# Apidays — Contexte projet

## Quoi

Outil de gestion des congés/RTT pour Abeil (bureau d'aménagement foncier), premier projet client
de Citizen D.

## Stack

- Frontend : **Next.js 16 (App Router)** + TypeScript strict + Tailwind CSS v4
- Backend : **Supabase** (Postgres + Data API) — schéma appliqué (voir
  [BASE-DE-DONNEES.md](BASE-DE-DONNEES.md) et [`supabase/schema.sql`](supabase/schema.sql)) et
  branché pour l'authentification, les demandes, l'utilisateur courant et les soldes
  (`lib/data/*.repository.ts` parle à Supabase via `lib/supabase/client.ts` / `server.ts`) ;
  `soldes.repository.ts` calcule le solde CP/RTT/CPA à la volée depuis
  `regles_acquisition`/`regles_anciennete` (13/08/2026, voir "État actuel" plus bas et
  [README.md](README.md), section "Couche données")
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
- Couche données isolée (demandes, soldes, utilisateur) — toutes branchées sur Supabase, soldes
  calculé en réel depuis les règles d'acquisition/ancienneté (13/08/2026)
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
- Schéma de base de données Supabase conçu (14 tables, RLS + policies par rôle
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
  Deux vues — "Année en cours" (ajout/suppression ponctuels via un mode édition, semaine du 15 août
  calculée automatiquement — voir plus bas) et "Paramétrage année à venir" (vendredis décochés par
  défaut, compteur configurable 16→0, ajout de dates libres hors vendredi, bouton "Valider" qui
  remplace intégralement les DJ de la période). Jours fériés légaux français calculés côté app avec
  Pâques mobile (`lib/joursFeries.ts`, algorithme de Meeus/Jones/Butcher), pré-remplissage sur
  demande + ajout manuel. Nombre cible et jour de semaine par défaut configurables en base
  (`parametrage_periode.nb_demi_journees_cible`/`jour_semaine_defaut`), pas figés en dur. Table
  `demi_journees_imposees` (renommée depuis `rtt_imposes`), type technique `DJ_IMPOSEE` dans
  `types_absences`, policy `jours_feries` élargie à manager+admin (auparavant admin seul) — testé
  de bout en bout en base réelle (calcul Pâques 2026/2027, pré-remplissage, ajout/suppression jour
  férié, sélection/validation/remise à zéro des DJ, persistance après rechargement)
- Vue "Année en cours" du Calendrier restructurée en dashboard (05/08/2026), inspirée de l'Accueil
  "Poser" : layout 2/3 (DJ imposées) — 1/3 (congés imposés + jours fériés en sidebar, chaque entrée
  en carte indépendante à coins carrés avec espacement). Badges `TypeBadge` "DJI" (`--color-dji`,
  violet) et "CPI" (à l'origine même couleur que CP — voir entrée "Échange de couleurs CPI/RECUP"
  du 15/08/2026, CPI a depuis son propre token)
- DJ imposées en cartes (05/08/2026) : grille 5 cartes/ligne (`bg-surface-card rounded-xl
shadow-sm`, style `SoldeCard`) remplaçant la liste `ListCard` initiale — jour de la semaine en
  toutes lettres + date en mois complet (`text-base`), durée "0,5j" (`text-ink-500 text-sm`),
  pastille Matin/A. Midi. La correction inline d'une DJ mal saisie est retirée
  (`modifierDj`/`modifierDjImposee` supprimés du hook et du repository, plus d'usage). `TypeBadge`
  gagne une **variante `outline`** (`variant="outline"`, prop `label` pour un texte personnalisé) —
  liséré + texte de la couleur du code, fond transparent, même palette que la variante cercle par
  défaut ; documentée dans `/design-system`
- Mode édition des DJ imposées (`BlocDjImposees`) : les icônes Supprimer sont masquées par défaut,
  révélées par un lien "Modifier" aligné à droite du titre de section (bascule "Terminer"). En mode
  édition, une carte "Ajouter une demi-journée" (style `bg-mint`, identique au bouton "Poser un
  congé" de l'Accueil) s'ajoute en dernière position de la grille, même gabarit que les autres
  cartes (stretch de grille) ; cliquer dessus la remplace par un formulaire inline (date + Select
  Matin/Après-midi). Nouvelle fonction repository `ajouterDjImposee` (insertion unitaire, à la
  différence de `remplacerDjImposees` qui fige toute la liste depuis "Paramétrage année à venir") —
  testé en base réelle (ajout, persistance après rechargement, suppression)
- Congés imposés (période du Manager, ex. semaine du 15 août imposée) : section "Congés imposés"
  dans la colonne de droite de la vue "Année en cours" — badge "CPI", période "Du J mois au J mois",
  nombre de jours calendaires, ajout via lien "+ Ajouter congés imposés" (formulaire inline
  début/fin). Table `conges_imposes` (`parametrage_periode_id`, `type_absence_id`, `date_debut`,
  `date_fin`), type technique `CP_IMPOSE` dans `types_absences` (`necessite_solde = false`),
  indépendant du solde CP calculé dans Congés & RTT — mêmes policies RLS que `demi_journees_imposees`
  (lecture authentifiée, écriture manager/admin). Le `parametrage_periode` de l'année est créé à la
  volée (valeurs par défaut 16 DJ / vendredi) si l'ajout d'un congé imposé précède toute
  validation de la vue "Paramétrage année à venir" — testé en base réelle (ajout, persistance après
  rechargement, suppression)
- **Calendrier 2 (`/parametrer/calendrier2`, scénarisation, 06/08/2026)** : vue calendrier
  synthétique — 12 `MiniCalendrier` (grille fluide `[grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]`,
  `max-w-[900px]` pour plafonner à 4 colonnes même sur grand écran, jamais de resize continu d'une
  carte — le nombre de colonnes s'adapte, pas leur taille) + une légende (`TypeBadge` CPI/DJI/FERIE).
  Nav de second niveau sous Paramétrer, toggle séparé de la vue "Calendrier" existante. Section
  encore en scénarisation (pas de vérification systématique passée dessus par consigne explicite),
  mais son composant central est promu design system car destiné à être réutilisé :
  - **`components/ui/MiniCalendrier.tsx`** — composant DS pur/présentationnel (aucune notion
    DJI/CPI/férié dedans, tout passe par les props `tipoDuJour`/`estEnGroupe`), documenté dans
    `/design-system` avec des données figées (pas de hook). Règles de gestion (détail complet en
    JSDoc en tête du fichier — à lire avant toute réutilisation) :
    - Grille L-V (5 colonnes), week-ends jamais affichés, y compris dans le décompte d'une période.
    - Un jour = une pastille max ; en cas de conflit de type le même jour, l'appelant tranche (dans
      Calendrier : priorité férié > congé imposé (CPI) > demi-journée imposée (DJI), voir
      `VueCalendrierGrille.tipoDuJour` dans `CalendrierPage.tsx`).
    - Jours consécutifs → barre continue ("pilule") ; l'arrondi ne marque que les extrémités RÉELLES
      de la période (dates calendaires, week-ends inclus), jamais la fin d'une ligne d'affichage —
      un vendredi qui se prolonge le lundi suivant reste écarré des deux côtés. La continuité est
      décidée par l'appelant via `estEnGroupe` (ex. un jour férié à l'intérieur d'un congé n'interrompt
      pas la période même s'il change de couleur) ; un jour sans pastille (travaillé) interrompt
      toujours le groupe.
    - **Anti-seam** : les jours consécutifs de même groupe ET même apparence exacte sont fusionnés
      en un seul élément DOM (`grid-column: span N`, sous-grille interne pour aligner les chiffres)
      plutôt que plusieurs `<span>` collés — élimine les liserés de sous-pixel entre jours de même
      couleur. Un changement de couleur (ex. férié au milieu d'un congé) reste un élément séparé
      (frontière réelle, pas un artefact) mais garde l'arrondi de groupe.
    - Survol d'un jour quelconque de la période → toute la période en `brightness-110` (état porté
      par un `groupeId` commun, pas par jour) ; pas de scale/liseré au survol, ça casse la
      continuité visuelle d'une barre groupée (essayé puis retiré).
    - Demi-journée (variante "moitié") : gauche = matin, droite = après-midi, moitié pleine = posée,
      l'autre à 45 % d'alpha (`color-mix`) — jamais fusionnée avec un voisin.
    - **Cas à la marge — variante "partage"** : un jour couvert à la fois par un congé imposé (CPI,
      jour plein) ET une DJI (demi-journée) ne doit pas faire disparaître silencieusement la DJI
      derrière le CPI. Le jour se partage alors en deux couleurs PLEINES (pas d'alpha, contrairement
      à "moitié") — chaque type sur sa vraie moitié réelle (matin/après-midi). Distinct de "moitié"
      qui n'a qu'une seule couleur avec sa version alpha en contrepoint.
  - Nouveau token couleur `--color-ferie` (or) et badge `TypeBadge code="FERIE"` (label "FE").
- **Popin "Congés imposés" (06/08/2026, layout initial — voir refonte 07/08/2026 plus bas)**,
  accessible depuis la légende de Calendrier 2 (carte CPI, icône `+`) — `ModalCongesImposes` dans
  `CalendrierPage.tsx`. `Modal` (`components/ui/Modal.tsx`) généralisé : `title` accepte un
  `ReactNode` (plus seulement `string`), header recentré (bouton fermer sorti du flux en absolu),
  `className` pour élargir le panneau (`max-w-md` par défaut ailleurs).
  - **`components/ui/DatePicker.tsx`** (nouveau composant DS) : remplace `<input type="date">` pour
    les champs Du/Au — `react-day-picker` avec un `disabled` prop qui grise/bloque directement les
    week-ends et jours fériés DANS le calendrier (le natif ne permet pas de styler des jours
    précis). Reste un vrai champ texte tapable (jj/mm/aaaa) en plus du clic calendrier — une date
    tapée n'est commise que si elle est complète, valide, et non désactivée. Locale FR, accent
    `--color-mint`.
  - **"soit N jours" = jours ouvrés, pas calendaires** : `joursOuvres()` compte L-V hors jours
    fériés, et déduit 0,5 pour chaque jour ouvré de la période qui a déjà une DJI posée (une DJI
    n'est pas disponible en entier). Même logique côté jour unique.
  - Alternative retenue pour ce besoin (weekends/fériés non sélectionnables) : `react-day-picker` +
    predicate `disabled`, plutôt qu'un calendrier maison ou juste une validation après coup — voir
    discussion dans l'historique de session si le sujet revient (bénéfices/risques de réutiliser
    cette brique pour `NouvelleDemandeForm` plus tard : logique de jour dispo oui, composants
    visuels tels quels non — DJI est une demi-journée, pas compatible avec le modèle `disabled`
    tout-ou-rien, et `NouvelleDemandeForm` a déjà sa propre UI demi-journée).
  - **Bug corrigé** : `supprimerCongeImpose`/`supprimerDjImposee`/`supprimerJourFerie`/
    `supprimerRegleAnciennete` utilisaient `.delete().select().single()`, qui exige exactement une
    ligne renvoyée et lève une erreur si la suppression ne trouve rien (double-clic, état local pas
    encore resynchronisé) — alors que la suppression a réellement eu lieu. Retiré le
    `.select().single()` dans les 4 fonctions ; un delete qui ne trouve rien n'est plus une erreur.
    Vérifié avec un double-clic volontaire en base réelle.
- Pose de congé à la demi-journée (05/08/2026) : le concept existait en base
  (`demandes_conges.demi_debut`/`demi_fin`/`nb_demi_journees`) mais n'était pas branché côté
  application. Formulaire "Nouvelle demande" : sélecteur "Durée" (Journée entière/Matin/Après-midi)
  sur un jour unique, deux sélecteurs indépendants (début/fin) sur une plage. Décompte réel calculé
  côté serveur (`calculerNbDemiJournees`), Historique affiche le vrai nombre de jours
  (`demande.nbDemiJournees`) au lieu d'une estimation calendaire. Corrigé au passage : bug de
  fuseau horaire dans `calculerNbDemiJournees` (dates locales `new Date(iso+"T00:00:00")` décalées
  d'un jour en UTC+1/+2, désormais en UTC explicite comme `lib/joursFeries.ts`) — vérifié en base
  réelle (jour unique matin/après-midi, plage multi-jours avec demi-journée de fin)
- **Popin "Demi-journées imposées" (07/08/2026)**, `ModalDjImposees` dans `CalendrierPage.tsx`,
  ouverte depuis la légende de Calendrier 2 (carte DJI, icône `+`) — devient le gabarit de
  référence repris ensuite par la popin CPI (voir plus bas). Deux colonnes de largeur fixe (comme
  DJI, popin `max-w-4xl`) : à gauche colonne "Sélection" (`bg-surface-app`) avec onglets
  Vendredis/Autre date ; à droite (`md:w-80`) le référentiel des DJI déjà posées, compteur
  `(N/16)`. Composants DS introduits à cette occasion :
  - **`SelectPille`** (local à `CalendrierPage.tsx` pour l'instant, candidat DS) : select stylé en
    pilule (fond + coins arrondis, chevron bas), remplace `SelectSouligne` partout (CPI compris,
    `SelectSouligne` supprimé). Prend `disabled` en compte pour un rendu grisé (ligne déjà posée).
  - **Hover → aperçu calendrier en contexte** : survoler une ligne déjà posée affiche un
    `MiniCalendrier` du mois concerné en `position: fixed`, ancré via `getBoundingClientRect()`
    capturé **dans le handler d'événement** (`onMouseEnter`), jamais recalculé en lisant un `ref`
    pendant le rendu — cette dernière approche donne des coordonnées incohérentes dans ce
    environnement de preview (position figée/mauvaise au premier hover). Toujours calé au même
    endroit (ancre = le conteneur de la liste, pas la ligne survolée).
  - Snippet cliqué sur le calendrier principal (`SnippetDji`) : suppression uniquement, pas
    d'édition de créneau depuis le calendrier (le créneau se change dans la popin).
- **Popin "Jours fériés" (07/08/2026)**, `ModalJoursFeries` — sur le même gabarit référentiel (liste
  seule, pas d'ajout/suppression manuels : les 11 fériés légaux sont fixes). Seule vraie décision
  annuelle : le **lundi de Pentecôte** (journée de solidarité), avec 2 boutons radio
  Travaillé/Férié. Persisté **sans nouvelle colonne** : "travaillée" = la ligne correspondante est
  simplement absente de `jours_feries` (réutilise `ajouterFerie`/`supprimerFerie`) ; la liste
  affichée s'appuie sur `joursFeriesLegaux(annee)` (référentiel fixe) et pas sur les lignes
  réellement en base, pour que la ligne Pentecôte reste visible (grisée, badge `Badge tone="warning"`
  "Travaillé") même absente de la DB. `Badge` (`components/ui/Badge.tsx`) gagne un `className`
  optionnel pour ce besoin.
- Clic sur une pastille du calendrier principal → snippet contextuel selon le type, priorité
  identique à l'affichage (férié > CPI > DJI) : `SnippetConge` (Modifier/Supprimer),
  `SnippetDji` (Supprimer), `SnippetFerie` (lecture seule, aucune action — un jour férié légal ne
  s'édite pas depuis le calendrier).
- **Popin "Congés imposés" refondue (07/08/2026)** sur le gabarit DJI ci-dessus (même tailles :
  popin `max-w-4xl`, colonne "Sélection" `md:w-64`, liste `md:w-80`) — `ModalCongesImposes`
  entièrement réécrite :
  - Colonne "Sélection" (gauche, `bg-surface-app`) : Du/Au empilés verticalement, chacun avec son
    `DatePicker` + `SelectPille` (fond `bg-mint-tint` autour du bloc, comme l'onglet "Autre date"
    de DJI) ; un seul jour (Du = Au) → un seul sélecteur (celui du bas), 3 options
    Journée/Matin/A. midi qui pilotent `demiDebut`+`demiFin` ensemble (évite la combinaison
    contradictoire d'un jour à la fois "après-midi au début" et "matin à la fin"). Bouton
    "+ Ajouter" (icône `PlusCircle`).
  - Liste (droite, "le cœur") : cliquer une ligne la charge en édition dans la colonne de gauche
    (surlignage `bg-mint-tint`, "Annuler"/"Supprimer" affichés) ; survol → aperçu calendrier en
    contexte comme DJI. Deux gabarits de ligne : un jour unique reprend exactement le gabarit DJI
    (encart jour + date + `SelectPille` actif Journée/Matin/A. midi + suppression) ; une **période**
    affiche un "gros composant" — deux mini-snippets Du/Au empilés et reliés par un connecteur
    vertical (`absolute` entre les deux encarts jour), chacun avec son propre `SelectPille`
    (Journée/A. midi au Du, Journée/Matin au Au), nombre de jours en sous-titre sous la date de fin,
    une seule corbeille pour toute la période. La modale ne se ferme plus après ajout/modification
    (seul "Fermer"/la croix le fait), comme DJI.
  - `Modal` gagne une prop **`align`** (`"center"` par défaut inchangé partout ailleurs, `"top"`
    pour DJI et CPI) — fixe le panneau à une position stable en haut de l'écran, indépendante de la
    hauteur du contenu (une liste plus ou moins longue ne doit pas déplacer visuellement la popin
    d'une ouverture à l'autre).
  - **CPI posable à la demi-journée, avec vraie persistance (07/08/2026)** : colonnes
    `demi_debut`/`demi_fin` (`demi_journee` enum, comme `demandes`/`demi_journees_imposees`)
    ajoutées à `conges_imposes` — migration lancée manuellement par Vincent dans le SQL editor
    Supabase (pas d'accès DB admin depuis cet environnement, seule la clé anon est dans
    `.env.local`), `supabase/schema.sql` mis à jour en conséquence. `CongeImpose`/`CongeImposeInput`
    (`lib/types.ts`) et `calendrier.repository.ts` étendus. Vérifié en base réelle (ajout à la
    demi-journée, persistance après rechargement complet, changement de créneau depuis la liste).
- **CPI non modifiable une fois posé (08/08/2026)** : décision produit — les DATES d'une période
  déjà créée ne sont plus éditables (plus de clic-pour-charger-en-édition, plus de bouton
  "Modifier" dans `SnippetConge`/`ModalCongesImposes` ; seule action restante sur une ligne :
  Supprimer). Le CRÉNEAU (demi-journée) reste ajustable directement via son `SelectPille` dans la
  liste (delete+recreate en interne, avec gestion d'erreur) — c'est la seule édition encore permise.
- **Promotion DS + documentation `/design-system` (09/08/2026)** : `SelectPille` et `JourBadge`
  promus de code local à `components/ui/` (import réel dans la page DS, jamais recréé
  visuellement). Nouvelles sections DS : popins référentielles DJI/CPI/Fériés, transitions, états
  hover.
- **Onglets année + compteurs de volume + publication (10/08/2026), `Calendrier2Page`/
  `VueCalendrierGrille`** :
  - Deux onglets année sur `/parametrer/calendrier2` : année en cours (icône `Eye` sur ses cartes
    légende, plus de `+` — cohérent avec "déjà live") et année N+1 "Brouillon" (icône `+`, cartes
    éditables).
  - `datesDuJourDeLaSemaine` (`lib/joursFeries.ts`) exclut désormais les jours fériés légaux — un
    1er janvier tombant un vendredi n'est plus proposé/coché par défaut comme DJI (bug trouvé en
    testant le paramétrage 2027, où le 1/01/2027 est un vendredi).
  - Cartes légende CPI/DJI/Fériés : compteur de volume posé (pas de cible/jauge, juste ce qui existe
    — `X jours`/`X demi-journées`/`X jours`, en toutes lettres, pastille `bg-surface-app` sous le
    libellé).
  - Colonne `parametrage_periode.valide_le` (timestamptz, nullable — migration manuelle en base
    réelle comme d'habitude) : `null` = brouillon, une date = publié. Bouton "Publier" (visible
    uniquement sur l'année non live, quand pas encore publié) + lien texte "Annuler la publication"
    (une fois publié) — `publierParametragePeriode`/`depublierParametragePeriode` dans
    `calendrier.repository.ts`, exposés par `useCalendrier`. **Le flag n'est pour l'instant lu par
    aucun écran salarié — voir "Zones grises" ci-dessous.**
  - Bandeau d'alerte (`bg-status-warning-bg`/`text-status-warning-fg`, pleine largeur, sous les
    onglets année) : affiché uniquement en décembre (`new Date().getMonth() === 11`), incite à
    paramétrer l'année suivante avant la fin de l'année.
  - **Pastilles de volume couleur + blocage de publication** : `classesPastilleVolume(valeur, cible)`
    — gris (0), orange (entamé, sous la cible), vert (cible atteinte pile), **rouge** (cible
    dépassée). Cible CPI fixe (`CIBLE_JOURS_CPI = 5`, constante en dur, pas de champ éditable —
    règle d'entreprise supposée stable) ; cible DJI = `parametrage.nbDemiJourneesCible` (déjà
    configurable, défaut 16). Le bouton "Publier" n'est actionnable que si CPI et DJI sont
    **exactement** à leur cible (`===`, pas `>=`) et qu'au moins un férié existe ; sinon il reste en
    variant `secondary` (gris/neutre, pas juste une opacité réduite sur le bouton vert — lecture plus
    claire de l'état "pas prêt").
  - **Mêmes pastilles reprises dans les 3 popins** (`ModalCongesImposes`/`ModalDjImposees`/
    `ModalJoursFeries`) : titre du haut de la popin CPI remplacé par la pastille `X/5 jours` ;
    en-tête de liste DJI ("Demi-journées imposées (N/16)") remplacé par la pastille `X/16
demi-journées` ; popin Fériés — pastille simple `X jours` (pas de fraction/cible, "remplis par
    défaut") posée sur la même ligne que le sélecteur Lundi de Pentecôte, poussé à droite.
  - **Onglet "Vendredis" de la popin DJI** : survoler une ligne déjà cochée (coche verte) la
    transforme en poubelle rouge (`supprimerDate` — supprime toutes les demi-journées DJI de cette
    date, donc 1 ou 2 enregistrements si "Journée" complète).
  - **Sélecteur de créneau de la liste "cœur" DJI** gagne l'option "Journée" (comme les autres
    `SelectPille` de l'app) : la choisir AJOUTE la demi-journée manquante du même jour plutôt que de
    remplacer la ligne courante (les deux demi-journées restent deux lignes distinctes dans la
    liste, `changerCreneau` mis à jour en conséquence).

**Important — à garder en tête pour plus tard** : le système de paramétrage (CPI/DJI/Fériés,
publication) est amené à avoir un **impact direct sur le dashboard collaborateur** une fois branché
(cf. le flag `valide_le` actuellement lu par aucun écran salarié, voir "Zones grises" ci-dessous) —
quelle que soit la logique retenue pour la validation/publication, elle doit rester compatible avec cet
usage futur, pas juste avec l'écran admin actuel.

**Idée non développée (10/08/2026)** : déplacer le pilotage du volume cible CPI (aujourd'hui la
constante `CIBLE_JOURS_CPI`, non éditable) et DJI (déjà éditable via `nbDemiJourneesCible`) dans
Paramétrer > Congés & RTT (`/parametrer/conges-rtt`) plutôt que (ou en plus de) Calendrier 2 — ce
serait plus cohérent avec le reste du paramétrage de règles d'acquisition/quotas qui vit déjà sur cet
écran. Pas encore développé, juste noté pour la suite.

**Zones grises à trancher — système temporel et de publication du Calendrier** (10/08/2026, notées
suite à une question de Vincent sur comment tester tout ça) :

- Le flag `valide_le` (publié/brouillon) ne change actuellement **rien** pour les salariés — aucun
  écran (Poser, Historique, Congés & RTT) ne le consulte. "Publier" est pour l'instant un état
  purement déclaratif/visuel côté admin, pas encore une vraie porte d'accès.
- Aucune règle ne détermine QUAND l'onglet "année N+1 - Brouillon" doit apparaître (aujourd'hui :
  toujours visible, à côté de l'année en cours, sans condition de date).
- Pas de mécanisme pour créer une 3e année (N+2) le moment venu — `parametrage_periode` se crée
  implicitement au premier ajout DJI/CPI/férié pour une année donnée, jamais par une action
  explicite "créer l'année suivante".
- Pas de relance/notification si le paramétrage N+1 n'est pas publié à l'approche du 01/01 (le
  bandeau de décembre est un premier pas visuel, pas une vraie relance).
- **Tester ces comportements conditionnés par la date est aujourd'hui bricolé** (patch de `Date` en
  console navigateur, non accessible à Delphine). Piste retenue mais pas développée : centraliser
  tous les appels `new Date()` de ces écrans dans un point unique (`useAujourdhui()`), qui lit un
  paramètre d'URL `?date=AAAA-MM-JJ` en environnement non-production uniquement (sinon la vraie date
  système) — permettrait de visiter `/parametrer/calendrier2?date=2026-12-15` pour voir l'état
  "décembre" sans rien modifier de son horloge.

**Debug / dette technique** :

- **`SelectPille` (`components/ui/SelectPille.tsx`) — halo de focus non résolu (10/08/2026)** :
  au clic/focus clavier sur le `<select>`, un halo bleu/mauve apparaît autour de la pilule
  (visible sur les sélecteurs de créneau DJI/CPI). Tentative de fix : `outline-none` +
  `focus-visible:ring-2 focus-visible:ring-mint` posés sur le `<select>` — n'a **pas** résolu le
  problème (confirmé par Vincent après vérification visuelle réelle, malgré une classe CSS
  correcte à l'inspection). Cause probable non confirmée : le halo peut venir du navigateur/OS
  lui-même (rendu natif du `<select>`, hors contrôle CSS complet — voir aussi la remarque sur le
  style natif de la LISTE déroulante elle-même, non stylable). À reprendre avec un vrai test
  visuel humain (l'environnement d'agent automatisé ne reproduit pas de façon fiable l'état
  `:focus-visible` d'un `<select>` natif, donc la vérification IA seule ne suffit pas ici).

**Ancien écran Calendrier supprimé (10/08/2026)** : la route `/parametrer/calendrier` et tout le
code exclusif à cet écran ont été retirés (`app/(app)/parametrer/calendrier/page.tsx`,
`VueAnneeEnCours`, `VueParametrageAnneeAVenir`, `FormulaireParametrageAnneeAVenir`,
`BlocJoursFeries`, `BlocCongesImposes`, `CongeImposeRow`, `BlocDjImposees`, `DjImposeeCard`, et
l'export `CalendrierPage` dans `CalendrierPage.tsx`), ainsi que le code devenu mort qu'il était seul
à utiliser : `validerParametrage` (`hooks/useCalendrier.ts`) et `remplacerDjImposees`
(`lib/data/calendrier.repository.ts`). **Calendrier 2 est désormais LE seul écran Calendrier** —
route et nom de fichier restent `calendrier2`/`Calendrier2Page` pour l'instant (renommage pas fait,
voir Backlog.md si on veut nettoyer ça un jour), mais le libellé nav ("Calendrier 2" → "Calendrier"
dans `components/layout/tabs.ts`) et le titre de la page ("Calendrier 2 (scénarisation)" →
"Calendrier") ont été mis à jour pour ne plus laisser penser qu'il s'agit d'une scénarisation
temporaire.

**Accueil 2 (scénarisation, 11/08/2026)** — duplicata de l'accueil collaborateur
(`components/dashboard/Dashboard2Page.tsx`, route `/accueil2`) pour itérer sur l'évolution de la
page "Poser" sans toucher à l'écran en prod (même logique que Calendrier 2 en son temps) :

- Cartes solde (`SoldeCard`) réutilisent maintenant le vrai `TypeBadge` (variant cercle) au lieu
  d'un simple point coloré ; libellé texte redondant sous le badge retiré. Nouvel export
  `classeFondTypeBadge`/`classeFondAttenueTypeBadge` dans `TypeBadge.tsx` pour réutiliser la
  palette couleur hors du badge (pastilles de calendrier) — les classes d'opacité atténuée
  (`bg-cp/50`, etc.) sont écrites en toutes lettres exprès : une classe Tailwind construite par
  concaténation à l'exécution (`` `${classe}/50` ``) n'est jamais générée par le compilateur, qui ne
  scanne que les chaînes littérales du code source (bug rencontré et corrigé : pastilles
  invisibles).
- Renommage CPT → **CPA** (Congés Payés en Acquisition) sur toute l'app — plus fidèle à ce que
  représente ce solde ("En cours d'acquisition, à poser à partir de..."). Touche
  `TypeBadge.tsx`, `SoldeCard.tsx`, `app/globals.css` (`--color-cpa`), `lib/types.ts`
  (`Soldes.cpa`), le mock, `RequestRow`/`NouvelleDemandeForm`/`DesignSystemPage`.
- Bloc "Demandes en cours"/"Prochains congés" remplacé par une grille de 12 `MiniCalendrier`
  (même gabarit fluide que Paramétrer > Calendrier —
  `max-w-[900px] [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]`, 4×3 sur desktop),
  réordonnée pour commencer par le mois en cours, + colonne latérale "En attente de validation"
  (réutilise `RequestList`/`RequestRow`, juste réduite en largeur). Pas de légende pour l'instant.
- Le calendrier affiche deux sources fusionnées avec une priorité d'affichage : **demande
  personnelle du collaborateur** (couleur pleine si validée, atténuée à 50% si en attente) >
  **jours communs** (Fériés > CPI > DJI, DJI en variante `moitie` matin/après-midi comme sur
  Calendrier admin). Un chevauchement demande perso / CPI-DJI reste un cas marginal, non géré
  finement ici (voir item Backlog "scan de chevauchement CPI/DJI"). Clic sur un jour avec demande
  perso → popover détail (`SnippetDemande`, nouveau composant local, pas encore promu DS).
- Règle de visibilité des jours communs par année : **Fériés toujours visibles**, même sur une
  année pas encore publiée (fixes, connus à l'avance). **CPI/DJI de l'année EN COURS toujours
  visibles** (déjà réels/en vigueur) ; ceux de l'**année À VENIR** seulement si publiée
  (`parametrage_periode.valide_le`). Bug trouvé et corrigé en cours de route : l'année en cours n'a
  jamais de bouton "Publier" (n'apparaît que pour `!estAnneeLive`), donc son `valide_le` ne
  serait jamais renseigné — la condition de visibilité CPI/DJI doit donc explicitement
  court-circuiter la vérification de publication quand `annee === new Date().getFullYear()`.

**Fériés auto-seedés en base (11/08/2026)** — le concept "il faut cliquer Pré-remplir puis espérer
que ce soit fait pour chaque année" s'est révélé fragile : en testant Accueil 2, le 1er janvier
2027 n'apparaissait pas comme férié — la popin Fériés de Calendrier 2 affiche TOUJOURS les 11
fériés légaux de référence (`joursFeriesLegaux(annee)`) qu'ils soient réellement en base ou non
(seul le cas Pentecôte est vérifié contre la vraie donnée), ce qui masquait le fait que la ligne
"1er janvier" n'avait en réalité jamais été insérée pour 2027 (résidu des tests de publication
plus tôt dans la session). Décision : les 10 fériés à date fixe (tout sauf le lundi de Pentecôte)
sont désormais **auto-seedés à chaque chargement d'une année** dans `useCalendrier`
(`hooks/useCalendrier.ts`, fonction `feriesFixes` + `preRemplirJoursFeriesLegaux` appelé au lieu
d'un simple `fetchJoursFeries` dans l'effet de chargement) — idempotent (n'insère que ce qui
manque), plus besoin de l'action manuelle "Pré-remplir". Le lundi de Pentecôte reste volontairement
exclu de l'auto-seed : c'est la seule vraie décision annuelle (Travaillé/Férié), on ne veut jamais
écraser un choix déjà fait ni le présumer. Vérifié : 2027 passe de 10 à 11 fériés en base après le
fix, sans toucher au choix Pentecôte existant. La popin Fériés (référentiel affiché vs données
réelles) reste elle-même potentiellement trompeuse pour Delphine — voir item Backlog dédié.

**Espace Manager — `/suivre` (13/08/2026)** : première version posée. "Demandes à traiter" (liste
équipe des demandes en attente, Approuver en un clic / Refuser via popin avec commentaire
facultatif — `demandes.repository.ts` : `fetchDemandesEquipe`, `validerDemande`, `refuserDemande`)

- "Salariés" (avatar, nom, soldes CP/RTT/CPA réels par salarié — voir entrée "Soldes CP/RTT/CPA
  calculés en réel" plus bas, ajoutée après coup dans la même session). Nav "Suivre" activée dans
  `niveau1.ts`/`tabs.ts`,
  protégée dans `proxy.ts` comme `/parametrer`. Notifications email, relance J+nn, sync agenda Proton
  : hors scope, à reprendre une fois le service email choisi (voir Backlog.md).

Bug trouvé et corrigé en construisant cet écran : `fetchDemandes()` (Accueil/Historique) ne
filtrait pas explicitement par `utilisateur_id`, comptant sur la RLS seule — un manager récupérait
donc ses propres demandes ET celles de toute l'entreprise mélangées, affichées comme si elles
étaient siennes sur son propre Accueil. Fix : filtre explicite `.eq("utilisateur_id", ...)`.

**"Manager" = directeur, autorité globale (13/08/2026)** : décision produit clarifiée en
construisant `/suivre` — les comptes `manager` sont les directeurs de l'entreprise, hiérarchiquement
au-dessus de tout, sans équipe spécifique : ils ont autorité sur **tous** les salariés, pas un
sous-ensemble rattaché. Les policies RLS scopées via `manager_salaries`/`is_manager_of()` (sur
`utilisateurs`, `soldes`, `demandes_conges`) ont donc été remplacées par un accès manager = tout le
monde en lecture (+ validation des demandes), à l'instar de l'admin. `manager_salaries` et
`is_manager_of()` restent en base, inutilisées, au cas où une délégation plus fine reviendrait un
jour — voir [BASE-DE-DONNEES.md](BASE-DE-DONNEES.md). Migration SQL fournie à faire tourner par
l'utilisateur dans l'éditeur SQL Supabase (comme d'habitude, pas d'exécution automatique par
l'agent).

**Soldes CP/RTT/CPA calculés en réel (13/08/2026)** : `soldes.repository.ts` n'est plus mocké.
Calcul à la volée (pas de job planifié, pas de lecture/écriture de la table `soldes` elle-même) à
partir de `regles_acquisition`/`regles_anciennete` (déjà réels, Paramétrer > Congés & RTT) et des
demandes déjà décidées — formule et arbitrages actés en discussion avec Vincent (pas via
`documentation-conges/`, toujours non dépouillé) :

- **CP** : capital fixe pour la période en cours = accrual complet de la période **précédente**
  (12 mois × taux mensuel × prorata temps partiel) + bonus ancienneté (le plus favorable, non
  cumulable) + **report** du CP non consommé de la période précédente (**un seul niveau de
  report, pas de cascade** — le collaborateur consomme toujours son solde avant qu'un report à
  deux niveaux n'ait de sens, cas jugé inexistant en pratique) − CP déjà **validés** consommés sur
  la période en cours.
- **CPA** ("Congés Payés en Acquisition") : accrual mensuel **en cours** pour la période CP
  **suivante** (pas encore commencée, grossit chaque mois) − CP anticipés déjà validés dessus
  (`is_anticipation = true`).
- **RTT** : accrual mensuel depuis le début de sa période − RTT validés sur cette période. Pas
  d'ancienneté, pas de report (perdus en fin de période, confirmé).
- **Temps partiel** : `taux_activite` proratise le taux d'acquisition mensuel (CP et RTT).
- **Granularité mensuelle uniquement** : mois calendaires entiers écoulés, jamais de dixième de
  mois — décision explicite pour rester simple.
- Chaque catégorie expose aussi `valeurApresAttente` (solde ci-dessus moins les jours **en
  attente** de validation, retrait non définitif) — calculé mais **pas encore affiché dans l'UI**,
  à faire si besoin.

`useSoldes(utilisateurId?)` accepte désormais un id optionnel (Accueil : soi-même ; `/suivre` :
n'importe quel salarié, la RLS élargie manager/admin du 13/08/2026 le permet). Le disclaimer
"Données de démonstration" retiré de `DashboardPage.tsx`. `soldes.mock.ts` supprimé. La table
`soldes`/`historique_soldes` reste en base pour un futur usage (correction manuelle par Delphine)
mais n'est pas lue par ce moteur.

**Auto-validation manager + feed d'historique de solde CP + régulation Delphine (13/08/2026)** :

- `fetchDemandesEquipe()` inclut désormais les propres demandes du manager connecté (plus de
  filtre d'exclusion) — un manager (directeur, personne au-dessus pour valider à sa place) peut
  s'auto-valider ses congés depuis `/suivre`, testé de bout en bout (Olivier a approuvé sa propre
  demande, solde recalculé correctement).
- **Table `ajustements_solde`** (nouvelle, migration fournie et appliquée par l'utilisateur) :
  régulation manuelle du solde par Delphine — `utilisateur_id`, `type_absence_id`, `delta_jours`
  (signé), `motif`, `auteur_id`. Volontairement **indépendante** de `soldes`/`historique_soldes`
  (non exploitées, le solde est calculé à la volée) pour ne pas réintroduire de risque de
  désynchronisation. RLS : lecture manager/admin, écriture admin uniquement. Intégrée au calcul du
  solde CP de la période en cours dans `soldes.repository.ts` (`sommeAjustements`).
- **Popin "Historique CP"** (`components/suivre/HistoriqueSoldeModal.tsx`, ouverte au clic sur le
  solde CP d'un salarié dans `/suivre`) : feed groupé par mois, du 1er mois de la période jusqu'au
  mois en cours (même sans mouvement, "Pas d'événement"). Chaque mois replié par défaut ; un
  stabilo (`bg-status-warning-bg`) + chevron affiche "N événements" et déroule au clic. Congés
  validés en vert (`CP : du JJ/MM au JJ/MM`), régulations en rouge/vert selon le signe
  (`Régul (JJ/MM)`). Formulaire de régulation (delta + motif obligatoire) réservé à l'admin
  (`peutReguler`), visible sous "Solde actuel".
- `fetchHistoriqueCp(utilisateurId)` (nouveau, `soldes.repository.ts`) et
  `useHistoriqueSoldeCp(utilisateurId)` (nouveau hook) — même moteur de calcul que `fetchSoldes`
  (capital + report), mais expose le détail mois par mois plutôt qu'un seul total.
- **`SoldeMoisBloc`** (`components/ui/SoldeMoisBloc.tsx`) — le bloc "mois" (pill + stabilo
  événements + mouvements dépliables + ligne de solde de clôture) extrait en composant du design
  system, documenté sur `/design-system` aux côtés de `TypeBadgePillEnhanced`
  (`components/demandes/TypeBadge.tsx`, pill agrandie pour les soldes de premier plan). Réutilisable
  pour un futur feed RTT sans dupliquer le rendu.
- Vocabulaire : "mouvement" renommé "événement" dans l'UI (mais le type `MouvementSolde` et le
  champ `mouvements` gardent leur nom en code, changement cosmétique seulement).
- **Zone grise identifiée, pas encore tranchée** : les CP posés en anticipation
  (`is_anticipation = true`) pendant une période P-1 pour des dates tombant dans la période P
  suivante ne sont déduits nulle part une fois P devenue la période en cours (exclus du calcul CP
  car `is_anticipation = false` filtré, et sortis de la fenêtre CPA qui ne regarde plus que
  P+1). Diagnostiqué en discussion avec Vincent, correctif proposé (ne plus filtrer
  `is_anticipation` dans le calcul du capital consommé de la période en cours) mais **pas encore
  appliqué** — Vincent n'était "certain de rien" sur ce point, à retrancher avant de corriger.

**Export paie (14/08/2026)** — sous-rubrique `/suivre/paie` (`CongesPaiePage.tsx`), visible
manager + admin comme le reste de `/suivre` :

- **Encart "Congés consommés"** au-dessus de "Suivi des demandes" (`CongesConsommesCard.tsx`) —
  récap CP/RTT/CPA/CSS de la période, clique vers le détail. Période par défaut **25→24**
  (`periodePaieParDefaut`, `lib/periodePaie.ts` — cycle de transmission à la comptable), modifiable
  via deux champs date sur la page détail.
- **Table par collaborateur** (`fetchCongesConsommesPeriode`, `demandes.repository.ts`) — CP, RTT,
  Congés anticipés, Congé sans solde. Chaque cellule : total en jours (aligné sur le "j", largeur
  fixe `w-10 text-right`) + une pill par période (contour couleur du type, point de statut en tête).
- **Jours non validés comptés dans le total dès maintenant** (décision explicite, cas à la marge de
  régularisation, pas encore de logique fine de report) — distingués uniquement par la couleur du
  point : **vert** validé, **orange** en attente, **rouge** annulé (voir plus bas). Le CSV exporté
  exclut les dates annulées de la liste entre parenthèses mais garde le total cohérent.
- **Pills cliquables → panneau de détail** (card `md:sticky md:top-4`, le tableau passe en
  `md:flex-1` pour lui laisser la place plutôt que de se décaler façon overlay — testé et écarté un
  positionnement `fixed`/`absolute` qui débordait ou flottait n'importe où) :
  - Congé **en attente** : commentaire (motif/traçabilité) + deux CTA **Valider**/**Refuser**
    (réutilisent `validerDemande`/`refuserDemande` existants — même action réelle que "Demandes à
    traiter", pas un mécanisme parallèle).
  - Congé **validé ou annulé** : CTA masqués derrière un lien discret **"Régularisation"**
    (chevron, replié par défaut — la régularisation est exceptionnelle, ne doit pas être la
    première chose visible). Une fois déplié : commentaire + un seul bouton, qui dépend du statut —
    **Supprimer** (validé → annulé, nouvelle fonction `regulariserDemande`) ou **Restaurer**
    (annulé → validé, réutilise `validerDemande`).
- **Statut "annulé" exposé côté app** (`StatutDemande` gagne une 4e valeur, `STATUT_DEPUIS_DB`
  mappe `annulee`→`annulé`, `StatusBadge` gagne une entrée `Ban`/rouge) — jusqu'ici `annulee`
  n'était qu'un statut DB théorique (aucune demande n'y passait en pratique). Décision de traçabilité
  prise en cours de route (l'utilisateur a testé "Supprimer" une fois, remarqué que la demande
  disparaissait purement et simplement du tableau, puis demandé à la garder visible) : les congés
  annulés **depuis cette page** restent affichés dans le tableau (pill avec point rouge **avant** la
  date, même format que vert/orange — un essai avec barré + point en fin de pill a été fait puis
  écarté), exclus du total, cliquables pour repasser en mode Régularisation → Restaurer.
  `fetchCongesConsommesPeriode` inclut donc désormais `validee`/`en_attente`/`annulee` (pas
  `refusee`, jamais pertinent ici).
- **Case "Validés uniquement"** dans la barre de filtres — masque les collaborateurs/lignes qui
  n'ont que du non-validé ou de l'annulé sur la période, sans changer le calcul.
- **`devalidee_par`/`date_devalidation` finalement pas utilisées** pour ce flux — voir
  [BASE-DE-DONNEES.md](BASE-DE-DONNEES.md), point de modélisation dédié.
- Colonne du tableau resserrée (`px-3`, avatar `Avatar` + nom, en-têtes centrés `text-ink-500`,
  cellule vide sans "0" — juste rien) plutôt que la première version plus large ; bouton
  "Exporter (CSV)" en `variant="primary"` (pas secondary, décision finale après itération).
- **Nettoyage en route** : un panneau latéral "Relecture avant transmission" (liste de toutes les
  demandes non validées de la période avec case à cocher inclure/exclure du calcul) a été construit
  puis entièrement retiré — jugé peu utile après coup, le cas réel étant rare et déjà couvert par la
  régularisation du mois suivant. Gardé en tête si le besoin revient sous une autre forme : ne pas
  reproduire tel quel (mécanisme de coche jamais branché à une vraie action, juste un filtre
  d'affichage local).
- **Trois bugs de stabilité trouvés et corrigés en repassant sur la fonctionnalité** (14/08/2026,
  suite à une relecture demandée explicitement par Vincent — "certains composants me semblent pas
  stables") :
  - **Totaux incohérents entre l'encart et le détail** : `CongesConsommesCard.calculerTotaux`
    (encart `/suivre`) sommait toutes les demandes de la période sans exclure les annulées, alors
    que `CongesPaiePage.grouperParCollaborateur` (détail `/suivre/paie`) les exclut — les deux
    écrans affichaient des totaux différents pour la même période dès qu'une régularisation avait eu
    lieu. Même exclusion (`statut !== "annulé"`) ajoutée aux deux endroits.
  - **Course entre actions concurrentes** : rien n'empêchait de cliquer sur une autre pill (ou de
    changer Du/Au/le filtre) pendant qu'une action Valider/Refuser/Supprimer/Restaurer était encore
    en vol — la résolution tardive de la première action (`setSelectionId(null)` dans son `finally`)
    pouvait fermer le panneau d'un item différent de celui réellement concerné. Corrigé en
    verrouillant (`disabled={enCours}`) les pills, les champs Du/Au, la case "Validés uniquement" et
    le bouton fermer du panneau pendant qu'une action est en cours.
  - **Panneau qui écrase le tableau en dessous de `xl` (1280px)** : le layout côte à côte
    (`flex-row`) s'activait dès `md` (768px), mais le panneau fixe (`w-80` = 320px) et le
    `min-w-[640px]` du tableau ne tiennent pas ensemble dans l'espace disponible sur un écran de
    laptop courant (1024–1279px) — le tableau se retrouvait compressé sous son propre minimum,
    deux colonnes entières sortant du cadre visible sans indication claire de scroll horizontal.
    Le seuil du layout côte à côte (conteneur, largeur du tableau, position/largeur du panneau) est
    passé de `md:` à `xl:` — en dessous, panneau et tableau s'empilent proprement au lieu de se
    disputer la largeur.

**Accueil 2 devient l'unique écran Accueil (14/08/2026)** : direction validée après scénarisation
(voir entrée du 11/08/2026 ci-dessus) — l'ancien `DashboardPage.tsx` (calendrier/prochains congés en
listes) est supprimé, `app/(app)/page.tsx` rend désormais `Dashboard2Page` sur la route `/`. La route
`/accueil2`, devenue redondante, est supprimée (404 volontaire). Nav : l'entrée "Accueil 2" retirée
de `POSER_TABS` (`components/layout/tabs.ts`), il ne reste qu'une seule entrée "Accueil" → `/`.
Composant/fichier **pas renommés** (`Dashboard2Page`/`Dashboard2Page.tsx` gardent leur nom "2"
historique) — même situation que `Calendrier2Page` en son temps, item ajouté au Backlog pour
regrouper ce nettoyage cosmétique le jour où il sera fait.

**Historique refondu en tableau + filtre pill standardisé (14/08/2026)** :

- `/historique` passe d'une liste de cartes (`RequestList`) à un vrai tableau
  (`components/historique/HistoriqueTable.tsx` : Type/Dates/Nbre jours/Posé le/Validé le/Statut,
  colonnes "Posé le"/"Validé le" masquées sous `md`). Composant présentationnel pur (prend
  `demandes` en props), pensé dès le départ pour être réutilisé ailleurs avec un sous-ensemble de
  demandes.
- Filtres : statut (Toutes/**En validation**/Validées/Refusées) + période (Année en cours / Période
  de référence CP / plage personnalisée Du-Au), regroupés avec le tableau dans une seule card.
  `periodeReferenceCp()` (`lib/periodeReferenceCp.ts`) extrait en utilitaire partagé — même calcul
  que l'onglet "Période de référence" de `Dashboard2Page`, plus de duplication entre les deux.
- **Nouveau standard DS `FiltrePill`** (`components/ui/FiltrePill.tsx`, `SelectFiltrePill`/
  `InputFiltrePill`) — pill contour mint, `text-xs`/`px-2.5 py-1` (une première version plus
  spacieuse s'est avérée trop massive). C'est désormais LE composant à utiliser pour tout filtre de
  tableau ; distinct de `SelectPille` par l'usage (filtre de page vs créneau en popin DJI/CPI), pas
  par la taille. Documenté sur `/design-system`. Appliqué à Export paie (`CongesPaiePage.tsx`) et
  Utilisateurs (`UtilisateursListPage.tsx`) en plus d'Historique.
- `Demande.dateDecision` exposé côté app (`date_decision` n'était sélectionné nulle part côté
  repository jusqu'ici) pour la colonne "Validé le".
- Essai puis retour en arrière : intégrer `HistoriqueTable` (4 dernières entrées, sans filtres) sur
  l'Accueil à la place du bouton "En attente de validation", avec un lien "Tout voir" vers
  `/historique`. Jugé "moche" après coup — **revert complet sur `Dashboard2Page.tsx`**, le bouton
  "En attente de validation" (+ sa popin) est resté en place. Le composant `HistoriqueTable` et le
  reste d'Historique restent inchangés ; seule l'intégration sur l'Accueil a été annulée. Si l'idée
  revient, retenir que le style du bloc lui-même posait problème, pas le principe.

**Audit d'incohérences UI + harmonisation des cards de tableau (14/08/2026)** — Vincent a demandé un
état des lieux ("beaucoup d'incohérence, c'est pas très clair") après la refonte d'Historique.
Incohérences relevées, traitées dans l'ordre où elles seront reprises :

1. **Cards de tableau sans arrondi ni ombre — fait.** Historique n'avait ni l'un ni l'autre
   (demandé explicitement plus tôt), Export paie et Utilisateurs avaient les deux. Les deux
   `rounded-card` retirés des wrappers de tableau (`CongesPaiePage.tsx`, `UtilisateursListPage.tsx`)
   — l'ombre (`shadow-sm`) reste pour l'instant, pas encore retirée sur ces deux écrans. `EmptyRow`
   (`components/ui/EmptyRow.tsx`) avait lui aussi `rounded-card` — retiré également (il s'affiche à
   l'intérieur de ces mêmes tableaux, incohérence directe sinon), impact sur tous ses appelants
   (Historique, Export paie, Utilisateurs, Suivre, Calendrier — un seul composant partagé).
2. **En-têtes de colonnes — fait.** Export paie et Utilisateurs alignés sur Historique (majuscules
   espacées, `uppercase tracking-wide`) ; sur Utilisateurs, `ThTriable` (colonnes triables) avait sa
   propre classe de bouton qui ne l'héritait pas de la ligne parente, corrigé au passage. Au
   passage : le tri sur la colonne Nom retiré (jugé inutile, données déjà triées alphabétiquement
   par défaut), seule "Date d'entrée" reste triable.
3. **Position des filtres** — Historique/Export paie : filtres dans la même card que le tableau.
   Utilisateurs : filtres au-dessus, hors card. Pas encore harmonisé.
4. **Format des dates** — deux langages coexistent : texte ("12 juin au 16 juin",
   `formatPeriodeDemande`) et pill numérique ("12/08 - 14/08", Export paie/Historique). Pas de règle
   explicite sur lequel utiliser quand. Pas encore tranché.
5. **Représentation du statut** — `StatusBadge` (pill + icône) sur Historique vs point de couleur
   "fait main" dans les pills de date d'Export paie pour le même concept. Pas encore harmonisé.
6. **En-têtes de page** — certaines pages ont `BackHeader` (flèche retour : Nouvelle demande, fiche
   Utilisateur), d'autres un `<h1>` simple sans retour (Historique, Export paie, Utilisateurs). Pas
   de règle explicite sur quand utiliser lequel, pas encore tranché.

Points 1 et 2 faits ; points 3 à 6 restent à traiter — voir Backlog.md.

**"Suivre les demandes" (14/08/2026)** — nouvelle sous-rubrique `/suivre/demandes`, 3e onglet de
`/suivre` (visible admin + manager, comme le reste de la section) :

- Reprend `HistoriqueTable` telle quelle (même composant que `/historique`) sur
  `fetchDemandesEquipe()` (toute l'entreprise) au lieu de `fetchDemandes()` (soi-même) — nouvelle
  prop `avecCollaborateur` sur `HistoriqueTable` (type discriminant `Demande[]`/`DemandeEquipe[]`
  selon la prop) qui ajoute une colonne Collaborateur (avatar + nom) en tête de ligne, factorisée
  via une fonction interne `cellulesCommunes()` réutilisée dans les deux branches de rendu.
- Filtres, dans l'ordre : **Type** (Tous les types + les 7 codes de `TypeBadgeCode` posables par un
  salarié, CPA compris) → **Statut** (Tous les statuts/En validation/Validés/Refusés, libellés au
  masculin) → **Collaborateur** (liste dérivée des demandes chargées, pas figée en dur) → **Période**
  (Année en cours/Période de référence CP/plage personnalisée — même logique que `/historique`).
  Même standard `FiltrePill` que partout ailleurs.
- `SuivreDemandesPage.tsx` est volontairement très proche de `HistoriquePage.tsx` (même structure de
  filtres statut/période, dupliquée plutôt que factorisée pour l'instant — à revoir si un 3e écran du
  même genre apparaît).

**"Suivre les soldes" + détail du solde CP (14/08/2026)** — nouvelle sous-rubrique
`/suivre/soldes`, 4e onglet de `/suivre` (même protection que le reste de la section) :

- **`SuivreSoldesPage.tsx`** : tableau Collaborateur/CP/RTT/CPA de tous les salariés actifs, mêmes
  conventions de card/en-têtes que le reste de `/suivre` (pas d'arrondi ni d'ombre, en-têtes
  majuscules, filtres dans la même card que le tableau). Filtre Collaborateur en `SelectFiltrePill`
  (même construction dérivée des données chargées que sur `SuivreDemandesPage`). Une ligne =
  un `useSoldes(utilisateur.id)` séparé (composant `LigneSolde`, pas de batch) — pas de route soldes
  groupée, et les Rules of Hooks interdisent d'appeler le hook en boucle dans un seul composant.
  Table plafonnée à `md:max-w-[900px]` (colonne de droite vide) tant qu'aucun panneau n'est ouvert,
  passe à `xl:flex-1` sinon — même pattern de docking que Export paie (seuil `xl:`, pas `md:`, pour
  la même raison de layout cassé sur un écran laptop 1024–1279px, voir "Export paie" ci-dessus).
- **Pill CP cliquable → `SoldeCpDetailPanel.tsx`** (nouveau, panneau latéral droit `xl:sticky`,
  ouvert au clic sur la pill CP d'un salarié — seul CP a un historique détaillé pour l'instant,
  comme la popin `HistoriqueSoldeModal` existante ailleurs dans l'app). Header : avatar + nom du
  salarié en gras (style titre), "Détail du solde CP" en sous-titre gris juste dessous (ordre
  volontaire : le nom est l'information principale du panneau, pas le libellé de la fonctionnalité).
  Table "Événements" à 3 colonnes (Événement/Jours/Solde, ces deux dernières centrées avec leur
  contenu) — **à plat**, pas de repli par mois comme `HistoriqueSoldeModal` (ici on veut tout voir
  d'un coup, du solde N-1 jusqu'à aujourd'hui) :
  - Ligne "Solde N-1 - {date de début de la période de référence}" en pill contour bleu (couleur
    CP) — solde de départ de la période.
  - Un événement par CP validé, pill identique à la colonne Dates d'Export paie (contour couleur du
    type + point de statut, pas de mention "CP" dans le libellé puisque la colonne est déjà 100%
    CP) — point **vert**. Jours négatifs affichés en **bleu (couleur CP)**, pas en rouge (décision
    explicite : le rouge est réservé aux statuts refusé/annulé ailleurs dans l'app, un jour posé
    validé n'est pas une erreur).
  - Pied de table "Solde actuel" avec `TypeBadgePillEnhanced`.
- **État "déclenché" — lien visuel entre l'indicateur et le panneau ouvert** : tant que le panneau
  est ouvert pour un salarié, sa pill CP dans le tableau **s'inverse** (fond blanc/transparent,
  texte + contour couleur CP — `TypeBadge variant="outline"` au lieu de `variant="pill"`) au lieu du
  fond plein blanc-sur-bleu habituel. Piloté par un simple `active={u.id === selectionId}` passé à
  `LigneSolde`, pas de nouvel état — même esprit que le surlignage `ring-mint` déjà utilisé sur les
  pills sélectionnées d'Export paie, mais ici la couleur de la pill elle-même change plutôt qu'un
  anneau superposé (retenu après essai de la variante anneau, jugée moins lisible que l'inversion).
- **Solde Réel/Théorique** : à côté de "Solde actuel", le mot "Réel"/"Théorique" est un `<select>`
  minimal (pas de bordure/pill, juste souligné en pointillé pour signaler l'interaction) qui bascule
  entre les deux modes. **Réel** = solde actuel habituel (CP validés uniquement). **Théorique** =
  ajoute à la table les CP **non validés** (`statut = "en_attente"`) posés depuis le début de la
  période de référence, affichés avec un point **orange** (au lieu de vert, cohérent avec le code
  couleur statut du reste de l'app) et un solde qui continue de décroître à leur suite ; le pied de
  table affiche alors `soldeTheorique` au lieu de `soldeActuel`. Nouveaux champs `enAttente`/
  `soldeTheorique` sur `HistoriqueSolde` (`lib/types.ts`) et calculés dans
  `fetchHistoriqueCp` (`soldes.repository.ts`) — même fenêtre de période que le reste de la
  fonction, une requête `demandes_conges` de plus (`statut = "en_attente"`), pas de recalcul côté
  client.

**Détail du solde RTT + panneau généralisé CP/RTT (14/08/2026)** — la pill RTT de
"Suivre les soldes" devient cliquable sur le même modèle que CP, avec une formule adaptée à sa
propre règle de gestion (période de référence RTT = **l'année civile**, acquisition **mensuelle**,
**pas de report** d'une période à l'autre) :

- **`SoldeCpDetailPanel.tsx` généralisé en `SoldeDetailPanel.tsx`** (prop `code: "CP" | "RTT"`),
  réutilisé par les deux pills plutôt que dupliqué — seules les couleurs (`classeTexteTypeBadge`/
  `classeBordureTypeBadge`, nouveau helper texte symétrique du helper bordure existant dans
  `TypeBadge.tsx`) et le libellé de la ligne de départ (`"Solde N-1"` pour CP, `"Solde initial"` pour
  RTT — RTT n'a pas de notion de report/N-1) changent avec `code`.
- **`fetchHistoriqueRtt`** (nouveau, `soldes.repository.ts`, même gabarit que `fetchHistoriqueCp`)
  reflète la vraie mécanique RTT plutôt que de forcer le moule CP : pas de capital connu d'avance,
  le solde se construit mois après mois — chaque mois entier écoulé depuis le 1er jour de la période
  devient donc lui-même un **événement positif** dans le feed (`type: "acquisition"`, libellé
  "Acquisition {mois}"), en plus des RTT validés consommés (négatif). D'où `soldeDepart: 0` toujours
  pour RTT (jamais de report). `MouvementSolde.type` gagne cette 3e valeur (`lib/types.ts`).
- **Couleur des jours consommés = couleur du TYPE, pas un rouge générique** (règle déjà actée pour
  CP le 14/08/2026, reconduite ici à l'identique pour RTT) : `-1 j` s'affiche en `text-rtt` (vert),
  les crédits (accrual RTT ou ajustement) restent en `text-status-success-fg` (vert "succès",
  différent du vert RTT — les deux se ressemblent par coïncidence de palette, pas une confusion
  volontaire).
- **`useHistoriqueSolde(utilisateurId, code)`** (nouveau hook générique, `hooks/`) : distinct de
  `useHistoriqueSoldeCp` qui reste tel quel (expose en plus `ajouterAjustement`, utilisé par la
  popin de régulation admin `HistoriqueSoldeModal`, non touchée). Point d'attention : `loading` ne se
  réinitialise qu'au montage (pas de `setLoading(true)` synchrone dans l'effet — interdit par la
  règle de lint `set-state-in-effect`) ; `SuivreSoldesPage` force donc un remontage du panneau via
  `key={`${utilisateurId}-${code}`}` quand on clique directement CP→RTT (ou l'inverse) pour le même
  salarié sans fermer d'abord, pour éviter un flash de l'ancien solde sous le nouveau libellé.
- **État "déclenché"** étendu aux deux pills indépendamment (`Selection { utilisateurId; code }`
  plutôt qu'un simple id) : cliquer RTT après avoir ouvert CP sur le même salarié fait bien basculer
  l'inversion visuelle de la pill CP vers la pill RTT, jamais les deux en même temps.
- DS : nouvel exemple `/design-system` à ajouter si RTT devient un cas de référence récurrent — pas
  fait pour l'instant, l'exemple existant ("Pill de solde cliquable") reste illustré uniquement en
  CP, le principe (variant pill/outline piloté par `active`) étant identique pour RTT.

**Détail du solde CPA + raffinements visuels du panneau (14/08/2026)** — la pill CPA de
"Suivre les soldes" devient cliquable à son tour (3 types sur 3 désormais), et le panneau reçoit
plusieurs ajustements de lisibilité demandés après coup sur les 3 types :

- **`fetchHistoriqueCpa`** (nouveau, `soldes.repository.ts`) : même principe d'accrual mensuel que
  RTT (`type: "acquisition"`, `soldeDepart: 0`), mais sur une **fenêtre temporelle décalée** propre à
  CPA — l'acquisition se déroule sur la période CP **en cours** (même horloge que `regleCP`,
  `periodeEnCours`), alors qu'elle finance des congés anticipés dont les dates tombent dans la
  période **suivante** (`periodeSuivante`, `is_anticipation = true`, même logique que le calcul de
  `fetchSoldes`). Piège identifié en écrivant la fonction : un parcours calendaire de "mois entiers
  écoulés" borné à aujourd'hui (le pattern repris tel quel de RTT) aurait silencieusement perdu tout
  événement de consommation, puisque ces dates tombent dans une période future hors de cette
  fenêtre. Fix : les clés de mois du feed (`cles`) sont dérivées de l'union des dates réelles de
  tous les mouvements (accrual + consommation) plutôt que d'un parcours calendaire fixe — vérifié en
  base réelle (Salarie Test : 2 accruals "juin 2026"/"juillet 2026" + 1 événement "CPA : du 08/06 au
  08/06" daté 2027, correctement inclus et sommé, solde final 4 j identique entre le panneau et la
  colonne CPA du tableau — même moteur de calcul que `fetchSoldes`, pas de recalcul divergent).
- **`useHistoriqueSolde`/`SoldeDetailPanel`/`SuivreSoldesPage`** étendus de `"CP" | "RTT"` à
  `"CP" | "RTT" | "CPA"` — aucune bifurcation supplémentaire nécessaire, tout le reste (couleurs via
  `classeTexteTypeBadge`/`classeBordureTypeBadge`, libellé "Solde initial", pill CPA qui s'inverse en
  `variant="outline"` pendant que son panneau est ouvert) était déjà générique par construction.
- **Icône "+" au lieu du point vert pour les événements d'acquisition** (`Plus` de `lucide-react`,
  `size={10}`) — un point de couleur signale normalement un STATUT (validé/en attente), ce qu'une
  acquisition automatique n'est pas ; le "+" évite de laisser croire à un statut alors qu'il s'agit
  d'un mécanisme différent. Couleur du "+" et du montant "+X j" associé : **couleur du type**
  (`classeTexteTypeBadge`), pas le vert "succès" générique (qui reste réservé à un crédit ponctuel,
  ex. ajustement positif) — distinction demandée explicitement après une première passe où tout
  positif était en vert succès.
- **Préfixe `"CP : "`/`"RTT : "`/`"CPA : "` réintroduit** dans le libellé des pills d'événement
  (`libelleEvenement` simplifié, ne prend plus le paramètre `code`) — retour en arrière assumé sur le
  choix initial de le retirer (motivé à l'époque par "on est déjà 100% CP dans ce panneau", un
  raisonnement qui ne tient plus maintenant que le même panneau mélange parfois acquisition et
  consommation dans un seul feed, ex. RTT/CPA).
- **En-tête du panneau recoloré au fond du type** (`classeFondTypeBadge(code)` sur le bandeau, au
  lieu de `bg-surface-card`) — nom du salarié et sous-titre "Détail du solde {code}" passés en
  `text-white`, sous-titre renforcé en `font-semibold` (était trop fin pour rester lisible sur fond
  coloré), croix de fermeture en `text-white/70` (`hover:text-white`).
- **Pill "Solde N-1"/"Solde initial" foncée pour l'accessibilité** — sa couleur de texte n'est plus
  la classe Tailwind figée du type (`text-rtt` en particulier, trop pâle sur fond clair pour un texte
  `text-xs`) mais un `color-mix(in srgb, var(--color-{code}) 65%, black)` en style inline (même
  procédé que `MiniCalendrier.tsx` pour une variante de couleur non pré-générée par Tailwind) — la
  bordure de la pill garde la couleur pleine du type, seul le texte est foncé.

**Popins récapitulatives de l'Accueil alignées sur le style `SoldeDetailPanel` (14/08/2026)** — les
popins CPI/DJI/Fériés/PERSO (types de congé perso — CP, CPA, CSS, etc.) de `Dashboard2Page.tsx`,
jusqu'ici sur le gabarit `Modal` générique (titre centré neutre, liste de lignes texte séparées par
un filet), reprennent le système visuel construit pour `SoldeDetailPanel` (panneau de solde,
Suivre les soldes) — décision explicite de faire converger les deux familles de popins plutôt que
les laisser diverger. Fait dans l'ordre DJI → CPI → Fériés → PERSO (CPA, CSS, etc. — voir
"Généralisation PERSO" plus bas) :

- **`Modal` gagne une prop `header?: ReactNode`** (`components/ui/Modal.tsx`) — en-tête plein-cadre
  custom qui remplace entièrement la barre titre/croix par défaut (croix de fermeture à la charge de
  l'appelant). Branche strictement additive : tous les appels existants (confirmations,
  `ReglesCongesModal`, popins DJI/CPI/Fériés de `CalendrierPage.tsx`, exemples DS) qui ne passent pas
  `header` gardent EXACTEMENT le rendu/padding d'avant, aucune régression possible par construction
  (le JSX du chemin `title` n'a pas été touché, seulement encapsulé dans un `??`).
- **Coins carrés appliqués globalement** — `rounded-xl` retiré du wrapper `Modal` sans condition
  (contrairement à `header`, ce changement-ci s'applique à TOUTES les popins de l'app d'un coup,
  demandé explicitement "on applique partout" après validation sur DJI). `shadow-lg` conservé
  (seul l'arrondi était visé, pas l'ombre — distinct de la harmonisation des cards de tableau du
  14/08/2026 plus haut, qui avait retiré les deux).
- **En-tête coloré générique** (`headerLegende(code, compteur)`, fonction locale à
  `Dashboard2Page.tsx`, réutilisée par CPI/DJI/Fériés/PERSO) — même structure que `SoldeDetailPanel` :
  fond `classeFondTypeBadge(code)`, typographie blanche, croix `text-white/70`. Substitutions
  demandées explicitement par rapport au panneau de solde (qui montre un salarié) : `TypeBadge`
  cerclé de blanc (`ring-2 ring-white`) à la place de l'avatar — sans ce cerclage le badge (fond plein
  de la couleur du type) devient invisible sur un en-tête de la MÊME couleur, ex. DJI violet sur DJI
  violet ; compteur ("7 demi-journées", "1 période", "4 jours", "1 demande") à la place du nom ;
  période active affichée (`rangeActive`, l'onglet Année en cours/Période CP/Année suivante) à la
  place du sous-titre "Détail du solde".
- **Lignes en pill contour couleur du type** (`classeBordureTypeBadge(code)`), une info
  complémentaire à droite selon le type : Matin/Après-midi (DJI), nombre de jours calculé (CPI, voir
  point suivant), libellé du jour férié (Fériés), nombre de jours + point de statut (PERSO, voir plus
  bas). Remplace les anciennes lignes texte brut séparées par un filet horizontal — même principe
  déjà acté sur `HistoriqueTable` (filets retirés, jugés redondants avec la pill).
- **`joursOuvres`/`estJourOuvre`/`dureeCongeImpose` extraits de `CalendrierPage.tsx` vers
  `lib/joursFeries.ts`** (exportés, réutilisés tels quels par `CalendrierPage.tsx` — aucune
  duplication de la formule) : nécessaire pour afficher le nombre de jours de chaque période CPI dans
  la popin Accueil, avec le même calcul que le compteur de volume admin (jours ouvrés, fériés
  exclus, demi-journées de début/fin d'après `demiDebut`/`demiFin`). Le calcul utilise la liste des
  fériés des 3 années chargées (précédente/actuelle/suivante) **non filtrée** par la fenêtre active
  (contrairement à `joursFeriesTous`, lui filtré) — une période CPI affichée peut déborder de la
  fenêtre active (chevauchement partiel), il faut TOUS les fériés qui la couvrent réellement pour un
  décompte juste.
- **Généralisation PERSO (CP → tous les types)** — la popin PERSO (CP, RTT, CPA, CSS, etc.) a d'abord
  été refaite pour CP seul (`demandesCp`/`demandesCpLabel`, code en dur), puis généralisée sur demande
  ("CPA et congés sans solde", reformulé en "tous les autres" en cours de route) via
  `demandesDuType(code)`/`labelDemandes(n)` — deux fonctions locales paramétrées par `code`, plus
  aucune branche spécifique à CP. `RequestList` (l'ancien rendu de cette popin) n'est plus utilisé
  que par la popin "En attente de validation", laissée inchangée.
  - **Point vert/orange selon le statut** de la demande (validé/en attente — `annulé` en rouge par
    cohérence avec le reste de l'app, bien que non explicitement demandé, ce statut étant rare ici
    car `demandesVisibles` exclut déjà `refusé`).
  - **Nombre de jours sans signe** ("1 j", pas "-1 j" — demandé explicitement, une popin de
    consultation n'est pas un solde qui décompte, contrairement à `SoldeDetailPanel`), coloré
    `classeTexteTypeBadge(code)` si validé, **grisé `text-ink-500`** si en attente (la couleur du
    type est réservée à ce qui est acquis/certain).
- **Pills date harmonisées à `px-2.5 py-1`** (partout — Historique, Export paie, Suivre les soldes,
  ces 4 popins Accueil) : deux variantes légèrement différentes avaient dérivé (`px-2 py-0.5` sur les
  pills d'événement de `SoldeDetailPanel`, `px-2.5 py-0.5` sur les premières versions des pills
  Accueil) — remises au gabarit `HistoriqueTable`, la référence historique de ce pattern.
- **Espacement entre lignes calé sur `SoldeDetailPanel`** — les 4 listes de la popin Accueil sont
  passées d'un `flex flex-col gap-2` (8px entre lignes) à un `flex flex-col` avec `py-3` sur chaque
  ligne (comme les `<td>` de la table `SoldeDetailPanel`, soit 24px effectifs entre deux lignes) —
  demandé explicitement pour que la densité visuelle des deux familles de popins se ressemble,
  au-delà de la seule couleur/forme des pills.

**Échange de couleurs CPI/RECUP (15/08/2026)** — CPI (Congé imposé) n'avait jusqu'ici pas de token
couleur propre : il réutilisait `--color-cp` (bleu, `bg-cp`/`border-cp`/`text-cp` en dur dans
`TypeBadge.tsx`, commentaire "même couleur que CP"). Décision explicite : CPI récupère le bleu slate
foncé jusqu'ici utilisé par RECUP (`#496580`), et RECUP récupère à son tour le rose jusqu'ici utilisé
par EVT_FAM (`#d98ca6`) — **EVT_FAM garde volontairement son rose actuel pour l'instant** (RECUP et
EVT_FAM partagent donc temporairement la même couleur, tranché explicitement comme acceptable en
attendant qu'une 3e couleur soit choisie pour l'un des deux — voir Backlog.md).

- **Nouveau token `--color-cpi: #496580`** (`app/globals.css`) — CPI a désormais sa propre entrée
  `CODE_STYLES`/`CODE_STYLES_OUTLINE`/`CODE_STYLES_BORDURE`/`CODE_STYLES_TEXTE`/`CODE_STYLES_ATTENUE`
  dans `TypeBadge.tsx` (`bg-cpi`/`border-cpi`/`text-cpi`/`bg-cpi/50`), plus de dépendance à CP.
  `--color-recup` passe à `#d98ca6` (`--color-evtfam` inchangé, toujours `#d98ca6`).
- **Audit fait avant l'échange** (agent dédié, recherche sur tout le repo) : aucune autre occurrence
  en dur des hex `#496580`/`#d98ca6` en dehors de `globals.css` (le `#496580` de `--color-slate`
  mentionné dans README.md est un token différent, sans rapport), aucune classe `bg-recup`/`bg-evtfam`
  utilisée hors des helpers `classeFondTypeBadge`/`classeBordureTypeBadge`/`classeTexteTypeBadge` de
  `TypeBadge.tsx` (donc rien à modifier ailleurs, la couleur se propage automatiquement partout où
  ces helpers sont appelés — DS, popins Accueil, Calendrier, Suivre les soldes...).
- Note "CPI (même couleur que CP)" dans l'entrée du 05/08/2026 ci-dessus corrigée (devenue fausse
  après cet échange). Ligne `cpi` ajoutée à la table de swatches `PALETTE` du DS (`/design-system`),
  absente jusqu'ici alors que le token `cp`/`rtt`/etc. l'était déjà — gap indépendant de l'échange,
  corrigé au passage.

**Popins récapitulatives de l'Accueil ancrées en surimpression du calendrier (15/08/2026)** —
expérimentation ("on va tenter un truc") sur les 4 popins CPI/DJI/Fériés/PERSO de
`Dashboard2Page.tsx` : au lieu du `Modal` plein écran à fond assombri (garde ses coins carrés déjà
appliqués globalement, voir entrée précédente), elles s'ouvrent maintenant en surimpression du
calendrier, sans jamais le masquer complètement :

- **Position fixe en haut de la colonne légende** (`ouvrirLegende`, un seul point d'entrée pour les
  4 kinds) — quelle que soit la carte cliquée (même la dernière de la liste), la popin s'ouvre
  toujours à la même position, alignée sur le haut de la 1re rangée du calendrier (les deux colonnes
  sont côte à côte dans le même flex row, même départ vertical par défaut). Mesurée une fois via
  `calendrierGridRef.current.getBoundingClientRect()` au clic, pas suivie en continu.
- **`position: absolute` dans un conteneur `relative`, pas `fixed`** — premier essai en `fixed`
  (ancré au viewport, `DOMRect` de la carte cliquée) abandonné : la popin ne suivait pas le scroll de
  la page, elle restait plaquée à l'écran pendant que le calendrier défilait dessous. `absolute`
  dans la colonne légende (devenue `relative`) la fait scroller avec le contenu, comme demandé
  explicitement ("qu'elle reste fixe par rapport au calendrier").
- **Hauteur calée sur celle du calendrier affiché**, pas sur le nombre de lignes de la popin (bug
  remonté : une popin courte laissait entrevoir les cartes de légende suivantes en dessous) — hauteur
  du calendrier mesurée au clic (`calendrierHauteur`, même ref) et appliquée en `style={{ height }}`
  sur le panneau, avec `overflow-y-auto` en secours si le contenu dépasse malgré tout.
- **`MiniCalendrier` gagne une prop `estMisEnAvant?: (iso: string) => boolean`** — met un jour en
  surbrillance (`brightness-110`, même effet visuel que le survol) indépendamment de la souris.
  Nécessite un léger complément au modèle interne : le type `ItemRendu` (variante "fusion", jours
  consécutifs regroupés en un seul élément DOM) gagne un champ `isos: string[]` en plus de `jours:
number[]`, pour pouvoir tester CHAQUE jour du segment contre le prédicat (pas seulement le premier).
  Combiné en `OR` avec le survol existant (`groupeId === groupeSurvole`), jamais en remplacement.
  `Dashboard2Page.tsx` fournit `estJourDuPopinOuverte` (branché sur `legendeOuverte.kind`) à chaque
  `MiniCalendrier` — répond "oui" pour tout jour couvert par les données de la popin actuellement
  ouverte (dates DJI, période CPI, dates Fériés, ou plage de dates des demandes PERSO du type
  affiché), "non" sinon.
- **Ordre d'affichage des cartes de légende fixé** (`ORDRE_LEGENDE`, tableau de `TypeBadgeCode`,
  `Dashboard2Page.tsx`) : CP, RTT, CPA, DJI, CPI, FE, CSS — demandé explicitement, CPI oubliée dans la
  première formulation puis repositionnée juste après DJI ("les deux imposés par l'admin") sur
  clarification. `renderLegendeCard(code)` centralise le mapping code → libellé/compteur/onClick
  (avant : 3 blocs JSX dupliqués pour CPI/DJI/Fériés + un `.map` pour PERSO) ; les codes perso hors de
  cette liste (CE, RECUP, EVT_FAM...) restent affichés, ajoutés après dans leur ordre naturel
  d'apparition dans les demandes.
- **Popin PERSO généralisée à tous les types** (CP, RTT, CPA, CSS...), plus seulement CP — reprend
  le même style pill (contour couleur du type + point de statut vert/orange/rouge validé/en
  attente/annulé) que CPI/DJI/Fériés, via `demandesDuType(code)`/`labelDemandes(n)`.
- Libellé du sélecteur d'affichage renommé "Affichage : Vue complète / Mois en cours" → "Débute :
  Mois en cours / Début période" (`SelectAffichage`, texte seul, comportement inchangé).

**Bug corrigé — demande refusée disparaissait du tableau Export paie (15/08/2026)** — trouvé en
répondant à un signalement de Vincent ("j'ai refusé un CSS à Delphine, je ne le retrouve pas dans
Suivre les demandes"). Deux choses distinctes étaient en jeu, clarifiées en discussion :

- **Le cas signalé au départ n'était pas un bug** : `fetchDemandesEquipe()` (Suivre les demandes)
  exclut volontairement le statut `annulée` (`.neq("statut", "annulee")`) — une demande validée puis
  supprimée via Régularisation dans Export paie n'est traçable que dans Export paie, jamais dans
  Suivre les demandes. Comportement voulu, pas modifié.
- **Le vrai bug, trouvé en creusant plus loin** (agent dédié) : `fetchCongesConsommesPeriode`
  (`lib/data/demandes.repository.ts`, alimente `CongesPaiePage`/Export paie) filtrait sur
  `.in("statut", ["validee", "en_attente", "annulee"])` — **`"refusee"` manquait de cette liste**.
  Conséquence : refuser une demande encore en attente depuis Export paie la faisait disparaître
  intégralement du tableau au `refetch()`, alors que la pastille de statut (vert/orange/rouge) avait
  déjà un chemin de code prévu pour l'afficher — jamais atteint faute de données. `"refusee"` ajouté
  à la liste.
- **Refusé traité comme annulé pour le calcul du total et l'export CSV** — ni l'un ni l'autre n'a
  jamais été (ou n'est plus) un congé réellement accordé, aucune raison de compter différemment
  (`grouperParCollaborateur` : `d.statut !== "annulé" && d.statut !== "refusé"` avant d'ajouter aux
  jours ; même exclusion sur la liste de dates de l'export CSV).
- **Pastille refusée : point rouge** (comme annulé), plutôt que l'orange "en attente" qu'elle aurait
  hérité par défaut du `else` de la ternaire — sinon indiscernable visuellement d'une demande encore
  en attente de décision une fois le fetch corrigé.
- **Panneau de détail — bug latent découvert au passage, jamais atteignable avant** (les demandes
  refusées n'étaient jamais chargées, donc jamais cliquables) : sélectionner une demande refusée
  tombait dans la branche `else` du code (prévue pour "en attente") et affichait à tort les boutons
  Refuser/Valider sur une demande déjà décidée. Nouvelle branche dédiée, lecture seule ("Demande déjà
  refusée — non comptée, aucune action possible depuis cet écran") — pas de Régularisation non plus
  sur un refus (ce mécanisme corrige un congé qui avait été accordé, un refus ne l'a jamais été).
- **Distinction annulé/refusé rediscutée** : gardée pour l'instant (refusé = jamais accordé, annulé =
  accordé puis corrigé après coup — utile pour l'audit paie), mais les deux se comportent maintenant
  de façon quasi identique dans Export paie (visibles, non comptés, lecture seule) — voir Backlog.md,
  point ajouté pour revenir sur l'ensemble des règles de gestion Export paie/suivi des congés.

**Panneau "Détail du congé" — début de refonte en feed d'actions, non terminé (15/08/2026)** —
`DetailCongePanel.tsx` (panneau partagé Export paie / Suivre les demandes, ouvert au clic sur la
pill Dates) retravaillé par itérations successives. **Chantier explicitement laissé en pause pour
reprise ultérieure**, voir "En cours" ci-dessous pour ce qui reste.

- **Largeur réduite** `xl:w-80` → `xl:w-64` : la colonne Collaborateur du tableau Export paie était
  trop compressée (jusqu'à ~653px, tout juste au-dessus du plancher `min-w-[640px]` de la
  `<table>`) quand le panneau était ouvert — gain de ~64px rendus au tableau. Palliatif, pas une
  solution : la vraie piste pour gagner de la largeur reste le menu latéral rétractable (voir
  Backlog.md, entrée "refonte de la nav").
- **Coins carrés** : `rounded-card` retiré (harmonisation "coins carrés" du 14/08/2026 qui n'avait
  pas touché ce panneau).
- **Header repensé plusieurs fois avant de se stabiliser** sur : fond plein coloré selon le type de
  congé (`classeFondTypeBadge`, même pattern que `SoldeDetailPanel`/popins Accueil), `TypeBadge`
  cerclé de blanc (`ring-2 ring-white`) à la place de l'avatar du collaborateur — repris tel quel du
  `headerLegende` de `Dashboard2Page.tsx` (sinon invisible sur un fond de la même couleur), nom du
  collaborateur + libellé du type en dessous.
- **Corps transformé en feed chronologique** : `SuiviDemandeRow` (période + jours) suivi d'une liste
  d'événements — "Posé le", puis "Validé le"/"Refusé le" si `dateDecision` existe. Deux nouvelles
  props opt-in sur `SuiviDemandeRow` (`masquerType`, `masquerPoseLe`, défaut `false` — comportement
  de `SuivrePage` inchangé) pour ne pas dupliquer ces infos, déjà portées par le header/le feed dans
  ce panneau.
  - Puces reliées par un connecteur vertical plein (pas pointillé, testé puis rejeté) coloré selon le
    type (`classeFondTypeBadge`) — signifie la continuité entre les deux événements. Centrage
    puce/connecteur/texte volontairement vérifié en DOM (`getBoundingClientRect`) à chaque itération
    : une première version (bordure `border-dashed` sur un élément 0-width centré au flex) créait un
    décalage sub-pixel visible, remplacée par un petit bloc plein `w-px` (centrage fiable).
  - Ligne de décision : couleur du texte selon le tone du statut (`text-status-success-fg` validé,
    `-danger-fg` refusé/annulé, `-warning-fg` en attente — nouveau `Record` local `TEXTE_DECISION`,
    même mapping que `STATUT_CONFIG`), date au format court `jj/mm/aa` (`formatJjMmAa`, nouvelle
    fonction locale au fichier, même logique que celle de `SoldeDetailPanel`).
- **Auteur de la décision affiché** ("Validé/Refusé le jj/mm/aa **par** Prénom) : la donnée
  existait déjà en base (`demandes_conges.validateur_id`, jamais exploitée côté app avant). Ajouts :
  - `DemandeEquipe.validateur: { id, prenom, nom } | null` (nouveau champ, `lib/types.ts`)
  - `SELECT_DEMANDE_EQUIPE` (`demandes.repository.ts`) embarque désormais
    `validateur:utilisateurs!validateur_id(id, prenom, nom)` en plus du join `demandeur` existant —
    alias obligatoire (`validateur:`) car PostgREST refuse d'embarquer deux fois la table
    `utilisateurs` sans désambiguïser
  - couvre les deux call sites qui construisent des `DemandeEquipe` (`fetchDemandesEquipe`,
    `fetchCongesConsommesPeriode`), donc Export paie et Suivre les demandes gratuitement
  - fixtures `DesignSystemPage.tsx` mises à jour (`validateur: null` / `validateur: {...}`) pour
    rester compilables
- **Commentaire de décision affiché après l'action** (`commentaireManager`) : d'abord tenté en
  petite ligne italique dans le feed, déplacé sur demande vers un bloc dédié juste en dessous du
  feed — **reprend le style et l'emplacement exacts d'un texte statique supprimé au passage**
  ("Demande déjà refusée — non comptée, aucune action possible depuis cet écran", codé en dur dans
  la branche `refusé`, sans lien avec un vrai commentaire — supprimé car trompeur une fois le feed en
  place, remplacé par `null` dans la branche, le commentaire réel prenant sa place visuelle).

**Panneau "Détail du congé" — encart "Décision" séparé pour le statut en attente (16/08/2026)** —
reprise du chantier du 15/08/2026, toujours **non terminé**. Le bloc commentaire + Refuser/Valider
(jusqu'ici collé au reste du panneau) devient son propre encart carte, sur le même modèle que
l'idée "un événement = une carte" du reste du panneau.

- Panneau désormais composé de **deux cartes empilées** (`bg-surface-card` chacune) dans un wrapper
  commun qui porte le `xl:sticky`/`w-64` : carte 1 = header + feed + commentaire de décision déjà
  affiché ; carte 2 = "Décision", seulement quand `statut === "en attente"`, séparées par
  **3px** (`gap-[3px]` sur le wrapper) plutôt qu'un simple `border-t` interne comme avant.
- Titre de la carte 2 essayé "Action" puis renommé **"Décision"**.
- **Longue série d'essais de fond/couleur "en mode réflexion"**, plusieurs revert : `bg-mint-tint`
  (vert pâle du bloc "Soldes" Accueil, non concluant) → `bg-status-warning-bg` (orange pâle, couleur
  du tone "en attente", non concluant) → blanc uni testé deux fois entre les essais → `#F6F7FB` puis
  `#F1F5FF` (bleu-gris solides) → `#F4F6FA` (gris légèrement bleuté, solide) → **état final retenu** :
  fond dynamique `color-mix(in srgb, var(--color-{type}) 5%, white)` (même procédé que
  `SoldeDetailPanel`), teinté selon le type du congé plutôt qu'une couleur fixe — nouvelle table
  `VAR_COULEUR_TYPE` locale à `DetailCongePanel.tsx`. Titre "Décision" suit la même logique
  (`classeTexteTypeBadge(code)` plutôt qu'une couleur fixe testée un temps `#4562E1`).
- Bouton Refuser : `flex-1` retiré (largeur naturelle au contenu, Valider récupère l'espace restant
  en `flex-1`) ; fond `bg-status-danger-bg` testé sur demande explicite pour trancher visuellement,
  jugé "affreux", reverté — convention confirmée : aucun bouton de l'app n'a de fond coloré danger
  (uniquement les bandeaux de message d'erreur), `Refuser` reste texte+bordure rouge comme le reste
  de l'app (`DemandeEquipeRow.tsx` notamment). Fond final : `bg-white/50` (blanc 50% d'opacité), pour
  se fondre dans la carte 2 désormais teintée sans redevenir un rectangle blanc plein.
- Bouton Valider : l'icône `Check` à gauche du texte décentrait visuellement "Valider" (pas de
  contrepoids à droite) — corrigé avec une seconde icône `Check` identique mais `invisible` après le
  texte, pure béquille de mise en page pour rééquilibrer le centrage (vérifié par mesure DOM :
  centre du bouton = centre du texte, au pixel près).
- Libellé "Commentaire (motif, traçabilité)" → **"Commentaire"** en gras (le texte entre parenthèses
  jugé redondant dans ce contexte).
- **Textarea du commentaire recoins moins arrondis** sur retour maquette : la valeur par défaut de
  `Textarea` (`rounded-control`, 16px, tokenisée dans `globals.css`) remplacée localement par
  `rounded-md` (6px, override Tailwind classique, testé en DOM — pas besoin de `!important`, l'ordre
  de génération a suffi ici). **Nouvelle variante documentée dans `/design-system`** : deux exemples
  "FieldLabel + Textarea" ajoutés (défaut `rounded-control` vs variante compacte `rounded-md`), pour
  que ce choix de style reste visible/réutilisable plutôt qu'enterré dans un seul composant.
- Vérifié au passage (question posée par Vincent) : le texte de guidance du `placeholder` HTML natif
  ne part jamais en base si le champ n'est pas touché — `value` reste `""`, `executer()` envoie
  `commentaire.trim()`, et `deciderDemande()` fait `commentaire_decision: commentaire || null`.
  Comportement déjà correct, rien à corriger.

**Pastille jour (`JourBadge`) devant la date, `SuiviDemandeRow` (16/08/2026)** — demande initialement
mal ciblée (essayée par erreur sur le snippet CPI de `/parametrer/calendrier2`, revert immédiat) :
la bonne cible était `SuiviDemandeRow.tsx`, utilisé par `DetailCongePanel` (Suivre les demandes/Export
paie) et `SuivrePage`. `nomJourSemaine` (jusqu'ici locale à `CalendrierPage.tsx`) déplacée dans
`lib/format.ts`, exportée, pour être partagée sans dupliquer la logique.

**Piège rencontré, à retenir pour toute future variante compacte d'un composant `ui/` existant** :
`JourBadge` a des classes par défaut (`h-9 w-9 rounded-xl text-ink-900`, voir `JourBadge.tsx`) codées
en dur dans le `className` du composant, concaténées **avant** le `className` reçu en prop. Sur ce
projet (Tailwind v4), l'ordre de génération du CSS ne garantit **pas** qu'une classe passée en prop
gagne sur la classe par défaut de même propriété — constaté deux fois de façons opposées : `rounded-md`
passé à `Textarea` (`components/ui/Textarea.tsx`) a bien gagné sur `rounded-control` sans rien de
spécial, mais `rounded-none` puis `rounded-[2px]` passés à `JourBadge` n'ont **jamais** remplacé le
`rounded-xl` par défaut tant qu'ils n'étaient pas préfixés `!` (`!rounded-[2px]`) — vérifié en DOM
(`getComputedStyle(...).borderRadius`) après plusieurs allers-retours visuels trompeurs ("c'est
toujours un rond" alors que la classe _semblait_ correcte à la lecture du JSX). **Réflexe à avoir** :
dès qu'un override de classe sur un composant `ui/` ne semble pas prendre effet visuellement, vérifier
immédiatement `getComputedStyle` plutôt que de re-changer la valeur en boucle — et utiliser `!classe`
si le composant encode déjà cette propriété par défaut.

Rendu final, trois cas :

- **Jour plein** (`debut === fin`, pas de demi-journée) : `JourBadge` — `18×18px`
  (`h-[18px] w-[18px]`, plus compact que le `h-9 w-9` par défaut), coins `2px`
  (`!rounded-[2px]`, forcé), texte gris (`!text-ink-500`, forcé — le défaut du composant est
  `text-ink-900`, quasi noir) — devant la date.
- **Demi-journée** (`debut === fin`, `demiDebut === "apres_midi"` ou `demiFin === "matin"`) : même
  pastille, suffixe `" - ma"` ou `" - apm"` (minuscules, en gris `text-ink-500` via un `<span>` dédié
  — pas de majuscule contrairement à l'abréviation du jour dans la pastille) **après** la date plutôt
  qu'une deuxième pastille.
- **Période** (`debut !== fin`) : passage sur **deux lignes**, une pastille + une date par ligne
  (début puis fin), au lieu de l'unique ligne "X au Y" (`formatPeriodeDemande`) utilisée pour les
  deux autres cas. Le début et la fin d'une période peuvent chacun être une demi-journée
  indépendamment (ex. arrivée l'après-midi du premier jour, départ le matin du dernier) — suffixe
  `- apm`/`- ma` évalué séparément par extrémité (`labelDemiDebut`/`labelDemiFin`), contrairement au
  cas jour seul où `demiDebut`/`demiFin` décrivent la même unique journée.

**Colonne Type en initiales + pill Dates "déclenchée" inversée, `HistoriqueTable` (16/08/2026)** —
deux ajustements sur le tableau "Suivre les demandes" (mode `compact`), sans impact sur `/historique`
(mode par défaut, non `compact`) :

- **Type** : `libelleTypeCompact` (regex ad hoc qui abrégeait "Congés Payés" → "C. Payés") supprimée,
  remplacée par `LABEL_COURT` — le mapping d'initiales déjà utilisé par `TypeBadge` (cercle 36px) et
  la légende Accueil (CP, RTT, CPA, CSS, CE, RÉC, ÉVT...), désormais exporté de `TypeBadge.tsx` pour
  être réutilisé ici plutôt que reformulé. Un seul mapping d'initiales dans tout le repo au lieu de
  deux formulations différentes du même besoin.
- **Pill Dates, état "déclenché" (sélection ouverte)** : remplacé `ring-mint ring-2` (contour ajouté
  par-dessus le style normal) par une **inversion complète** — fond `classeFondTypeBadge(code)`
  (couleur du type), texte blanc, bordure transparente — au lieu du fond neutre + bordure/texte
  colorés de l'état normal. Reprend la convention déjà définie pour les pills de solde cliquables de
  Suivre les soldes (`/design-system`, "Pill de solde cliquable — état normal vs état déclenché") :
  état déclenché = inversion des couleurs de l'état normal, peu importe lequel des deux (fond plein
  vs contour) sert de "normal" pour la pill en question. L'état survol (`hover:opacity-70`) existait
  déjà et suit la même convention que ces pills de solde, inchangé.

**Curseur `pointer` manquant sur tous les `<button>` (16/08/2026)** — signalé par Vincent en testant
les pills et les boutons du panneau Décision ("je ne vois pas le curseur se transformer en main").
Cause : contrairement à `<a href>`, le curseur natif d'un `<button>` HTML est `default`, pas
`pointer` — vérifié en DOM (`getComputedStyle(...).cursor`) avant toute correction. Concernait tous
les boutons du repo (composant `Button` partagé **et** les ~20 fichiers avec des `<button>` custom :
pills, croix de fermeture, boutons de tableau...), pas seulement les deux exemples cités. Corrigé en
**une seule règle globale** dans `globals.css` (`button:not(:disabled) { cursor: pointer; }`) plutôt
que d'ajouter `cursor-pointer` fichier par fichier — plus robuste (couvre aussi les boutons futurs)
et évite d'en oublier un sur ~20 fichiers concernés. Un essai initial (ajouter `cursor-pointer` dans
`BASE_STYLES` de `Button.tsx`) a été reverté une fois la règle globale posée, devenu redondant.

**Encart "Régularisation" sorti du panneau congé (statut validé/annulé), `DetailCongePanel`
(16/08/2026)** — même principe que l'encart "Décision" du statut "en attente" (15-16/08/2026
ci-dessus). Plusieurs allers-retours de structure avant de se stabiliser (carte unique colorée façon
Décision → lien+carte séparés → titre coloré fusionné dans le lien → configuration finale ci-dessous)
— cette entrée documente directement l'état final, pas l'historique des essais intermédiaires.

Structure finale :

- Le lien **"Régularisation"** (repli par défaut, `regularisationOuverte`) flotte **directement sur
  le fond de page** (pas de `bg-surface-card`) — garde son style d'origine, un simple lien cliquable
  (`text-ink-500 text-xs font-semibold` + chevron `ChevronUp`/`ChevronDown`), pas un titre de carte.
- Une fois déployé, le formulaire apparaît dans sa **propre carte**, avec le même traitement visuel
  que l'encart "Décision" : fond teinté `color-mix(in srgb, var(--color-{type}) 5%, white)`, titre
  **"Régularisation de congés"** en `text-sm font-bold` coloré par le type (`classeTexteTypeBadge`),
  `Textarea` en `rounded-md`.
- **Commentaire obligatoire pour une régularisation** : label "Commentaire (obligatoire)", bouton
  d'action désactivé tant que `commentaire.trim()` est vide (`disabled={enCours || !commentaire.trim()}`).
- **Bouton d'action côté "validé"** renommé **"Signaler comme non pris"** (au lieu de "Supprimer") et
  son style suit l'état du commentaire plutôt que d'être fixe : `variant="secondary"` (idle, blanc)
  tant que vide, `variant="primary"` (mint) dès qu'un commentaire est saisi — abandon du style rouge
  danger (`text-status-danger-fg`/`bg-white/50`) qui ne correspondait plus au sens de l'action une
  fois renommée (moins "destructif", plus "signalement"). Le bouton côté "annulé" ("Restaurer",
  `onValider`) garde son style et son libellé, seule sa désactivation suit la même règle.

Panneau "en attente" : 2 cartes (congé + Décision). "validé"/"annulé" : 1 carte congé + un lien sans
carte + (si déployé) 1 carte "Régularisation de congés". "refusé" : 1 seule carte (rien en dessous).

**Espacement bas de la carte congé (feed) — 25px fixe (16/08/2026)** — motif esthétique : la carte
congé (header + `SuiviDemandeRow` + feed Posé le/Validé le + commentaire éventuel) doit toujours
laisser 25px entre la fin de son contenu et son bord bas, quel que soit le contenu affiché (feed
seul, ou feed + commentaire). Centralisé sur le conteneur de la carte (`pb-[25px]`) plutôt que sur
le dernier enfant affiché (qui varie selon le cas) — les `pb-*` locaux du bloc feed et du bloc
commentaire ont été retirés pour ne pas cumuler les espacements. Vérifié en DOM
(`getBoundingClientRect`) : exactement 25px dans les deux cas testés (avec et sans commentaire).

**Confirmations pour les actions de décision, `DetailCongePanel` (16/08/2026)** — deux patterns
distincts selon l'action, tranchés par questions posées à Vincent avant implémentation :

- **Valider** (carte Décision, statut en attente) : agit **immédiatement**, sans confirmation
  préalable, puis affiche un **bandeau "a posteriori"** — nouveau composant `components/ui/Toast.tsx`,
  ancré en haut de la page (`fixed inset-x-0 top-4`), auto-fermeture après 5s. Message : "Vous avez
  validé le congé de {Prénom} {Nom} - {Dates} - {Durée}" + lien "Annuler". Le bandeau doit survivre à
  la fermeture du panneau (qui se démonte au clic sur Valider comme les autres actions) — **porté par
  la page appelante** (`CongesPaiePage`/`SuivreDemandesPage`, chacune son propre état `toast`), pas
  par `DetailCongePanel` lui-même, via le nouveau prop `onValiderSucces?: (id, message) => void`.
  - "Annuler" appelle une **nouvelle action** `remettreEnAttenteDemande` (`demandes.repository.ts`) —
    repasse `statut = en_attente` et efface `validateur_id`/`commentaire_decision`/`date_decision`,
    un vrai "undo" plutôt qu'une régularisation (qui marque "annulé", pas "en attente"). Exposée par
    `useDemandesEquipe` (`remettreEnAttente`) et directement dans `CongesPaiePage`
    (`annulerValidation`, même pattern que `valider`/`refuser`/`regulariser` de cette page qui
    appellent le repository directement plutôt que par un hook).
- **Refuser et Régularisation** (Signaler comme non pris / Restaurer) : confirmation **a priori**, en
  **modale** (réutilise `components/ui/Modal.tsx` existant, pas de nouveau composant) — "Êtes-vous
  certain de {verbe} ce congé :" + résumé "{Prénom} {Nom} - {Dates} - {Durée}", Annuler
  (`variant="secondary"`) / Confirmer (`variant="primary"`). Un seul état `confirmation` générique
  dans `DetailCongePanel` (`{ question, action }`), le verbe et l'action réelle (`executer(onRefuser,
...)` etc.) injectés au moment du clic sur le bouton d'origine via `demanderConfirmation(verbe,
action)` — la modale ne connaît pas le détail de chaque cas, juste "afficher la question, exécuter
  l'action au clic Confirmer".
- Résumé "{Prénom} {Nom} - {Dates} - {Durée}" factorisé une fois (`resumeConge`, calculé en haut du
  composant à partir de `selection`), réutilisé tel quel par le message du toast et par la modale.

**Feed mis à jour immédiatement après confirmation, correction du bug optimiste connu (16/08/2026)**
— demandé par Vincent : voir le changement de statut dans le feed juste après avoir confirmé une
action, sans recharger la page.

- **`DetailCongePanel` ne se ferme plus après Refuser/Signaler comme non pris/Restaurer** (`executer`
  n'appelle plus `onClose()`, seulement `executerValidation` — pour Valider — le fait encore, geste
  volontaire différent de celui-ci). L'utilisateur voit directement la nouvelle ligne "Refusé le"/
  "Validé le" apparaître dans le feed du panneau resté ouvert, plutôt que devoir le rouvrir.
- Ça a exposé pour de bon le **bug déjà documenté le 16/08/2026** (mises à jour optimistes de
  `useDemandesEquipe` incomplètes, `dateDecision`/`validateur` jamais renseignés) — jusqu'ici masqué
  par la fermeture automatique du panneau. **Corrigé** : `useDemandesEquipe` re-fetch désormais la
  liste entière après chaque action (`version`/`refetch`, même pattern que `useCongesConsommes`) au
  lieu de patcher l'état localement — abandonne le commentaire "pas de re-fetch, la liste peut être
  longue" qui motivait l'ancienne approche, la donnée à jour prime sur l'économie d'un appel réseau
  ici. `CongesPaiePage` faisait déjà ainsi (`refetch()`), non concerné par ce bug.

**Commentaire du salarié à la pose affiché dans le feed (16/08/2026)** — `selection.note` (le message
optionnel saisi dans "Nouvelle demande", jusqu'ici jamais affiché nulle part dans ce panneau, à ne
pas confondre avec `commentaireManager`, le commentaire du manager à la décision, déjà affiché)
apparaît maintenant sous la ligne "Posé le", même conteneur que le reste du feed. Aligné exactement
sur le texte "Posé le" (vérifié par mesure DOM avec `Range.getBoundingClientRect`, pas la position de
la boîte du `<div>` qui aurait inclus le padding du parent) — premier essai décalé de 16px (pensé en
"padding absolu depuis le bord de la carte" comme `commentaireManager`, qui lui est un sibling direct
de la carte sans padding, alors que ce nouveau bloc est imbriqué dans le conteneur du feed qui a déjà
son propre `px-4` : correction en `pl-[0.875rem]` — le complément, pas le total). Les **deux**
commentaires du feed (`selection.note` et `selection.commentaireManager`) passés en **italique**
(`italic`) sur demande, pour les distinguer visuellement du reste des lignes du feed — et
**alignés sur la même taille** (`text-[10px]`, celle du commentaire employé) : celui du manager
traînait encore en `text-xs` (12px) d'avant l'introduction du commentaire employé, tailles
désormais iso entre les deux.

**En cours / pas encore fait** :

- **Suite du chantier "Détail du congé" ci-dessus, explicitement interrompue pour reprise plus
  tard** : le feed ne montre que Posé le/Validé le/Refusé le — pas encore de traitement pour un
  événement de Régularisation (validé→annulé ou annulé→validé, voir `onRegulariser`), qui devrait
  logiquement devenir un item de feed lui aussi plutôt que de rester la mécanique à part actuelle.
- **Bug trouvé en testant ce chantier, pas corrigé** : les mises à jour optimistes de
  `useDemandesEquipe.ts` (`valider`/`refuser`/`regulariser`) mettent à jour `statut` et
  `commentaireManager` en local mais **oublient `dateDecision` et `validateur`** — juste après avoir
  cliqué Valider/Refuser, la ligne "Validé le/Refusé le" n'apparaît pas dans le feed tant que la
  page n'est pas rechargée (les données sont bien en base, seul l'état local React est incomplet).
- Données de test polluées pendant la vérification de ce chantier : la demande RTT de Delphine
  (17 août 2026, posée le 15/08) a été refusée avec le commentaire "Test commentaire de
  vérification" pour valider l'affichage. Toutes les demandes "en attente" initiales ont fini
  validées/refusées au fil des tests des 15-16/08 (plus aucune en attente en base) — une demande CP
  de test (Olivier Test, 01/12/2026, sans commentaire) a été reposée le 16/08 pour retester l'encart
  Décision et reste actuellement "en attente" en base. À nettoyer/ignorer selon besoin.
- Intégration de la vraie charte graphique Abeil (`Charte-abeil/` reçu en local, contient PDF +
  nouveau pack de logos, **non commité** — voir Conventions)
- Espace Manager, suite de l'Espace Delphine (paramétrage RTT imposés, correction de solde), accès
  Comptable — voir "Export paie (14/08/2026)" ci-dessous pour ce qui est fait côté récapitulatif
  mensuel
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

**Accueil2 — itération intensive (16-17/08/2026)**, route `/dashboard3` (nom de fichier
`Dashboard3Page.tsx` — 3e itération après `Dashboard2Page`), nav sous "Accueil2" :

- Sous-rubrique **"Mon calendrier"** (`/mon-calendrier`, `MonCalendrierPage.tsx`) créée en
  extrayant tel quel l'ancien bloc "Mes Congés" (calendrier + légende CPI/DJI/Fériés/PERSO)
  d'Accueil2, qui ne montre plus que le bandeau Soldes.
- **3 cards 1/3 largeur** en dessous du bandeau Soldes, ordre final : `ProchainsJoursOffCard` →
  `CalendrierMoisCourantCard` (1/3) → `ActiviteRecenteFeed` (1/4, seule à avoir été repassée en
  largeur réduite sur demande explicite).
  - **`CalendrierMoisCourantCard`** : mois en cours + mois suivant (gère le chevauchement d'année,
    deux `useCalendrier`), congés/CPI/DJI/FERIE réels avec la même priorité d'affichage que
    `MonCalendrierPage`. `MiniCalendrier` (`components/ui/MiniCalendrier.tsx`) gagne deux props
    opt-in **`sansCarte`** (snippet nu, sans la carte/le titre par défaut — pour un appelant qui
    fournit sa propre carte) et **`agrandi`** (case carrée au lieu de ronde/pilule, typo/hauteur de
    ligne recalées sur `PeriodeAvecPastilles` en mode `grand`, liseré `border-ink-300/40` délimitant
    chaque case, titre du mois en `text-ink-500`/`text-base` — gris et sobre plutôt que noir/gras) et
    **`estAujourdhui`** (contour rond serré autour du seul chiffre, jamais un remplissage, pour ne
    jamais laisser croire à un type de congé qui n'existe pas — y compris quand le jour tombe dans
    une barre de congé fusionnée). Aucun de ces props ne touche le rendu par défaut de
    `MonCalendrierPage`.
  - **`ProchainsJoursOffCard`** : jours non travaillés à venir, sélecteur de vue en titre (natif
    `<select>` stylé + chevron, même pattern que "Solde actuel ▾" de `SoldeDetailPanel` — pas une
    case à cocher) entre "Prochains jours off" (demandes perso validées + CPI + DJI + FERIE, badge
    Durée vert) et "En attente de validation" (uniquement les demandes perso non tranchées, badge
    Durée orange ; CPI/DJI/FERIE n'ont pas de notion d'attente, absents de cette vue). Chaque ligne :
    `TypeBadge` cerclé + `PeriodeAvecPastilles` (`grand`) + `Badge` (icône `STATUT_CONFIG` pour les
    demandes perso, vert sans icône pour CPI/DJI/FERIE — jamais un événement de décision).
    `PeriodeAvecPastilles` gagne une prop opt-in **`grand`** (`text-sm` au lieu de `text-xs`,
    `JourBadge` 17px) pour cette card, sans toucher `SuiviDemandeRow`/`ActiviteRecenteCard`.
  - **`ActiviteRecenteFeed`** : remplace `ActiviteRecenteListe` (gardé en fichier, inutilisé) —
    format phrases en langage naturel ("Vous avez posé une journée de CP - le 15/01/2027 - **en
    validation**", "Olivier a **validé** votre journée de CP du 01/12/2026") plutôt que le format
    carte. Un événement "posé" (toujours) + un événement "décision" (si tranchée) par demande, triés
    du plus récent au plus ancien. Verbe/statut surlignés en "stabilo" (fond coloré, tokens
    `status-warning/success/danger`) ; type et dates en semi-gras (essayé en couleur du type
    d'abord, jugé plus sobre en semi-gras simple) ; pastille de couleur (type de congé) devant
    chaque entrée ; chaque ligne est un lien vers `/historique?demande=<id>` (roll au survol comme
    seule affordance, pas de soulignement) qui ouvre directement le panneau détaillé sur la demande
    concernée.
  - **`validateur` remonté au niveau de `Demande`** (`lib/types.ts`) — auparavant réservé à
    `DemandeEquipe` (vue manager). `fetchDemandes()` (`lib/data/demandes.repository.ts`) embarque
    désormais `utilisateurs!validateur_id(id, prenom, nom)` dans son select de base, pour que le
    feed "Activité récente" du collaborateur puisse nommer qui a validé/refusé sa propre demande
    (pas seulement côté `/suivre`).
  - **`HistoriquePage`** (`/historique`) : pré-sélection via `?demande=<id>` (lien depuis Activité
    récente d'Accueil2) qui ouvre directement `DetailCongePanel` déployé sur cette demande — `useSearchParams`
    nécessite un `<Suspense>` autour de la page (`app/(app)/historique/page.tsx`). Fallback sur la
    liste complète non filtrée si la demande liée est exclue par les filtres actifs de la page
    (ex. lien vers une demande 2027 alors que le filtre par défaut est "Année en cours"). Nouveau
    filtre **"Tous les types"** (même liste/pattern que `SuivreDemandesPage`).
  - **`DetailCongePanel`** passe en lecture seule pour un collaborateur consultant sa propre
    demande : `selection` accepte `Demande & Partial<Pick<DemandeEquipe, "demandeur" | "validateur">>`,
    `onValider`/`onRefuser`/`onRegulariser` optionnels — `peutDecider` (dérivé) masque entièrement
    les encarts Décision/Régularisation quand absents, sans dupliquer le composant.
  - **Essais tentés puis explicitement abandonnés** (à ne pas reproduire sans revalider l'intention) :
    card "Mes soldes" (fond mint, `SoldeCard` empilées) en 3e position — annulé, retour au bandeau
    Soldes du haut ; dates de décision recolorées directement dans le corps de la phrase (sans
    stabilo) ; libellé "Voir" + soulignement sur les liens du feed ; extraction d'un composant
    `FeedDemande` partagé entre la popin et Accueil2 reprenant la timeline à points "Posé
    le/Validé le" de `DetailCongePanel` — la card garde finalement le simple trio `TypeBadge` +
    `PeriodeAvecPastilles` + `Badge`, pas la timeline complète (qui n'a de sens que dans le contexte
    d'un panneau dédié à une seule demande). Fichiers `MesSoldesCard.tsx`/`ActiviteRecenteListe.tsx`
    conservés mais inutilisés (aucun import actif) au cas où.

**Accueil / Accueil2 — itération du 18/08/2026** (session dense, beaucoup d'allers-retours ;
liste ci-dessous = ce qui est réellement resté) :

- **Deux bugs réels trouvés et corrigés en cours de route** (pas des changements demandés au
  départ, remontés par Vincent en testant) :
  - **Débordement horizontal** sur `MonCalendrierPage` (`/mon-calendrier`) et
    `CalendrierMoisCourantCard` (Accueil2) : la grille des mois (`flex-1`, CSS
    `grid-template-columns: repeat(auto-fit, minmax(170px,1fr))`) n'avait pas de `min-w-0` —
    ne pouvait jamais rétrécir sous la largeur min-content de tous ses mois, débordait hors de
    l'écran au lieu de replier en colonnes. Corrigé (`min-w-0` sur l'élément flex concerné),
    vérifié de 375px à 1280px.
  - **`fetchHistoriqueCp`/`fetchHistoriqueRtt`** (`soldes.repository.ts`) généraient leur liste de
    mois seulement du début de la période jusqu'au mois **courant** — toute demande validée par
    avance sur un mois futur de la période (ex. novembre alors qu'on est en août) tombait sur une
    clé de mois inexistante et disparaissait silencieusement du détail de solde (`SoldeDetailPanel`),
    créant un delta avec le résumé (`fetchSoldes`, lui non borné). Corrigé : borne haute = le plus
    tardif entre aujourd'hui et le dernier mouvement réel. `fetchHistoriqueCpa` n'avait pas ce bug
    (clés dérivées directement des dates de mouvements, pas d'une boucle bornée à "aujourd'hui").
  - **Tri du feed "Activité récente"** (`ActiviteRecenteFeed.tsx`) : `date` n'a qu'une granularité
    jour, donc "posé" et "décidé" le même jour étaient à égalité — le tri stable de JS gardait
    l'ordre d'insertion ("posé" avant "décidé"), alors qu'une décision arrive forcément après la
    pose. Départage explicite ajouté (`comparerEvenements`) : à date égale, "décidé" passe devant
    "posé".
  - **`useDemandes`** ne fetchait qu'une fois au montage — une décision prise ailleurs (autre
    onglet/session) pendant qu'Accueil restait ouvert n'était jamais remontée. Ajout d'un refetch
    automatique au retour sur l'onglet (`visibilitychange`), même pattern `refetch`/`version` que
    `useCongesConsommes`/`useDemandesEquipe`.
- **Accueil (`Dashboard2Page`, `/`)** :
  - `SoldeCard` gagne une pastille "i" colorée (couleur du type, pas l'icône `Info` de lucide qui a
    son propre contour — double contour sinon) à droite de la valeur, ouvre `SoldeDetailPanel` en
    overlay centré (backdrop manuel, pas `Modal` — le panneau a déjà son propre bandeau plein bord).
  - Popins légende CPI/DJI/Fériés/PERSO (clic sur une card légende) : lignes alignées sur le
    gabarit période + `Badge`, `TypeBadge` remplacé par une simple pastille de couleur (toutes les
    lignes d'une même popin partagent déjà le même type, le cercle répété faisait redite).
  - Jour courant cerclé sur le calendrier "Mes Congés" (`estAujourdhui` n'était pas câblé).
  - Sélecteur "Débute : Mois en cours" déplacé dans la même ligne que les pastilles
    année/période au lieu d'être sur sa propre ligne.
  - Bandeau "En attente de validation" retiré, remplacé par une ligne "Mes demandes" : pill
    "{n} En validation" (orange si > 0, cliquable vers `/historique?statut=en_attente` — nouveau
    filtre pré-sélectionné, lu par `HistoriquePage`), lien "Suivre mes demandes" (`/historique`),
    lien "Journal" (ouvre le tiroir `ActiviteRecenteFeed`, réutilisé tel quel depuis Accueil2).
  - **Essai abandonné en cours de session** : bandeau "Activité récente"/"Suivre mes activités"
    (surligné selon décisions non vues, tracking `localStorage`) — ajouté puis retiré une fois
    "Journal" en place (devenu redondant), tracking `localStorage` nettoyé avec.
- **Accueil2 (`Dashboard3Page`, `/dashboard3`)** : calendrier réintégré à droite de "Prochains
  jours off" (gabarit `MiniCalendrier` par défaut, pas `agrandi` — demande explicite "les templates
  de Mon calendrier"), grille `auto-fit`/`minmax(170px,1fr)` pour replier en 1 colonne si la place
  manque. **Essai tenté puis annulé** : encart "Soldes" (300px, CP/RTT/CPA empilés) à gauche de
  "Prochains jours off" — retiré à la demande de Vincent juste après l'avoir vu.
- **`compterDecisionsRecentes`** (ajouté pour le bandeau "Activité récente" ci-dessus) retiré avec
  lui, pas de trace morte.

**Popin "Nouvelle demande" refondue (18/08/2026)**, `components/nouvelle-demande/PoserDemandeModal.tsx`
— remplace l'ancien formulaire plein écran (`NouvelleDemandeForm`, code conservé mais plus utilisé) et
un premier essai de calendrier maison cliquable (abandonné le même jour). Reprend le gabarit
`DatePicker` déjà en place pour les popins CPI/DJI plutôt qu'un calendrier fait main : le `disabled`
bloque directement, dans la grille, les jours non sélectionnables (week-end, férié, jour déjà
imposé/posé) — un vrai blocage plutôt qu'un avertissement visuel après coup.

- **Structure de la popin** — bandeau plein `TypeBadge` cerclé de blanc (teinte = couleur du type
  sélectionné) + titre + croix ; corps en quatre sections titrées dans la même typo que les onglets de
  période "Mes Congés" (`text-sm font-semibold`) : **Type d'absence** (sélecteur), **Période**
  (Du/Au), **Solde**, **Message (facultatif)**. `Modal` gagne `separateur={false}` pour cet en-tête
  discret (pas de liseré entre bandeau et corps, contrairement à CPI/DJI).
- **Sélecteur de type** (`SelectPille`) coloré dans la teinte du type en cours (bordure, chevron,
  survol, texte) — CP/RTT/CPA/CSS/CE ont une variante de texte **plus foncée** que leur token de
  base (`TEXTE_TYPE_IMPORTANT`, classes littérales une par code, RTT réutilisant
  `--color-status-success-fg` déjà dans la palette, les autres en valeur arbitraire ~35% plus sombre)
  — la couleur brute de ces tokens est trop peu contrastée en typo sur fond blanc, mais reste
  inchangée partout ailleurs (badges, pastilles calendrier).
- **Un seul jour possible en ne renseignant que "Du"** : le calcul de jours/solde ne bloque plus sur
  `fin` renseigné — `finPourCalcul = fin && fin >= debut ? fin : debut`, utilisé partout (calcul,
  solde, soumission). Le sélecteur journée/demi-journée reste toujours côté "Du" tant que la période
  effective est un seul jour (`unSeulJour = Boolean(debut) && (!fin || fin === debut)`), y compris
  quand "Au" est explicitement renseigné à la même date que "Du" — il ne "saute" côté "Au" que pour
  une vraie période multi-jours.
- **`DatePicker`** (`components/ui/DatePicker.tsx`) — quatre nouvelles props opt-in (défaut =
  comportement historique pour CPI/DJI, non touché) :
  - `compact` : champ + grille légèrement réduits (texte `text-lg` au lieu de `text-xl`, cellules
    38/36px au lieu de 44/42px).
  - `dateMarquee` : matérialise une date dans la grille par un **rond plein** dans la couleur
    d'accent de CE picker (classe globale `.rdp-jour-marque`, `app/globals.css`) sans que ce soit la
    date sélectionnée de ce picker — utilisé sur "Au" pour garder un repère visuel de "Du" une fois
    qu'on choisit la fin de période.
  - `moisInitial` : mois d'ouverture de la grille (sinon mois de `value`/mois courant) — le picker
    "Au" s'ouvre directement sur le mois de "Du" plutôt que toujours le mois courant.
  - **Calendrier rendu en portail** (`createPortal` dans `document.body`, `position: fixed` calculée
    depuis `getBoundingClientRect()` du champ, recalculée au scroll/resize) — nécessaire depuis que
    `Modal` limite sa hauteur (`max-h-[90vh]`, voir plus bas) : un calendrier en `position: absolute`
    classique se retrouvait rogné par l'`overflow-y-auto` du corps de la popin dès qu'il dépassait la
    zone visible. Le clic-extérieur (fermeture) vérifie maintenant aussi le contenu du portail
    (`popoverRef`), sinon un clic dans le calendrier se serait interprété comme "extérieur".
  - **Jour "aujourd'hui" matérialisé de façon neutre** sur tous les calendriers de l'app (règle
    globale, `app/globals.css` : `.rdp-today` — anneau `--color-ink-500` + texte `--color-ink-900`),
    plutôt que dans la couleur d'accent de chaque instance (qui varie par type de congé) — cohérence
    demandée entre CPI/DJI et "Poser un jour".
- **Bug de calcul corrigé** : `joursOuvres(debut, finPourCalcul, joursFeries)` n'passait pas
  `djImposees` (4e paramètre optionnel de la fonction, `lib/joursFeries.ts`) — une ou plusieurs DJI à
  l'intérieur d'une période sélectionnée n'étaient donc jamais déduites (0,5j chacune) du nombre de
  jours ni du solde affichés. Signalé par Vincent avec un cas réel (31/08→25/09, 2 DJI dans la
  période, total affiché comme si elles n'existaient pas) ; corrigé en passant `djImposees` (déjà
  chargée pour le détail "voir", voir plus bas).
- **Détail "voir" (lien sous "Soit N jours")** — bascule un encart gris `bg-surface-app` sous le
  champ (le lien passe de "voir" à "masquer", pas de calendrier mensuel complet) : jours de la
  période mis à plat par semaine (une ligne par semaine, week-ends toujours masqués comme
  `MiniCalendrier`), en-têtes L-M-M-J-V par semaine, libellé du mois affiché seulement quand il
  change d'une semaine à l'autre. Chaque jour coloré selon sa vraie nature plutôt que toujours la
  couleur du type demandé — même priorité que `MiniCalendrier` : férié > congé imposé (CPI) > demi-
  journée imposée (DJI) > une autre demande personnelle déjà posée (`codeDuJour`) > le type en cours
  de saisie sinon. Objectif : visualiser comment la période choisie s'articule avec d'autres
  absences déjà en place, sans reproduire un calendrier mensuel complet.
- **Gestion des soldes négatifs** : `pillSolde` inverse son style quand la valeur est négative — fond
  blanc, texte rouge (`--color-status-danger-fg`), liséré dans la couleur du type (au lieu du badge
  plein couleur habituel). Le bouton "Envoyer la demande" est **désactivé** dès que "Après la
  demande" serait négatif (`soldeNegatif`), et le `Button` (`components/ui/Button.tsx`) a son état
  désactivé revu globalement — fond/texte gris (`bg-ink-300`/`text-ink-500`) au lieu d'une simple
  opacité réduite sur la couleur active, pour que "désactivé" se voie sans ambiguïté (tous les
  boutons de l'app, pas seulement celui-ci).
- **Ligne "Actuel" du bloc Solde** volontairement moins mise en avant que les deux autres lignes
  (à la date de la demande / après la demande) : fond blanc, liséré + texte dans la couleur du type
  (variante "off" de `pillSolde`, 3e paramètre `attenue`) plutôt que le badge plein couleur.
- **Compteur de caractères sur "Message"** (`NOTE_LONGUEUR_MAX = 200`, `maxLength` sur le
  `Textarea`) — compteur `x/200` sous le champ, passe en orange (`text-status-warning-fg`) à partir
  de 175 caractères, en rouge (`text-status-danger-fg`) à 200 (limite dure, blocage de la saisie au-
  delà, pas juste un avertissement).
- **`Modal` (`components/ui/Modal.tsx`)** — deux changements qui touchent TOUTES les popins de l'app,
  pas seulement celle-ci :
  - Le panneau est maintenant borné à `max-h-[90vh]` (`flex flex-col`) : l'en-tête reste fixe, le
    corps scrolle en interne (`overflow-y-auto`) — avant ce fix, une popin au contenu long (ex.
    "voir" déployé sur une longue période) pouvait dépasser la hauteur de l'écran sans aucun scroll
    possible.
  - `align="top"` remonté (`pt-12` au lieu de `pt-24`) — popin plus proche du haut de l'écran.
  - **Essai fait puis annulé dans la même session** : verrouillage du scroll de la page derrière une
    popin ouverte (`document.body.style.overflow = "hidden"` en effet de montage/démontage) — retiré
    à la demande de Vincent juste après implémentation, la page derrière doit rester scrollable.
- **Bug de comptage des jours corrigé (18/08/2026)** — "Soit N jours" dans la popin "Nouvelle
  demande" ne déduisait que week-ends/fériés/DJI (via `joursOuvres`), pas les congés imposés (CPI)
  ni une demande personnelle déjà posée sur la période choisie : ces jours étaient comptés en trop
  dans le nombre de jours ET dans l'impact sur le solde (signalé par Vincent avec un cas réel : CP
  10/07→31/08 avec un CPI 17→21 août, système affichait 35,5j au lieu de 30,5j). Premier correctif
  (comparer `typeSurDemiJour(...)` à `option.code`) incomplet : confondait "demi-journée libre et
  demandée" avec "déjà occupée par une AUTRE demande du même type" dès que le chevauchement était,
  par exemple, un CP sur un CP déjà posé (aucune confusion possible avec RTT, couleur différente —
  c'est ce qui a permis de déceler le vrai problème). Fix définitif : séparation de
  `typeOccupantDemiJour` (ce qui occupe déjà une demi-journée, indépendamment de la nouvelle
  demande) et `typeSurDemiJour` (ce qui s'affiche dans le détail "voir") — le comptage n'utilise
  QUE le premier. Vérifié sur les deux cas réels signalés (30,5j ; et une demande CP 18/09→28/09
  chevauchant une demande CP déjà posée 21→25/09 → 2j, pas 12).
  - **Trou de règle de gestion identifié en creusant ce bug** (ajouté au Backlog, priorité Haute) :
    le contrôle anti-chevauchement CPI/DJI/demande existante n'existe QUE côté client, dans le
    filet de sécurité de `handleSubmit` (`PoserDemandeModal.tsx`) — et il ne couvre même pas les
    DJI. Rien côté serveur : `creerDemande` (`demandes.repository.ts`) insère sans vérifier
    `conges_imposes`/`demi_journees_imposees`, et `validerDemande` ne revérifie rien au moment de
    la validation manager (un CPI ajouté après coup sur une demande déjà en attente ne redéclenche
    aucune alerte). Explique une partie des données de test incohérentes trouvées en base (demandes
    validées chevauchant un CPI).
  - **Nettoyage associé** : `NouvelleDemandeForm.tsx` (ancien formulaire plein écran, remplacé par
    la popin le 18/08/2026 mais laissé en place "au cas où") supprimé — plus référencé par aucune
    route depuis que `/nouvelle-demande` pointe sur `PoserDemandeModal`, c'était un second chemin
    de création qui contournait le filet de sécurité anti-chevauchement.
- **Décision produit sur le chevauchement CPI, puis étendue à tout chevauchement (18/08/2026)** —
  signalé par Vincent avec un cas réel : demande CP 14→24 août avec 5 jours de CPI au milieu, comptage
  correct (2 jours affichés) mais soumission bloquée par le filet de sécurité avec un message
  générique. Première décision : un CPI au milieu d'une période plus large ne doit PLUS bloquer la
  soumission — il est déjà exclu du décompte (`typeOccupantDemiJour`), donc une période avec un CPI
  dedans est un cas légitime, pas une erreur à corriger. Étendue le même jour à TOUT chevauchement, y
  compris avec une AUTRE demande personnelle (cas réel : une journée déjà posée le 11/08, pas encore
  validée ; poser ensuite 10/08→13/08 compte bien 3 jours, ce qui est correct — il ne doit pas non plus
  y avoir de blocage) : **la transparence prime sur le blocage**, principe produit explicite ("les
  calendriers sur la page soldes sont là pour ça"). `handleSubmit` (`PoserDemandeModal.tsx`) n'a plus
  aucun filet de sécurité anti-chevauchement — le calcul exclut déjà ce qui est occupé, il suffit de
  l'afficher correctement. Le détail "voir" matérialise maintenant une légère transparence
  (`opacity-45`) sur toute demi-journée déjà occupée (férié, CPI, DJI, ou une autre demande), même
  quand elle partage la couleur du type affiché (avant, un jour "CP sur CP" se fondait visuellement en
  un bloc plein sans distinction — corrigé en rendant systématiquement deux demi-blocs plutôt qu'un
  bloc unique quand les couleurs coïncident). Vérifié en soumettant deux vraies demandes (14/08→24/08,
  2j ; 10/08→13/08, 3j avec le 11 en transparence). `jourDejaOccupe` (CPI + demande) reste inchangée
  par ailleurs, toujours utilisée pour désactiver les BORNES du `DatePicker` (on ne peut pas démarrer/
  finir littéralement sur un jour déjà occupé, seul le milieu d'une période n'est plus bloquant).
  - **Verrouillage du sélecteur de demi-journée sur une DJI** — cas à la marge signalé par Vincent :
    une période qui démarre ou se termine sur une DJI doit verrouiller le sélecteur Du/Au (ou le
    sélecteur "Journée/Matin/A. midi" en mode un seul jour) sur l'unique créneau cohérent (celui que la
    DJI n'occupe pas) plutôt que de laisser un choix qui n'a pas de sens. Implémenté via
    `djiSurDate`/`demiParDefautDebut`/`demiParDefautFin` et des listes d'options filtrées
    (`dureeUnJourOptions`/`demiDebutOptions`/`demiFinOptions`), `SelectPille` passé en `disabled` quand
    une seule option reste. Vérifié : demande d'un seul jour sur une date avec DJI l'après-midi →
    sélecteur verrouillé sur "Matin", 0,5 jour.
  - **Extraction en composant partagé** — le détail "voir" (grille par semaine, transparence) et le
    résolveur d'occupant (`typeOccupantDemiJour`) étaient dupliqués nulle part ailleurs jusqu'ici, mais
    la nouvelle fonctionnalité "Voir" côté validation manager (ci-dessous) en avait besoin à
    l'identique : extraits dans `components/demandes/DetailPeriodeConges.tsx`
    (`DetailPeriodeConges` + `creerResolveurOccupant` + `demiCouvertePeriode`), `PoserDemandeModal.tsx`
    refactorisé pour consommer ce module plutôt que sa propre copie.
- **Lien "Informations complémentaires" sur la validation manager (18/08/2026)** — demande de Vincent :
  sur "Suivre les demandes" (`/suivre/demandes`, `SuivreDemandesPage.tsx`), dans le panneau de détail
  d'une demande "en attente" (`DetailCongePanel.tsx`), APRÈS l'encart Décision (Commentaire +
  Refuser/Valider), un lien "Informations complémentaires" (même gabarit que le lien "Régularisation"
  déjà existant pour validé/annulé — texte + chevron) déploie la même représentation par semaine que la
  popin de dépôt (`DetailPeriodeConges`), pour que le manager voie concrètement ce qui compte avant de
  valider. Essai intermédiaire abandonné le même jour : d'abord posé sur `/suivre` ("Demandes à
  traiter", `DemandeEquipeRow.tsx`) et libellé "voir"/"masquer" entre le récap et les boutons — mauvais
  écran (Vincent visait "Suivre les demandes") et mauvais libellé/emplacement, entièrement revu.
  L'occupant (transparence) se base sur les AUTRES demandes du même employé (filtrées depuis
  `useDemandesEquipe`, qui charge déjà toute l'équipe) plutôt que sur celles du manager — calendrier
  (fériés/CPI/DJI) chargé une fois dans `SuivreDemandesPage` via `useCalendrier` (année courante +
  suivante, données globales valables pour n'importe quel employé) et passé en props (optionnelles :
  absentes, le lien ne s'affiche pas — `CongesPaiePage.tsx`, qui réutilise aussi `DetailCongePanel`
  mais ne traite pas de demandes "en attente" par ce panneau, n'a rien à changer).
- **Comptage serveur corrigé — DJI et CPI (18/08/2026)** — `calculerNbDemiJournees`
  (`demandes.repository.ts`, calcul exécuté à l'enregistrement réel dans `creerDemande`) ne déduisait
  ni les DJI ni les CPI de la période, contrairement à l'aperçu client (`typeOccupantDemiJour`),
  causant un décompte PERSISTÉ différent de celui affiché avant l'envoi (signalé par Vincent : demande
  3→7 août comptée 5j en base au lieu de 4,5j, la DJI du 7/08 non déduite). Fix : ajout d'un fetch de
  `demi_journees_imposees` et `conges_imposes` sur la période (en plus de `jours_feries` déjà
  interrogé), et d'un helper `demiCouvertePeriode` dupliqué côté serveur (pas de module partagé entre
  code serveur et composant, même limitation que côté client). Vérifié en soumettant une vraie demande
  31/08→11/09/2026 couvrant la DJI du 11/09 après-midi : affichée 9,5j avant envoi, persistée 9,5j en
  base après envoi (`/historique`). **Les demandes de test déjà en base avant ce fix ne sont PAS
  corrigées rétroactivement** — "3 août-7 août 2026" reste à 5j (devrait être 4,5j) et "14 août-24 août
  2026" reste à 7j (devrait être 2j), ce sont des données de test à corriger manuellement ou à ignorer.
  Toujours aucune vérification anti-chevauchement CPI/DJI côté serveur ni à la validation manager (voir
  Backlog, priorité Haute, point non traité par ce fix).
- **Deux entrées retirées de la nav "Poser" (18/08/2026)**, `components/layout/tabs.ts` :
  - **"Calendrier2"** (`/calendrier2`, `components/dashboard/Calendrier2Page.tsx`) — route et
    composant supprimés, plus référencés nulle part ailleurs. Distinct de `/parametrer/calendrier2`
    (`Calendrier2Page` dans `components/parametrer/CalendrierPage.tsx`, libellé nav "Calendrier"),
    conservé — deux composants différents qui partageaient juste le même nom.
  - **"Nouvelle demande"** (`/nouvelle-demande`) — seule l'entrée de nav est retirée, la route et
    `PoserDemandeModal` restent en place (deep-link toujours fonctionnel) : le parcours réel passe
    par la tuile "Poser un congé" d'Accueil, qui ouvre déjà la popin en state local sans navigation
    (`Dashboard2Page.tsx`), rendant l'entrée de nav redondante.
- **Tiroir "Mes demandes" ("Listing") sur Accueil (18/08/2026)**, `components/dashboard/ListingTiroir.tsx`
  — nouveau tiroir déclenché par une pill grise après "Journal" : liste les demandes triées par date de
  dernière action (Validé/Refusé si décidée, sinon Posé) décroissante, gabarit complet
  `DetailCongePanel` empilé tel quel (pas de liste intermédiaire cliquable, essayé puis abandonné).
  Trois nouvelles props opt-in sur `DetailCongePanel` (`components/suivre/DetailCongePanel.tsx`),
  toutes scopées à cet usage (aucun autre appelant — `SuivreDemandesPage`/`CongesPaiePage` gardent le
  gabarit d'origine) :
  - `masquerFermer` — cache la croix de fermeture individuelle (le tiroir n'en a pas besoin, chaque
    carte n'a pas sa propre fermeture).
  - `masquerTypeBadgeBandeau` — cache le cercle `TypeBadge` du bandeau, remplacé par une pastille de
    couleur directement sur la ligne dates (comme `SuiviDemandeRow`) ; le bandeau lui-même perd son
    fond coloré plein cadre (devient transparent, juste le texte teinté via `classeTexteTypeBadge` +
    la pastille), le séparateur entre le titre et les dates est retiré, celui entre les dates et le
    feed (Posé/Validé/Refusé) passe dans la couleur du type (`classeBordureTypeBadge`) plutôt que gris,
    l'espace en bas de carte est réduit de moitié, et les classes `xl:sticky xl:top-4 xl:w-64
xl:shrink-0` (pensées pour l'usage sidebar de page) sont retirées pour ce contexte de tiroir étroit
    — **sans ce dernier point, plusieurs cartes `position: sticky` empilées cassaient complètement le
    scroll du tiroir sur grand écran (≥1280px), bug découvert et corrigé le 18/08/2026**.
  - `masquerBandeau` (préexistant, ajouté plus tôt le même jour pour un tiroir "En validation" — voir
    ci-dessous, depuis supprimé) : reste disponible dans l'API du composant, plus aucun appelant actuel.
    Largeur du tiroir : `294px` (colonne droite normale de `DetailCongePanel`, `w-64`/256px, élargie de
    15% à la demande explicite de Vincent). En-tête ("Mes demandes" + croix) repris tel quel du tiroir
    "Journal" (`ActiviteRecenteFeed`).
- **Tiroir "En validation" ajouté puis entièrement supprimé (18/08/2026)** — `DemandesEnAttenteTiroir`
  (composant + pill orange sur Accueil, ouvrait la liste des demandes en attente du collaborateur) créé
  en premier essai de ce type de tiroir, puis retiré à la demande de Vincent une fois "Mes demandes"
  en place (redondant). Fichier `components/dashboard/DemandesEnAttenteTiroir.tsx` supprimé, plus
  aucune référence dans le code (seul un commentaire dans `DetailCongePanel.tsx` documente encore
  pourquoi `masquerBandeau` existe).
- **Lien "Suivre mes demandes" retiré puis réintroduit en grande phrase cliquable (18/08/2026)** — le
  lien texte souligné vers `/historique` (non filtré) a été supprimé une première fois (redondant avec
  "Mes demandes"), puis Vincent a demandé 3 "grandes phrases" cliquables sous Soldes (même taille que
  "Bonjour, {prénom}", `text-2xl`, puis passées à `text-[30px]`, fond `hover:bg-mint`/texte blanc au
  survol) : "Poser un congé" (ouvre la popin), "Suivre mes demandes" (ouvre le tiroir "Mes demandes"),
  "Quelles semaines poser en 2027 ?" (ouvre `ReglesCongesModal`, le même "découvrir"). **Ces 3 phrases
  ont ensuite été retirées d'Accueil (`Dashboard2Page.tsx`) le même soir** — gardées uniquement sur
  Accueil2 (`Dashboard3Page.tsx`, voir ci-dessous), le "premier Accueil" reste avec "découvrir" +
  gros bouton "Poser un congé" dans la grille Soldes + "Journal"/"Mes demandes".
- **Accueil2 redevenu un vrai duplicata de travail (18/08/2026)** — supprimé une première fois dans la
  soirée (route `/dashboard3`, composant `Dashboard3Page.tsx`, entrée nav "Accueil2" dans
  `components/layout/tabs.ts`, `CalendrierMoisCourantCard.tsx` orphelin supprimé avec), puis recréé à
  la demande de Vincent ("tu me dupliques le dashboard d'accueil") — copie fraîche de `Dashboard2Page`
  à ce moment-là (avec les 3 grandes phrases), pour itérer sans toucher à `/`. Diverge ensuite
  rapidement de `Dashboard2Page` : "découvrir", gros bouton "Poser un congé", "Journal" et "Mes
  demandes" retirés, titres "Soldes"/"Mes Congés" renommés "Mes Soldes"/"Mes Congés" en `text-sm
font-semibold` (taille des onglets de période plutôt que `text-lg font-bold`), puis **toute la
  section "Mes Congés" (calendrier + colonne légende CPI/DJI/Fériés/PERSO + popins CPI/DJI/FERIE/PERSO
  - snippet demande au clic jour) supprimée entièrement** — Accueil2 ne montre plus que Soldes + les 3
    phrases. Gros nettoyage de code mort qui en découle (tous les états/fonctions/imports liés au
    calendrier — `onglet`, `legendeOuverte`, `tipoDuJour`, `estEnGroupe`, `SnippetDemande`,
    `LegendeCard`, etc. — retirés du fichier, plus que ~180 lignes contre ~780 avant).
- **Alignement grille Soldes/calendrier — essai imparfait, à reprendre (18/08/2026)**, `Dashboard2Page.tsx`
  — demande de Vincent : élargir les cards CP/RTT/CPA (pas le bouton "Poser un congé") pour que son
  bord droit s'aligne avec le bord droit du 4ème mois du calendrier "Mes Congés" en dessous. Essayé via
  une grille `md:grid-cols-[1fr_1fr_1fr_160px]` dans un conteneur `flex-1` accompagné d'une colonne
  fantôme invisible `md:w-72 md:shrink-0` (même largeur que la colonne légende du calendrier, pour que
  le calcul `flex-1` soit identique des deux côtés) — résultat approximatif (~40px d'écart mesuré à
  1280px de large), pas un alignement pixel-parfait : la largeur du calendrier est **pilotée par son
  contenu** (`grid-template-columns: repeat(auto-fit, minmax(170px, 1fr))`, s'arrête dès qu'un Nème mois
  ne rentre plus) et non par l'espace flex disponible, alors que la grille Soldes (colonnes `1fr`) elle
  grandit toujours pour remplir tout l'espace qu'on lui donne — les deux logiques de largeur sont
  fondamentalement différentes, un alignement exact demanderait une mesure en JS plutôt qu'une règle
  CSS déclarative. **Vincent : "il va falloir qu'on se pose sur les grilles à un moment, c'est
  n'importe quoi"** — voir Backlog, à reprendre en session dédiée plutôt qu'en itérations rapides.
- **"Mes demandes" (Accueil, `Dashboard2Page.tsx`) — chantier "vu" + refonte en phrase, en cours
  d'itération (18/08/2026)** — **documentation précise et à jour dans
  [SUIVI-DECISIONS.md](SUIVI-DECISIONS.md)** (règles de gestion, principes d'affichage, composants
  concernés) ; le résumé chronologique ci-dessous reste comme trace de la genèse/des essais
  abandonnés, mais SUIVI-DECISIONS.md fait référence en cas de divergence. Déclenché par un constat
  de Vincent : "Validées"/"Refusées" ne sont pas
  des notions valables dans la durée (ce sont des événements passés, pas un état), contrairement à "en
  attente" (état réel, toujours vrai tant que non traité) — le journal (`ActiviteRecenteFeed`) est le
  bon endroit pour représenter les décisions, pas des compteurs permanents.
  - **Notion de "vu" — migration Supabase durable** (pas un flag client/localStorage, choix explicite
    de Vincent : "je préfère que l'on code un truc pour durer") : colonne `demandes_conges.vu boolean
not null default false` + fonction `marquer_demande_vue(p_demande_id)` en `security definer` (la
    policy RLS salarié n'autorise l'update que sur une demande `en_attente` ; passer par une fonction
    dédiée évite d'élargir cette policy aux demandes déjà décidées, ce qui aurait aussi exposé les
    autres colonnes — dates, statut... — à une modification côté client). Générique à tout statut
    décidé (pas seulement "validée"), donc déjà prêt pour "refusée" sans nouvelle migration. `vu`
    repasse à `false` à chaque nouveau changement de statut (`deciderDemande`/
    `remettreEnAttenteDemande` dans `demandes.repository.ts`) — une décision (ou un changement de
    décision) est une nouvelle information à consulter. Migration appliquée manuellement par Vincent
    dans le SQL editor Supabase (voir `supabase/schema.sql`, section demandes_conges + fonctions
    utilitaires). Exposé côté app via `Demande.vu` (`lib/types.ts`), `marquerDemandeVue()`
    (repository), `marquerVue()` (`useDemandes`).
  - **3 pills "En attente"/"Validées"/"Refusées"** (compteur + lien vers `/historique` filtré,
    `?statut=en_attente` / `valide_non_vu` / `refuse_non_vu`, sort par `datePose` desc côté
    `HistoriquePage`) créées puis **la carte entière masquée (`hidden`, contenu conservé)** une fois
    remplacée par la phrase ci-dessous — à supprimer pour de bon ou réutiliser plus tard, pas encore
    tranché ("il y a un bloc qui est masqué que l'on effacera peut-être plus tard à voir").
  - **État actuel retenu : une phrase unique** au-dessus de "Mes Congés" — "Mes demandes" (texte,
    `text-sm`) + `{n} demande(s) en attente` (stabilo orange si `n > 0`, sinon texte gris neutre) +
    séparateur `|` + soit "aucune décision récente" (gris) soit `{n} nouvelle(s) décision(s)` (stabilo
    **vert** uniquement quand il n'y a **aucune** demande en attente — sinon reste en gris neutre, l'
    attente prime toujours sur les décisions) + lien "afficher le journal" (gris, ou **vert gras**
    dans le même cas de priorité "décisions"). Essais intermédiaires tous annulés à la demande de
    Vincent : tiroir "Mon journal" calé/redimensionné sur le bord droit de la carte (290px) avec
    `DetailCongePanel` affiché en ligne au clic sur une entrée ("ça devient compliqué, je suis pas
    convaincu") ; 4ème bloc façon `SoldeCard` (fond `status-warning`, sablier à la place du
    `TypeBadge`, "3 Demandes"/"en attente de validation") sous Soldes ; carte "Mes demandes"
    dupliquée + renommée "Suivre les validations" à droite.
  - **Journal (`ActiviteRecenteFeed.tsx`)** : titre "Activité récente" → "Mon journal". Une ligne
    "décision" (validée/refusée) non vue (`!demande.vu`) s'affiche en emphase (fond `status-success`
    à 40%, texte en gras) — le "vu" se marque à la **fermeture** du volet (`fermerJournal()` dans
    `Dashboard2Page.tsx`, passé comme `onFermerTiroir`), pas à l'ouverture, sinon l'emphase
    disparaîtrait avant que l'utilisateur n'ait eu le temps de la voir. **Bug corrigé le même jour** :
    le journal est plafonné à 6 lignes (`NB_LIGNES`) et triait par date avec un départage "décidé
    avant posé" à date égale — plusieurs décisions tombées le même jour pouvaient repousser une
    demande encore "en attente" hors des 6 lignes visibles (constaté par Vincent : "je n'en vois que
    2 dans son journal" alors que le compteur affichait 3). Les événements "posé" d'une demande encore
    en attente (`EvenementFeed.enAttente`) sont désormais réservés en priorité, le reste des lignes
    comblé par les événements les plus récents, l'ensemble retrié chronologiquement pour l'affichage.
- **Accueil2 (`/dashboard3`) supprimé pour de bon (18/08/2026)** — ancienne version de travail
  utilisée pour itérer sans toucher à `/`, devenue inutile une fois "Mes demandes"/le suivi des
  décisions stabilisés sur l'Accueil réel. Supprimés : la route `app/(app)/dashboard3/page.tsx`, le
  composant `components/dashboard/Dashboard3Page.tsx`, l'entrée de nav "Accueil2" dans
  `components/layout/tabs.ts`. Aucun composant partagé n'est devenu orphelin (`SoldeCard`,
  `ActiviteRecenteFeed`, `ListingTiroir`, `ReglesCongesModal`, `PoserDemandeModal`,
  `SoldeDetailPanel` restent tous utilisés par `Dashboard2Page`/ailleurs).
  - À cette occasion, 5 composants déjà orphelins repérés dans `components/dashboard/` (restes
    d'essais Accueil2 du 16/08/2026, jamais importés nulle part) : `MesSoldesCard.tsx` (supprimé le
    18/08/2026), `ProchainsJoursOffCard.tsx`, `ActiviteRecenteTable.tsx`, `ActiviteRecenteListe.tsx`,
    `ActiviteRecenteCard.tsx` (ces 3 derniers restent en place pour l'instant). Page de test
    temporaire créée pour les visualiser avant décision : `app/(app)/preview-orphelins/page.tsx`
    (route `/preview-orphelins`) — **à supprimer une fois Vincent statué**, voir Backlog.
- **Page "Demandes à traiter" (`/suivre`) supprimée (18/08/2026)** — Vincent : plus utilisée,
  redondante avec "Suivre les demandes" (`/suivre/demandes`). Supprimés : la route
  `app/(app)/suivre/page.tsx`, le composant `components/suivre/SuivrePage.tsx`, et les composants
  devenus orphelins `SalarieRow.tsx`, `CongesConsommesCard.tsx`, `DemandeEquipeRow.tsx`,
  `HistoriqueSoldeModal.tsx`. **Point d'attention traité** : le lien niveau 1 "Suivre" du header
  (`components/layout/niveau1.ts`, `getNiveau1Items`) pointait vers `/suivre` — redirigé vers
  `/suivre/demandes` pour ne pas laisser un 404 au clic sur "Suivre" dans le header. Entrée
  "Demandes à traiter" retirée de `SUIVRE_TABS` (`components/layout/tabs.ts`), import `ClipboardCheck`
  (lucide-react) retiré avec. `SuiviDemandeRow.tsx` avait été identifié à tort comme orphelin par une
  première recherche automatisée — restauré : toujours utilisé par `DetailCongePanel.tsx` et
  `/design-system`.
- **Audit de grille Accueil/Poser + largeur unifiée à 1180px (18-20/08/2026)** — audit demandé par
  Vincent avant un refacto des soldes : la grille Soldes (colonnes `1fr`, grandit pour remplir
  l'espace) et la grille calendrier "Mes Congés" (`auto-fit minmax(170px,1fr)`, pilotée par son
  contenu) suivent deux logiques différentes qui ne peuvent pas être alignées pixel-perfect sans
  abandonner l'une des deux philosophies. Décision de Vincent : **1) objectif d'alignement
  abandonné**, **2) nettoyage** — le hack de "colonne fantôme" (`div` invisible `aria-hidden` servant
  à caler un `flex-1`) retiré, ainsi qu'un bloc de 3 pills mortes (En attente/Validées/Refusées,
  jamais affiché, resté `hidden` depuis le 18/08/2026). À la suite de l'audit, largeur de travail du
  projet unifiée : un seul `max-w-[1180px]` centré porté par `AppShell.tsx`/`HeaderBar.tsx`
  (remplace l'ancien `1440px` du header + les `md:max-w-6xl`/`max-w-[1152px]` dupliqués
  individuellement dans 8 pages, retirés — `md:max-w-none` ajouté à la place pour neutraliser le
  `max-w-md` mobile au-delà du breakpoint `md`). Gouttière rail↔contenu réglée à 16px total
  (`px-3` sur `AppShell` + `px-1` déjà présent sur chaque page, les deux s'additionnent). Fond de
  page blanc au-delà de 1180px (`body` dans `globals.css`), le bandeau de travail (1180px) garde
  `bg-surface-app` porté par `AppShell` (pas par `body`). L'incohérence overlay (Accueil) vs reflow
  (Historique/Suivre, `DetailCongePanel`) pour afficher un détail complémentaire reste non tranchée
  — loggée dans Backlog plutôt que corrigée dans la foulée (accord de Vincent : "oui").
- **Micro-interactions Accueil (20/08/2026)** — suite de l'audit ci-dessus, itéré par petites
  touches successives sur la carte Soldes :
  - `SoldeCard` (`components/ui/SoldeCard.tsx`) : cards CP/RTT/CPA plafonnées à 200px de large
    (grille `minmax(0,200px)` au lieu de `1fr`). Ancienne pastille "i" (ouvrait `SoldeDetailPanel`)
    remplacée par un lien texte "Suivre" ferré contre le chiffre de solde, puis **la carte entière
    est devenue cliquable** (`onClick`/`role="button"`/clavier) et le lien "Suivre" a été retiré —
    `avecInfo`/`onInfoClick` supprimés du composant, remplacés par un simple `onClick`. Chiffre de
    solde agrandi de 15% au repos (`text-2xl` → `text-[1.725rem]`). Survol : fond teinté qui se fonce
    de 12% à 30% via une variable CSS `--tone-darken` imbriquée dans deux `color-mix()` (le
    `background-color` reste une seule propriété transitionnable en CSS malgré l'indirection par
    variable), ombre `shadow-sm` → `shadow-md`, card entière `scale-105`, chiffre de solde
    `scale-[1.2]` avec `transform-origin: left` (`origin-left`) pour grossir vers la droite en
    restant ferré à gauche — le tout `transition-[...] duration-200` pour un rendu fluide.
  - Bouton "Poser un congé" (dans la même grille que les `SoldeCard`, toujours dans
    `Dashboard2Page.tsx`) : refondu en picto seul (`PlusCircle` 56px) + libellé en dessous, couleur
    `text-mint`/`hover:text-mint-hover` (nouveau token `--color-mint-hover`, mint éclairci de 15%
    vers le blanc), fond blanc à 30% d'opacité (`bg-surface-card/30`), ombre légère
    `shadow-sm`/`hover:shadow-md`, grossit de 10% au survol (`hover:scale-110`, bouton entier —
    picto et libellé scalent ensemble, pas de `group-hover` séparé).
  - Titre de section "Soldes" → "Suivre mes soldes", réduit et grisé (`text-lg text-ink-900` →
    `text-sm text-ink-500`), interlignage resserré des deux côtés (valeurs arbitraires ad hoc, voir
    commentaire inline dans `Dashboard2Page.tsx`).
  - Les deux composants (`SoldeCard`, bouton "Poser un congé") documentés dans `/design-system`
    (`DesignSystemPage.tsx`) avec le détail du comportement au survol.
  - Récurrence notable pendant cette session : le bundle dev Turbopack reste régulièrement en
    retard sur les nouvelles classes Tailwind arbitraires (`hover:[--var:x%]`, `scale-[1.2]`,
    `bg-x/40`...) — `--tone-darken`/`--color-mint-hover` etc. n'apparaissaient pas dans le CSS
    généré tant que `.next` n'était pas vidé. Fix systématique : `preview_stop` → `rm -rf .next` →
    `preview_start`.
- **Refonte "Suivi de solde" (`SoldeDetailPanel`, 18-20/08/2026)** — documentation complète dans
  [SUIVI-SOLDE.md](SUIVI-SOLDE.md) : dissociation visuelle pill congé vs badge d'info (Solde
  N-1/Acquisition), popin Accueil unifiée avec `DetailCongePanel` au clic sur une pill (transition
  de largeur, empilement mobile sous la ligne concernée, animation `detail-fade-in` au changement
  de ligne), hauteur/largeur proportionnelles à l'écran. **Bug significatif rencontré et corrigé** :
  une classe Tailwind arbitraire construite avec une interpolation JS à l'intérieur du crochet
  (`hover:bg-[...${variable}...]`) ne génère jamais de règle CSS — Tailwind scanne le code source
  littéralement, pas une valeur résolue à l'exécution. La classe s'affichait dans le DOM sans le
  moindre effet, symptôme identique à un bundle Turbopack en retard mais **aucun rapport avec le
  cache** — piège à yeux ouverts pour la suite, détail complet et pattern de correction (lookup
  object figé par valeur) dans SUIVI-SOLDE.md. Le même bug de transition `scale`/`transform` que
  celui découvert ici existe aussi dans `SoldeCard.tsx`, pas encore corrigé (tâche en arrière-plan
  proposée).
- **Refonte "Mon Calendrier"/"Prochains jours off" (20/08/2026)** — suite du même chantier Accueil,
  gros volume d'itérations dans la même session :
  - **Colonne légende CPI/DJI/Fériés/PERSO retirée** (popins, cards, tout le code associé dans
    `Dashboard2Page.tsx`, ~350 lignes) sans modifier la largeur du calendrier. `ProchainsJoursOffCard`
    (jusque-là orphelin, voir Backlog) intégrée à la place — sœur de "Mon Calendrier" dans le même
    `flex md:flex-row`, largeur 288px (`md:w-72`), liste dans une zone scrollable interne
    (`overflow-y-auto`) plafonnée à 604px de haut (= 2 lignes de cards mois) plutôt que de suivre la
    hauteur réelle du calendrier.
  - **Notion "CI" (Congés Imposés)** introduite côté collaborateur uniquement (Accueil) : CPI et DJI
    fusionnés visuellement (même couleur, celle de CPI ; même libellé "CI") sur le calendrier et dans
    la liste — la distinction CPI/DJI reste pertinente côté paramétrage Delphine, jugée pas utile pour
    le collaborateur. Bug découvert au passage : le variant "circle" (par défaut) de `TypeBadge`
    ignore sa prop `label` (seuls "outline"/"pill" la respectent) — contourné par un badge local
    dédié (`BadgeTypeLeger` dans `ProchainsJoursOffCard.tsx`) plutôt que de corriger le composant
    partagé, la fusion CPI/DJI ne devant s'appliquer qu'ici.
  - Chaque jour off listé est devenu sa **propre card** (fond blanc, coins légèrement arrondis,
    ombre, fond teinté à 3% de la couleur du type — même procédé `color-mix` que les compteurs de
    solde `SoldeCard`, mais atténué) plutôt qu'une ligne dans une liste à séparateurs `border-b`.
    Séparateurs de mois (`AOÛT 2026`, etc., `text-[11px] font-semibold text-ink-500 uppercase`,
    interlignage asymétrique 24px au-dessus/4px en dessous) insérés à chaque changement de mois. Plus
    de plafond de lignes (`NB_LIGNES` retiré) : liste intégrale, désormais bornée par le filtre
    d'onglet actif plutôt que par un nombre fixe (voir plus bas). Les demandes "en attente" de
    validation sont réintégrées dans la liste (exclues à l'origine) avec le badge sablier/orange de
    `STATUT_CONFIG`.
  - **Grille calendrier responsive** : `grid-cols-3` remplacé par `flex flex-wrap` (1 carte/ligne sous
    `sm`, 2 entre `sm`/`lg`, 3 à partir de `lg`) — avec un `grid`, une dernière ligne incomplète (ex.
    5 mois → 3+2) réservait quand même la 3ᵉ colonne vide, laissant une gouttière béante à droite du
    dernier mois ; en `flex-wrap` la dernière ligne s'aligne simplement à gauche. Cards mois passées à
    250×290px avec padding 24px (`p-6`) et gap 24px (`gap-6`) entre elles pour plus d'aération.
    Chiffres des jours à 16px (`text-base`, nouvelle prop `texteJour` sur `MiniCalendrier`,
    indépendante de la prop `agrandi` existante), en-têtes L/M/M/J/V à 14px. Les lignes de semaines se
    répartissent désormais l'espace vertical disponible de la card (`flex-1 content-between` plutôt
    qu'un `gap-y` fixe) pour mieux remplir la hauteur de 290px quel que soit le nombre de semaines du
    mois (5 ou 6).
  - **Nouvelle card FAQ** (`components/dashboard/FaqCard.tsx`) sous l'ensemble calendrier/liste —
    bord à bord, liste de questions à gauche, réponse de la sélection à droite (empilé sur mobile),
    contenu provisoire ("on affinera").
  - **Clic sur un jour du calendrier avec pastille** : fait défiler "Prochains jours off" jusqu'à la
    card correspondante (recherche par plage de dates, pas par id — les deux composants ne partagent
    pas le même id) et la surligne brièvement (`ring-2` dans la couleur du type, effacé après 1,5s
    côté état parent). **Clic sur un jour SANS pastille** : au survol, le chiffre du jour est remplacé
    par un petit "+" vert (`text-mint`, nouvelle prop `onJourVideClick` sur `MiniCalendrier`) ; au
    clic, ouvre "Poser un congé" (`PoserDemandeModal`) avec ce jour pré-rempli comme date de début
    (nouvelle prop `dateInitiale`), date de fin laissée vide.
  - **Le filtre d'onglet ("Mon Calendrier" — Année en cours / Période de référence CP / Année
    suivante) chapote désormais aussi "Prochains jours off"**, pas seulement la grille calendrier :
    nouvelles props `debutPeriode`/`finPeriode` sur `ProchainsJoursOffCard`, alimentées par le même
    `rangeActive` que la grille. Les deux bornes sont nécessaires (pas seulement la borne haute) : pour
    l'onglet "Année suivante", le début de la période active est dans le FUTUR (1er janvier de l'année
    suivante), donc sans borne basse les jours de l'année en cours restaient visibles (ils passaient
    déjà le filtre générique "à venir"). Titre "Mon Calendrier" + bandeau d'onglets déplacés
    au-dessus des DEUX colonnes (calé à gauche) plutôt que dans la seule colonne calendrier, pour
    refléter visuellement que le filtre s'applique aux deux ; le titre propre de
    "Prochains jours off" a été retiré (le titre commun suffit).
  - **Bug corrigé** : les congés imposés (CPI/DJI) de l'année suivante apparaissaient dans
    "Prochains jours off" même quand le calendrier de cette année n'était pas encore publié
    (`parametrage.valideLe` null) — `useCalendrier` charge ces données dès qu'un paramétrage existe,
    même en brouillon. La grille calendrier avait déjà cette garde (`anneeVisiblePourCommuns`,
    `Dashboard2Page.tsx`) mais pas la liste. Corrigé en appliquant la même règle (année en cours
    toujours visible, année suivante seulement si publiée) — vaut pour tout rôle, y compris
    Admin/Manager : ce n'est pas un filtre de permission par rôle, juste "ce qui a été formellement
    publié". Les jours fériés restent affichés dans tous les cas (faits légaux fixes).
- **Card FAQ (`components/dashboard/FaqCard.tsx`, 20-21/08/2026)** — sous "Prochains jours
  off"/"Mon Calendrier" sur Accueil. Contenu en dur (4 questions provisoires, "on affinera" —
  réponses pas encore validées côté métier), voir Backlog pour l'administration à construire et la
  rédaction définitive.
  - **Structure** : titre "Questions fréquentes" (même typo que le `<h1>` "Bonjour, {prénom}" —
    `text-2xl font-semibold`, pas de soulignement) + sous-texte ("Comprendre les quelques principes
    qui encadrent les congés chez Abeil") dans une colonne fixe `md:w-72` à gauche ; accordéon de
    questions dans une colonne `md:w-[400px]` à droite (une seule dépliée à la fois, réponse affichée
    juste sous la question, chevron haut/bas selon l'état — pas de panneau séparé). Empilé en une
    seule colonne sous `md:`.
  - **Carte "à plat"** : coins carrés, pas de bordure ni d'ombre, fond blanc (`bg-surface-card`).
    Padding horizontal propre conservé (`px-8`/`md:px-12`) — un essai "sans gouttière gauche/droite"
    a été annulé le jour même.
  - **Débordement horizontal bord à bord** (cassant pour la première fois la largeur de travail
    unique `max-w-[1180px]` décidée le 18/08/2026, voir plus haut) : bord droit jusqu'au bord réel du
    viewport, bord gauche collé au rail `SideNav` replié (aucune gouttière `px-3`) — mesuré au
    runtime (pas de solution CSS pure fiable, le cadre 1180px étant centré par `mx-auto` dans un
    `flex` contenant aussi `SideNav`). Repère stable ajouté pour ça : attribut
    `data-sidenav-spacer` sur l'espaceur invisible du rail (`SideNav.tsx`) — son bord droit donne la
    position exacte à coller, indépendante de l'expansion de la nav elle-même au survol (qui reste en
    `position: absolute`, ne bouge pas cet espaceur). Calcul basé sur le PARENT de la card (jamais
    modifié) plutôt que sur elle-même, pour éviter une boucle de rétroaction : mesurer l'élément
    après lui avoir déjà appliqué un `marginLeft` mesure une position faussée, un piège rencontré en
    cours de route (aggravé par le Strict Mode de React qui invoque l'effet deux fois au montage en
    dev, doublant l'erreur si on ne s'en protège pas). Un essai intermédiaire d'étendre aussi le bord
    gauche jusqu'à 0 (sous le rail, recouvert par son `z-40`) a été tenté puis annulé — le padding
    interne de la card ne suffisait pas à dégager le texte du titre, resté partiellement masqué.
- **Historisation "Durée de travail"/"Nature du contrat" (21/08/2026)** — jusqu'ici,
  `utilisateurs.taux_activite` était une colonne scalaire relue "fraîche" par les 5 fonctions de
  calcul de solde (`soldes.repository.ts`), appliquée en multiplicateur plat (`prorata`) à toute la
  période de référence : un changement de taux en cours de période (ex. 100% → 80% à mi-parcours)
  recalculait rétroactivement TOUTE la période comme si le nouveau taux avait toujours été en
  vigueur, faussant le solde CP/RTT affiché. Décision (Vincent) : proratiser le changement **mois
  par mois**, sans recalcul rétroactif, et empêcher la modification libre par menu déroulant sur
  une fiche déjà créée.
  - **Schéma** : nouvelle table `historique_utilisateur` (`utilisateur_id`, `champ` ∈
    `{taux_activite, nature_contrat}`, `ancienne_valeur`/`nouvelle_valeur` en `text`, `date_effet`,
    `auteur_id`, `created_at`) — même esprit que `ajustements_solde` (une ligne par changement,
    RLS lecture manager/admin **+ le salarié concerné** (`utilisateur_id = my_utilisateur_id()`,
    ajouté après coup, voir plus bas), écriture admin uniquement). Colonne `utilisateurs.cree_par_id`
    (uuid, nullable, auto-référence sur `utilisateurs`) ajoutée en parallèle — `null` sur tous les
    profils existants (pas de backfill rétroactif), renseignée à la création pour les nouveaux
    profils.
  - **Règle de granularité** : un changement s'applique au **mois entier** — si `date_effet` n'est
    pas le 1er du mois, le nouveau taux s'applique à partir du 1er du mois **suivant** (le mois de
    la date d'effet finit sur l'ancien taux). Fonction pure `moisEffet()` (`lib/format.ts`,
    partagée moteur de calcul + affichage) et `resolverTauxActiviteEffectif(historique, tauxActuel,
anneeMoisIso)` (`soldes.repository.ts`) : résout le taux en vigueur pour un mois cible ; sans
    historique (ou mois antérieur à la 1ère entrée), retombe sur `tauxActuel`/`ancienneValeur` — un
    profil sans changement calcule un solde identique à avant cette fonctionnalité (non-régression
    vérifiée). Les 5 fonctions de calcul (`fetchSoldes`, `fetchSoldeAnticipe`, `fetchHistoriqueCp`,
    `fetchHistoriqueRtt`, `fetchHistoriqueCpa`) appellent ce résolveur mois par mois plutôt qu'un
    `prorata` unique. `nature_contrat` n'entre dans aucun calcul (purement informatif/RH), même
    historisation mais aucune modification du moteur.
  - **UI (`UtilisateurFichePage.tsx`)** : sur une fiche **existante**, "Durée de travail"/"Nature du
    contrat" passent en lecture seule + bouton "Modifier" ouvrant une popin (sélecteur de valeur +
    "Date d'effet" + Valider) — en **création**, ces deux champs restent des `Select` simples (pas
    encore d'historique possible). Deux tableaux récap sous le formulaire ("Période du mm/aa au
    mm/aa : valeur"), et une colonne latérale "Suivi des modifications" (dot + date + phrase,
    convention `ActiviteRecenteFeed`) : "Fiche créée par {créateur}" en 1ère entrée synthétique,
    puis chaque changement, les deux champs mélangés, du plus récent au plus ancien.
  - **Bug découvert et corrigé le jour même — RLS bloquait la propre lecture du salarié** :
    `historique_utilisateur` avait, comme `ajustements_solde`, une policy `select` restreinte à
    `manager`/`admin`. Un salarié consultant SON PROPRE solde sur Accueil (`fetchSoldes()` sans
    `utilisateurId`) ne pouvait donc pas lire son propre historique de taux — RLS filtre
    silencieusement à 0 ligne (pas d'erreur), le calcul retombait sur `tauxActuel` (flat), donnant
    un solde **différent de celui vu par un manager/admin pour la même personne** sur "Suivre les
    soldes" : exactement le bug qu'on voulait corriger, côté collaborateur cette fois. Policy
    élargie à `my_role() in ('manager','admin') or utilisateur_id = my_utilisateur_id()` — même
    correctif appliqué à `soldes_initiaux` (voir entrée suivante) et à `ajustements_solde`
    (préexistante, même trou, corrigée par cohérence).
  - **Second bug découvert et corrigé — `cree_par_id` affichait le mauvais nom** : la requête de
    lecture embarquait `cree_par:utilisateurs!cree_par_id(prenom, nom)` (jointure sur
    l'auto-référence `utilisateurs → utilisateurs`). PostgREST a résolu cette jointure dans le
    **mauvais sens** en pratique (la ligne qui RÉFÉRENCE celle-ci via `cree_par_id`, plutôt que
    celle qu'elle référence) : la fiche de Delphine (compte admin de 2020, `cree_par_id` réellement
    `null` en base, vérifié par requête directe) affichait "Fiche créée par Test SoldeInit" (un
    compte de test créé ce jour-là PAR Delphine). Nommer explicitement la contrainte FK
    (`utilisateurs!utilisateurs_cree_par_id_fkey`) n'a pas résolu le problème (PostgREST renvoyait
    "relationship not found", `NOTIFY pgrst, 'reload schema'` sans effet non plus). **Solution
    retenue** : abandon de l'embed PostgREST pour ce cas d'auto-référence, `creeParNom` résolu par
    une requête séparée (`fetchNomUtilisateur`, `utilisateurs.repository.ts`) uniquement là où
    affiché (fiche détail) — plus robuste, vérifié correct dans les deux sens après correctif.
- **Solde initial à la création d'un salarié — report fiche de paie (21/08/2026)** — pour le
  lancement en production, les salariés déjà en poste ont un capital CP et des soldes RTT/CPA
  antérieurs à l'app (suivi papier/fiche de paie), qu'aucune donnée `demandes_conges` ne permet de
  reconstituer. Le moteur de calcul supposait jusqu'ici que l'app avait toute la donnée depuis le
  début de la période en cours — faux pour un profil fraîchement créé avec de l'ancienneté réelle.
  - **Schéma** : nouvelle table `soldes_initiaux` — **une ligne par utilisateur** (`utilisateur_id
unique`), `date_reference`, `cp`/`rtt`/`cpa` (numeric), `auteur_id`, `created_at`. RLS identique
    à `historique_utilisateur` (lecture manager/admin + soi-même, écriture admin). Saisie possible à
    la création du profil, et **corrigeable ensuite** (upsert `on conflict (utilisateur_id)`,
    décision de Vincent après la 1ère version du plan qui la voulait création-only) — pas de
    notion de date d'effet ni d'historique pour cette table : une correction écrase simplement la
    valeur précédente (pas de ligne dans "Suivi des modifications").
  - **Mécanique CP** (décidée avec Vincent après un premier essai incorrect, voir plus bas) : la
    valeur CP saisie **remplace entièrement** `capitalBase + report` (pas seulement le report) —
    le CP est un capital figé, acquis en une fois pour toute la période en cours (1er juin → 31 mai
    par ex., pas recalculé mois par mois), donc "15 jours au 01/06/26" représente le capital total
    restant pour l'année en cours jusqu'à la fin de période, pas un simple reliquat auquel il
    faudrait encore ajouter un nouveau capital calculé par l'app. Condition d'activation :
    `periodePrecedente.fin <= soldeInitial.dateReference` (la période précédente s'est terminée
    avant/à la référence → pas de donnée fiable pour un calcul automatique). Une fois cette
    condition fausse (période suivante entamée), le calcul automatique reprend seul.
  - **Mécanique RTT/CPA** : pas de notion de report (accrual mensuel pur) — quand la date de
    référence tombe dans la période en cours, le point de départ de l'accrual devient le 1er du
    mois **suivant** la référence (`premierJourMoisSuivant`, toujours le mois d'après même si la
    référence est déjà un 1er — le solde saisi est supposé inclure l'acquisition du mois en cours),
    avec le solde saisi comme base au lieu de 0.
  - **Bug découvert et corrigé en cours de route — double comptage de la consommation** : les
    requêtes de consommation (`demandes_conges` validées/en attente, `ajustements_solde`) restaient
    bornées à la période ENTIÈRE (`periodeEnCours`/`periodeRtt`), pas à la fenêtre "depuis la
    référence" — un salarié ayant déjà de la vraie consommation enregistrée dans l'app AVANT la
    date de référence (ex. Olivier Test, compte de test ancien avec historique réel) voyait cette
    consommation déduite une seconde fois (une fois implicitement via le solde déclaré, qui est
    déjà net de cette consommation ; une fois explicitement via la requête), donnant un solde
    faussement négatif (-16j observé). Corrigé en bornant la fenêtre de consommation à
    `max(periode.debut, dateReference)` quand le solde initial s'applique
    (`periodeConsommationCp`/`periodeConsommationAccrual`).
  - **UI** : section "Soldes actuels (report de la dernière fiche de paie, facultatif)" sur le
    formulaire de création (Date de référence + CP/RTT/CPA, rien créé si la date est laissée
    vide) ; sur une fiche existante, affichage lecture seule + bouton "Modifier" ouvrant une popin
    minimale (Date + CP/RTT/CPA + Valider, pas de tableau récap ni de date d'effet — juste une
    correction directe).
  - **Nettoyage** : les 3 lignes de test posées pendant la mise au point (Delphine, Olivier Test,
    Test SoldeInit) ont été supprimées (`delete from soldes_initiaux;`) une fois les deux bugs
    ci-dessus corrigés et vérifiés — base repartie propre, à retester profil par profil.
  - **Questions encore ouvertes / non tranchées formellement** :
    - La sémantique "remplace tout" n'a été validée par Vincent QUE pour le CP. Pour RTT/CPA,
      le modèle "point de départ décalé + base additive" n'a pas fait l'objet de la même
      discussion explicite (par analogie avec la décision CP, mais pas reconfirmé mot pour mot).
    - Le correctif de fenêtre de consommation (double comptage) est une déduction du principe
      "pas de double comptage" posé pour le CP, étendue par cohérence à RTT/CPA — pas non plus
      explicitement revalidé avec Vincent au moment de l'écrire.
    - **Cas Olivier Test à -16j (avant nettoyage) — expliqué, pas un bug** : Vincent lui avait saisi
      un solde initial CP volontairement bas (20j) sur un profil ayant déjà, dans l'app, un vrai
      volume de congés posés — le solde saisi (censé représenter le total restant à cette date)
      était donc inférieur à la consommation réellement enregistrée après la date de référence,
      d'où le négatif : un résultat mathématiquement cohérent, pas un défaut du correctif de
      fenêtre de consommation. Cas jugé "à la marge, assez peu réaliste" par Vincent — une vraie
      saisie de report suit en pratique un volume de conso réel après la référence, pas l'inverse.
      Pas d'action de code prévue pour ce cas ; à garder en tête si un admin saisit un solde
      initial visiblement trop bas par rapport à la conso déjà connue de l'app.
    - Pas de reflet du solde initial (création ou correction) dans un quelconque flux d'audit
      global — seul `auteur_id` sur la ligne elle-même trace qui a écrit la dernière valeur, sans
      historique des valeurs précédentes.
    - Self-service salarié : la policy élargie (`or utilisateur_id = my_utilisateur_id()`) n'a été
      revérifiée en conditions réelles (connexion effective en tant que salarié) que sur
      `historique_utilisateur`/`ajustements_solde` via le compte "Salarie Test" — pas
      spécifiquement re-testée pour `soldes_initiaux` après le nettoyage des données de test.

**Refonte Paramétrer > Calendrier (`/parametrer/calendrier2`, 22/08/2026)** — répond à l'item
Backlog "Refonte du système de définition des CPI/DJI/Fériés côté admin" (18/08/2026, voir
Backlog.md) : les trois anciennes modales référentielles (`ModalCongesImposes`/`ModalDjImposees`/
`ModalJoursFeries`, `CalendrierPage.tsx`) et leurs points d'entrée sur les cartes légende sont
**retirés** (code mort supprimé, pas juste débranché) ; les cartes légende CPI/DJI/Fériés gardent
leur pastille de volume mais ne sont plus elles-mêmes un bouton :

- **Chaque carte légende porte deux zones cliquables indépendantes** (`stopPropagation`, plus de
  clic "carte entière") :
  - La **pill** (nombre de jours/demi-journées) ouvre un **tiroir** calé sous la carte (même
    gabarit que celui décrit ci-dessous pour "Conflit d'agenda") : liste des entrées via
    `ProchainsJoursOffCard` (déjà existant, Accueil), avec un nouveau prop **`toutAfficher`**
    (retire le filtre "à venir"/`fin >= aujourd'hui` et le masquage année-non-publiée — pertinent
    ici puisque Delphine doit voir TOUT ce qu'elle a paramétré, passé ou futur, publié ou non) et
    un nouveau prop **`donneesInjectees`** (bypass complet des deux `useCalendrier` internes
    `calActuel`/`calSuivant` par les données/callbacks déjà chargés par l'appelant) — **corrige un
    bug réel** : `ProchainsJoursOffCard` et `VueCalendrierGrille` tenaient chacun leur propre
    instance `useCalendrier`, non synchronisées ; supprimer un CPI/DJI depuis le tiroir laissait la
    grille et les pastilles de légende périmées jusqu'au rechargement. Le tiroir Fériés n'a pas de
    suppression (fériés légaux non supprimables) mais gagne en intro le **toggle Lundi de
    Pentecôte** (repris de l'ancienne `ModalJoursFeries`, même logique "travaillée = pas de ligne
    en base").
  - Le **"+"** (DJI/CPI uniquement, retiré de la carte Fériés) ouvre `ModalPoserJourImpose`
    (nouveau composant, `components/parametrer/ModalPoserJourImpose.tsx`) — popin unifiée reprenant
    le gabarit de `PoserDemandeModal.tsx` (verrouillage du sélecteur de demi-journée sur une DJI
    déjà posée, `DatePicker` bloqué sur jours non ouvrés/fériés, lien "voir" + aperçu
    `DetailPeriodeConges`) plutôt que les deux anciennes modales divergentes. Un clic sur un jour
    vide du calendrier ouvre la même popin (mode DJI par défaut — un clic sur un seul jour est
    statistiquement plus souvent une demi-journée qu'une période). Simplifiée ensuite en mode
    DJI : Date + créneau (défaut Après-midi, verrouillé si l'autre créneau est déjà pris) + "Soit
    N jours" + bouton Ajouter, sans bloc "Objectif annuel" (retiré des deux modes CPI/DJI) ni
    "voir"/aperçu détaillé (retiré du mode DJI seulement, gardé en CPI).
  - Suppression d'un jour depuis un tiroir : **toast de confirmation** (`components/ui/Toast.tsx`
    gagne une prop `tone` "success"/"error", inchangée par défaut pour les appelants existants)
    avec bouton **"Annuler"** (undo — recrée l'entrée via `ajouterConge`/`ajouterDj`, nouvel id,
    pas une vraie restauration mais fonctionnellement équivalent).
- **"Conflit d'agenda"** (nouveau, remplace l'ancienne notion "Scan de chevauchement CPI/DJI" du
  Backlog) — implémente la règle actée le 18/08/2026 : transparence plutôt que blocage. Calcule
  (`useDemandesEquipe()`, toute l'entreprise) les CPI/DJI paramétrés qui recouvrent une demande
  personnelle active (validée/en attente, tous collaborateurs) d'au moins une demi-journée — une
  ligne par couple (entrée CPI/DJI, demande), dédupliquée par id (une demande qui chevauche
  plusieurs jours d'un même CPI ne compte qu'une fois pour ce CPI). Affiché en texte stabiloté
  orange (`text-[11px] font-semibold text-status-warning-fg`, fond `bg-status-warning-bg`) entre
  les cartes légende et le message Publié/Brouillon ; ouvre un tiroir (même gabarit que les
  tiroirs légende, pas de popup centrée) listant pour chaque conflit : `CODE - date` (discret) +
  **nom du collaborateur** (mis en avant, `text-xs font-semibold text-ink-900`) + la demande
  personnelle elle-même en pièce jointe, dans son gabarit habituel
  (`TypeBadge`/`PeriodeAvecPastilles`/`Badge`, comme `ActiviteRecenteCard`/`SuiviDemandeRow`) —
  purement informatif, aucune action de résolution (arbitrage manuel par Delphine). Piège
  rencontré : la clé de ligne doit inclure l'id réel de l'entrée CPI/DJI (`c.id`/`dj.id`), pas
  seulement `debut`/`fin` — deux DJI du même jour (matin ET après-midi) partagent la même date et
  produisaient une clé React dupliquée.
- **Message "Publié"** : l'année en cours (`estAnneeLive`, jamais de bouton Publier/Dépublier) et
  l'année à venir une fois publiée affichent désormais le même message —
  `<span className="bg-status-success-bg text-status-success-fg px-1">Publié</span> ce calendrier
est visible par les collaborateurs` — au lieu de l'ancien texte `Publié le JJ/MM/AAAA` réservé à
  l'année à venir (la date de publication n'est plus affichée).
- **`/parametrer/calendrier3` abandonné (22/08/2026)** : prototype créé le 21/08/2026 pour
  scénariser la refonte ci-dessus sans toucher à `calendrier2` — décision tranchée le jour même une
  fois `calendrier2` refondu en pratique : route (`app/(app)/parametrer/calendrier3/`),
  `Calendrier3Page.tsx` et le lien nav temporaire "Calendrier (v2)" (`components/layout/tabs.ts`)
  supprimés. `/parametrer/calendrier2` reste le seul écran Calendrier.

**Encart "Demandes à étudier" (Accueil, 22/08/2026)** — à destination du profil manager, signale
les demandes de congés de l'équipe en attente de décision :

- **`DemandesAEtudierCard`** (nouveau, `components/dashboard/DemandesAEtudierCard.tsx`) — fond
  `bg-status-warning-bg`, gros chiffre à gauche (même taille que la valeur d'une `SoldeCard`,
  `text-[1.725rem] font-bold`) + libellé "Demande(s) à étudier" sur deux lignes (`text-xs
font-bold`, taille alignée sur le sous-texte "à poser avant" de `SoldeCard`) + `ChevronRight` à
  droite. Largeur `md:max-w-[160px]` (proche d'une `SoldeCard`, après plusieurs itérations à
  600px/450px/200px/180px). Hover `hover:scale-[1.02] hover:shadow` avec `origin-left` — ancrer le
  point de transformation à gauche (au lieu du centre par défaut) empêche la carte de déborder à
  gauche de l'écran au survol, l'ancien `hover:scale-105` faisait déborder visiblement. Compte les
  demandes `en attente` via `useDemandesEquipe()` (toute l'entreprise, pas `useDemandes()` qui ne
  donne que les demandes du profil connecté) ; masqué si 0. Rendu conditionnel dans
  `Dashboard2Page.tsx` (`utilisateur.role === "manager"`).
- **Lien vers `/suivre/demandes`** avec `?statut=en_attente&periode=toutes_dates` — même
  principe que `?statut=`/`?demande=` déjà utilisé par `HistoriquePage` (`FILTRE_PAR_PARAM_STATUT`,
  lu via `useSearchParams` dans un `useState` initializer). **Piège rencontré** : `useSearchParams`
  exige un `<Suspense>` autour de la page en prod (`next build` échouait avec "should be wrapped in
  a suspense boundary") — `app/(app)/suivre/demandes/page.tsx` ne l'avait pas (contrairement à
  `app/(app)/historique/page.tsx`, qui l'a déjà pour son propre usage de `useSearchParams`).
- **`SuivreDemandesPage`** gagne une option de filtre Période **"Toutes les dates"**
  (`toutes_dates`, `debut`/`fin` vides = pas de restriction) — le tri par défaut restait par date de
  congé (`debut`) ; reste inchangé ici (pas de demande de le changer), seul le tri de la colonne
  "Posé le" (voir plus bas) trie explicitement par date de dépôt.
- **`HistoriqueTable`** (partagé avec `/historique`) : l'en-tête de la colonne **"Posé le" devient
  cliquable** — bascule plus récent → moins récent → (retour à l'ordre transmis par l'appelant),
  icône `ArrowUpDown`/`ArrowUp`/`ArrowDown` selon l'état. Tri interne au composant
  (`trierParPoseLe`, générique sur `T extends Demande`), n'affecte pas l'ordre par défaut tant que
  l'utilisateur n'a pas cliqué.

**Refacto tableaux — Suivre les demandes (24/08/2026)** : premier écran du chantier "refacto
tableaux", `SuivreDemandesPage`/`DetailCongePanel`/`HistoriqueTable`/`DetailPeriodeConges` :

- **Largeur du tableau verrouillée** (`SuivreDemandesPage.tsx`) : la ligne tableau + panneau de
  détail passe de `flex` (`xl:flex-row`, largeur du tableau conditionnelle à la présence du
  panneau) à **CSS Grid** (`grid-cols-1` en dessous de `xl:`, `xl:grid-cols-[minmax(0,900px)_16rem]`
  au-delà) — la colonne du panneau (16rem, largeur fixe de `DetailCongePanel`) est réservée dans le
  gabarit **qu'elle soit occupée ou non**, contrairement à `flex-1`/`shrink` qui recalcule selon la
  présence réelle du panneau. Le tableau ne bouge donc plus quand on ouvre/ferme le détail d'une
  demande. Trois tentatives intermédiaires en largeur fixe px (`xl:w-[900px]`, puis `780px`, puis
  `858px` pour caler une gouttière à 20px pile à 1280px) ont toutes échoué d'une manière ou d'une
  autre (débordement horizontal à l'ouverture du panneau, ou fragile à toute largeur de fenêtre
  différente de celle testée) avant ce passage à Grid — **leçon retenue : verrouiller une largeur
  de ligne responsive nécessite de réserver l'espace dans le gabarit, pas de calculer une valeur en
  pixels pour un viewport précis**. Vérifié sans débordement à 1024/1280/1920px. Écart entre les
  deux colonnes : `gap-5` (20px) par défaut (row-gap en pile mobile), réduit à `xl:gap-x-2.5`
  (10px) pour le column-gap desktop.
- **États hover généralisés au composant `Button`** (`components/ui/Button.tsx`) — aucune variante
  (primary/secondary/ghost) n'avait d'état `:hover`, nulle part dans l'app (pas propre à un bouton
  en particulier). Ajout `enabled:hover:bg-mint-hover`/`enabled:hover:bg-surface-app`/
  `enabled:hover:opacity-70` + `transition-colors duration-150` dans `BASE_STYLES` — token
  `--color-mint-hover` déjà défini dans `app/globals.css` mais jamais branché jusqu'ici. Bouton
  Refuser (`DetailCongePanel.tsx`) : fond passé de `bg-white/50` à `bg-white` opaque, et hover
  propre en `enabled:hover:bg-status-danger-bg!` (modificateur `!important` Tailwind v4) — la
  variante `secondary` du Button écrase sinon ce hover local, la règle `enabled:hover:bg-surface-app`
  du variant arrivant après dans la feuille de style compilée peu importe l'ordre des classes dans
  le JSX (confirmé en inspectant le CSS Tailwind compilé, `document.styleSheets` s'étant révélé peu
  fiable dans cet environnement — préférer un `curl` sur le chunk `.css` compilé + `grep` du
  sélecteur attendu).
- **Solde avant/après dans "Informations complémentaires"** (`DetailCongePanel.tsx`) — pour une
  demande "en attente" de type CP/RTT/CPA (les 3 seuls types suivis par `useSoldes`), affiche le
  solde actuel (`soldes.<type>.valeur`) et le solde après décision (`soldes.<type>.valeurApresAttente`,
  déjà calculé par `fetchSoldes` mais jamais affiché jusqu'ici) sous forme de deux pills `TypeBadge
variant="pill"` reliées par une flèche, centrées, libellées "Actuel"/"Après" — même brique que la
  colonne CP/RTT/CPA du tableau "Suivre les soldes" (`SuivreSoldesPage`/`LigneSolde`), placé juste
  au-dessus du mini-calendrier de la période. `valeurApresAttente` tient compte de TOUTES les
  demandes en attente de ce type pour ce salarié, pas uniquement celle affichée — approximation
  acceptée (cohérente avec son seul autre usage, `Dashboard2Page`).
- **Semaine de contexte avant/après dans le mini-calendrier de période** (`DetailPeriodeConges.tsx`,
  composant partagé avec le lien "Voir" de `PoserDemandeModal`) — la grille n'affichait que les
  semaines couvertes par `[debut, fin]` ; elle inclut désormais systématiquement une semaine
  complète avant et après (`lundiDeLaSemaine`/`vendrediDeLaSemaine`, nouveaux helpers locaux), pour
  voir d'un coup d'œil ce qui entoure la demande (fériés, autres demandes déjà posées...). Les
  jours de contexte restent non colorés par le type demandé (`demiCouvertePeriode` renvoie déjà
  `false` hors période), seul un éventuel occupant s'affiche dessus.
- **États hover/actif des lignes de `HistoriqueTable`** — remplace le `hover:bg-surface-app`
  générique initial (jugé quasi invisible, `--color-surface-app` étant à `#fafbfc`, presque blanc)
  par une teinte de la couleur du **type de la ligne**, même mécanique que le pill Dates
  (`classeFondTypeBadge`) : deux nouveaux exports dans `TypeBadge.tsx`,
  `classeFondSurvolTypeBadge` (`hover:bg-<type>/15`, passager) et `classeFondActifTypeBadge`
  (`bg-<type>/30`, permanent). La ligne dont le détail est ouvert (`demande.id === selectedId`,
  déjà utilisé pour l'état du pill Dates) reçoit la variante "actif" (30%, plus marquée) ; les
  autres lignes gardent le survol passager (15%). Classes Tailwind écrites en toutes lettres dans
  des `Record<TypeBadgeCode, string>` (même contrainte que `classeFondAttenueTypeBadge` — une
  classe construite par concaténation à l'exécution n'est jamais scannée par le compilateur).

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
