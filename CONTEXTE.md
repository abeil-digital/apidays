# Apidays — Contexte projet

## Quoi

Outil de gestion des congés/RTT pour Abeil (bureau d'aménagement foncier), premier projet client
de Citizen D.

## Stack

- Frontend : **Next.js 16 (App Router)** + TypeScript strict + Tailwind CSS v4
- Backend : **Supabase** (Postgres + Data API) — schéma appliqué (voir
  [BASE-DE-DONNEES.md](BASE-DE-DONNEES.md) et [`supabase/schema.sql`](supabase/schema.sql)) et
  branché pour l'authentification, les demandes et l'utilisateur courant (`lib/data/*.repository.ts`
  parle à Supabase via `lib/supabase/client.ts` / `server.ts`) ; seul `soldes.repository.ts` reste
  mocké (`lib/data/mock/soldes.mock.ts`), les règles de calcul CP/RTT n'étant pas encore validées
  avec Abeil (voir [README.md](README.md), section "Couche données")
- Déploiement : Vercel, équipe `abeil-digital` (compte `abeil-it@proton.me`), projet `apidays`
  importé depuis GitHub (`abeil-digital/apidays`), déploiement auto sur push vers `main` — URL
  `https://apidays-seven.vercel.app`. **Un second projet Vercel existe** sur le compte personnel de
  Vincent (`vincent-mayols-projects/apidays`, URL `https://apidays-iota.vercel.app`) — **abandonné,
  décision du 24/07/2026 : on n'y touche plus** (pas de push `perso`, pas d'env vars, pas de
  redéploiement). Reste sur l'ancienne version mockée, pas supprimé par précaution mais plus le
  déploiement de référence — voir projet.md.
- Repo Git : remote `origin` → `https://github.com/abeil-digital/apidays.git` (remote `perso` en
  local, conservé, pointe vers l'ancien dépôt personnel `vincent-uzi/abeil-apidays`)
- CLI local (`.vercel/project.json`) lié au projet `abeil-digital/apidays` (celui qui compte) ;
  connexion CLI possible via `vercel login abeil-it@proton.me` (device flow — bien l'ouvrir dans une
  fenêtre où aucune session Vercel perso n'est déjà active, sinon le code s'attache au mauvais
  compte) puis `--scope abeil-digital`

## État actuel

**Fait** :

- Espace Salarié (Next.js) : Dashboard, Nouvelle demande, Historique — 3 routes fonctionnelles
- Couche données isolée (demandes, soldes, utilisateur) — demandes et utilisateur branchés sur
  Supabase, soldes reste mocké (règles de calcul non validées)
- Authentification réelle (Supabase Auth) : page `/connexion`, `proxy.ts` protège les routes de
  l'Espace Salarié et rafraîchit la session, déconnexion depuis le header. Routes salarié
  déplacées dans `app/(app)/` (groupe de routes avec l'AppShell), `/connexion` en dehors. Comptes
  de test Phase 0 (`test-salarie@abeil.local` etc.) — plus d'utilisateur unique mocké "Camille Rio"
  pour les demandes/utilisateur
- Header général (navigation niveau 1 Poser/Suivre/Paramétrer) — "Poser" fonctionnel pour tous,
  "Paramétrer" cliquable pour manager/admin uniquement (grisé pour salarié, comme "Suivre" pour
  tous), sous-nav dépendante de la section active (`niveau1.ts`/`tabs.ts`)
- Espace Delphine (premier écran) : Paramétrer > Gestion des utilisateurs
  (`/parametrer/utilisateurs`) — tableau (recherche, filtres rôle/statut/contrat, tri Nom/Date
  d'entrée, filtre "Actif" par défaut), fiche création/édition (`UtilisateurFichePage`), archivage
  avec confirmation. Accès route protégé pour les salariés dans `proxy.ts` ; la RLS fait le reste
  (admin voit/gère tout, manager voit son équipe sans pouvoir créer/modifier — policies
  insert/update admin uniquement)
- Design system : palette de catégories CP/RTT/CPT/mint centralisée dans `app/globals.css`
  (reprise d'une maquette "design system" fournie en artifact, pas encore la charte Abeil), cartes
  de solde en grille 4 colonnes (CP/RTT/CPT + CTA "Poser un congé"), badges de type circulaires,
  modale "Règles de congés" (RTT imposés + échéances, ouverte via "découvrir")
- `Badge` (`components/ui/Badge.tsx`) généralisé — tons success/warning/danger/neutral sur les
  tokens `@theme` (`--color-status-neutral-bg/-fg` ajouté). `StatusBadge` en est une fine couche
  (statuts de demande), sans rien casser côté appelants. Page de référence vivante
  **`/design-system`** (`components/design-system/DesignSystemPage.tsx`) : importe les vrais
  composants `components/ui/*` avec des props représentatives (palette, typographie, composants,
  états) — à tenir à jour à chaque évolution de composant plutôt qu'une doc externe séparée
- Tailles de texte arbitraires (`text-[...]`) remplacées par l'échelle Tailwind standard (titre de
  page → `text-2xl font-semibold`), convention documentée en commentaire dans `app/globals.css`
- `Input`/`Select`/`Textarea` (`components/ui/`) généralisés — fond blanc, liséré gris normal/rouge
  en erreur (prop `error`), disposition (`mt-2 w-full` ou largeur spécifique) laissée à l'appelant.
  Migré partout (connexion, nouvelle demande, fiche utilisateur, filtres de la liste utilisateurs)
- `Button` (`components/ui/Button.tsx`) généralisé — variantes primary/secondary/ghost, couleur
  `primary` passée de `bg-brand` (bleu) à `bg-mint` (vert). Les 6 boutons d'action de l'app qui
  utilisaient `bg-brand` à la main sont migrés ; les sélecteurs à état (toggle CP/RTT, filtres
  Historique) restent volontairement à part (pattern différent, pas encore consolidé)
- Fiche utilisateur : le champ "Contrat" scindé en deux — **Nature du contrat**
  (CDI/CDD/Alternance/Stage) et **Durée de travail** (préréglages 100/80/50/33,33 % + "Autre" en
  saisie libre). Tableau : colonne "Contrat" combinée (`CDI · Temps plein`, `CDD · 80%`). Champs DB
  `nature_contrat`/`taux_activite`, migration additive (24/07/2026) — voir "En cours" ci-dessous
  pour l'état transitoire de la base
- Bordures décoratives retirées des cartes/boutons (ombre légère ou fond à la place) ; le logo
  Abeil n'est plus affiché dans le header pour l'instant (texte seul)
- Dépôt transféré sur l'organisation GitHub `abeil-digital` (repo officiel)
- Schéma de base de données Supabase conçu (13 tables, RLS + policies par rôle
  salarié/manager/admin) — voir [BASE-DE-DONNEES.md](BASE-DE-DONNEES.md)
- Paramétrer > Congés & RTT (`/parametrer/conges-rtt`) : moteur de calcul générique des soldes
  CP/RTT, indépendant des règles Abeil (celles-ci restent dans une sous-section "Calendrier" à
  venir). Trois blocs : Congés Payés (période de référence, acquisition/mois, report,
  anticipation), Ancienneté (rattachée aux CP, plusieurs règles non cumulables, la plus favorable
  s'applique), RTT (mêmes champs que CP, sans ancienneté). Tables `regles_acquisition` (upsert par
  type d'absence) et `regles_anciennete` — code applicatif fait et vérifié en base réelle
  (`lib/data/reglesConges.repository.ts`, `hooks/useReglesConges.ts`,
  `components/parametrer/CongesRttPage.tsx`)
- Types d'absence étendus au-delà de CP/RTT (04/08/2026) : 4 nouveaux types sans compteur de solde
  (CSS, CE, RECUP, EVT_FAM — `types_absences.necessite_solde = false`) et logique "Congés
  anticipés" (CP + `is_anticipation`, consomme `solde_theorique`, badge "CPT"). Formulaire "Nouvelle
  demande" mis à jour (sélecteur 7 options) — migration appliquée et vérifiée en base réelle
  (demande CSS et CP anticipé posées et visibles dans l'Historique avec le bon badge)
- Paramétrer > Calendrier (`/parametrer/calendrier`, 05/08/2026) : demi-journées imposées (DJ
  imposées, nomenclature provisoire) et jours fériés, indépendant du solde RTT de Congés & RTT.
  Deux vues — "Année en cours" (lecture seule + correction ponctuelle d'une DJ mal saisie, semaine
  du 15 août calculée automatiquement) et "Paramétrage année à venir" (vendredis décochés par
  défaut, compteur configurable 16→0, ajout de dates libres hors vendredi, bouton "Valider" qui
  remplace intégralement les DJ de la période). Jours fériés légaux français calculés côté app avec
  Pâques mobile (`lib/joursFeries.ts`, algorithme de Meeus/Jones/Butcher), pré-remplissage sur
  demande + ajout manuel. Nombre cible et jour de semaine par défaut configurables en base
  (`parametrage_periode.nb_demi_journees_cible`/`jour_semaine_defaut`), pas figés en dur. Table
  `demi_journees_imposees` (renommée depuis `rtt_imposes`), type technique `DJ_IMPOSEE` dans
  `types_absences`, policy `jours_feries` élargie à manager+admin (auparavant admin seul) — testé
  de bout en bout en base réelle (calcul Pâques 2026/2027, pré-remplissage, ajout/suppression jour
  férié, sélection/validation/remise à zéro des DJ, persistance après rechargement)
- Pose de congé à la demi-journée (05/08/2026) : le concept existait en base
  (`demandes_conges.demi_debut`/`demi_fin`/`nb_demi_journees`) mais n'était pas branché côté
  application. Formulaire "Nouvelle demande" : sélecteur "Durée" (Journée entière/Matin/Après-midi)
  sur un jour unique, deux sélecteurs indépendants (début/fin) sur une plage. Décompte réel calculé
  côté serveur (`calculerNbDemiJournees`), Historique affiche le vrai nombre de jours
  (`demande.nbDemiJournees`) au lieu d'une estimation calendaire. Corrigé au passage : bug de
  fuseau horaire dans `calculerNbDemiJournees` (dates locales `new Date(iso+"T00:00:00")` décalées
  d'un jour en UTC+1/+2, désormais en UTC explicite comme `lib/joursFeries.ts`) — vérifié en base
  réelle (jour unique matin/après-midi, plage multi-jours avec demi-journée de fin)

**En cours / pas encore fait** :

- Intégration de la vraie charte graphique Abeil (`Charte-abeil/` reçu en local, contient PDF +
  nouveau pack de logos, **non commité** — voir Conventions)
- Exploitation de `documentation-conges/` (état préparatoire des salaires, modèles de demande
  CP/RTT) pour définir les vraies règles de calcul de solde — **non commité**, contient
  potentiellement des données de paie — bloque le branchement de `soldes.repository.ts`
- Espace Manager, suite de l'Espace Delphine (paramétrage RTT imposés, export paie, correction de
  solde), accès Comptable — **le récapitulatif mensuel n'existe pas encore en code** (aucune
  route/composant), donc son extension aux 4 nouveaux types sans compteur (CSS/CE/RECUP/EVT_FAM,
  04/08/2026) reste à faire quand cet écran sera construit, pas avant
- Consolidation design system identifiée par audit (24/07/2026) : `Badge`, `Button`,
  `Input`/`Select`/`Textarea` faits. Reste : mapping couleur CP/RTT/CPT dupliqué entre
  `SoldeCard.tsx` et `TypeBadge.tsx` (deux `Record` séparés pour la même correspondance) ; pas de
  composant "pill toggle" partagé (dupliqué entre `NouvelleDemandeForm` et `HistoriquePage`). La
  page `/design-system` sert d'aide visuelle pour cette consolidation au fur et à mesure.
- Nettoyage DB en attente : `type_contrat`/`taux_temps_partiel` (colonnes `utilisateurs`) sont
  dépréciées mais encore en base (migration additive volontaire du 24/07/2026, voir
  [BASE-DE-DONNEES.md](BASE-DE-DONNEES.md)) — à supprimer, et `nature_contrat` à passer en
  `not null` avec défaut, une fois tous les profils repassés en édition (les profils existants ont
  `nature_contrat = null`, affiché "Non précisé" dans le tableau)
- Écran Congés & RTT : vérifié de bout en bout en base réelle (bloc CP, ancienneté, bloc RTT,
  persistance après rechargement) — migration appliquée (tables + RLS + policies + grants).
  **Prochaine session : ajustements UI** sur cet écran

## Décisions prises

- Un seul compte de travail utilisé côté Abeil : `abeil-it@proton.me` (GitHub : `Abeil35`)
- Repo hébergé sous l'organisation GitHub `abeil-digital` ; Vincent (`vincent-uzi`) collaborateur
  avec accès _Write_
- Projet Supabase créé : organisation `abeil-digital`, projet `Apidays`, région West EU (Ireland),
  URL `https://eaizbjovkrdjmujxovvs.supabase.co` — clé publishable utilisée côté client
- Variables d'environnement `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` :
  présentes dans `.env.local` (non commité) et poussées sur le projet Vercel `abeil-digital/apidays`
  (Production/Preview/Development) — les anciennes `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` qui
  traînaient dessus ont été supprimées
- Aucune couleur en dur dans les composants : tout passe par les tokens Tailwind v4 dans
  `app/globals.css` (voir README.md, section "Thème & design tokens")

## Conventions

- **Couche données** : un repository dans `lib/data/`, un hook dans `hooks/`, jamais d'accès
  direct aux données mockées depuis un composant. Détail complet dans
  [README.md](README.md#couche-données--convention-à-respecter-sur-les-prochaines-fonctionnalités).
- **Composants** : `components/<écran>/` pour les composants spécifiques à un écran,
  `components/ui/` pour les primitives réutilisables, `components/layout/` pour la coquille
  applicative (header, nav).
- **Documents de référence hors code** (`Charte-abeil/`, `documentation-conges/`) : toujours
  `.gitignore`, jamais commités — le second peut contenir des données de paie réelles.
- **TypeScript strict**, ESLint + Prettier (`prettier-plugin-tailwindcss`) — `npm run lint`,
  `npm run typecheck`, `npm run format` avant tout commit.

## À faire

1. Intégrer la vraie charte graphique Abeil (`Charte-abeil/`) — remplacer la palette de travail et
   le logo placeholder
2. Dépouiller `documentation-conges/` pour définir les règles de calcul CP/RTT réelles (compléter
   les points encore ouverts du schéma, voir [BASE-DE-DONNEES.md](BASE-DE-DONNEES.md)), puis
   brancher `soldes.repository.ts`
3. Suite de l'Espace Delphine (paramétrage RTT imposés, export paie, correction de solde), puis
   Espace Manager
