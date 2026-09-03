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

**Refacto tableaux — Suivre les soldes (24/08/2026)** : même chantier, deuxième écran
(`SuivreSoldesPage.tsx`) :

- **Largeur du tableau verrouillée**, même solution CSS Grid que "Suivre les demandes" —
  `xl:grid-cols-[minmax(0,900px)_24rem]` (24rem = largeur fixe de `SoldeDetailPanel`, `xl:w-96`)
  remplace `flex` + largeur conditionnelle (`xl:flex-1` si un solde est ouvert). Vérifié sans
  débordement à 1024/1280px, largeur du tableau identique avant/après ouverture du panneau
  (mesuré 688px à 1280px dans les deux cas).
- **Chargement des soldes remonté au parent** (rupture avec le commentaire d'origine du fichier,
  qui assumait explicitement "chaque ligne fait son propre appel") — nécessaire pour trier par
  CP/RTT/CPA : l'ordre d'affichage doit connaître les 3 valeurs de **toutes** les lignes à la
  fois, ce qu'un `useSoldes` local à chaque `LigneSolde` ne permet pas. `SuivreSoldesPage` fait
  désormais un seul `Promise.all` sur `fetchSoldes(id)` (repository, pas le hook) pour tous les
  collaborateurs actifs filtrés, stocké dans `soldesParId: Record<string, Soldes>`, transmis en
  prop à `LigneSolde`.
- **En-têtes Collaborateur/CP/RTT/CPA cliquables** — même cycle desc → asc → aucun tri que "Posé
  le" dans `HistoriqueTable` (`ArrowUpDown`/`ArrowDown`/`ArrowUp`), un seul `ColonneTri` actif à la
  fois. Tri Collaborateur = alphabétique sur `prénom nom` ; tri CP/RTT/CPA = numérique sur
  `soldes.<type>.valeur`, valeur manquante traitée comme `0` (collaborateur dont le fetch n'est
  pas encore résolu).
- **Colonnes CP/RTT/CPA centrées** (`text-center` sur les `<th>`/`<td>`, `mx-auto` sur le bouton
  d'en-tête pour centrer le texte + l'icône de tri ensemble) — la colonne Collaborateur reste
  alignée à gauche (avatar + nom).
- **Export CSV** (bouton "Exporter (CSV)", coin supérieur droit du filtre, même gabarit que
  `CongesPaiePage` — `Blob` + lien de téléchargement côté client, BOM UTF-8, séparateur `;`) :
  exporte les lignes **actuellement affichées**, dans l'ordre affiché (filtre collaborateur + tri
  actif compris), pas un export brut de toute la base.
- **Popin de détail démarre sur "Théorique"** (`modeParDefaut="theorique"` passé à
  `SoldeDetailPanel`) — remplace l'ancien défaut "Réel" documenté comme décision explicite le
  20/08/2026 ; l'écran collaborateur (Accueil, "mon solde") restait déjà sur "Théorique".
- **Pill "on" (`variant="outline"` de `TypeBadge`) passe de fond transparent à fond blanc** — les
  lignes du tableau ayant désormais une teinte permanente à l'ouverture du panneau
  (`classeFondActifTypeBadge`, même mécanique que `HistoriqueTable` ci-dessus, mais ici calée sur
  le type effectivement consulté puisqu'une ligne "Suivre les soldes" porte 3 pills CP/RTT/CPA et
  non un type unique), la pill outline (contour coloré, fond transparent) perdait tout contraste
  sur ce fond teinté. Fond blanc appliqué globalement dans `TypeBadge.tsx` (seul autre usage :
  `/design-system`, sur fond blanc — aucun changement visuel là-bas).

**`DemandesAEtudierCard` — état "0" affiché plutôt que masqué (24/08/2026)** : l'encart Accueil
manager ne disparaît plus quand aucune demande n'est en attente (comportement d'origine du
22/08/2026) — reste visible avec les teintes `status-success` (vert, `bg-status-success-bg`/
`text-status-success-fg`) au lieu de `status-warning` (orange), pour signaler explicitement un
état "à jour" plutôt que de laisser un vide dans la grille Accueil.

**Calendrier admin — `/suivre/calendrier` (24/08/2026)** : nouvel écran manager/admin, permet de
consulter le calendrier d'un collaborateur. Chantier mené en plusieurs passes le même jour, toutes
détaillées ci-dessous.

- **Route + sélection du collaborateur** : `app/(app)/suivre/calendrier/page.tsx` →
  `SuivreCalendrierPage.tsx` (nouveau, `components/suivre/`) — un `SelectFiltrePill` (même
  convention que `SuivreDemandesPage`/`SuivreSoldesPage`, liste dérivée des utilisateurs actifs
  chargés via `useUtilisateursAdmin`, triée alphabétiquement), aucune présélection par défaut (état
  vide explicite tant qu'aucun collaborateur n'est choisi — contrairement à Suivre les
  demandes/soldes qui affichent d'emblée toute l'équipe, un calendrier individuel n'a pas de choix
  "évident"). Protégée comme le reste de `/suivre/*` par le préfixe déjà géré dans `proxy.ts`, rien
  à ajouter côté middleware. Onglet "Calendrier" ajouté dans `components/layout/tabs.ts`
  (`SUIVRE_TABS`, entre "Suivre les soldes" et "Export paie").
- **Mauvais gabarit repris puis corrigé en cours de route** : la première version réutilisait
  `MonCalendrierPage.tsx` (l'écran `/mon-calendrier` existant — onglets `bg-brand`, colonne légende
  CPI/DJI/Fériés cliquable). Vincent a explicitement écarté ce choix : c'est le calendrier "nouvelle
  version" d'Accueil (`Dashboard2Page`, section "Mon Calendrier" — onglets `bg-mint/90`, colonne
  "Prochains jours off", grille `MiniCalendrier` 3 mois/ligne) qui devait servir de gabarit. Les
  props ajoutées à `MonCalendrierPage.tsx` pour la première tentative ont été intégralement
  annulées (`git checkout`) plutôt que laissées en code mort.
- **`CalendrierCollaborateur.tsx`** (nouveau, `components/suivre/`) — réplique le bloc "Mon
  Calendrier" de `Dashboard2Page` (onglets Année en cours/Période de référence CP/Année suivante,
  colonne "Prochains jours off" + grille `MiniCalendrier`), adapté : pas de bouton "+"/clic sur jour
  vide pour poser un congé (un manager ne pose pas à la place d'un collaborateur depuis cet écran,
  hors scope), pas de cartes Soldes/FAQ/activité récente — uniquement le bloc calendrier, piloté par
  un `utilisateurId` obligatoire. Duplication de code assumée avec `Dashboard2Page` (mêmes
  `isoDate`/`moisEntre`/`tipoDuJour`/etc. qu'à l'accoutumée dans ce projet entre les variantes de
  calendrier — voir le hook partagé encore non fait, `hooks/usePeriodesCalendrier.ts`, noté dans le
  plan de refonte Calendrier gardé de côté) plutôt qu'une abstraction prématurée pour un 3ᵉ écran.
- **`useDemandes`/`fetchDemandes` gagnent un `utilisateurId` optionnel** (même principe que
  `useSoldes`) — sans argument, l'utilisateur connecté ; avec, les demandes d'un autre collaborateur.
  **Piège évité** : le mécanisme "vu"/journal de `useDemandes` (clés `sessionStorage`/`localStorage`
  globales au navigateur, pas scopées par utilisateur consulté) est **désactivé** dès qu'un
  `utilisateurId` est passé — sinon la simple consultation du calendrier d'un collaborateur par le
  manager aurait marqué les demandes de CE collaborateur comme "vues" en se basant sur l'état de
  session du manager, corrompant son propre journal. Vérifié : aucun appel RPC
  `marquer_demande_vue` déclenché en consultant le calendrier d'un collaborateur.
- **`ProchainsJoursOffCard` gagne le même `utilisateurId` optionnel** — passé à son propre
  `useDemandes` interne ; masque aussi le lien "Gérer mes demandes" (mène à `/historique`, propre à
  l'utilisateur connecté, non pertinent en consultant quelqu'un d'autre) indépendamment de
  `masquerDemandesPerso` (qui masque les demandes elles-mêmes, usage différent côté paramétrage
  Calendrier).
- **Overlay "typologie de congé" unifié au clic sur un jour** (`SnippetJourCalendrier.tsx`, nouveau,
  `components/demandes/`) — remplace le `SnippetDemande` dupliqué dans `Dashboard2Page`/
  `CalendrierCollaborateur` (qui ne réagissait qu'aux demandes personnelles). Un seul composant,
  réutilisé par les deux écrans, gère 4 cas (`JourCalendrierClique`, union discriminée) :
  - `demande` : badge coloré par type + période + "X jour(s)" + `StatusBadge` (seul cas avec un
    statut de décision à afficher).
  - `cpi` : badge CPI + période + durée (`dureeCongeImpose`, jours ouvrés moins fériés).
  - `dji` : badge + date + "Matin"/"Après-midi" — **badge affiché "CI" (pas "DJI"), couleur CPI**
    (24/08/2026, demande explicite) : même fusion visuelle CPI/DJI sous "Congés imposés" que
    `ProchainsJoursOffCard`/le compteur par typologie (voir plus bas), pour ne pas afficher "DJI"
    isolément dans cet overlay alors que le reste de l'écran parle de "CI". Nécessite que la
    variante `circle` (par défaut) de `TypeBadge` respecte enfin la prop `label` — jusque-là
    seules les variantes `outline`/`pill` le faisaient, `circle` ignorait silencieusement tout
    `label` passé et retombait toujours sur `LABEL_COURT[code]` ; corrigé dans `TypeBadge.tsx`,
    sans impact sur les appelants existants (aucun ne passait `label` avec la variante par défaut).
  - `ferie` (24/08/2026, ajouté après coup — absent de la version initiale de l'overlay) : badge FE
    - date + **nom du jour férié** (`JourFerie.libelle`, ex. "Armistice").
  - Priorité au clic = même ordre que la couleur des pastilles (`tipoDuJour`/`communDuJour`) :
    demande perso > férié > CPI > DJI. Un jour sans occupant ne déclenche rien (comportement
    d'origine, inchangé).
- **Interaction retirée : clic sur le calendrier → surlignage/scroll de "Prochains jours off"**
  (`jourSurligne`, initialement introduit le 20/08/2026) — décision explicite de la supprimer
  maintenant que l'overlay ci-dessus est le seul mécanisme de rappel au clic. Code entièrement
  retiré de `Dashboard2Page`/`CalendrierCollaborateur` (état, prop) et de `ProchainsJoursOffCard`
  lui-même (prop, `useRef`/`useEffect` de scroll, classe `ring-2` + variable CSS `--tw-ring-color`
  associée) plutôt que laissé en dead code — plus aucun appelant ne le consommait.
- **Compteur par typologie** (`compterTypologies.ts` + `CompteurTypologies.tsx`, nouveaux,
  `components/demandes/`) — sur la même ligne que les onglets de période, poussé à droite
  (`justify-between`), aligné sur le bas des onglets (`items-end`, pas `items-center` — demande
  explicite, les pilules d'onglet étant plus hautes que le texte du compteur). Une puce de couleur
  - libellé + total entre parenthèses par typologie réellement présente sur la période active
    (`text-[11px] font-semibold text-ink-500`) : Congés payés, RTT, Congés en acquisition, Congés
    imposés (CPI+DJI fusionnés sous le code "CPI", même convention que l'overlay et
    `ProchainsJoursOffCard"), Jours fériés, puis CSS/CE/Récupération/Événement familial si présents.
    **Libellés abrégés** (24/08/2026, demande explicite) : "Congé(s)" → "C.", "Jours" → "J." — "C.
    payés", "C. en acquisition", "C. sans solde", "C. exceptionnel", "C. imposés", "J. fériés" (RTT/
    Récupération/Événement familial inchangés, aucun des deux mots à abréger). Rien affiché si aucune
    typologie sur la période (pas de rangée vide).
  * Fichier nommé `compterTypologies.ts` (verbe, minuscule) et non `compteurTypologies.ts` —
    **piège de casse rencontré** : ce nom entrait en collision avec `CompteurTypologies.tsx` (le
    composant) sur un système de fichiers insensible à la casse, cassant la résolution de module
    TypeScript ("File name differs... only in casing"). Renommé côté logique de calcul, le
    composant garde son nom PascalCase standard.
- **États hover sur les 3 onglets de période** (24/08/2026, demande explicite) — absents jusque-là
  sur `Dashboard2Page`/`CalendrierCollaborateur` (contrairement au reste de l'app, cf. la
  généralisation des hover de `Button.tsx` le même jour sur un autre écran). Onglet actif
  (`bg-mint/90`) : `hover:bg-mint-hover` (token déjà existant, réutilisé). Onglet inactif
  (`border-mint text-mint bg-transparent`) : `hover:bg-mint-tint` (token déjà existant, utilisé
  jusque-là pour le fond du bloc "Soldes"). `transition-colors duration-150` ajouté aux deux.

**"Mon calendrier" supprimé (24/08/2026)** : retiré de la sous-navigation "Poser"
(`components/layout/tabs.ts`, `POSER_TABS`), puis la route et la page elle-même supprimées une fois
confirmé qu'elle n'était plus reliée à rien — `app/(app)/mon-calendrier/page.tsx` et
`components/dashboard/MonCalendrierPage.tsx` (gabarit onglets + colonne légende CPI/DJI/Fériés,
distinct du calendrier "nouvelle version" d'Accueil/`Suivre > Calendrier`, voir ci-dessus).
Vérifié avant suppression : composant self-contained (aucun helper extrait dans un fichier à part),
tous ses imports (`useCalendrier`/`useDemandes`/`useReglesConges`/`MiniCalendrier`/`TypeBadge`/...)
restent utilisés ailleurs — rien d'autre à nettoyer. `/mon-calendrier` renvoie désormais un 404
(vérifié). Les mentions de `MonCalendrierPage`/`/mon-calendrier` restant en commentaire dans
`CalendrierCollaborateur.tsx`/`SuivreCalendrierPage.tsx` (comme précédent de gabarit écarté) et dans
ce fichier sont volontairement conservées, à titre de contexte historique — même convention que les
écrans Calendrier/`calendrier3` déjà retirés plus haut.

**Transmissions paie — construction de l'écran (24/08/2026)** : nouvel item de nav séparé sous Suivre
(`components/layout/tabs.ts`, `SUIVRE_TABS`, icône `ClipboardCheck`, après "Export paie" — coexiste
avec `/suivre/paie`, qui n'est pas retiré). Chantier mené en plusieurs passes le même jour :

- **Page liste `/suivre/transmissions-paie`** (`ListeTransmissionsPaiePage.tsx`, nouveau,
  `components/suivre/`) : une carte "Mois en cours" (`periodePaieParDefaut()`) + une section
  Archives listant les 12 périodes précédentes (`periodesPrecedentes`, nouvelle fonction dans
  `lib/periodePaie.ts`, avec `finDePeriode`/`libellePeriode`), chaque carte menant à
  `/suivre/transmissions-paie/[debut]` (`debut` = 25 du mois, clé de période dans l'URL).
- **Page par période `/suivre/transmissions-paie/[debut]`** (`app/(app)/suivre/transmissions-paie/[debut]/page.tsx`,
  `params: Promise<{ debut: string }>` — convention Next.js 16 déjà en place ailleurs, ex.
  `/parametrer/utilisateurs/[id]`) → `TransmissionsPaiePage.tsx`, 3 onglets :
  - **"Quels congés transmettre"** — branché sur `fetchCongesATransmettre` (nouveau repository
    `lib/data/exportsPaie.repository.ts`, hook `hooks/useCongesATransmettre.ts`), tableau
    `HistoriqueTable` (largeur verrouillée via CSS Grid, même pattern que "Suivre les demandes"),
    colonne Durée personnalisée via la nouvelle prop `renderDuree` de `HistoriqueTable` (affiche
    "X/Y j" sur un congé partiellement transmis). Les lignes ouvrent le `DetailCongePanel` complet
    (actions Valider/Refuser/Régulariser), même composant que "Suivre les demandes"/l'ancien "Export
    paie". Bouton "Poser pour un collaborateur" en tête de tableau.
  - **"Générer l'export"** — reprend `CongesPaiePage` telle quelle (`masquerTitre`,
    `periodeInitiale`, props ajoutées à ce composant existant) pour l'export CSV, complété d'un
    bandeau avec le bouton "Transmettre" (`genererExportPaie`) au-dessus — affiche "Période transmise
    le …" et désactive le bouton une fois l'export généré (`fetchExportPaie`, contrainte unique SQL
    `exports_paie_periode_unique` en filet de sécurité côté base).
  - **"Vérifier les fiches de paie"** — nouveau composant `VerifierFichesPaiePage.tsx`
    (`components/suivre/`), alimenté par `fetchCheckFichesPaie(exportId)` : une carte par
    collaborateur (total de jours transmis + action "Ça matche" en bloc), dépliable vers le détail
    par congé (action "OK"/"Écart" par ligne, `validerCheckPaie`/`signalerEcart`). Désactivé
    (message "Aucun export généré...") tant qu'aucun export n'existe pour la période.
- **`PoserCongePourCollaborateurModal.tsx`** (nouveau, `components/suivre/`) — dérivé de
  `PoserDemandeModal.tsx` (mêmes mécaniques `DatePicker`/demi-journées/DJI), avec un sélecteur de
  collaborateur en tête (`SelectFiltrePill`, même liste que `SuivreCalendrierPage`) ; `useDemandes`/
  `useSoldes` pointés sur ce collaborateur plutôt que l'utilisateur connecté ; pas de projection
  "solde à la date de la demande" (RTT/CPA anticipé, simplifié en Actuel/Après) ; appelle
  `poserCongePourCollaborateur` (statut `validee` direct) plutôt que `useDemandes().ajouterDemande`.
- **`DetailCongePanel.tsx` — feed étendu** : nouvelle prop optionnelle `lignesTransmission`, ajoute
  une entrée "Transmis le … : X j" par ligne `export_paie_lignes` de la demande (copie du pattern
  dot+connecteur existant du feed "Posé le"/"Validé le", pas de refactor en boucle générique — le
  fichier n'utilise pas ce pattern ailleurs), puis "En paye le …"/"Écart signalé le … " + motif selon
  le statut de chaque ligne.
- **"Suivre les demandes" — colonne "Paie"** (`HistoriqueTable.tsx`, nouvelle prop
  `lignesTransmissionParDemande`) : badge Transmis/En paye/Écart (agrégé — un écart sur une seule
  tranche prime sur les autres, tout en_paye seulement si TOUTES les tranches le sont) ou "—" si
  jamais transmis. `fetchLignesTransmissionParDemande(demandeIds)` (nouveau, fetch groupé en un
  aller-retour) alimente à la fois cette colonne et `DetailCongePanel.lignesTransmission` du panneau
  ouvert.
- **Schéma** : enum `statut_transmission` (`transmis`/`en_paye`/`ecart`), tables `exports_paie`
  (`genere_par`, unique sur `periode_debut`/`periode_fin`) et `export_paie_lignes` (`jours_inclus`
  signé, `statut`, `motif_ecart`, `verifie_le`/`verifie_par`) — RLS manager+admin lecture/écriture,
  admin `for all`, même pattern que `demandes_conges`. Détail complet et rationale dans
  [BASE-DE-DONNEES.md](BASE-DE-DONNEES.md#points-de-modélisation-notables).

**Transmissions paie — règles métier de la transmission (24/08/2026)** : refonte du parcours "export
paie" en un vrai suivi de transmission, nouvel écran `/suivre/transmissions-paie` (coexiste avec
l'ancien `/suivre/paie`, qui n'est pas retiré). Détail technique (schéma, calcul, code) dans
[BASE-DE-DONNEES.md](BASE-DE-DONNEES.md#points-de-modélisation-notables) — ici, les règles métier
actées avec Vincent qui ont guidé cette conception :

- **Le statut "transmis" est distinct du statut "validé"**. Un congé validé n'est plus un état
  terminal côté paie : il traverse ensuite Transmis → En paye (ou Écart). Décidé après plusieurs
  itérations sur le bug "congés de période précédente non pris en compte"/"congés à cheval sur deux
  mois" — la vraie cause n'était pas un problème de bornes de dates, mais l'absence de ce statut.
- **"Quels congés transmettre" n'est jamais borné par une date de début de période** — seule règle :
  le congé est validé (ou annulé-après-transmission) et pas encore intégralement transmis, et sa
  date de début n'est pas dans le futur par rapport à la fin de la période. Ainsi un congé posé et
  validé en juin mais jamais transmis remonte automatiquement en août sans action manuelle — c'est
  le mécanisme de rattrapage voulu, plutôt qu'un filtre de date que Delphine devrait penser à
  élargir elle-même chaque mois.
- **Un congé à cheval sur deux périodes de paie se transmet en plusieurs fois** (notation actée avec
  Vincent : "2/6" = 2 jours transmis sur ce mois, 4 restent pour le suivant). Génération d'un
  export : le reliquat d'un congé qui se termine avant ou pendant la période part intégralement
  (rattrapage complet, pas de fragmentation inutile) ; un congé qui déborde sur le mois suivant ne
  transmet que sa portion jusqu'à la fin de la période en cours.
- **Une correction après transmission ne réécrit jamais l'historique** — choisi explicitement face à
  l'alternative "modifier la ligne déjà transmise" : régulariser un congé déjà transmis crée une
  **ligne de correction négative** au prochain export généré, jamais une modification des lignes
  d'origine. Un export généré reste la trace exacte, immuable, de ce qui a réellement été envoyé au
  comptable à l'époque.
- **La transmission n'a aucun effet sur le solde CP/RTT/CPA du salarié** — le solde est décompté dès
  la validation de la demande (comme avant cette refonte), pas à sa transmission. "Transmis"/"En
  paye"/"Écart" documentent uniquement le dialogue avec le comptable, ce n'est pas un second
  décompte.
- **Vérification des fiches de paie en mode détail** : décidé après discussion ("il faut passer en
  mode détail") — un résumé par collaborateur (solde + total transmis, ce qui est littéralement
  imprimé sur la fiche de paie) avec un drill-down par congé individuel pour isoler un écart précis,
  plutôt qu'une validation en bloc sans détail.
- **"Poser pour un collaborateur"** couvre l'oubli de saisie du salarié et la correction ponctuelle
  repérée par Delphine — **la maladie est explicitement hors scope** pour l'instant (confirmé par
  Vincent). Le congé ajouté doit être visible dans l'historique du salarié concerné (transparence
  totale actée — pas de ligne cachée, même si c'est Delphine qui l'a créée à sa place).
- **Période de transmission passée en mois calendaire (01→dernier jour), 25/08/2026** — remplace le
  cycle 25→24 initial (Delphine transmettait vers le 20, la comptable émettait les fiches jusqu'au
  24). Décidé après un aller-retour : un premier essai a gardé le cycle 25→24 en arrière-plan tout
  en changeant seulement l'affichage des filtres Du/Au sur le mois calendaire (moins perturbant pour
  Delphine) — mais Vincent a demandé un alignement complet plutôt que deux notions de "période"
  différentes coexistant silencieusement. `periodePaieParDefaut`/`finDePeriode`/`periodesPrecedentes`
  (`lib/periodePaie.ts`) calculent désormais directement le mois calendaire ; `libellePeriode` était
  déjà indifférent au changement (nommée d'après le mois de `fin`, qui tombe dans le même mois
  calendaire que `debut` de toute façon). Pas de migration de schéma nécessaire : `exports_paie`
  stocke des dates arbitraires, seule la logique applicative qui les calcule a changé.

**Transmissions paie — refactos post-construction (25/08/2026)** : plusieurs ajustements
demandés une fois l'écran en main, avant de reprendre la partie "Vérifier les fiches de paie".

- **Onglet "Quels congés transmettre" éclaté en 3 tableaux distincts** (`TransmissionsPaiePage.tsx`,
  `QuelsCongesTransmettre`), plutôt qu'un seul mélangeant tout — un seul état `demandes` (toujours
  issu de `fetchCongesATransmettre`) reste la source, seulement reparti côté client en 3 groupes
  affichés séparément :
  - **"Congés consommés sur la période"** — `d.fin >= debut` (le congé touche l'intervalle Du/Au
    affiché).
  - **"Congés consommés non passés sur des périodes précédentes"** — `d.fin < debut` (le backlog :
    validés/en attente jamais tranchés d'un mois antérieur).
  - **"Congés passés en paye mais annulés"** — `d.statut === "annulé"`, à part des deux tableaux
    ci-dessus plutôt que mélangés dedans (avant : une correction en attente de régularisation
    pouvait se retrouver listée dans "sur la période" ou "repêchage" selon sa date, peu lisible).
    Chaque tableau a son propre `<HistoriqueTable>`, `selectionId`/`DetailCongePanel` restent
    partagés entre les 3 (un seul panneau ouvert à la fois, quel que soit le tableau cliqué).
- **`HistoriqueTable.tsx` — colonnes "Statut" et "Collaborateur" rendues triables**, en plus des
  colonnes déjà triables "Dates"/"Posé le" (mécanisme `ColonneTriable` étendu). "Statut" trie sur un
  ordre métier (`STATUT_ORDRE`, pas alphabétique) : en attente → validé → refusé → annulé, l'idée
  étant de faire remonter en premier ce qui demande une action. "Collaborateur" trie par nom complet
  (`localeCompare`).
- **Fusion visuelle des lignes consécutives d'un même collaborateur** quand le tri actif est
  "Collaborateur" (`trierEtGrouperParCollaborateur`, nouveau) — la cellule Collaborateur (avatar +
  nom) n'apparaît qu'une fois par groupe, étirée sur toutes ses lignes via l'attribut HTML natif
  `rowSpan` (pas de librairie). Piège rencontré et corrigé deux fois :
  - Un `tr:hover` CSS ne peut pas atteindre une cellule `rowSpan`-ée qui n'est l'enfant que de la
    PREMIÈRE `<tr>` du groupe — survoler une ligne du milieu du groupe ne teintait donc pas le nom.
    Fix : état `hoveredId` suivi en JS (`onMouseEnter`/`onMouseLeave` sur chaque `<tr>`), la cellule
    fusionnée recalcule sa propre classe de fond à partir de cet état plutôt que de compter sur le
    survol CSS natif de sa ligne.
  - Une fois ce fix posé, la PREMIÈRE ligne du groupe se retrouvait deux fois plus foncée que les
    autres au survol/à la sélection : elle recevait à la fois la classe hover/active native de son
    propre `<tr>` ET la classe JS ajoutée par-dessus, les deux (semi-transparentes, même teinte) se
    superposaient. Fix : la classe JS ne s'applique que si c'est une AUTRE ligne du groupe qui est
    survolée/sélectionnée (`hoveredId !== demande.id` / `selectedId !== demande.id`) — la ligne qui
    porte nativement la cellule n'a jamais besoin du double calque, sa propre classe suffit déjà.
    Nouvelle classe utilitaire ajoutée pour ce besoin :
    `classeFondSurvolTypeBadgeActif` (`TypeBadge.tsx`) — même teinte que `classeFondSurvolTypeBadge`
    (15%) mais sans le préfixe `hover:`, pour un survol piloté en JS plutôt qu'en CSS pur.
- **Tri par défaut sur "Collaborateur"** pour les 2 premiers tableaux de "Quels congés transmettre"
  (nouvelle prop `triParDefaut` de `HistoriqueTable`) — direct à l'ouverture, sans clic requis.
- **Onglet "Générer l'export" aligné sur "Quels congés transmettre"** — jusque-là, cet onglet
  (qui réutilise `CongesPaiePage`) passait par `fetchCongesConsommesPeriode` (filtre strict
  `date_debut` dans la période), pas `fetchCongesATransmettre` : un congé du backlog (démarré avant
  la période, jamais transmis) était donc bien transmis au clic sur "Transmettre" mais invisible
  dans cet aperçu/le CSV — décalage trompeur repéré par Vincent ("Pourquoi Olivier Test n'apparaît
  pas sur Générer l'export ?"). Fix : nouveau paramètre `sourceTransmission` sur `useCongesConsommes`
  et `CongesPaiePage`, qui bascule sur `fetchCongesATransmettre` quand activé — seul l'onglet
  "Générer l'export" de `TransmissionsPaiePage` l'active, `/suivre/paie` autonome garde son
  comportement d'origine.
  - **Effet de bord découvert dans la foulée** : `grouperParCollaborateur` (`CongesPaiePage.tsx`)
    sommait `nbDemiJournees` (la durée TOTALE de la demande), pas le reliquat — un congé à cheval
    déjà partiellement transmis lors d'un export précédent se retrouvait donc recompté en entier
    dans l'aperçu du mois suivant, en double des jours déjà partis. Fix : nouveau paramètre
    `joursPour` sur `grouperParCollaborateur`, utilisé avec `joursRestants` (pas `nbDemiJournees`)
    quand `sourceTransmission` est actif. Vérifié en conditions réelles : un congé 21/09→25/09
    transmis à 4/5 sur un export ne réapparaît plus qu'à 1 j (le reliquat) sur l'export suivant, pas
    5 j.
- **Case "Validés uniquement" masquée sur cet onglet** (nouveau paramètre `validesUniquement` de
  `CongesPaiePage`, forcé sur "Générer l'export" uniquement) — sur cette vue, seuls les congés
  validés ont vocation à être transmis, pas de choix à faire à cet endroit (demande explicite).
  `/suivre/paie` autonome garde la case à cocher.

**Transmissions paie — aperçu du découpage sur un congé à cheval (25/08/2026)** : discussion partie
d'un cas concret (Delphine, CP du 31/08 au 11/09) — le découpage réel entre deux périodes était déjà
correct au moment de cliquer "Transmettre" (`joursDansPeriode` dans `genererExportPaie`), mais rien
ne le montrait AVANT ce clic : la colonne Durée et le total de "Générer l'export" affichaient le
solde restant complet, comme si tout partait ce mois-ci. Vincent : "bricoler un truc" plutôt que de
resigner sur la question — la logique de découpage existant déjà, il s'agissait de la réutiliser
pour l'affichage, pas d'en inventer une nouvelle.

- **`calculerJoursATransmettreMaintenant(conge, periode)`** (nouveau, exporté depuis
  `lib/data/exportsPaie.repository.ts`) — extrait la même logique que la boucle de
  `genererExportPaie` (rattrapage complet si `conge.fin <= periode.fin`, sinon intersection plafonnée
  au reliquat via `joursDansPeriode`, désormais partagée) dans une fonction autonome, appelable pour
  un aperçu sans créer de ligne `export_paie_lignes`. Une demande annulée (correction) renvoie
  directement son reliquat négatif, pas de découpage par date pour ce cas.
- **Colonne Durée de "Quels congés transmettre" — toujours au format "X/Y j"** (`TransmissionsPaiePage.tsx`,
  `renderDureeATransmettre`) : X = jours qui partiraient réellement maintenant
  (`calculerJoursATransmettreMaintenant`, calculé en async via un `useEffect` sur `demandes` une fois
  chargées — `Promise.all`, stocké dans un state `joursATransmettreParId` indexé par id de demande),
  Y = durée totale de la demande. Avant : affichait "Y j" tout court tant que rien n'avait encore été
  transmis, masquant le fait qu'un congé à cheval ne partirait que partiellement.
- **Nouvelle carte "Jours transmis par type" dans la colonne droite** (`RecapParType`, nouveau) —
  occupe l'espace jusque-là vide de la grille (`xl:grid-cols-[minmax(0,900px)_16rem]`) tant qu'aucune
  ligne n'est sélectionnée (le `DetailCongePanel` prend sa place au clic sur une ligne, exclusif l'un
  de l'autre). Somme, par type (CP/RTT/CPA/CSS/CE/RECUP/EVT_FAM), les mêmes valeurs que la colonne
  Durée — inclut les corrections négatives des congés annulés, pour un total net qui correspond
  exactement à ce que contiendrait l'export généré maintenant. Première vérification (38 j) trompeuse
  — voir le bug ci-dessous, découvert par Vincent juste après.

**Transmissions paie — bug "en attente" compté dans le récap (25/08/2026)** : `calculerJoursATransmettreMaintenant`
ne traitait explicitement que le cas `annulé` (correction) avant de tomber dans le calcul général
(rattrapage/intersection) — un congé **en attente** de décision (jamais validé) s'y engouffrait donc
comme n'importe quel congé validé, alors que `genererExportPaie` ne le transmettra jamais tant qu'il
n'est pas décidé (`fetchDemandesAvecSoldeTransmission` ne fetch que `validee`/`annulee`). Signalé par
Vincent avec un exemple concret : total affiché 38 j, mais la somme des lignes réellement **validées**
de la période ne faisait pas ce compte — l'écart (3 j) correspondait exactement aux deux demandes
encore en attente (1 j + 2 j).

- **Fix** : `calculerJoursATransmettreMaintenant` renvoie `0` pour un congé `en attente`, avant tout
  autre calcul.
- **Aller-retour sur l'affichage "0/Y j"** : premier réflexe, masquer le format X/Y pour `en attente`
  (juste "Y j", pour éviter un "0/Y" jugé trompeur). Vincent est revenu dessus : "0/NN" explicite est
  finalement ce qu'il veut — montre sans ambiguïté que rien ne partira tant que ce n'est pas décidé.
  `renderDureeATransmettre` garde donc le format X/Y uniforme pour tous les statuts.
- Revérifié : total du récap passé de 38 j à 35 j, correspondant exactement à la somme des lignes
  `Validé` affichées (les deux `En attente` valent maintenant 0/Y j, conforme à ce que
  `genererExportPaie` ferait réellement).
- **Colonne Durée renommée "Transmis"** (nouvelle prop `libelleColonneDuree` de `HistoriqueTable`,
  utilisée seulement par les 3 tableaux de "Quels congés transmettre") — plus parlant que "Durée"
  une fois au format X/Y. Les autres usages de `HistoriqueTable` ("Suivre les demandes"...) gardent
  "Durée"/"Nbre jours".
- **Même bug retrouvé côté "Générer l'export"** : `grouperParCollaborateur` (`CongesPaiePage.tsx`)
  utilisait encore `joursRestants` (le solde total restant) comme valeur du paramètre `joursPour` en
  mode `sourceTransmission`, pas `calculerJoursATransmettreMaintenant` — un congé à cheval y
  réapparaissait donc avec son reliquat complet plutôt que la portion réellement transmissible ce
  mois-ci (ex. Delphine 31/08→11/09 : 9,5 j affichés au lieu de 1 j). Fix : même calcul async que
  "Quels congés transmettre", precalculé dans un state `joursATransmettreParId` (`useEffect` sur
  `demandes`/`sourceTransmission`/`debut`/`fin`), consommé par `joursPour` avec repli sur
  `joursRestants` tant que le calcul n'est pas résolu. Revérifié : total Delphine passé de 10,5 j à
  2 j (1 + 1, cohérent avec les 35 j du récap "Quels congés transmettre").

**Transmissions paie — feed "prévision" dans `DetailCongePanel` (25/08/2026)** : nouvelle prop
`previsionTransmission?: { jours: number; total: number }` sur `DetailCongePanel.tsx` — ajoute une
entrée "Transmis paie le {aujourd'hui} : X j / Y j" en fin de feed (pastille en pointillés + texte
italique, distincte des lignes réelles `lignesTransmission`/`export_paie_lignes` déjà transmises,
pour ne pas laisser croire que c'est déjà fait). Branchée à la fois depuis "Quels congés
transmettre" (`TransmissionsPaiePage.tsx`) et "Générer l'export" (`CongesPaiePage.tsx`, uniquement
si `sourceTransmission`), toutes deux réutilisant le même state `joursATransmettreParId` déjà
calculé pour la colonne "Transmis"/le total par collaborateur — répond à la confusion notée par
Vincent sur l'aperçu global de "Générer l'export" (qui n'affichait pas ce détail congé par congé) :
cliquer sur une date pill ouvre maintenant ce détail directement.

**Régularisation invisible pour le salarié concerné (25/08/2026)** : signalé par Vincent avec un cas
réel (Delphine régularise — annule — un congé déjà validé d'Olivier, 03/08→28/08) — Olivier n'était
notifié nulle part et ne voyait jamais cette décision dans son propre historique.

- **Cause** : `fetchDemandes` (`demandes.repository.ts`, "Mon historique"/Accueil du salarié
  connecté) excluait purement et simplement toute demande `statut = 'annulee'` via `.neq(...)` —
  une régularisation devenait donc invisible pour l'intéressé, alors qu'elle reste déjà visible côté
  Delphine (section "Congés passés en paye mais annulés" de Transmissions paie).
- **Fix (3 endroits)** :
  - `fetchDemandes` — filtre `.neq("statut", "annulee")` retiré, la demande annulée remonte
    désormais dans l'historique du salarié comme n'importe quelle autre décision. Sans risque pour
    `annulerDemande` (retrait par le salarié lui-même d'une demande en attente) : cette fonction n'a
    aucun appelant dans l'UI actuellement, donc toute demande `annulee` remontée aujourd'hui est une
    régularisation Delphine, traçable via `dateDecision`/`validateur`.
  - `useDemandes.ts` — le mécanisme "vu depuis votre dernière connexion" (mise en avant jaune du
    journal) filtrait uniquement `validé`/`refusé` pour la liste "non vues" persistée ; étendu à
    `annulé`.
  - `ActiviteRecenteFeed.tsx` ("Mon journal", tiroir Accueil) — `evenementsDeDemande` ne générait un
    événement "décision" que pour `validé`/`refusé` ; étendu à `annulé` avec son propre verbe
    ("a retiré vos X jours de CP du…au…", tone rouge comme un refus — nouveau mapping
    `STABILO_PAR_STATUT`).
- **Non vérifié en conditions réelles** faute d'identifiants pour le compte de test d'Olivier dans
  cette session — logique cohérente avec le traitement déjà existant de `validé`/`refusé` partout
  ailleurs (`StatusBadge`/`HistoriqueTable` gèrent déjà le tone "annulé"), à confirmer par Vincent.

**Journal complet des décisions — `decisions_demande` (25/08/2026)** : suite directe du point
précédent — capture d'écran à l'appui, Vincent a montré le feed d'un congé régularisé qui saute
directement de "Posé le" à "Annulé le", sans jamais montrer "Validé le" : `demandes_conges.
date_decision`/`validateur_id`/`commentaire_decision` ne gardent que la décision COURANTE, une
régularisation écrase silencieusement la trace de la validation d'origine. Question posée à Vincent
(table d'historique complète vs colonnes séparées pour la régularisation, un seul niveau) — a choisi
la table d'historique, cohérent avec le principe déjà appliqué à `export_paie_lignes` (ne jamais
réécrire l'historique).

- **Nouvelle table `decisions_demande`** (`demande_id`, `statut`, `commentaire`, `decide_par`,
  `decide_le`) — une ligne par décision réelle, jamais écrasée. RLS : salarié lit celles de ses
  propres demandes (`exists` sur `demandes_conges.utilisateur_id`), manager/admin lisent tout,
  manager/admin créent, admin `for all`. `demandes_conges` elle-même n'est pas modifiée — reste la
  décision courante pour toute lecture rapide qui n'a pas besoin de l'historique complet.
- **Écriture** : `deciderDemande` (`demandes.repository.ts`, partagée par valider/refuser/
  régulariser) insère une ligne après chaque mise à jour de `demandes_conges` — best-effort (une
  erreur d'écriture du journal ne fait pas échouer la décision elle-même, déjà actée). Même
  insertion dans `poserCongePourCollaborateur` (validation directe à la création).
  `remettreEnAttenteDemande` ("Annuler" du bandeau de confirmation post-validation) n'écrit
  volontairement rien dans le journal — c'est un "annuler mon propre clic", pas une vraie décision à
  historiser.
- **Lecture** : nouvelle fonction `fetchHistoriqueDecisions(demandeId)` (`demandes.repository.ts`).
- **`DetailCongePanel.tsx`** — le feed affiche désormais une entrée par ligne d'historique
  (`Validé le… par…` puis `Annulé le… par…`, etc.) au lieu d'une seule décision. **Repli explicite**
  pour la compatibilité arrière : la table démarre vide, une demande déjà décidée avant cette
  migration n'a aucune ligne tant qu'elle ne subit pas une NOUVELLE décision — si
  `historiqueDecisions` est vide, le composant retombe sur l'ancien affichage à partir de
  `selection.dateDecision`/`selection.validateur` (comportement inchangé pour ces demandes-là).
- **Migration + backfill exécutés par Vincent** (`insert into decisions_demande select … from
demandes_conges where date_decision is not null and not exists (…)`, idempotent) — préserve la
  décision courante de chaque demande déjà décidée comme première ligne de son journal, avant
  qu'une future régularisation ne l'écrase. Ne peut PAS recréer un historique déjà perdu : une
  demande déjà régularisée avant ce jour (ex. l'ancien test Olivier 03/08→28/08) n'a que sa dernière
  décision connue (`annulee`), l'étape "Validé le" d'origine, jamais stockée deux fois nulle part,
  reste irrécupérable pour ce cas précis.
- **Vérifié en conditions réelles** (test + restauration propre après coup, aucune donnée de test
  laissée) : régularisé un congé d'Olivier fraîchement validé (01/12/26) — feed affiché
  "Validé le 16/08/26 par Olivier" puis "Annulé le 25/08/26 par Delphine" avec le commentaire, dans
  le bon ordre. Confirme que le backfill + le journal fonctionnent ensemble pour toute demande
  actuellement dans un état connu au moment du backfill.
- **`fetchDemandesEquipe` ("Suivre les demandes") — même correction que `fetchDemandes`** : excluait
  aussi totalement les demandes `annulee`, laissant Delphine sans AUCUN moyen de retrouver une
  régularisation qui n'a jamais été transmise (donc absente aussi de "Transmissions paie > Congés
  passés en paye mais annulés", qui ne liste que les corrections à faire). Filtre `.neq` retiré ;
  nouveau filtre "Annulés" ajouté à `SuivreDemandesPage.tsx` (`Filtre`/`FILTRES`/
  `STATUT_PAR_FILTRE`) pour les isoler facilement plutôt que les laisser noyées dans "Tous les
  statuts".

**Effet de bord sur les calendriers — congés annulés qui continuaient d'occuper des jours
(25/08/2026)** : conséquence directe du retrait du filtre `.neq("statut", "annulee")` sur
`fetchDemandes` (voir plus haut) — plusieurs fonctions `demandeDuJour`/équivalentes, qui résolvent
"qu'est-ce qui occupe ce jour du calendrier", n'excluaient que `refusé` et pas `annulé` (l'exclusion
d'`annulé` était jusque-là inutile, aucune demande annulée ne remontait jamais dans `demandes`).
Signalé par Vincent : une régularisation devait aussi "libérer" le jour sur le calendrier du
collaborateur, pas seulement rester tracée dans son historique/journal.

- **`Dashboard2Page.tsx`** (Accueil, "Mon calendrier") — `demandeDuJour`.
- **`CalendrierCollaborateur.tsx`** (Suivre > Calendrier, vue manager) — `demandeDuJour`, même
  correction.
- **`compterTypologies.ts`** — les compteurs "C. payés (X j)"/etc. affichés au-dessus du calendrier
  sommaient aussi les jours des demandes annulées dans leurs totaux.
- **Déjà corrects, non touchés** : `creerResolveurOccupant` (`DetailPeriodeConges.tsx`),
  `PoserDemandeModal.tsx`/`PoserCongePourCollaborateurModal.tsx` (jours déjà occupés bloquant la
  sélection d'une nouvelle demande), `CalendrierPage.tsx` (Paramétrer) — excluaient déjà `annulé`
  en plus de `refusé`, écrits après la première apparition de ce bug ailleurs dans le code.
- Vérifié en conditions réelles : le calendrier d'Olivier (`/suivre/calendrier`) ne montre plus le
  congé annulé 03/08→28/08 (20 j) — seule sa demande "en attente" distincte sur les mêmes dates
  (14,5 j, résidu de test d'une session précédente) reste visible.

**Calendrier — demi-journées affichées comme des journées pleines (25/08/2026)** : signalé par
Vincent (Delphine, 16/09, un demi-CP affiché comme un jour entier). `tipoDuJour`
(`Dashboard2Page.tsx`/`CalendrierCollaborateur.tsx`) rendait TOUJOURS un fond plein
(`classeFondTypeBadge`) pour un jour occupé par une demande, quelle que soit sa vraie couverture —
seule la pastille DJI utilisait déjà la variante `moitie` de `MiniCalendrier` (couleur pleine +
côté gauche/droite posé, déjà utilisée aussi pour les jours fériés/CPI communs). Fix : `tipoDuJour`
calcule maintenant `matinCouvert`/`apresMidiCouvert` à partir de `demiDebut`/`demiFin` sur les bornes
de la demande (`iso === demande.debut`/`demande.fin` uniquement — un jour au milieu d'une période
multi-jours reste toujours plein), et bascule sur `moitie` dès qu'un seul des deux est couvert.
Nouvelle constante `VAR_COULEUR_TYPE` (dupliquée dans les deux fichiers, même convention que
`DetailCongePanel.tsx`/`PoserDemandeModal.tsx`) — `moitie` prend une couleur CSS brute, pas une
classe Tailwind. Teinte atténuée pour "en attente" reproduite via `color-mix` (équivalent de
`classeFondAttenueTypeBadge` mais applicable à une couleur brute). Vérifié via le style calculé du
DOM (`background: linear-gradient(...)`, plus fiable qu'une capture d'écran à cette échelle) : le 16
septembre affiche bien une pastille moitié pleine/moitié claire, pas un fond plein.

**Légende du calendrier — plage "mois en cours" démarrant littéralement aujourd'hui, pas le 1er du
mois (25/08/2026)** : suite du point précédent — Vincent a signalé un total "C. payés" incohérent
(5,5 j affichés, 6,5 j attendus : 0,5 + 5 + 1 j pour un congé en attente du 11/08, avant la date du
jour). Cause : `ranges.en_cours.debut`/`ranges.periode_cp.debut`
(`Dashboard2Page.tsx`/`CalendrierCollaborateur.tsx`) valaient `todayIso` (aujourd'hui, 25/08) plutôt
que le 1er du mois, alors que le sélecteur "Débute :" affiche le libellé **"Août 26"** — laissant
croire que tout le mois est couvert, alors que les 24 premiers jours étaient silencieusement exclus.
Fix : nouvelle constante `debutMoisActuel` (1er jour du mois en cours), substituée à `todayIso`
comme valeur par défaut (non "vue complète") des deux plages — le libellé et la donnée réelle
correspondent maintenant. `todayIso` reste utilisé tel quel pour `estAujourdhui` (marqueur "jour
présent" sur la grille, sans rapport avec la plage de calcul). Vérifié : "C. payés" passe de 5,5 j à
6,5 j, le 11/08 réapparaît bien dans la liste/le calendrier d'août.

**Régularisation — pas de notification "décision" sur la home + mot "retiré" au lieu d'"annulé"
(25/08/2026)** : deux derniers trous signalés par Vincent sur ce chantier.

- **`nbDecisionsNonVues`** (`Dashboard2Page.tsx`, stabilo "X nouvelle(s) décision(s)" en haut de
  l'Accueil) ne comptait que `validé`/`refusé`, pas `annulé` — une régularisation ne déclenchait
  donc aucune notification alors que `vu` repasse bien à `false` dessus (`deciderDemande`, déjà
  générique à tout changement de statut). Fix : `annulé` ajouté au filtre.
- **`ActiviteRecenteFeed.tsx`** — le verbe utilisé dans la phrase du journal ("Delphine a **retiré**
  vos X jours...") remplacé par "**annulé**", cohérent avec le libellé utilisé partout ailleurs dans
  l'app pour ce statut (`StatusBadge`, filtre "Annulés" de `SuivreDemandesPage`, etc.).
- Vérifié en conditions réelles (test + restauration propre) : régularisé le CP du 16/09 de Delphine
  → stabilo Accueil passé à "1 nouvelle décision", journal affichant "Delphine a annulé votre
  demi-journée de CP du 16/09/2026 ma". Restauré ensuite à l'identique.
- **Effet de bord découvert en testant, non lié à ce fix** : le journal a aussi fait remonter deux
  autres régularisations de Delphine (21/09→25/09, 31/08→11/09) déjà présentes en base depuis un
  test antérieur de cette session, jamais restaurées — invisibles jusqu'ici faute du fix du journal
  ci-dessus. Vincent a confirmé vouloir les restaurer ; fait dans la foulée (repassées "validée" via
  le bouton "Restaurer" de la régularisation).

**"Export paie" (`/suivre/paie`) supprimé (25/08/2026)** — coexistait avec "Transmissions paie"
depuis sa construction (24/08/2026), gardé volontairement en parallèle le temps de valider le
nouveau parcours. Une fois "Transmissions paie" jugé complet, Vincent a demandé la suppression de
l'ancien écran plutôt que de continuer à maintenir les deux.

- `app/(app)/suivre/paie/page.tsx` (route) supprimé.
- Entrée de nav "Export paie" retirée de `SUIVRE_TABS` (`components/layout/tabs.ts`), import
  `Receipt` (lucide-react) devenu inutile, retiré aussi.
- **`CongesPaiePage.tsx` conservé** — pas mort : c'est le composant réutilisé tel quel par l'onglet
  "Générer l'export" de `TransmissionsPaiePage` (`masquerTitre`/`periodeInitiale`/
  `validesUniquement`/`sourceTransmission` toujours renseignés par ce seul appelant restant).
  Commentaires mentionnant l'ancien écran `/suivre/paie` autonome mis à jour dans ce fichier,
  `useCongesConsommes.ts` et `TransmissionsPaiePage.tsx` — sans toucher au comportement.
- Vérifié : `/suivre/paie` renvoie un 404, "Transmissions paie" reste la seule entrée de nav pour ce
  périmètre, build/typecheck/lint clean.

**"Quels congés transmettre" — bandeau sticky de validation (25/08/2026)** : Vincent — "la séquence
quels congés transmettre à mon sens doit être validée par l'utilisateur pour générer l'export" —
bandeau sticky en bas de l'onglet, portant le bouton de validation ET le récap par type (déplacé
depuis la carte de la colonne droite, qui n'apparaissait que quand rien n'était sélectionné — le
bandeau, lui, reste visible en permanence). Question posée à Vincent : le bouton doit-il transmettre
directement, ou juste amener à l'onglet "Générer l'export" ? Réponse : bascule d'onglet seulement —
l'action réelle "Transmettre" reste un geste séparé, sur "Générer l'export" comme avant.

- **`QuelsCongesTransmettre`** gagne une prop `onValiderEtGenererExport`, câblée par
  `TransmissionsPaiePage` sur `() => setOnglet("export")`.
- **`totauxParType`** (renommée depuis le composant `RecapParType`, devenu une simple fonction pure)
  — même calcul qu'avant, réutilisé pour le rendu horizontal en pills du bandeau plutôt que la
  liste verticale de card. La colonne droite de la grille (`xl:grid-cols-[minmax(0,900px)_16rem]`)
  ne montre donc plus le récap quand rien n'est sélectionné — seulement `DetailCongePanel` quand une
  ligne l'est, sinon vide (comportement d'avant l'introduction du récap, 25/08/2026 plus tôt).
- Bandeau en `sticky bottom-0`, en dehors de la grille 2 colonnes (sibling après, pas à l'intérieur)
  pour occuper toute la largeur plutôt que seulement la colonne de gauche.
- Vérifié en navigateur : le bandeau reste visible en bas au scroll, le récap se met à jour en
  fonction des filtres Du/Au, le bouton bascule effectivement vers l'onglet "Générer l'export".

**"Générer l'export" — même continuité (bandeau sticky + modale de confirmation, 25/08/2026)** :
Vincent — "Même sticky même position du bouton transmettre qui ouvre une modale de confirmation de
validation + lien du téléchargement du CSV". Le bouton "Transmettre" (auparavant en haut de
l'onglet, effet immédiat) a été déplacé dans un bandeau sticky en bas, au même style que celui de
"Quels congés transmettre", et n'agit plus directement : il ouvre une `Modal` de confirmation
contenant un lien "Télécharger le CSV" et Annuler/Confirmer — Confirmer déclenche l'action réelle
`genererExportPaie` (inchangée).

- **`CongesPaiePage`** converti en `forwardRef` (`useImperativeHandle`) pour exposer sa fonction
  `exporter()` — nouvelle interface exportée `CongesPaiePageHandle`. Nécessaire car la génération du
  CSV (`genererCsv`/`lignes`) vit dans la closure de ce composant, rendu comme enfant de
  `GenererExport` ; plutôt que dupliquer cette logique dans la modale, celle-ci appelle
  `congesPaieRef.current?.exporter()` via un `useRef<CongesPaiePageHandle>` posé sur
  `<CongesPaiePage ref={congesPaieRef} .../>`.
- **`GenererExport`** : l'ancienne barre du haut (`bg-surface-card ... shadow-sm` avec statut +
  bouton) devient le bandeau sticky du bas (`sticky bottom-0`, même classes que celui de
  `QuelsCongesTransmettre`) ; le statut ("Pas encore transmise."/"Période transmise le…") reste à
  gauche, le bouton "Transmettre" à droite. Le bouton reste désactivé une fois la période transmise
  (`Boolean(exportPaie)`).
- La modale (`components/ui/Modal.tsx`, `title="Transmettre la période"`) affiche un message de
  confirmation, le lien CSV, l'erreur éventuelle (`erreur`, remontée de `genererExportPaie`), puis
  Annuler (ferme la modale)/Confirmer (appelle `transmettre()`, qui ferme la modale et rafraîchit
  le statut via `onTransmis` en cas de succès).
- Vérifié en navigateur (après un restart `.next` pour purger un faux électrique HMR habituel de ce
  projet, voir plus haut) : bandeau identique visuellement à celui de "Quels congés transmettre",
  clic sur "Transmettre" ouvre la modale, "Télécharger le CSV" déclenche `exporter()` sans erreur
  console, "Annuler" ferme la modale sans effet de bord (statut resté "Pas encore transmise.").
  Confirmer non testé en conditions réelles pour ne pas polluer les données de Vincent (l'action
  `genererExportPaie` elle-même est inchangée et déjà vérifiée par ailleurs) ; `tsc`/`eslint`/
  `npm run build` clean.

**Bandeau sticky — récap CP/RTT/CPA en pastilles colorées (25/08/2026)** : Vincent a fourni une
capture (3 pastilles rondes bleu/vert/gris, juste un chiffre dedans, ex. "62 j"/"1,75 j"/"5 j") avec
la consigne "dans le sticky de la première étape tu m'intègre les soldes dans ce format". Question
posée pour clarifier de quel solde il s'agissait (celui du collaborateur sélectionné, ou un par
collaborateur listé) — réponse : ni l'un ni l'autre, c'est le total CP/RTT/CPA de la période
concernée (même donnée que le récap déjà présent), affiché dans le style pastille plutôt qu'en
texte — "pour le moment on a juste congés payés : Note : le 0 est une donnée importante" (donc les
3 pastilles CP/RTT/CPA restent visibles même à 0, contrairement au reste du récap).

- Le style exact réutilise `TypeBadge` (`components/demandes/TypeBadge.tsx`) `variant="pill"` avec
  `label` réglé sur `${jours} j` — le même rendu que la colonne solde de `SuivreSoldesPage.tsx`
  (`LigneSolde`), pas de nouveau composant.
- **`totauxParType`** change de signature : retourne désormais le `Record<TypeBadgeCode, number>`
  complet (non filtré) plutôt qu'un tableau déjà filtré sur les valeurs non nulles — le filtrage
  devient la responsabilité de l'appelant, puisqu'il diffère maintenant selon le type.
- Nouvelle constante `TYPES_PRINCIPAUX = ["CP", "RTT", "CPA"]` — ces 3 types sont toujours rendus en
  pastille colorée, y compris à 0. Les autres types de `TYPES_RECAP` (CSS/CE/RECUP/EVT_FAM, plus
  rares) gardent l'ancien rendu texte (`{LABEL_LONG[code]} : {jours} j`) et restent masqués quand
  nuls — pas de raison de leur appliquer la même règle de visibilité, Vincent n'a parlé que des 3
  types officiels transmis à la paie.
- Vérifié en navigateur : bandeau affiche "14 j" (pastille bleue CP), "0 j" (verte RTT), "0 j"
  (grise CPA) sur la période de test (seuls des CP existent) ; `tsc`/`eslint` clean.

**Feed du `DetailCongePanel` — lignes de transmission réelles + tri chronologique unifié
(25/08/2026)** : suite directe du point précédent. `fetchLignesTransmissionParDemande`
(`exportsPaie.repository.ts`) existait déjà mais n'était câblée nulle part — branchée sur
`QuelsCongesTransmettre` et `CongesPaiePage` (prop `lignesTransmission`, déjà prévue dans
`DetailCongePanel` depuis le 24/08), pour matérialiser dans le feed le vrai passage en paie
("Transmis le"/"En paye le"/"Écart signalé le"), pas seulement la prévision.

- Test réalisé sur le congé Salarie Test 16/07-17/07 (rétro-daté par SQL à la demande de
  Vincent : posé 07/07, validé 13/07, export juillet transmis+vérifié "en paye" le 30/07, puis
  régularisé/annulé ce jour via l'UI) — a révélé un bug d'ordre : le feed rendait le bloc
  "décisions" (`historiqueDecisions`) puis le bloc "transmissions" (`lignesTransmission`) l'un
  après l'autre, sans les mélanger par date — "Annulé le 25/08" apparaissait donc avant "En paye
  le 30/07", pourtant antérieur ("c'est pas dans l'ordre" — Vincent).
- Corrigé en fusionnant les deux sources dans un seul tableau `entreesFeed` (décisions +
  lignes de transmission + prévision), trié par date effective avant rendu (`decideLe`/
  `genereLe`/`verifieLe`, tous des timestamptz ISO directement comparables) plutôt que deux
  blocs figés — un seul passage de map sur le tableau trié, connecteur entre chaque entrée.
- **Convention "(retro)"** (demande explicite) : une ligne de correction (`joursInclus < 0` —
  congé déjà transmis puis annulé) porte désormais le suffixe "(retro)" à la fois sur "Transmis"
  et sur "En paye"/"Écart", pour la distinguer de l'envoi d'origine — même mécanique de
  transmission, appliquée à un ajustement plutôt qu'au premier envoi. Le point encore ouvert
  ("Restitué solde Fdp {mois}") reste à préciser avec Vincent : dépend de quel export futur
  transmettra effectivement cette correction négative (celui d'août si transmis avant la
  clôture, sinon celui de septembre) — pas encore un cas testable tant que cette correction n'a
  pas été elle-même transmise.
- Vérifié en navigateur, ordre du feed sur le cas test : "Posé le 07/07/2026" → "Validé le
  13/07/26 par Delphine" → "Transmis le 30/07/26 : 2 j" → "En paye le 30/07/26" → "Annulé le
  25/08/26 par Delphine" → "Transmis en paie (retro) le 25/08/26 : -2 j / 2 j" (prévision,
  pointillés) — conforme à l'ordre demandé. `tsc`/`eslint`/`npm run build` clean.

**Feed — commentaire dupliqué + retouches sticky/tableau (25/08/2026)** : suite immédiate des deux
points précédents, plusieurs retouches réclamées en observant le cas de test en direct.

- **Commentaire de régularisation mal placé** : affiché comme un bloc générique
  (`selection.commentaireManager`, la colonne `commentaire_decision` de `demandes_conges`, réécrite
  à chaque décision) tout en bas du feed, donnant l'impression d'être associé au DERNIER événement
  affiché plutôt qu'à "Annulé" ("le commentaire est associé à annulé" — Vincent). Corrigé en portant
  ce commentaire par décision : chaque entrée de `entreesFeed` issue de `historiqueDecisions` prend
  désormais `decision.commentaire` (déjà journalisé par `decisions_demande`, un par décision) comme
  `note` — rendu juste sous cette entrée précise, plus comme bloc générique en fin de panneau (bloc
  `selection.commentaireManager` supprimé, devenu redondant/trompeur).
- **Doublon transitoire** : lors du premier passage, le commentaire apparaissait deux fois (une fois
  correctement sous "Annulé", une fois encore via l'ancien bloc générique, positionné après "Transmis
  (retro)" à cause du tri chronologique) — résolu par la suppression de ce bloc ci-dessus, plus de
  doublon.
- **Libellé "(retro)" simplifié** : "Transmis en paie (retro)" → "Transmis (retro)" (répété deux fois,
  Vincent a coupé court : "Transmis (retro) : -2j") — dans le feed (ligne réelle ET prévision) ET dans
  la colonne "Transmis" du tableau "Quels congés transmettre"/le détail de "Vérifier les fiches de
  paie" (`(correction)` → `(retro)` partout, wording unifié).
- **Sticky bar** : pastilles CP/RTT/CPA maintenant surmontées de leur code (`LABEL_COURT`, "CP"/
  "RTT"/"CPA" — "attribuer les soldes à leur nom") ; interligne ajouté entre la ligne de pastilles et
  la phrase "à régulariser" (`gap-1.5` → `gap-2.5`) ; le montant ("2 j") de cette phrase passe en gras,
  seul le reste ("de Congés Payés à régulariser") reste en texte normal.
- Vérifié en navigateur (screenshot) : "CP 14,5 j" / "RTT 0 j" / "CPA 0 j" avec libellés, "**2 j**
  de Congés Payés à régulariser" en dessous avec un espacement net, tableau affichant "-2 j (retro)".
  `tsc`/`eslint`/`npm run build` clean.

**"Générer l'export" — parité avec "Quels congés transmettre" (25/08/2026)** : Vincent — "On fige
les dates de sélection / On integre les tableau équivalent [repêchage + corrections] / L'export csv
devient un lien texte associé avant transmettre / Pas encore transmise : Brouillon - non transmis".
Question posée (recommandation suivie) : le récap collaborateur × type existant doit-il continuer à
sommer TOUS les jours (période + repêchage + corrections), ou exclure repêchage/corrections
maintenant qu'ils ont leurs propres tableaux ? Réponse : exclure, pour ne pas compter les mêmes
jours deux fois à l'écran.

- **Période figée** : `CongesPaiePage` (props `sourceTransmission`) n'affiche plus les champs Du/Au
  éditables mais un texte fixe (`formatPeriodePillNumerique`) — cet onglet transmet exactement la
  période choisie sur la liste `/suivre/transmissions-paie`, plus de risque de la changer par erreur.
- **2 tableaux ajoutés** sous le récap collaborateur × type : "Congés consommés non passés sur des
  périodes précédentes" (repêchage) et "Congés passés en paye mais annulés" (corrections) — mêmes
  `HistoriqueTable`/mêmes rendus (`renderDureeATransmettre`, "Transmis") que sur "Quels congés
  transmettre". Le récap collaborateur × type est désormais filtré sur `fin >= debut` pour exclure ce
  repêchage (les corrections en étaient déjà exclues, `validés uniquement` étant forcé sur cet onglet).
- **`renderDureeATransmettre`** déplacée de `TransmissionsPaiePage.tsx` vers `lib/format.ts` (fonction
  pure partagée) — évite un import circulaire (`CongesPaiePage` est rendu PAR `TransmissionsPaiePage`,
  qui aurait dû importer depuis lui pour le réutiliser).
- **Export CSV** : bouton retiré du bandeau du haut de `CongesPaiePage` (masqué quand
  `sourceTransmission`) — devient un simple lien texte souligné "Exporter (CSV)" dans le bandeau
  sticky de `GenererExport`, juste avant le bouton "Transmettre" (toujours `congesPaieRef.current
?.exporter()` via `ref`). Le lien "Télécharger le CSV" à l'intérieur de la modale de confirmation
  est retiré (redondant, déjà accessible avant l'ouverture de la modale).
- **Wording statut** : "Pas encore transmise." → "Brouillon - non transmis".
- Vérifié en navigateur : période figée en pill texte, 3 tableaux affichés (récap + repêchage +
  corrections, mêmes lignes qu'observées sur "Quels congés transmettre"), lien "Exporter (CSV)" sans
  erreur console, modale de confirmation inchangée (Annuler testé, aucun effet de bord). `tsc`/
  `eslint`/`npm run build` clean.

**"Générer l'export" — les 3 tableaux au même format (25/08/2026)** : Vincent — "Les tableau 2 et 3
doivent prendre le même format que le tableau 1 [répartition par employés et colonne typologie de
congés] / pour les congés à cheval, on affiche dans le tableau export que les jours pris en comptes
en revanche le détail solde lui affiche toute la période". Les 2 tableaux ajoutés juste avant
(repêchage/corrections) utilisaient `HistoriqueTable` (ligne par ligne) — remplacés par le même rendu
grille collaborateur × type que le récap principal.

- Nouveau composant local `TableauCollaborateurType` (`CongesPaiePage.tsx`) — extrait du rendu
  jusque-là dupliqué du tableau 1, réutilisé pour les 3 tableaux (`lignes`/`lignesRepechage`/
  `lignesCorrections`, tous produits par `grouperParCollaborateur`).
- **`grouperParCollaborateur`** gagne un 3ᵉ paramètre `inclureAnnuleDansTotal` (défaut `false`,
  comportement inchangé) : une demande "annulée" ne comptait jamais dans le total par type, ce qui
  aurait affiché "0 j" pour le tableau corrections (100% composé de demandes annulées) au lieu de la
  correction négative à transmettre — passé à `true` uniquement pour ce 3ᵉ tableau.
- **Jours "pris en compte" vs "détail solde"** — déjà correct côté cellule (`joursPourTransmission`,
  = `joursATransmettreParId`/`joursRestants`, jamais la durée totale d'un congé à cheval) mais pas
  encore formalisé en commentaire ; le clic sur une pastille de date ouvre toujours `DetailCongePanel`
  avec la période ENTIÈRE de la demande (`selection.debut`/`fin`, inchangé) — la distinction demandée
  ("tableau = jours comptés, détail solde = période complète") était donc déjà en place, seulement
  documentée plus explicitement dans les commentaires du fichier.
- Vérifié en navigateur : "Congés consommés non passés sur des périodes précédentes" et "Congés
  passés en paye mais annulés" utilisent désormais la même grille (Avatar + nom + colonnes CP/RTT/
  CPA/CSS + pastilles de dates) — la correction Salarie Test affiche "-2 j" avec pastille rouge
  (statut annulé), comme sur le tableau 1. `tsc`/`eslint`/`npm run build` clean.

**Icône "congé à cheval" sur les pastilles de date (25/08/2026)** : Vincent — "j'insiste sur le
cheval :) On affiche dans le tableau export que les jours concernés par l'export. quitte à mettre
une icone 15*15 fond orange pour le signifier : table-columns-split. En revanche le détail affiche
bien le congé dans son ensemble" — le chiffre en tête de colonne montrait déjà seulement les jours
comptés (`joursPourTransmission`), mais rien ne signalait visuellement, sur la pastille elle-même,
qu'un congé était fractionné entre deux périodes.

- `DatePeriode` (`CongesPaiePage.tsx`) gagne un champ `aCheval: boolean`. `grouperParCollaborateur`
  prend un 4ᵉ paramètre `estACheval: (d) => boolean` (défaut `() => false`) — calculé par l'appelant
  comme `d.fin > fin` (la fin de la demande dépasse la borne haute de la période affichée), passé aux
  3 tableaux (récap période/repêchage/corrections).
- Pastille concernée : une icône `TableColumnsSplit` (lucide-react, confirmé disponible) dans un
  carré 15×15 `bg-status-warning-fg` (orange, même token que le point "en attente"), glyphe blanc,
  juste après la pastille de date — `title` explicite au survol.
- `DetailCongePanel` (ouvert au clic sur une pastille) reste inchangé : affiche toujours
  `selection.debut`/`selection.fin`, la période ENTIÈRE de la demande, jamais tronquée — déjà le cas,
  confirmé par Vincent ("le détail affiche bien le congé dans son ensemble").
- Vérifié en navigateur : icône orange visible sur "31/08 au 11/09/26" (Delphine) et "26/08 au
  03/09/26" (Salarie Test), toutes deux dépassant le 31/08 — absente sur les congés entièrement
  dans le mois. `tsc`/`eslint`/`npm run build` clean.

**Correction — libellé de date borné + icône ronde (25/08/2026)** : Vincent, suite immédiate du
point précédent — deux retouches. D'abord signalé un vrai bug : "tu m'affiches pour les à cheval
les dates prises en compte 31/08 au 31/08 au lieu de 31/08 au 11/09/26 dans le tableau" — la pastille
de date des congés à cheval devait afficher la portion comptée pour CETTE période (ex. "31/08" pour
un congé du 31/08 au 11/09, vu depuis août), pas la période complète de la demande.

- Nouvelle fonction `libellePeriodeAffichee(d, finPeriode)` — borne `d.fin` à `finPeriode` quand elle
  la dépasse (même condition que `estACheval`), laisse `d.debut` inchangé. Threadée dans
  `grouperParCollaborateur` via un nouveau paramètre `libelle` (défaut `libellePeriodeDemande`,
  inchangé pour les appels hors transmission).
- **Premier essai buté** : bornage symétrique (début ET fin) — cassait le repêchage/les corrections,
  dont les dates démarrent par construction avant la période (`d.fin < debutPeriode`) ; les borner
  produisait un intervalle inversé ("01/08 au 30/07/26"). Corrigé en ne bornant QUE la fin.
- **Icône** : passée d'un carré `TableColumnsSplit` à une pastille RONDE `SquareSplitHorizontal`
  ("icone ronde mode alerte" — Vincent), toujours 15×15, fond `bg-status-warning-fg` (orange),
  glyphe blanc.
- Vérifié en navigateur : "31/08/26" (Delphine, était "31/08 au 11/09/26") et "26/08 au 31/08/26"
  (Salarie Test, était "26/08 au 03/09/26") avec la pastille orange ronde ; repêchage ("30/07/26")
  et corrections ("16/07 au 17/07/26") inchangés, sans intervalle inversé. `tsc`/`eslint`/
  `npm run build` clean.

**Suivi du congé — prévision en orange + tooltip "Transmission partielle" (25/08/2026)** :
Vincent — "Dans le suivi du congé : tu me mets Transmis paie le jj/mm/AA - 1J/NNj en orange avec une
emphase sur le nombre de jours transmis / Un over sur les jours cheval et leur icone qui disent
Transmission partielle".

- **`DetailCongePanel`** : la ligne de prévision (`previsionTransmission`, italique, non encore
  réellement transmise) passe de gris (`text-ink-500`) à orange (`text-status-warning-fg`, même
  token que le point "en attente"/l'icône à cheval) ; séparateur `:` remplacé par `-` ; le nombre de
  jours transmis (avant le `/`) passe en gras (`font-bold not-italic`), le total après `/` reste en
  poids normal. Vérifié programmatiquement (`getComputedStyle`) : couleur `rgb(199, 119, 0)`
  (`#c77700`), `font-weight: 700` sur "4 j" — rendu "Transmis paie le 25/08/26 - **4 j**/7 j".
- **`CongesPaiePage`** (tableaux "Générer l'export") : le `title` (tooltip au survol) sur l'icône
  ronde orange ET sur la pastille de date elle-même passe de la longue description initiale à
  "Transmission partielle" (court, cohérent entre les deux éléments) — vérifié en DOM, les deux
  `[title="Transmission partielle"]` présents sur les congés à cheval (bouton de date + pastille
  icône).
- `tsc`/`eslint`/`npm run build` clean.

**Repasse technique Transmissions paie (25/08/2026)** : Vincent a demandé une "grosse repasse
technique" sur Accueil/Quels congés transmettre/Générer l'export après la série de retouches UI —
relecture + correction au fil de l'eau (mode choisi explicitement).

**Bug trouvé en premier, signalé par Vincent avant même la fin de la relecture** : "l'export CSV de
générer l'export il est incomplet on doit retrouver les 3 tableaux" — conséquence directe de
l'exclusion du repêchage/des corrections hors du récap collaborateur × type (25/08/2026, plus tôt,
pour ne pas les compter deux fois à l'écran) : `exporter()` ne générait le CSV qu'à partir de ce
récap (`lignes`), perdant le repêchage et les corrections au passage.

- Nouvelle fonction `fusionnerLignes(...groupes: LigneCollab[][])` (`CongesPaiePage.tsx`) — combine
  plusieurs `LigneCollab[]` par collaborateur × type (somme des jours, concaténation des dates).
  `exporter()` appelle désormais `genererCsv(fusionnerLignes(lignes, lignesRepechage,
lignesCorrections))` — le CSV redevient le reflet complet des 3 tableaux, cohérent avec ce que
  `Transmettre` envoie réellement.
- `genererCsv` : `c.jours > 0` → `c.jours !== 0` (une correction pure, cellule 100% "annulé", a un
  total négatif — l'ancien seuil `> 0` l'aurait affichée à "0") ; le filtre des dates listées entre
  parenthèses passe de `statut !== "annulé" && statut !== "refusé"` à `statut !== "refusé"` seul (les
  demandes "annulé" n'apparaissent QUE dans les cellules de corrections, où leur date doit rester
  visible — l'ancien filtre les aurait toutes masquées).
- Vérifié en interceptant `URL.createObjectURL` en navigateur (JS) : Salarie Test → "11 j (...,
  16/07 au 17/07/26)" = 13 j (période) − 2 j (correction), toutes les dates des 3 tableaux listées ;
  Olivier Test → "0,5 j (30/07/26)" (repêchage, absent du récap période) ; Delphine → "1 j
  (31/08/26)" (date déjà bornée à la période, cohérent avec l'affichage écran). `tsc`/`eslint`/
  `npm run build` clean.

**Suite de la repasse technique — refetch après transmission + statut sur la liste (25/08/2026)** :
au-delà du bug CSV (ci-dessus), la relecture systématique d'Accueil/Quels congés transmettre/Générer
l'export a fait remonter deux autres points, corrigés dans la foulée.

- **Bug réel — pas de refetch après "Transmettre"** : une fois une période transmise avec succès
  (`GenererExport.transmettre()`), `onTransmis` (= `rafraichirExport`, côté `TransmissionsPaiePage`)
  ne rafraîchissait QUE l'état `exportPaie` du parent (pour le bandeau sticky) — rien ne redéclenchait
  le fetch interne de `CongesPaiePage` (`useCongesConsommes`), qui ne dépend que de
  `[debut, fin, sourceTransmission, version]`, tous invariants ici. Résultat : les 3 tableaux et le
  feed du panneau de détail restaient figés sur l'état "avant transmission" tant que la page n'était
  pas rechargée. Corrigé en donnant à `<CongesPaiePage>` une `key={exportPaie ? exportPaie.id :
"brouillon"}` — le composant remonte (donc refetch tout) dès que `exportPaie` passe de `null` à un
  id réel. Vérifié par lecture du flux de données (`tsc`/`eslint`/`npm run build` clean) — non testé
  en cliquant réellement sur "Confirmer" pour ne pas créer un export réel sur la période d'août en
  cours de test.
- **Accueil sans statut de transmission** : `ListeTransmissionsPaiePage.tsx` (liste
  `/suivre/transmissions-paie`) affichait toutes les périodes de la même façon, sans distinguer
  celles déjà transmises — son propre commentaire admettait "pas encore de statut transmis/vérifié
  affiché" alors que `exports_paie` porte cette info depuis le 24/08/2026. Ajout d'un badge vert
  "Transmis le JJ/MM/AAAA" par ligne (mois en cours + les 12 archives), alimenté par une nouvelle
  fonction groupée `fetchExportsPaie(periodes)` (`exportsPaie.repository.ts`, un seul aller-retour
  `.in("periode_debut", ...)` plutôt que 13 requêtes individuelles). Vérifié en navigateur : "Juillet
  2026" (transmis via SQL plus tôt dans la session) affiche "Transmis le 30/07/2026" avec l'icône
  `Send`, les autres mois n'affichent rien.
- **Nettoyage de commentaires périmés** : sous-titre "Récap congé + génération de l'export" → "Quels
  congés transmettre + génération de l'export" (nom d'onglet à jour) ; doc de `CongesPaiePage`
  (référençait encore l'ancien écran autonome "Export paie") ; doc de `previsionTransmission`
  (`DetailCongePanel`, gardait l'ancien format ":" au lieu du "-"/gras actuel).

**Refonte du modèle solde théorique/réel — décision actée, implémentation pas commencée (27/08/2026)** :
discussion déclenchée par un chiffre jugé "pas logique" par Vincent sur "Vérifier les fiches de paie"
(Delphine : mois précédent 62, mois en cours 47, mouvement -1 — l'écart ne collait pas). Investigation :
des congés de septembre, validés courant août, avaient fait bouger le solde théorique/réel calculé en
direct par `soldes.repository.ts`, alors qu'ils n'avaient encore rien à voir avec ce qui avait été
transmis en paie sur la période. Le modèle actuel confond deux besoins différents avec un seul niveau
de distinction (validé vs en attente), sans jamais prendre en compte la transmission paie elle-même.

**Nouveau modèle à 2 niveaux, acté avec Vincent** :

- **Solde théorique** = dernier solde réel vérifié − tous les congés à venir, **validés ou en
  attente confondus** (même traitement pour les deux, plus de distinction entre les deux). Répond à
  la question du collaborateur : "combien il me reste à poser ?". C'est le solde affiché aujourd'hui
  sur les cards Soldes d'Accueil et par défaut sur "Suivre mon solde".
- **Solde réel** = solde ancré sur ce qui a été **effectivement transmis en paie**
  (`export_paie_lignes`), pas sur le statut `validee` d'une demande ni sur une date calendaire de
  congé. Répond à la question de Delphine : "est-ce que ce qui est sur la fiche de paie du comptable
  est juste ?". **C'est ce solde réel qui sert de référentiel à toute la gestion de la transmission
  paie** (Quels congés transmettre / Générer l'export / Vérifier les fiches de paie) — Vincent l'a
  confirmé explicitement.

**Implémenté et vérifié (27/08/2026)** : nouvelle fonction `sommeTransmis` (`lib/data/
soldes.repository.ts`) qui somme les `export_paie_lignes.jours_inclus` déjà transmis (au lieu de
rejouer le statut `validee`) ; `fetchSoldes`/`fetchHistoriqueCp`/`fetchHistoriqueRtt` restructurées
pour dériver `valeur` (réel) du transmis et `valeurApresAttente` (théorique) — formule inchangée —
d'un calcul local dédié (ne dépend plus de `valeur`). Plafond de pose (`PoserDemandeModal.tsx`,
`PoserCongePourCollaborateurModal.tsx`) basculé de `.valeur` à `.valeurApresAttente` (le réel, désormais
en retard sur la transmission, aurait laissé poser trop de jours). Copie FAQ (`FaqCard.tsx`) et
commentaires (`lib/types.ts`, doc de `fetchComparaisonSoldes`) mis à jour. `tsc`/`eslint`/`npm run
build` clean.

**Vérifié en navigateur, le cas Delphine (62→47, mouvement -1) est résolu** : sur "Vérifier les fiches
de paie" (Août 2026), Delphine affiche désormais mois précédent 62j → mois en cours 61j, mouvement -1j
— les 3 valeurs reconcilient enfin (62 + (-1) = 61), au lieu de l'incohérence 62→47/-1 d'avant. Confirmé
aussi que le solde théorique (Dashboard Accueil, 45j pour Delphine) diverge maintenant correctement du
réel (62j sur Suivre les soldes) : ses congés de septembre déjà validés mais pas encore transmis
réduisent le théorique sans toucher le réel — exactement le comportement voulu.

**Bug trouvé et corrigé dans la foulée (27/08/2026)** : Vincent a signalé que la popin "Suivre mon
solde" (`fetchHistoriqueCp`/`fetchHistoriqueRtt`) affichait un théorique incohérent avec la card
Accueil — 60j dans la popin contre 45j sur la card, pour Delphine. Cause : ces deux fonctions
re-dérivent indépendamment `soldeActuel`/`soldeTheorique` (pas de réutilisation de `fetchSoldes`), et
mon premier passage avait fait démarrer `cumulTheorique` depuis `cumul` (= le nouveau "réel", basé sur
les lignes transmises) au lieu de repartir d'une base validée indépendante — le théorique ne retirait
donc plus les jours validés-mais-pas-encore-transmis, seulement les jours transmis + en attente.
Corrigé en calculant `cumulTheorique` depuis une base dédiée (`soldeDepart/baseRtt − consommation
validée totale (`sommeJours`) + ajustements`), indépendante de `cumul`. Revérifié en navigateur : la
popin de Delphine affiche maintenant Théorique 45j (identique à la card) et Réel 62j (identique à
"Suivre les soldes"/"Vérifier les fiches de paie"). `tsc`/`eslint`/`npm run build` clean.

**Deux bugs supplémentaires trouvés et corrigés (27/08/2026)**, remontés par Vincent qui a pointé que
l'addition ne tombait pas juste dans la popin ("Solde N-1 62j, -1j, -1j" mais "Solde actuel 45j") :

1. **Mauvaise colonne de gating côté transmission** — `sommeTransmis`/`fetchLignesTransmises`
   filtraient sur `exports_paie.periode_fin <= dateReference` : un export généré EN COURS de période
   (ex. le 26/08 pour la période du 01/08 au 31/08) n'était compté qu'à partir du 31/08, jamais avant —
   donc "aujourd'hui" (27/08), le réel de Delphine ignorait encore la transmission du 26/08. Corrigé en
   filtrant sur `exports_paie.genere_le` (le moment réel de la transmission) plutôt que la fin de la
   période couverte, avec borne de fin de journée (`T23:59:59.999Z`, même motif que le filtre
   `ajustements_solde.created_at` existant) pour ne pas exclure un export généré plus tôt le jour même.
2. **Popin "Suivre mon solde" incohérente en mode Théorique** — `fetchHistoriqueCp`/`fetchHistoriqueRtt`
   n'affichaient, en mode théorique, que les demandes EN ATTENTE (`historique.enAttente`) en plus des
   mouvements réels (transmis) — mais `soldeTheorique` retire aussi les demandes déjà VALIDÉES mais pas
   encore transmises, jamais montrées comme ligne. Résultat : la liste affichée (-1j, -1j) ne
   totalisait pas le solde affiché en bas (45j), écart de 15j invisible. Corrigé en ajoutant un nouveau
   champ `HistoriqueSolde.mouvementsTheorique` (toutes les demandes validées, transmises ou non) que la
   popin utilise à la place de `mois` quand le mode "Théorique" est sélectionné — les lignes
   reconcilient maintenant exactement avec le total affiché. CPA (hors scope) n'a pas ce champ, la popin
   retombe sur `mois` dans ce cas (comportement inchangé pour CPA).

Revérifié en navigateur : popin de Delphine en Théorique liste 62→52,5→52→47→46→45 (reconcilie avec
"45j" affiché) ; en Réel, 62→61j (reflète la transmission du 26/08, avant même la fin de période).
"Vérifier les fiches de paie" (Août) toujours cohérent après ce correctif (Delphine 62→61/-1j, Olivier
62→61,5/-0,5j, Salarie Test 47→36/-11j). `tsc`/`eslint`/`npm run build` clean.

**Confirmation de règle — acquisitions RTT/CPA créditées au 1er du mois suivant (27/08/2026)** :
Vincent a confirmé la règle métier ("0,25j de RTT de juin sont crédités le 1er juillet") en observant
qu'un solde initial daté du 01/06/26 (Delphine) ne fait apparaître aucune "Acquisition juin" — comportement
déjà correct, pas un bug : `resolverPointDepartAccrual` (`soldes.repository.ts:224`) fixe le point de
départ de l'accrual à `premierJourMoisSuivant(dateReference)`, donc la première acquisition affichée
("Acquisition juillet") EST le crédit de juin — un seul mouvement, pas un décalage en deux temps.
Confirmé aussi que le CP du 15/01/27 d'Olivier (signalé comme "manquant" sur sa page d'accueil) existe
et s'affiche bien — seulement sur l'onglet "Juin 26 → Mai 27" du calendrier, pas sur l'onglet "2026" par
défaut (qui ne couvre que l'année calendaire en cours) — comportement des onglets existant, pas un bug,
laissé tel quel (Vincent n'a pas demandé de changement).

**"Soldes actuels" (solde initial) — sélecteur de mois au lieu d'une date (27/08/2026)** : le formulaire
laissait saisir n'importe quel jour du mois, alors que le moteur de solde ne raisonne qu'en mois entiers
(report CP, accrual RTT/CPA au 1er du mois suivant) — un jour précis n'avait aucun sens et pouvait laisser
croire à une granularité que rien ne respecte. Remplacé par `<input type="month">` (stocké au 1er du mois
choisi) aux deux endroits où le champ existe (`ModalModifierSoldeInitial` et la section "Soldes actuels"
du formulaire de création, `components/parametrer/UtilisateurFichePage.tsx`), avec un texte de guidage
explicite sous le champ : "Le solde saisi correspond au solde constaté à la fin du mois précédent (ex.
juillet 2026 = solde au 30 juin 2026)". Vérifié en navigateur sur la fiche d'Olivier Test : le sélecteur
de mois s'affiche et se remplit correctement. `tsc`/`eslint` clean.

**"Suivre les soldes" — popin par défaut remise en cohérence avec le tableau (27/08/2026)** : Vincent a
signalé que "dans le tableau on affiche les soldes théoriques" — en fait le tableau affiche bien `.valeur`
(réel, ex. Delphine CP 29j), mais la popin `SoldeDetailPanel` ouverte au clic sur une pill démarrait sur
"Théorique" (`modeParDefaut="theorique"`, décision du 24/08/2026, antérieure à la refonte du modèle) —
un chiffre différent (19,5j pour Delphine) s'affichait donc silencieusement à l'ouverture, sans lien
visible avec la valeur du tableau. Remis sur `modeParDefaut="reel"` dans `SuivreSoldesPage.tsx` (seul
l'usage manager change ; Accueil/`Dashboard2Page`, vue salarié, reste sur "théorique", toujours pertinent
pour "combien il me reste à poser"). Vérifié en navigateur : popin de Delphine ouvre maintenant sur
Réel 29j, identique au tableau. `tsc`/`eslint` clean.

**Correction du correctif précédent — sélecteur réel/théorique ajouté au tableau (27/08/2026)** :
Vincent a précisé juste après que c'est l'inverse qu'il voulait — "dans le tableau par défaut on
affiche les soldes théoriques" : pas juste rebasculer la popin sur réel pour matcher un tableau figé
sur réel, mais ajouter un vrai sélecteur réel/théorique **au tableau lui-même** (par défaut théorique).
Fait : nouveau `SelectFiltrePill` "Solde théorique"/"Solde réel" à côté du filtre collaborateur
(`SuivreSoldesPage.tsx`), un seul état `mode` partagé qui pilote l'affichage des 3 colonnes CP/RTT/CPA,
le tri, l'export CSV, et le `modeParDefaut` de la popin `SoldeDetailPanel` ouverte au clic — plus de
risque d'incohérence entre le tableau et la popin, quel que soit le mode choisi. `ModeSolde` exporté
depuis `SoldeDetailPanel.tsx` pour être réutilisé. Vérifié en navigateur : bascule théorique ↔ réel
change bien les 3 colonnes (ex. Delphine CP 13j théorique / 29j réel), et la popin ouverte dans chaque
mode affiche le même chiffre que le tableau. `tsc`/`eslint`/`npm run build` clean.

**Itération sur la forme du contrôle (27/08/2026)** : deux ajustements de style demandés juste après —
(1) "tu me le sors du tableau et tu le passe en toggle" : `SelectFiltrePill` retiré de la ligne de
filtres du tableau, remplacé par un vrai switch binaire (piste + poignée, pas un `<select>`) placé au
niveau du titre de page ; (2) "sous le titre et en un peu plus petit" : repositionné sur sa propre
ligne sous le H1 (au lieu d'aligné à droite dessus) et réduit (piste `h-5 w-9`/poignée `h-4 w-4` au lieu
de `h-6 w-11`/`h-5 w-5`, texte `text-xs` au lieu de `text-sm`). Pas de primitive `Toggle`/`Switch`
partagée dans `components/ui/` pour l'instant — construit directement dans `SuivreSoldesPage.tsx` ; à
extraire si un futur écran a besoin du même composant. Revérifié en navigateur : bascule fonctionne,
`tsc`/`eslint`/`npm run build` clean.

**"Vérifier les fiches de paie" — libellé "Soldes réels" (27/08/2026)** : titre de la section
renommé de "Soldes" à "Soldes réels" (`VerifierFichesPaiePage.tsx`) pour lever toute ambiguïté — ce
tableau montre bien le réel (ancré transmission), pas le théorique, ce que le nom générique
"Soldes" ne précisait pas. Changement de libellé seul, vérifié en navigateur (Delphine 30→29/-1j,
Olivier 62→61,5/-0,5j, Salarie Test 47→36/-11j, cohérent). `tsc`/`eslint` clean.

**"Vérifier les fiches de paie" — colonnes nommées par le mois réel (27/08/2026)** : "Mois précédent"/
"Mois en cours" remplacés par "Solde juillet"/"Solde août" (noms dérivés dynamiquement de
`periode.debut`, `nomMois`/`moisPrecedentIso` ajoutés à `VerifierFichesPaiePage.tsx`). Vérifié en
navigateur : colonnes "SOLDE JUILLET"/"SOLDE AOÛT" pour la période Août 2026, valeurs inchangées et
toujours cohérentes. `tsc`/`eslint` clean.

**"Vérifier les fiches de paie" — panneau latéral "jours du mouvement" (27/08/2026, demande explicite,
"on va tenter un truc")** : le tableau "Soldes réels" est resserré (`min-w-[480px]`, était `640px`) et
passe en grille 2 colonnes (`xl:grid-cols-[minmax(0,560px)_24rem]`, uniquement quand un mouvement est
sélectionné) dès qu'on clique sur une valeur "Mouvement" (devenue un bouton soulignée cliquable, avant
texte brut). Le panneau latéral (`PanelJoursMouvement`) liste les jours `export_paie_lignes` de cet
export pour ce collaborateur/type précis — **aucune nouvelle donnée chargée** : simple filtre sur
`collaborateurs` (déjà fetché par `fetchCheckFichesPaie` pour le contrôle ligne par ligne existant plus
bas). Cliquer un jour dans cette liste ouvre `DetailCongePanel` ("suivi de congé") en ligne, juste en
dessous — la `demande` du filtre est déjà un `DemandeEquipe` complet, pas de fetch supplémentaire
nécessaire pour ça non plus. Vérifié en navigateur (via clic direct sur le bouton, l'inspection DOM a
montré un délai de montage du bouton après le changement d'onglet — pas un bug, juste un besoin
d'attendre le fetch de `comparaisons`) : clic sur "-1 j" (Delphine, CP) ouvre le panneau avec la ligne
"31 août → 11 sept. 2026, -1j", clic sur cette ligne ouvre bien `DetailCongePanel`. `tsc`/`eslint`/
`npm run build` clean.

**Duplication en onglet séparé pour itérer (27/08/2026)** : Vincent veut retravailler l'UI et la
logique globale de "Vérifier les fiches de paie" sans risquer de casser la version utilisée pour la
vraie vérification de paie — `VerifierFichesPaiePage.tsx` dupliqué à l'identique dans
`VerifierFichesPaiePage2.tsx` (export renommé `VerifierFichesPaiePage2`), câblé sur un **4e onglet**
"Vérifier les fiches de paie 2" ajouté dans `TransmissionsPaiePage.tsx` (`Onglet` type +
`onglets`/rendu), à côté de l'original — pas un remplacement silencieux (Vincent l'a explicitement
demandé après un premier essai de bascule directe). L'original reste inchangé et branché sur son
propre onglet. Vérifié en navigateur : les deux onglets coexistent, "Vérifier les fiches de paie 2"
affiche le même contenu (Soldes réels + panneau latéral) que l'original. `tsc`/`eslint`/`npm run build`
clean. Toute itération à venir se fait sur `VerifierFichesPaiePage2.tsx` uniquement — voir ce fichier
pour le détail au fur et à mesure des changements.

**Itérations UI supplémentaires sur `VerifierFichesPaiePage2.tsx` (27/08/2026, "on va bosser sur l'UI
du truc et la logique globale")** — chaîne de petits ajustements demandés au fil de l'eau, tous vérifiés
en navigateur :

- Colonnes "Solde N-1"/"Solde N"/"Mouvement" plafonnées à `150px` chacune (`minmax(0,150px)`), colonne
  "Type" resserrée à `4.5rem` (fixe, pas `auto` — chaque ligne est sa propre grille CSS, `auto` aurait
  donné une largeur différente par ligne selon CP/RTT/CPA).
- Card et en-tête de colonnes (sorti des cards, affiché une fois sur le fond de page) calés sur la
  largeur du contenu (`w-fit`), plus d'étirement à 900px.
- Typo "Solde N-1" alignée sur celle de la pill "Solde N" (`text-xs font-bold` de `TypeBadge`), puis
  agrandie (`text-sm`) sur demande.
- **Correction de fond** (pas juste du style) : "Mouvement" recalculé en delta (`moisEnCours −
moisPrecedent`) plutôt que via `fetchMouvementsExport` — ce dernier ne somme que les
  `export_paie_lignes` transmises, sans les acquisitions RTT/CPA du mois ("les mouvements totalisent
  les acquisitions et les consommés", Vincent). Résultat concret : RTT de Delphine passe de "0 j" à
  "+0,25 j".
- Nom/prénom du collaborateur passés en `text-xs` (calé sur la typo des cards "Congés consommés" plus
  bas), puis en `text-base` (16px) sur demande explicite suivante.
- **Nouvelle prop `pleineLargeur` sur `DetailCongePanel`** (`DetailCongePanel.tsx`, changement partagé
  — pas cantonné à la V2) : sans elle, le composant s'impose `xl:sticky xl:w-64 xl:shrink-0`, pensé
  pour un docking pleine page (`SoldeDetailPanel`) — incohérent une fois affiché en ligne dans le
  panneau "jours du mouvement" déjà étroit (`PanelJoursMouvement`). `pleineLargeur` neutralise juste
  ça, sans toucher le bandeau coloré (contrairement à `masquerBandeau`/`masquerTypeBadgeBandeau`, qui
  changent aussi son style) — changement additif, aucun appelant existant impacté.

**"Jours du mouvement" — refonte reprenant "Suivre mon solde" (27/08/2026, demande explicite)** :
`PanelJoursMouvement` passe d'une liste plate à un tableau ÉVÉNEMENT/JOURS repris de
`SoldeDetailPanel.tsx`, adapté à un seul mois — **pas de colonne SOLDE** (demande explicite, pas de
sens ici où on ne montre qu'un mois isolé). Ligne "Solde {mois précédent}" en tête (pill pleine couleur,
valeur = `categorie.moisPrecedent`). Jours transmis en pill contour + point vert (style repris de
`SoldeDetailPanel`), cliquables → `DetailCongePanel` en ligne (`pleineLargeur`). **Acquisition RTT/CPA
du mois** ajoutée comme "événement" à part (pill pleine + icône `Plus`, même style que
`SoldeDetailPanel`) — pas de ligne dédiée dans `export_paie_lignes` pour ça, déduite par résidu
(`mouvementTotal − somme des jours de ligne affichés`, `mouvementTotal = moisEnCours − moisPrecedent`,
déjà calculé pour l'affichage de "Mouvement"). Libellé date des pills via `formatPeriodePillNumerique`
(convention existante, pas de date ISO brute) ; pas de rappel du type dans le libellé (le panneau est
déjà scopé à un seul type via son bandeau). Vérifié en navigateur : Delphine RTT (+0,25j, aucun jour
transmis) affiche "Acquisition août 2026 +0,25j" seule ; Delphine CP (-1j) affiche la ligne "31/08 au
11/09/26 -9,5j" (jour réel transmis, aucune acquisition CP — cohérent, le CP n'a pas d'accrual mensuel).
`tsc`/`eslint`/`npm run build` clean.

**Ce qui disparaît** : l'actuel "solde réel" de `soldes.repository.ts` (capital − tout ce qui est
`validee`, peu importe la date du congé ou si c'est transmis) n'est **plus une valeur utile en soi** —
ni le collaborateur (qui a besoin du théorique) ni Delphine (qui a besoin du réel ancré paie) ne s'en
servent. Décision : le supprimer plutôt que le garder comme 3e valeur cachée, pas de rétro-compatibilité
à préserver dessus.

**Impact code attendu (pas encore implémenté)** : c'est un vrai changement de calcul, pas un
renommage — le "réel" doit désormais se dériver de `export_paie_lignes` (cumul de ce qui a été
transmis) au lieu du statut `validee` des `demandes_conges`. Touche `soldes.repository.ts` (moteur de
calcul), et potentiellement `exportsPaie.repository.ts`/`VerifierFichesPaiePage.tsx` (le
`fetchComparaisonSoldes`/`fetchMouvementsExport` construits le 25/08 reposaient sur l'hypothèse — dont
on sait maintenant qu'elle était fausse — que le "mouvement" de l'export doit _reconcilier_ un solde
théorique recalculé en direct ; avec le nouveau modèle, le réel EST directement le cumul transmis, plus
besoin de reconcilier deux calculs indépendants). Périmètre exact et plan de bascule à définir en
implémentation — voir `questions.md` pour le point resté ouvert et `Backlog.md` pour le chantier en
pause qui doit reprendre là-dessus.

**Statut/commentaire des demandes — deux règles resserrées (28/08/2026)** : (1) plus de régularisation
possible une fois un congé refusé ou annulé, pour tous les profils — le bloc "Régularisation" de
`DetailCongePanel.tsx` (qui permettait "Restaurer" un congé annulé, réutilisant `onValider`) ne
s'affiche désormais que pour `statut === "validé"` (ancienne condition : `"validé" || "annulé"`) ;
l'état `annulé` devient un vrai statut terminal, sans action. (2) le commentaire devient obligatoire
pour "Annuler cette demande" quand la demande est `validée` (comportement déjà en place pour la
régularisation "Signaler comme non pris", désormais harmonisé) — reste facultatif pour une demande
"en attente". `tsc`/`eslint`/`prettier` clean.

**Suppression de la granularité transmis/en_paye/écart sur `export_paie_lignes` (28/08/2026,
"je me demande si on a besoin d'avoir deux statuts transmis et pris en compte")** : en creusant,
confirmé que cette distinction n'a jamais été fonctionnelle — `validerCheckPaie` (la fonction censée
faire passer une ligne de `transmis` à `en_paye`) n'avait aucun appelant, le bouton "Valider" de
"Vérifier les fiches de paie" étant câblé à vide depuis sa conception (discussion restée en pause).
Décision : tout retirer plutôt que garder un statut mort. Colonnes `statut`/`motif_ecart`/
`verifie_le`/`verifie_par` supprimées d'`export_paie_lignes` (migration fournie à Vincent, exécutée),
type `statut_transmission` supprimé, policy RLS `"export_paie_lignes: manager et admin mettent à
jour le statut"` (devenue sans objet) supprimée. Côté code : `StatutTransmission` retiré de
`lib/types.ts` (`LigneExportPaie` perd `statut`/`motifEcart`/`verifieLe`), `validerCheckPaie` supprimé
de `exportsPaie.repository.ts`, le feed de `DetailCongePanel.tsx` n'affiche plus qu'une entrée
"Transmis"/"Transmis (retro)" (fini la distinction "En paye"/"Écart signalé" en 2e ligne), et le badge
"Paie" de `HistoriqueTable.tsx` simplifié à Transmis (✓)/— (icône `Check` ajoutée, `TriangleAlert`
retiré). Une ligne dans `export_paie_lignes` = congé transmis, point — plus de sous-état. Avant cette
suppression, Vincent a fait vider `exports_paie`/`export_paie_lignes` (`delete from exports_paie`,
cascade) pour repartir d'un jeu de données propre et refaire l'exercice de transmission lui-même.
`tsc`/`eslint`/`prettier`/`npm run build` clean à chaque étape.

**Annulation par l'admin d'un congé déjà transmis en paie (28/08/2026, "on va s'intéresser à la
gestion des annulations des congés déjà passés en paye")** : cas resté bloqué jusqu'ici — même
l'admin ne pouvait pas annuler un congé validé une fois `export_paie_lignes` non vide (mention "Passé
en paie : contactez l'administrateur..." affichée à tout le monde, y compris l'admin). En creusant,
découverte que le mécanisme de correction existe déjà et est branché : `genererExportPaie`
(`exportsPaie.repository.ts`) détecte automatiquement, au prochain "Transmettre", toute demande
`annulée` dont le solde de transmission est positif, et génère une ligne négative de correction — ce
mécanisme a été construit pour la régularisation manager ("Signaler comme non pris" après
transmission), mais ne dépend que du statut `annulé`, peu importe qui l'a mis. Donc : juste débloquer
l'UI pour l'admin, sans rien construire de neuf côté génération. Nouveau prop
`peutAnnulerDejaTransmis` (opt-in, admin uniquement) sur `DetailCongePanel.tsx` — étend
`onRetirer`/le commentaire obligatoire au cas `dejaTransmis`, ajoute une note "Déjà transmis en
paie : une correction sera envoyée automatiquement au prochain export." dans le bloc ouvert. Câblé à
`estAdmin` dans `SuivreDemandesPage.tsx`, `SoldeDetailPanel.tsx`/`SuivreSoldesPage2.tsx` (via une
nouvelle prop traversante) et `TransmissionsPaiePage.tsx`. RLS inchangée (la policy large
`"demandes: admin gère tout"` couvrait déjà ce cas). `tsc`/`eslint`/`prettier`/`npm run build` clean.

**Suppression de la ligne "prévisionnelle" du feed (28/08/2026)** : en testant le rattrapage de
juillet, Vincent relève que la ligne "Transmis paie le {jj/mm/AA} - Xj/Yj" du feed de
`DetailCongePanel` (ajoutée le 25/08, uniquement sur "Quels congés transmettre"/"Générer l'export")
affiche la date du jour réel (28/08) plutôt que la période traitée (juillet) — comportement voulu à
l'origine (`genererExportPaie` horodate bien l'export avec `now()`, pas avec la période), mais jugé
trompeur à l'usage pour un rattrapage de backlog. Décision : la retirer entièrement plutôt que
l'ajuster. Prop `previsionTransmission` retirée de `DetailCongePanel.tsx` (interface, destructure,
bloc de rendu, champ `previsionnel` du feed et son style pointillé), et son câblage retiré de
`TransmissionsPaiePage.tsx`/`CongesPaiePage.tsx`. Le calcul sous-jacent
(`calculerJoursATransmettreMaintenant`/`joursATransmettreParId`) reste en place, toujours utilisé
pour la colonne Durée "X/Y j". `tsc`/`eslint`/`prettier`/`npm run build` clean.

**Refonte de "Quels congés transmettre" (28/08/2026)** — plusieurs chantiers enchaînés dans la même
session :

- **Décision/Régularisation retirées de cet écran** ("on va supprimer les blocs régulation de cette
  vue et décision pour le remplacer par le bloc qui permet de supprimer un congé") : composant
  `CarteDecisionRapide` (Valider/Refuser/Pending, construit le 25/08) supprimé, ainsi que le bloc
  Régularisation intégré (`onRegulariser` retiré du câblage) — remplacés par `onRetirer` ("Annuler
  cette demande"/"Annuler ce congé" ici, voir wording plus bas) avec `peutAnnulerDejaTransmis={estAdmin}`
  systématique. Fonctions `valider`/`refuser`/`regulariser`/`annulerValidation` (+ le toast d'annulation
  de validation associé) devenues mortes, supprimées. Cohérent avec la règle actée le 28/08 pour
  "Suivre les demandes"/"Suivre les soldes 2" : admin ne décide plus jamais, seulement annuler.
- **Tri par collaborateur puis type** ("Pour chaque section... organiser : Collaborateur / CP / RTT /
  CSS / CPA / puis les autres") : nouvelle fonction `trierParCollaborateurPuisType` (tri stable,
  s'appuie sur le regroupement par collaborateur déjà fait par `HistoriqueTable` via
  `triParDefaut="collaborateur"`) appliquée aux 3 tableaux ("Congés consommés sur la période",
  "...des périodes précédentes", "...passés en paye mais annulés").
- **Refonte du format CSV** ("Export congés {Mois}" + période, puis un bloc par collaborateur —
  liste des CP, liste des RTT, etc. — par section, "Régularisations" gardant des colonnes dédiées) :
  nouveau format en sections + blocs par collaborateur (une ligne "Nom", puis une ligne par type
  effectivement consommé — plus de ligne "0"), remplace l'ancienne grille fusionnée
  collaborateur × type. Décisions actées via questions posées : titre sur 2 lignes ("Export congés
  {mois année}" / "Période de prise en compte : jj/mm/aaaa - jj/mm/aaaa"), Régularisations en
  colonnes dédiées (Collaborateur/Type/Date/Jours/Motif) plutôt qu'en blocs.
- **Wording** : lien/titre "Annuler cette demande" → "Annuler ce congé" sur cet écran uniquement
  (nouveau prop `libelleRetirer` sur `DetailCongePanel`, défaut inchangé partout ailleurs) ; texte
  "Ce congé n'a pas été pris par le collaborateur" ajouté entre le titre et le commentaire (nouveau
  prop `texteRetirer`, opt-in) ; modale de confirmation de transmission reformulée en "Transmettre ces
  données" / "Confirmez-vous que vous allez envoyer ces données à la paie ? L'historique sera
  consultable dans Apidays."
- `tsc`/`eslint`/`prettier`/`npm run build` clean à chaque étape.

**Transmission directe + suppression de l'onglet "Générer l'export" (28/08/2026)** : Vincent doutait
depuis un moment de l'utilité de cet onglet ("juste une mise en page différente de ce qui se passe
ici") — décision actée en 2 temps. D'abord, le bouton "Valider et générer l'export" de "Quels congés
transmettre" transmet désormais directement (au lieu de juste changer d'onglet) : modale de
confirmation forte (reprise de l'ancien "Générer l'export"), `genererExportPaie(periode)`, gel de
l'écran une fois transmis — sélecteurs Du/Au désactivés, cards congé en lecture seule (`onRetirer`
non câblé), bandeau "Transmis le {date} à {heure}" sous les onglets (`formatDateHeureAction`,
finalement scopé à cet onglet seulement, pas "Vérifier les fiches de paie"), colonne "Paie" avec coche
ajoutée aux 3 tableaux (`lignesTransmissionParDemande`), feed de `DetailCongePanel` enrichi d'un "par
{prénom}" sur l'entrée "Transmis le" (nouveau champ `genereParNom` sur `LigneExportPaie`, alimenté par
un join `export_paie_lignes → exports_paie → utilisateurs(prenom)` dans `fetchCheckFichesPaie`/
`fetchLignesTransmissionParDemande`). Ensuite, l'onglet "Générer l'export" (`GenererExport`) est
supprimé entièrement, ainsi que `components/suivre/CongesPaiePage.tsx` (devenu orphelin, plus aucun
appelant) — la génération CSV qu'il portait via `ref`/`useImperativeHandle` est portée directement
dans `TransmissionsPaiePage.tsx` (types/fonctions `LigneCollab`/`grouperParCollaborateur`/
`genererCsv`/... copiés depuis `CongesPaiePage.tsx`, `codeRecap`/`ordreType`/
`trierParCollaborateurPuisType` généralisés de `CongeATransmettre` à `DemandeEquipe` pour rester
utilisables sur les deux sources de données), le lien "Exporter (CSV)" rejoint le bouton "Valider et
générer l'export" dans le même bandeau sticky. `TransmissionsPaiePage` ne garde plus que 2 onglets
("Quels congés transmettre", "Vérifier les fiches de paie 2").

**Bug "plus aucune donnée dans le tableau après la validation" (28/08/2026, signalé en testant)** :
`useCongesATransmettre` liste ce qui RESTE à transmettre — une fois tout envoyé, forcément vide. Le
gel de l'écran (sélecteurs/lecture seule) masquait ce problème sans le résoudre : les 3 tableaux et le
CSV se retrouvaient vides après un "Transmettre" réussi. Correctif : port du mécanisme
`figeParExport` de l'ancien `CongesPaiePage.tsx` — une fois `exportPaie` connu, un nouvel effet
appelle `fetchCheckFichesPaie(exportPaie.id)` et bascule `demandesPourAffichage`
(`demandesFigees`/`joursParDemandeFigee`, signé) à la place du backlog live pour tout le calcul en
aval (bucketing des 3 tableaux par signe plutôt que par statut, `totaux`, colonne Durée via un nouveau
`renderDureeFigee`, CSV via `joursPourCsv`). **Exigence explicite de Vincent en cours de route** ("les
données qu'un export contient doivent être historisées" — exemple : un CP transmis en juillet puis
annulé en août doit rester visible dans les 2 transmissions, juillet ET août) : confirmé que ce
mécanisme la satisfait nativement, `fetchCheckFichesPaie` étant scopé par `export_paie_id`, jamais par
le statut live de la demande — un export figé est immuable. Un bug annexe corrigé dans la foulée :
`grouperParCollaborateur` (utilisé pour le total du CSV) excluait à tort une demande dont le statut
LIVE était passé à "annulé" depuis, même dans une section qui la comptait historiquement comme
positive — nouveau paramètre `ignorerStatutLive` (activé quand `estTransmis`) pour ne plus dépendre du
statut courant une fois l'export figé. `tsc`/`eslint`/`prettier`/`npm run build` clean.

**"Vérifier les fiches de paie 2" — vérification du calcul de solde (28/08/2026)** : Vincent demande
confirmation que les jours transmis via "Quels congés transmettre" sont bien pris en compte dans le
calcul des soldes affichés ici. Confirmé après lecture du code : `fetchSoldes`/`sommeTransmis`
(`soldes.repository.ts`) sont bien ancrés sur `export_paie_lignes`, filtrés par
`exports_paie.genere_le <= dateReference` (date de génération réelle de l'export, pas la période
qu'il couvre) — mécanisme déjà en place depuis le 27/08, `fetchComparaisonSoldes` refetch déjà
automatiquement au changement d'`exportId`. **Effet de bord découvert en testant** : un rattrapage
tardif (congé de juillet transmis le 28/08 en régularisant le backlog) ne compte donc ni dans le solde
de juillet ni avant le 28/08 dans celui d'août — seulement à partir de sa date de génération réelle.
Question posée à Vincent (ancrer sur la période de l'export plutôt que sur `genere_le` ?) — **décision :
garder `genere_le`, ne rien changer** ; cohérent avec le reste de l'app (repêchage/à cheval atterrissent
toujours dans la période où ils sont réellement transmis, jamais réinjectés rétroactivement dans le
passé). Reste un vrai bug d'affichage identifié mais pas corrigé : dans ce cas de figure, le panneau
"jours du mouvement" de `VerifierFichesPaiePage2.tsx` invente une "Acquisition" fantôme
(`acquisition = mouvement − somme des lignes`, résidu de calcul) pour un type qui n'en a pas (CP) —
Vincent a proposé de la corriger plus tard, pas encore fait. Pour tester ce scénario, Vincent a
antidaté manuellement (SQL fourni par l'agent, exécuté par Vincent) le `genere_le` d'un export de test
au 29/07/2026 (dans juillet lui-même, volontairement, pour vérifier l'effet inverse). Item ajouté au
Backlog : "Gestion des jours à cheval : à revoir" (Moyenne, priorité).

**Tiroir "Mon journal" — tentative de bascule vers une entrée par le bas, abandonnée (28/08/2026)** :
sur demande explicite ("on va remplacer la transition droite gauche pour une basse ahaute"),
`ActiviteRecenteFeed.tsx` a été modifié pour ancrer le tiroir en bas de l'écran (`items-end
justify-center`, `max-h-[85vh]`, coins arrondis en haut) avec une nouvelle animation dédiée
`--animate-drawer-in-bottom`/`@keyframes drawer-in-bottom` (`translateY`) ajoutée dans
`globals.css`, en gardant `max-w-sm` (pas plein écran) — confirmé par Vincent après une question de
cadrage. Revenu en arrière presque aussitôt ("on garde comme avant") : wrapper et panneau repassés à
leur état d'origine (`justify-end`, `animate-drawer-in-right`, hauteur pleine), le token et les
keyframes `drawer-in-bottom` supprimés de `globals.css` (n'existent donc plus dans le code).

**"Acquisition" fantôme — diagnostic technique complet (28/08/2026)** : approfondissement de l'item
Backlog identifié le 28/08 plus haut (voir juste au-dessus). Racine confirmée avec précision : dans
`VerifierFichesPaiePage2.tsx:265-266`, `sommeJoursLignes` vient de `fetchCheckFichesPaie(exportId)`
(`exportsPaie.repository.ts:374-377`) — TOUTES les lignes rattachées à cet export précis, y compris
un repêchage d'un mois antérieur transmis tardivement dans cet export — alors que `mouvementTotal`
vient de `fetchSoldes(u.id, finMoisEnCours)`, qui filtre `exports_paie.genere_le <= periode.fin`
(`soldes.repository.ts:472`) : si l'export a été généré après la fin de la période affichée (cas
courant), ses propres lignes tombent hors de ce filtre. Le résidu (`mouvementTotal −
sommeJoursLignes`) invente alors une "Acquisition" pour un type qui n'en a pas (CP). Piste de
correctif documentée dans Backlog.md (filtrer `lignes` sur la période affichée avant de calculer le
résidu) — **pas implémenté, Vincent doit vérifier la logique avant tout correctif** (touche du
calcul de solde).

**Apparition échelonnée des blocs d'écran (28/08/2026, item Backlog "Affichage progressif des
composants")** : nouvelle convention d'entrée de page — classe utilitaire `animate-stagger-in`
(`--animate-stagger-in`/`@keyframes stagger-in` dans `globals.css`, fondu + `translateY` de 14px,
durée 450ms) appliquée aux blocs de premier niveau de chaque page, avec un `animationDelay` inline
croissant par bloc (généralement 0/90/180/270ms) pour créer un effet de cascade au montage plutôt
qu'un rendu en bloc. Réglage de l'intensité en plusieurs passes : 400ms/8px jugé imperceptible par
Vincent, vérifié techniquement correct malgré tout (`getAnimations()` en JS confirme l'animation
appliquée) — la limite venant du round-trip de l'outil de capture d'écran (screenshot toujours pris
après la fin de l'animation, jamais pendant) plutôt qu'un vrai bug ; passage temporaire à 2500ms pour
confirmation visuelle par Vincent en conditions réelles, puis réglage final à 450ms/14px avec délais
resserrés (70-90ms par palier). Déployé sur toutes les pages principales : Accueil (`DashboardPage`,
6 blocs), Historique, Suivre les demandes, Suivre les soldes 2, Suivre le calendrier, Transmissions
paie (shell + les 4 cards de "Quels congés transmettre"), Vérifier les fiches de paie 2, Paramétrer >
Utilisateurs/Congés & RTT/Calendrier. Les panneaux de détail ouverts par clic (`DetailCongePanel`,
`SoldeDetailPanel`...) et les bandeaux sticky de bas de page ne sont volontairement pas animés (pas
de remontage au clic, l'effet de cascade ne concerne que le chargement initial de la page). Vérifié
`tsc`/`eslint`/`prettier`/`npm run build` clean sur l'ensemble des fichiers touchés, testé en
navigateur sur chaque page sans régression visuelle.

**Poursuite de la revue du Backlog (28/08/2026)** : passage complet ligne par ligne sur les items
restants après la session précédente (repris à la ligne "Affichage progressif"). Tranchés/traités :
apparition échelonnée (fait, voir ci-dessus), item "Uniformisation UI des icônes 'à cheval'" renommé
et réécrit en "Gestion des demandes à cheval : clarté de la transmission (UI) et suivi de ces jours"
(priorité relevée à Haute, absorbe l'ancien item séparé "Gestion des jours à cheval" du 28/08, jugé
doublon), "Finir le chantier Vérifier les fiches de paie" marqué traité, "Suite de l'Espace Delphine"
supprimé (obsolète), "Unifier les boutons Exporter" fusionné dans "Uniformisation des éléments UI".
Item "Dépouiller documentation-conges/" jugé caduc et remplacé par un nouveau point priorité Haute :
"Paramétrage des congés" (définition de la semaine de CP, intégration des zones de congés scolaires,
modification de l'intitulé des compteurs RTT) — le cadrage CPI/DJI/RTT imposées détaillé dans
`questions.md` reste comme référence historique mais n'est plus la base de travail directe.

**Revue complète du Backlog + nettoyage technique (28/08/2026)** : après la documentation ci-dessus,
passage exhaustif ligne par ligne sur `Backlog.md` avec Vincent, générant plusieurs correctifs et
suppressions concrets, en plus des mises à jour de statut :

- **`HistoriqueTable.tsx`** : la ligne entière (`<tr>`) devient cliquable dans les deux variantes de
  rendu (groupée par collaborateur avec `rowSpan`, et plate), pas seulement la pastille de dates —
  celle-ci perd son wrapper `<button>` dédié. Audit fait sur toute l'app pour repérer un éventuel
  conflit (deux actions distinctes dans une même ligne) : seuls `SuivreSoldesPage2.tsx`
  (boutons Théorique/Réel) et `CongesRttPage.tsx` (icônes Modifier/Supprimer) laissés inchangés.
- **`HistoriquePage.tsx`** : filtres "Validés non vus"/"Refusés non vus" retirés du menu `Filtre`
  (aucun lien nulle part ne pointait vers ces valeurs — le compteur Accueil censé les déclencher
  n'existe pas) ; le mécanisme `vu`/`marquerVue` sous-jacent reste utilisé par le Journal (Accueil).
- **Composants dashboard orphelins supprimés** : `ActiviteRecenteTable.tsx`, `ActiviteRecenteListe.tsx`,
  `ActiviteRecenteCard.tsx` et la route `app/(app)/preview-orphelins/` (aucun vrai import ailleurs,
  juste des mentions en commentaires) — `ProchainsJoursOffCard.tsx` explicitement conservé (utilisé
  sur Accueil).
- **`SuivreSoldesPage.tsx` (V1) supprimé**, avec sa route `app/(app)/suivre/soldes/` — Vincent a
  tranché de ne garder que `SuivreSoldesPage2.tsx` (`/suivre/soldes2`), qui reste sur son URL/libellé
  "2" pour l'instant (même logique que l'ancien `Dashboard2Page`, voir point suivant) ;
  `components/layout/tabs.ts` mis à jour pour ne plus lister l'onglet "Suivre les soldes" (V1).
- **`Dashboard2Page.tsx` → `DashboardPage.tsx`** : fichier renommé (`git mv`), export renommé
  `Dashboard2Page` → `DashboardPage`, seul vrai import mis à jour (`app/(app)/page.tsx`) ; les
  mentions en commentaire JSDoc dans 12 autres fichiers (`tabs.ts`, `SoldeDetailPanel.tsx`,
  `SuivreCalendrierPage.tsx`, `DemandesAEtudierCard.tsx`, `DetailCongePanel.tsx`,
  `compterTypologies.ts`, `CalendrierCollaborateur.tsx`, `SnippetJourCalendrier.tsx`,
  `ProchainsJoursOffCard.tsx`, `periodeReferenceCp.ts`, `PoserDemandeModal.tsx`,
  `DesignSystemPage.tsx`) mises à jour en masse puis vérifiées une à une.
- **`SideNav.tsx` — passage en `fixed`, sur plusieurs itérations** : bug signalé, "sticky au scroll"
  ne fonctionnait pas — en cause, un `absolute top-0 bottom-0` qui défilait avec la page faute de
  conteneur de scroll interne dans `AppShell`. Remplacé par `fixed inset-0` avec une enveloppe
  `mx-auto max-w-[1180px]` (deux calques `pointer-events-none`, seule la nav elle-même
  `pointer-events-auto`) pour rejouer le centrage perdu par le passage en `fixed`, plus un espaceur
  `w-16 shrink-0` dans le flux flex de `AppShell` pour réserver la largeur du rail replié. Rail
  d'abord ancré sous `HeaderBar` (`top-14`), puis remonté jusqu'à `top: 0` sur demande explicite
  ("faudrait qu'il reste sticky en haut... pour compenser la disparition du header général" —
  Vincent a explicitement refusé de fixer le header lui-même, tentative revertée immédiatement :
  "non pas le header sticky, non !"). `HeaderBar.tsx` reçoit `relative z-50` (pas sticky) pour
  rester visuellement au-dessus du rail (`z-40`) tant que les deux sont à l'écran ensemble ; une fois
  le header défilé hors du viewport, plus rien ne recouvre le haut du rail. Bug de suivi signalé par
  Vincent ("sans scroll, les premiers items de la nav latérale sont masqués par le header") : le
  premier item de nav démarrait dans la zone des 56px recouverte par le header au repos — corrigé en
  passant le padding interne de la nav de `py-6` à `pt-20 pb-6` (80px = 56px header + 24px marge
  d'origine), qui pousse tout le contenu sous le header quelle que soit la position de scroll.
- **Tiroir "Mon journal" (`ActiviteRecenteFeed.tsx`) — recentrage** : le panneau était bien
  positionné dans l'absolu mais aligné sur le bord droit du vrai viewport plutôt que sur le
  conteneur centré `max-w-[1180px]` de l'app (grand vide gris visible entre le contenu et le tiroir
  à 1920px) — corrigé avec le même principe d'enveloppe `mx-auto max-w-[1180px]` que `SideNav`,
  backdrop `fixed inset-0` conservé pour fermer au clic n'importe où hors du panneau.
- Vérifié à chaque étape `tsc`/`eslint`/`prettier`/`npm run build` clean, testé en navigateur
  (multiples redémarrages du serveur dev nécessaires : `rm -rf .next` pendant que le serveur tourne
  corrompt son cache de build — symptôme récurrent cette session, `Module not found`/`ReferenceError`
  sur du code pourtant correct en disque, résolu à chaque fois par `preview_stop` → `rm -rf .next` →
  `preview_start`).

Backlog lui-même mis à jour en continu pendant la revue (dizaines d'items tranchés/fusionnés/
supprimés/renommés — voir `Backlog.md` directement pour l'état détaillé), notamment : "Uniformisation
UI des icônes 'à cheval'" renommé "Gestion des demandes à cheval : clarté de la transmission (UI) et
suivi de ces jours" (priorité relevée à Haute), "Dépouiller documentation-conges/" remplacé par
"Paramétrage des congés" (semaine de CP, zones scolaires, intitulé RTT — Haute), "Suite de l'Espace
Delphine" supprimé (obsolète), "Unifier les boutons Exporter" fusionné dans "Uniformisation des
éléments UI".

**Fond de la card FAQ — test de couleur conservé (28/08/2026)** : sur demande de test rapide,
plusieurs couleurs essayées en navigateur (header `--color-slate` → teal `#245554`, fond de page
`--color-surface-app` → vert clair `#F3FCF1`, fond de `FaqCard.tsx` → jaune sable `#FCEFB3`) — seul
le fond de la FAQ conservé, en couleur arbitraire ponctuelle (`bg-[#FCEFB3]`) plutôt qu'en modifiant
le token partagé (`--color-surface-card`, utilisé par toutes les cards blanches de l'app). Le header
teal et le fond de page vert restent aussi actifs (non explicitement annulés par Vincent) — seul le
fond de page général a été remis au gris d'origine sur demande explicite ("le gris en fond steup").

**"Calendrier des employés" — heatmap consolidée sur `/suivre/calendrier` (28/08/2026, item Backlog
priorité Urgente)** : nouveau composant `components/suivre/CalendrierGlobal.tsx`, vue par défaut de
l'écran (le sélecteur de collaborateur existant bascule toujours vers `CalendrierCollaborateur` en
cas de sélection explicite — rien retiré, uniquement ajouté). Reprend le même système d'onglets de
période (Année en cours / Période de référence CP / Année suivante) que les autres calendriers.

_Modèle d'intensité_ : ratio = MAX de deux sources (jamais la somme, pour ne pas dépasser 100% ni
compter deux fois une même fermeture) — (1) congés personnels validés/en attente, pondérés en
demi-journées (0,5/1 par collaborateur selon `demiDebut`/`demiFin`, même granularité que
`DashboardPage`/`CalendrierCollaborateur`) divisé par l'effectif actif ; (2) fériés/CPI/DJI, communs
à TOUS les actifs (même liste pour tout le monde, pas une notion par personne) — un férié ou un CPI
vaut 100% (entreprise fermée), une DJI vaut 50%. Plancher à 15% dès qu'au moins une personne est
concernée, pour rester visible sur un gros effectif.

_Rendu de la heatmap_ : extension du DS partagé `MiniCalendrier.tsx` avec une nouvelle variante
`PastilleJour.plein` (couleur CSS calculée dynamiquement — `color-mix`/interpolation par jour,
qu'aucune classe Tailwind littérale ne peut représenter à l'avance) plutôt qu'un composant dédié
bypassant `MiniCalendrier` (premier essai, revenu en arrière sur demande explicite : "on doit avoir
une identité graphique entre la vue consolidée et la vue individuelle, ça passe aussi par la même
grille" — la heatmap utilise donc la même card `h-[290px]`, mêmes breakpoints, même typo que
`CalendrierCollaborateur`). `plein` remplit toute la largeur de sa case (`w-full`, comme une barre
groupée) plutôt qu'une pastille centrée, pour que les jours consécutifs se touchent horizontalement
(jamais fusionné avec un voisin pour autant — chaque jour garde sa propre intensité). Dégradé orange
clair → rouge foncé (échelle "OrRd" de ColorBrewer, 5 paliers interpolés manuellement — un simple
`color-mix` à 2 couleurs glisse vers le rose, jamais l'orange intermédiaire voulu). Les fériés
restent en couleur dédiée `--color-ferie` plutôt que fondus dans le dégradé (identifiables au premier
coup d'œil, même sur un jour qui coïncide avec des congés personnels).

_États d'interaction, plusieurs itérations_ : survol → chiffre en gras + léger grossissement (pas
d'éclaircissement `brightness-110`, jugé "jaunâtre" sur un fond orange/rouge saturé) + bulle
"n Collab. off · n demi-jour."/"Jour férié" en fond `--color-slate` ; sélection (clic) → état
"déclenché" séparé et stable (fond blanc, bordure + texte dans la couleur du jour), corrige un bug
réel où la bulle de survol disparaissait juste après le clic (l'ouverture du panneau provoque un
reflow qui déclenche un `mouseleave` involontaire sur la case). Jours vides totalement
non-interactifs (`PastilleJour.plein.interactif`, défaut `true`) — ni clic, ni curseur, ni survol.

_Panneau de détail (clic sur une date)_ : redessiné en s'inspirant explicitement de
`DetailCongePanel` (même largeur `xl:w-64`) — bandeau coloré (couleur heatmap du jour, pas une
couleur de type fixe) avec `JourBadge` (abréviation 2 lettres, ex. "Ma") devant 2 lignes empilées
(date sans le nom du jour, déjà porté par le badge + stats "n Collab. off · n demi-jour."), corps à
coins carrés groupé par section Journée entière/Matin/Après-midi, une ligne par collaborateur avec sa
pill de congé au format `SoldeDetailPanel` (point de statut validé/en attente + "CODE : dates", ex.
"CP : 21/09 au 25/09/26" — période COMPLÈTE de la demande, pas juste le jour cliqué). DJI intégrée
comme ligne "fluo" (`bg-dji/15 text-dji`) dans la section Matin/Après-midi correspondante plutôt
qu'un bandeau séparé (bandeau restant réservé au CPI) ; jour férié → message dédié centré "Personne
ne travaille aujourd'hui !".

_Mise en page, plusieurs itérations de resserrement_ : grille des mois recentrée dans le corps de
page puis repassée en colonnes calées à gauche (le centrage par ligne recentrait à tort la dernière
ligne incomplète, ex. 5 mois affichés → 2 sur la 2e ligne visuellement décalés) ; espacement resserré
à 10px entre cards et entre la grille et le panneau ; largeur des cards plafonnée à 256-259px (valeur
du palier 3 colonnes, "la plus haute résolution", pour éviter l'étirement à ~391px au palier 2
colonnes). Bug de mise en page non trivial rencontré en resserrant le gap grille/panneau à 10px : la
colonne de grille `xl:grid-cols-[minmax(0,900px)_16rem]` (motif partagé avec les autres écrans
Suivre) réserve jusqu'à 900px de large INDÉPENDAMMENT du contenu réel (`minmax(0,900px)` participe à
la distribution de l'espace libre du grid comme une piste flexible) — un vide invisible restait donc
avant le panneau malgré le `gap` réduit. Corrigé en passant la colonne de CalendrierGlobal (elle
seule, pas le motif partagé ailleurs) en `max-content`, qui épouse la largeur réelle du contenu
(797px, la grille des mois plafonnée) sans stretch.

Titre de page renommé "Calendrier consolidé" (sous-titre "Calendrier des employés" retiré). Chantier
mené par petites itérations verbales successives (~25 échanges), vérifié à chaque étape
`tsc`/`eslint`/`prettier`/`npm run build` clean + test navigateur (mesures DOM précises via JS pour
les questions de spacing, `computer`/hover peu fiable pour ce genre de vérif — voir gotchas plus
haut).

**"Congé à cheval" — bandeau de suivi dans `DetailCongePanel` + teinte header étendue au calendrier
et à l'Accueil collaborateur (29/08/2026)**

Reprise du backlog "Gestion des demandes à cheval" (priorité Haute) : constat de départ, une demande
qui chevauche deux mois calendaires (= deux périodes de paie, voir `lib/periodePaie.ts`) n'avait
aucune indication visuelle dans `DetailCongePanel` — ni depuis "Suivre les demandes", ni "Suivre les
soldes 2", ni même "Quels congés transmettre" (qui affiche pourtant déjà la fraction "X/Y j" dans son
tableau). Seule "Vérifier les fiches de paie 2" avait un badge dédié (`SquareSplitHorizontal`,
"Transmission partielle").

Ajout d'un bandeau "Congé sur N mois" (fond `bg-status-warning-bg`, sans icône — un essai avec
`ChessKnight` en pictogramme a été retiré à la demande de Vincent) dans `DetailCongePanel`,
affiché dès que `selection.debut`/`selection.fin` ne tombent pas dans le même mois calendaire. Le
détail par mois ("4 j en paie août / 3 j en septembre") vient d'une nouvelle fonction
`repartitionParMoisCalendaire` (`lib/data/exportsPaie.repository.ts`) qui découpe la demande en
segments par mois calendaire et recalcule chaque segment via `calculerNbDemiJournees` (même moteur
que le reste de l'app — fériés/CPI/DJI déduits). Le mois correspondant au mois calendaire RÉEL
(`todayISO()`) est mis en avant en vert (`text-status-success-fg`, "en paie {mois}"), les autres
restent en `text-ink-500` ("en {mois}"). Fonctionne automatiquement partout où `DetailCongePanel`
s'ouvre — aucun câblage supplémentaire côté appelants (`SuivreDemandesPage`, `SoldeDetailPanel`,
`TransmissionsPaiePage`).

Bug connexe corrigé au passage : le feed de `DetailCongePanel` (entrées "Transmis le [date] : X j")
ne s'affichait JAMAIS depuis "Vérifier les fiches de paie 2" (`VerifierFichesPaiePage2.tsx`,
`PanelJoursMouvement`) — son appel à `DetailCongePanel` ne passait pas `lignesTransmission`, alors
que les données existaient déjà localement (`lignes: {ligne, demande}[]`, prop du composant). Corrigé
en filtrant `lignes` sur `demande.id === demandeOuverte.id`. Le libellé de ces entrées est passé de
"Transmis le" à "**Transmis en paie le**" (demande explicite, plus clair sur ce qui s'est
effectivement passé), partout où `DetailCongePanel` affiche ce feed.

Discussion annexe (documentée mais pas implémentée, mise en pause) : le bouton "Valider" de
"Vérifier les fiches de paie 2" reste câblé à vide (voir commentaire existant dans
`VerifierFichesPaiePage2.tsx` — décision de comportement pas encore tranchée avec Vincent). Le vrai
transfert de jours vers la paie continue de se faire uniquement via "Valider et générer l'export"
dans "Quels congés transmettre". Autre point clarifié : un mois futur (ex. septembre alors qu'on est
en août) n'apparaît nulle part dans "Transmissions paie" avant que la date réelle n'y arrive —
`periodePaieParDefaut()` se cale sur `new Date()`, pas de navigation manuelle vers un mois à venir.

En parallèle, plusieurs petits ajustements demandés sur "Calendrier consolidé"
(`CalendrierGlobal`/`SuivreCalendrierPage`) et repris à l'identique sur l'Accueil collaborateur
(`DashboardPage`) :

- Le panneau de détail du jour s'ouvre désormais par défaut sur AUJOURD'HUI au chargement de la page
  (`dateSelectionnee` initialisé à `todayISO()` plutôt qu'à `null`).
- Le titre de page, les sous-titres de section, les montants de solde (`SoldeCard`, nouveau prop
  opt-in `classeValeur`) et les noms de mois des mini-calendriers (`MiniCalendrier`, nouveau prop
  opt-in `classeTitreMois`) passent de `text-ink-900`/`text-ink-500` à `text-slate` (le vert foncé du
  bandeau `HeaderBar`, `#245554`) — un essai volontairement scopé à ces deux écrans pour l'instant,
  pas une refonte globale de la charte.
- Les pills de sélection de période (année en cours / période de référence CP / année suivante),
  jusque-là en `mint`, repassent en `slate` sur ces mêmes écrans ET sur `CalendrierCollaborateur`
  (calendrier détaillé d'un collaborateur depuis "Suivre") — mêmes classes partout
  (`bg-slate/90 hover:bg-slate text-white` actif, `border-slate text-slate hover:bg-slate/10` inactif),
  pas de nouveau token CSS créé (`slate-hover`/`slate-tint` n'existent pas, remplacés par des
  variantes d'opacité `/90`/`/10` sur le token `slate` existant).

Refonte du sélecteur de collaborateur sur "Calendrier" (`SuivreCalendrierPage`) : l'ancienne pill
`SelectFiltrePill` "Sélectionner un collaborateur" sous le titre est retirée, remplacée par un simple
chevron à côté du `h1` (même principe que `SelectFiltrePill` : un `<select>` natif rendu invisible et
superposé au chevron, pour garder l'accessibilité du `<select>` sans popover custom). Le titre reflète
la sélection : "Calendrier consolidé" par défaut, "Calendrier de {Prénom} {Initiale du Nom}." une fois
un collaborateur choisi (ex. "Calendrier de Delphine A."). Le sous-titre "Calendrier de {nom complet}"
qu'affichait `CalendrierCollaborateur` en interne a été supprimé (devenu redondant avec le nouveau
titre de page) — son prop `nomComplet`, plus utilisé nulle part dans le composant, a été retiré de son
interface et de l'appelant.

**"Révision des tableaux de l'app" — pattern établi sur Historique (`/historique`), à répliquer
ailleurs (29/08/2026, item Backlog priorité Haute)**

Première passe de la révision des tableaux, entièrement sur `HistoriquePage.tsx`/`HistoriqueTable.tsx`
(partagé avec "Suivre les demandes" via `avecCollaborateur`) — ~25 échanges verbaux successifs.
Objectif de cette note : que la prochaine table révisée (Suivre les demandes/soldes 2, Transmissions
paie, Utilisateurs...) reprenne les mêmes décisions plutôt que de repartir de zéro.

_Teinte "vert header" (`text-slate`/`border-slate`, `--color-slate: #245554`, même vert que
`HeaderBar`)_ — appliquée systématiquement à : titre de page (`h1`), bordure/texte/chevron des
`SelectFiltrePill`/`InputFiltrePill` (nouveaux props opt-in `classeBordure`/`classeChevron`/
`classeIcone` sur `FiltrePill.tsx`, décrits plus bas), bouton d'action principal ("Exporter" —
fond plein `bg-slate`, texte/icône blancs), texte des titres de colonnes du tableau, et les 2
séparateurs horizontaux de la section filtres (bordure au-dessus du tableau + bordure sous la ligne
d'en-tête, tous deux en `border-slate/30`). Fond de la barre de filtres ET de la ligne d'en-tête de
colonnes : `bg-mint-tint/50` (mint existant, testé à 100% puis redescendu à 50% — trop appuyé sinon).

_`FiltrePill.tsx` (composant partagé, extension opt-in, pas de breaking change)_ — `CLASSE_FILTRE_PILL_BASE`
ne porte plus la couleur (bordure/texte/anneau focus) ni le poids de police : ces deux aspects vivent
désormais dans `CLASSE_ACCENT_MINT` (défaut mint inchangé pour tous les appelants existants) et sont
overridables via de nouveaux props optionnels — `classeBordure`/`classeChevron` sur `SelectFiltrePill`,
`classeBordure`/`classeIcone` sur `InputFiltrePill`. Extraire la couleur de la constante de base était
nécessaire : deux classes Tailwind de même groupe (ex. `border-mint` dans la base + `border-slate`
apposée après via `className`) ont une spécificité CSS identique, le résultat final dépend alors de
l'ordre d'apparition dans la feuille de style générée (pas de l'ordre dans la chaîne `className`) — un
comportement non fiable, déjà rencontré et documenté ailleurs dans ce projet.

_Structure/largeur du tableau, alignée sur "Suivre les demandes"_ — `HistoriquePage.tsx` reprend
maintenant EXACTEMENT le même conteneur que `SuivreDemandesPage.tsx` : `grid grid-cols-1 items-start
gap-5 xl:grid-cols-[minmax(0,900px)_16rem] xl:gap-x-2.5`, tableau en 1ère colonne
(`bg-surface-card w-full min-w-0`), `DetailCongePanel` en 2ᵉ colonne (`xl:w-64`, sticky). Un premier
essai avait donné au conteneur du tableau une largeur figée en dur (`xl:w-[900px] xl:shrink-0`) pour
éviter le "saut" de largeur entre l'état sans sélection (alors `max-w-[900px]`) et avec sélection
(alors `xl:flex-1`, qui remplit l'espace libre à côté du panneau) — fonctionnel, mais Vincent a
préféré réutiliser telle quelle la grille déjà partagée par les autres écrans "Suivre" plutôt qu'un
correctif ad hoc propre à cette page. Cette même grille (`minmax(0,900px)_16rem`) est le motif
partagé documenté ailleurs dans ce fichier (voir l'entrée "Calendrier des employés" du 28/08 pour le
bug de stretch qu'il peut provoquer dans un AUTRE contexte, une grille de mini-calendriers — sans
rapport ici, un tableau `w-full` remplit de toute façon sa colonne).

_En-têtes de colonnes_ — police normale (majuscule uniquement en première lettre, la transformation
CSS `uppercase` d'origine a été retirée), fond `bg-mint-tint/50`, texte `text-slate`. Alignement
: plusieurs allers-retours (centré text+titre, puis centré titre seul, puis tout repassé à gauche) —
**décision finale : tout aligné à gauche**, y compris les colonnes resserrées (Durée/Statut/Paie).

_Colonnes resserrées "à leur contenu" (`w-px` + `whitespace-nowrap`, sur le `th` ET le `td`)_ — Durée,
Dates, Statut, Paie. Astuce déjà utilisée ailleurs dans le projet : dans un tableau `table-auto`
(layout par défaut), une colonne `w-px` associée à du contenu `whitespace-nowrap` se réduit à la
largeur minimale de son contenu le plus large, sans jamais laisser la colonne s'étirer pour combler
l'espace libre (contrairement à une colonne sans largeur explicite, qui absorbe l'espace restant).
Combiné à `inline-flex` (au lieu de `flex`, qui crée une boîte bloc pleine largeur) sur les petits
conteneurs internes (pastille Type, pill Dates) — un point technique à connaître : un `<span
className="flex ...">` à l'intérieur d'une cellule de tableau devient une boîte de type bloc qui
s'étire pour remplir toute la largeur de la cellule une fois que le tableau a fixé la largeur finale
des colonnes (même si elle est `w-fit`) ; `inline-flex` reste, lui, dimensionné à son contenu et
respecte `text-align`/`justify-content` du parent.

_Détails colonne par colonne_ :

- **Type** : libellé court (CP/RTT/CPA...) via nouveau prop `typeCourt` sur `HistoriqueTable`
  — délibérément DÉCOUPLÉ du prop `compact` existant (qui change aussi le format des dates et masque
  "Validé le", non voulu ici pour Historique).
- **Dates** : pill jamais coupée sur deux lignes (`whitespace-nowrap`), colonne resserrée à la pill
  la plus large réellement affichée.
- **Durée** : renommée simplement "Durée" partout (l'ancien "Nbre jours" en mode non-`compact` est
  retiré, un seul libellé par défaut désormais) ; valeur en semi-gras, couleur reprise du statut de
  la ligne (nouvelle map locale `TEXTE_STATUT`, même mapping tone que `StatusBadge`/`STATUT_CONFIG`
  mais exprimé en classe de texte).
- **Posé le / Validé le** : date compacte jj/mm/aa (année sur 2 chiffres, nouvelle fonction locale
  `formatDateActionCourte` — `formatDateAction` partagée, année 4 chiffres, reste inchangée partout
  ailleurs) ; espacement horizontal resserré entre les deux colonnes adjacentes (`pr-2 pl-4` puis
  `pr-4 pl-2`, au lieu de `px-4` symétrique des deux côtés).
- **Paie** : colonne resserrée ; `BadgeTransmission` retourne `null` (plus de tiret "—") quand la
  demande n'a aucune ligne de transmission, au lieu d'un texte de repli.

_Effets over/déclenché des lignes, alpha propres à ce tableau_ — après plusieurs itérations (50% →
70% → 80/60% → 20/40% → **10%/20% final**, la dernière étant explicitement en "% de transparence",
donc 90%/80% de transparence = 10%/20% d'opacité), les teintes standard `classeFondSurvolTypeBadge`/
`classeFondActifTypeBadge` de `TypeBadge.tsx` (15%/30%, utilisées partout ailleurs dans l'app) ont
été jugées insuffisamment visibles ici et remplacées par deux maps locales à `HistoriqueTable.tsx`
(`CODE_HOVER_10`/`CODE_ACTIF_20`, un jeu de classes Tailwind littérales par `TypeBadgeCode`, même
principe que les maps existantes de `TypeBadge.tsx` mais à une opacité différente) — **décision
consciente de ne pas modifier le design system partagé** pour ce réglage, propre à cet écran.

**Reste à faire pour appliquer ce pattern ailleurs** (voir Backlog "Révision des tableaux de l'app") :
Suivre les demandes/soldes 2 (déjà share `HistoriqueTable`, bénéficie donc déjà du gros des
changements — vérifier notamment couleur d'en-tête/filtres et alpha over/déclenché, pas automatiques
puisque portés par la page appelante, pas le composant table lui-même), Transmissions paie, et la
liste Utilisateurs (`UtilisateursListPage.tsx`).

**CPI (congés imposés) — mêmes règles de gestion que des CP normaux (29/08/2026, migration SQL
appliquée)**

Revirement complet sur le traitement des CPI, en deux temps. D'abord un audit d'impact ("les CPI ne
sont plus paramétrés dans le calendrier, on va les supprimer" — Vincent) a établi que CPI n'était en
réalité PAS chargé de calcul de solde comme initialement rapporté : `calculerNbDemiJournees`
(`demandes.repository.ts`) exclut bien les demi-journées couvertes par un CPI du décompte d'une
demande personnelle qui chevauche, mais c'est un filet anti-double-comptage (le jour est déjà "pris"
par l'imposition), pas une déduction propre au CPI — `soldes.repository.ts` ne référence d'ailleurs
jamais `conges_imposes`. Correction actée avec Vincent en cours d'échange.

Puis décision finale, plus ambitieuse : garder le réglage "nombre de CP imposés" dans Congés & RTT
(masquer seulement la section de configuration sur Calendrier quand il vaut 0), et surtout faire en
sorte que les CPI suivent **exactement les mêmes règles de gestion qu'un CP normal** — déduction du
solde Théorique dès la création, déduction du solde Réel une fois transmis en paie. Tous les CPI
existants en base (2026 + 2027) ont d'abord été supprimés via l'écran d'admin (pas de données
historiques à faire migrer).

Architecture retenue (détaillée dans BASE-DE-DONNEES.md, section "Points de modélisation notables") :
plutôt que de dupliquer le calcul de solde/export paie pour un second type d'enregistrement, la
création d'un CPI génère une vraie ligne `demandes_conges` (type CP, statut `validee`) **par
collaborateur actif**, liée à sa période d'origine via la nouvelle colonne
`demandes_conges.conge_impose_id`. Ces lignes traversent alors tout le pipeline solde/export paie
déjà existant sans aucun changement de code — confirmé par exploration que `fetchSoldes`,
`fetchDemandesAvecSoldeTransmission`/`genererExportPaie` ne filtrent ni sur l'origine ni sur
l'utilisateur. `conges_imposes` reste la source de vérité pour la PÉRIODE (ce que Delphine crée/
consulte/supprime sur Paramétrer > Calendrier) ; les demandes générées sont l'effet de bord qui
alimente les soldes. `calculerNbDemiJournees` est appelée AVANT l'insertion de la période elle-même
(sinon elle se déduirait de son propre chevauchement et renverrait 0).

Décision produit actée (AskUserQuestion) : un collaborateur ne peut pas annuler lui-même une demande
générée par un CPI — seul l'admin peut la retirer en supprimant la période sur Paramétrer >
Calendrier. Implémenté à deux niveaux : policy RLS ("demandes: salarié annule un congé validé non
transmis" exclut désormais `conge_impose_id is not null`) et un seul point d'application côté UI
(`DetailCongePanel.peutAnnulerCetteDemande`), qui couvre automatiquement tous les appelants
(Historique, Suivre les demandes, Suivre les soldes 2, Transmissions paie) sans les toucher un par
un — même principe que la simplification du rôle admin faite plus tôt dans cette session (portée
limitée à l'UI pour l'admin, RLS admin inchangée `for all`). `supprimerCongeImpose` annule
(`retirerDemande`, jamais un hard delete) chaque demande liée encore validée avant de supprimer la
période — la correction paie se génère automatiquement au prochain export si l'une était déjà
transmise, même mécanisme que l'annulation d'un CP normal déjà transmis.

Vérifié end-to-end en navigateur après migration : création d'un CPI de 5j (21→25 sept. 2026) →
4 lignes CP "validée" générées (une par collaborateur actif, 4,5j chacune après déduction des jours
déjà occupés), commentaire "Congé imposé du...", aucun bouton "Annuler cette demande" côté
collaborateur, message "Congé imposé : à retirer depuis Paramétrer > Calendrier" affiché ;
suppression de la période → les 4 lignes générées passent en `annulé`, la demande personnelle
préexistante de Delphine sur les mêmes dates reste intacte (aucune interférence).

Migration SQL appliquée manuellement par Vincent dans le SQL editor Supabase (colonne
`conge_impose_id` + policy RLS mise à jour) — voir `supabase/schema.sql`.

**Vert header (`slate`) généralisé à toute l'app + suite sur les tableaux (29/08/2026)**

Après le pattern établi sur Historique (voir l'entrée du même jour plus haut) puis étendu à
Transmissions paie, Vincent a demandé le même traitement partout ("tous les titres et tous les
boutons du dispositif" → confirmé "toute l'app" via question de clarification). Plutôt que de
patcher chaque écran, la teinte a été poussée à la source dans les deux composants partagés :
`components/ui/Button.tsx` (`variant="primary"`, mint → slate) et `components/ui/FiltrePill.tsx`
(`SelectFiltrePill`/`InputFiltrePill`, accent par défaut `CLASSE_ACCENT_DEFAUT` mint → slate) — ça
propage automatiquement le changement à tous les CTA/filtres qui utilisent ces briques (Suivre les
demandes/soldes, Utilisateurs, Congés & RTT, Transmissions paie...) sans toucher chaque fichier.
Restaient les titres de page (`h1`) et quelques liens/boutons mint ponctuels non couverts par ces
deux composants — traités un par un : `SuivreDemandesPage`, `SuivreSoldesPage2`, `UtilisateursListPage`,
`CongesRttPage`, `TransmissionsPaiePage` (titre dynamique + lien "Exporter (CSV)"),
`ListeTransmissionsPaiePage`, `BackHeader` (fiche utilisateur), `FaqCard` (Accueil, "même typo que
le h1" par design), "Poser un congé"/"voir le journal"/"Gérer mes demandes" sur Accueil, titre +
sélecteurs d'année sur Paramétrer > Calendrier.

`FiltrePill.tsx` a aussi gagné un prop `classeFond` (opt-in, défaut `bg-surface-card` inchangé) —
même raison que `classeBordure`/`classeChevron` déjà extraits le 29/08 (deux classes Tailwind du
même groupe CSS, `bg-*`, ont une spécificité identique : le résultat dépend de l'ordre dans la
feuille de style générée, pas de l'ordre dans `className`, un comportement déjà rencontré et
documenté — extraire en prop plutôt que concaténer est la façon fiable de l'overrider).

Suite sur "Suivre les demandes"/"Suivre les soldes" (ex-"Suivre les soldes 2", renommé — le "2"
n'avait plus de sens depuis la suppression de la V1 le 28/08, seul le libellé de nav change,
l'URL `/suivre/soldes2` reste inchangée) :

- Barre de filtres de "Suivre les demandes" passée en fond `bg-mint-tint/50` (même traitement que
  Historique), fond des sélecteurs eux-mêmes laissé par défaut (`bg-surface-card`) — la première
  tentative appliquait le mint-tint aux pills individuelles, corrigée sur retour explicite de
  Vincent ("la ligne derrière en mint-tint/50, pas les sélecteurs").
- Bouton "Exporter (CSV)" de "Suivre les soldes" recalé sur la taille du bouton "Exporter" de
  "Suivre les demandes" (`text-xs`/`px-3 py-1.5`/icône 13px, remplace le `<Button>` partagé —
  trop imposant ici, `text-sm`/icône 16px — par un `<button>` custom aux mêmes classes).
- Filtre "Tous les collaborateurs" + bouton Exporter de "Suivre les soldes" regroupés dans une
  card `bg-mint-tint/50 rounded-xl`, à la largeur exacte des cards de solde juste en dessous —
  obtenu en plaçant filtre+cards dans un même conteneur `w-fit` (les cards, elles-mêmes `w-fit`,
  fixent la largeur du conteneur ; la barre de filtre en `w-full` s'y cale) plutôt qu'une largeur
  figée en dur, qui se serait désynchronisée si le contenu des cards changeait.

**Suivre les soldes : états déclenchés, restructuration du panneau détail, "Ajuster le solde"
alignée sur "Annuler cette demande" (29/08/2026 → 02/09/2026)**

État "déclenché" par pill (`SuivreSoldesPage2.tsx`, `CardSoldeCollaborateur`) : chaque pill
Théorique/Réel a désormais son propre état actif plutôt qu'un état partagé par ligne — première
tentative en anneau (`ring-2`) rejetée ("pas le bon effet déclenché"), corrigée en inversion de
`TypeBadge` (`variant="outline"`, fond blanc + contour/texte couleur du type, au lieu du `"pill"`
plein habituel) sur la pill réellement ouverte ; survol des deux pills passé de `hover:opacity-70`
à `hover:scale-105`.

Panneau détail (`SoldeDetailPanel.tsx`, branche `avecAjustement`) restructuré sur demande explicite :
le rappel "Solde actuel" (déjà affiché en bas de la liste d'événements dans les autres contextes)
l'est désormais aussi ici, sans sélecteur Théorique/Réel (label statique — l'utilisateur ne doit pas
pouvoir changer de solde depuis cette vue) et avec la pill à la taille du tableau (`TypeBadge
variant="pill"`, pas `TypeBadgePillEnhanced`). "Ajuster le solde" sort de la card tableau pour
devenir sa propre card en dessous, avec le même principe d'affichage que "Annuler cette demande"
(`DetailCongePanel`) : lien + chevron replié par défaut (pas de fond tant que fermé), panneau
déplié teinté à 5% de la couleur du type (`color-mix(in srgb, var(--color-X) 5%, white)`), styles de
champs/sous-titres/bouton repris à l'identique (labels `text-ink-500 text-[11px] font-bold`,
`gap-4` entre les blocs — plus d'interlignage avant un sous-titre qu'après, demande explicite de
design d'information). Champ "Nombre de jours" étroit (`w-20`, contraint par regex à 2 chiffres
avant la virgule + 2 après, plus de flèches de spin natives), unité "jours" en noir à côté plutôt
qu'en placeholder dans le champ (le placeholder `000,00` n'était qu'un repère de taille, pas censé
s'afficher — retiré sur clarification).

Validation forte ajoutée sur "Ajuster le solde" ("il faut une confirmation forte : popin de
confirmation", après une première proposition de bandeau annulable refusée) : même pattern
`Modal`/question + résumé + Annuler/Confirmer que `DetailCongePanel.demanderConfirmation`, la
mutation réelle (`ajouterAjustementSolde`) ne partant qu'au clic sur le "Confirmer" de la popin.

Cards événements : libellé des acquisitions mensuelles ("Acquisition septembre 2026") passé à
l'année sur 2 chiffres ("Acquisition septembre 26") pour éviter le retour à la ligne dans la
colonne Événement — traité localement dans `libelleEvenement` (SoldeDetailPanel), pas dans le
formateur partagé `formatMoisAnnee` de `soldes.repository.ts` (utilisé ailleurs avec l'année
complète).

Nav "Suivre" (`components/layout/tabs.ts`) : "Calendrier" repassé en premier onglet de la
sous-navigation (avant "Suivre les demandes").

**Vraie charte Abeil : logo + couleurs, premier déploiement sur le menu général (02/09/2026)**

Premier pas concret vers la vraie charte graphique Abeil (`Charte-abeil/`, non commitée — voir
Conventions), jusqu'ici jamais déployée dans le code (logo placeholder, palette de travail
provisoire, voir `projet.md`). Le dossier local contenait en fait DEUX choses distinctes,
découvertes en cours de session : `public/abeil-logo.jpeg` (l'ancien logo, jamais utilisé nulle
part dans le code, un fichier orphelin resté en place) et le vrai pack `Charte-abeil/2026_New_Logo/`
(avril 2026, "Version 1" — logos SVG en plusieurs déclinaisons + `ABEIL - Charte graphique_V2.pdf`
avec les vraies teintes) — Vincent a confirmé sur capture que c'est bien ce second pack qui fait foi.

Couleurs officielles ajoutées comme nouveaux tokens `@theme` dans `app/globals.css` —
`--color-abeil-navy: #001e32` (Bleu nuit) et `--color-abeil-yellow: #ebc850` (Jaune abeille),
valeurs exactes de la table "Couleurs et correspondances" du PDF — **sans toucher `--color-slate`**
(décision explicite via question de clarification : déploiement scopé au menu général pour
l'instant, pas un remplacement app-wide du slate provisoire).

`public/logo-abeil.svg` : wordmark dérivé du pack officiel (`ABEIL_LOGO_blanc_fond_bleu.svg`,
lettres blanches + point jaune, prévu pour un fond navy), avec deux corrections apportées au
fichier source du pack :
- le `<rect>` de fond navy plein intégré au fichier source retiré (le pack fournit chaque variante
  avec son propre fond en dur, pas transparent — inutilisable tel quel sur un header qui n'est pas
  exactement cette même teinte) ;
- `viewBox` recadré sur la vraie boîte englobante des lettres (calculée via `getBBox()` en
  navigateur, `x=130.97 y=121.98 588.45×266.29` + petite marge) au lieu du viewBox d'origine
  (0 0 850.39 510.24) qui incluait une zone de protection très large — sans ce recadrage le logo
  paraissait "aplati/étiré" à l'affichage (l'essentiel de sa boîte était de la marge invisible) ;
  `width`/`height` explicites ajoutés en plus du `viewBox` (absents du fichier source), sans quoi
  le navigateur ne calcule qu'une taille intrinsèque par défaut (250×150) au lieu de la vraie
  résolution vectorielle.

`components/layout/HeaderBar.tsx` — fond passé de `bg-slate` à `bg-abeil-navy` (le seul endroit de
l'app sur ce nouveau token pour l'instant), logo à la place du texte "Apidays" (`ml-[10px]`
`h-[25.6px]`, ajusté à la baisse après un premier essai jugé trop gros), nav de niveau 1
(Poser/Suivre/Paramétrer) : état actif en jaune (texte + soulignement `border-b-2`), état inactif
repassé en blanc plein (`text-white`, au lieu du `text-white/60` d'origine — demande explicite "état
off en blanc"), nav étirée en pleine hauteur du header (`h-full`/`items-stretch` sur le conteneur,
`flex items-center` par lien) pour que le soulignement actif touche exactement le bas du bandeau,
label recalé avec `pt-[10px]` (ajusté par itérations successives), hover `bg-white/10`
(inactif)/`bg-abeil-yellow/10` (actif) ajouté sur les 3 items.

`components/layout/SideNav.tsx`/`BottomNav.tsx` (nav secondaire) : par défaut, intitulé ET icône en
bleu nuit (`text-abeil-navy`, remplace `text-ink-900/60`/`text-ink-500`/l'ancien `text-brand` bleu
de `BottomNav`) ; état actif en jaune plein (texte + icône) sur fond jaune à 8% d'alpha
(`bg-abeil-yellow/8`), hover `bg-abeil-navy/5` (inactif)/`bg-abeil-yellow/15` (actif). Un essai de
fond plein bleu nuit pour l'état actif (repris du même principe que les sélecteurs d'onglet de
l'Accueil, voir plus bas) a été testé puis explicitement annulé par Vincent ("non, on revient en
arrière") — l'état actif de la nav secondaire reste donc sur fond alpha jaune, pas fond navy plein.

Tests de couleur sur écrans (comparaison avant validation, pas encore de décision finale sur la
généralisation) :

- **Accueil** (`DashboardPage.tsx`, `FaqCard.tsx`, `ProchainsJoursOffCard.tsx`) et **Historique**
  (`HistoriquePage.tsx`) : tous les usages de `slate` remplacés par `abeil-navy` (titres, sous-titres,
  indicateurs de solde, filtres, bouton Exporter, séparateurs) — test scopé à ces fichiers précis,
  **pas** au composant partagé `HistoriqueTable.tsx` (dont l'en-tête de colonnes reste en slate,
  ce composant étant aussi utilisé par Suivre les demandes et Transmissions paie — le changer aurait
  dépassé le scope du test demandé).
- **Suivre les demandes** (`SuivreDemandesPage.tsx`) : titre en bleu nuit conservé ; un essai
  "bouton Exporter en jaune avec texte navy" a été testé puis explicitement annulé ("reviens en
  arrière pour le bouton") — le bouton reste `bg-slate`.
- Sélecteurs d'onglet "Mon Calendrier" de l'Accueil (année en cours/période CP/année suivante) et
  CTA "Poser un congé" : plusieurs allers-retours de test — bleu nuit avec texte jaune d'abord, puis
  **repassés au mint d'origine** ("call to action verts... pour voir"), puis **repassés au slate**
  ("vert foncé comme calendrier de suivre", pour matcher `CalendrierCollaborateur.tsx`/
  `CalendrierGlobal.tsx` sur `/suivre/calendrier`, qui utilisent ce même pattern
  `bg-slate/90 hover:bg-slate text-white` / `border-slate text-slate hover:bg-slate/10`) — état final
  de cette session : **slate**, pas encore de décision définitive.

Reste ouvert (pas tranché cette session) : sort de `public/abeil-logo.jpeg` (ancien logo, toujours
présent mais inutilisé — signalé à Vincent, pas supprimé), et généralisation ou non de
`--color-abeil-navy`/`--color-abeil-yellow` au-delà du menu général et des écrans testés.

**Suite (même session) : tous les H1 en bleu nuit, Historique repassé cohérent, lien "Suivre" corrigé**

Historique (`HistoriquePage.tsx`) réaligné sur le même principe que Suivre les demandes/Accueil :
titre `<h1>` seul en bleu nuit, tout le reste (filtres, bouton Exporter, séparateur) repassé en
slate — le test "tout en navy" du tour précédent n'a donc été conservé nulle part pour les éléments
cliquables, uniquement pour les titres.

**Tous les `<h1>` de l'app passés en `text-abeil-navy`** (décision cette fois généralisée, pas un
test scopé) : `BackHeader.tsx` (fiche utilisateur), `ListeTransmissionsPaiePage.tsx`,
`SuivreSoldesPage2.tsx`, `TransmissionsPaiePage.tsx`, `SuivreCalendrierPage.tsx`,
`DesignSystemPage.tsx`, `UtilisateursListPage.tsx`, `CongesRttPage.tsx`, `CalendrierPage.tsx` — en
plus des 4 déjà faits au tour précédent (Accueil, Historique, Suivre les demandes, header général).
Seule exception assumée : les `<h1>` `print:block`/`hidden` (variantes dédiées à l'impression sur
Historique et Suivre les demandes) restent en `text-ink-900`, hors du champ de cette décision — ce
sont des styles d'impression, pas d'affichage écran.

Bug corrigé au passage : `niveau1.ts`, le lien "Suivre" du header pointait encore en dur sur
`/suivre/demandes`, jamais mis à jour après le changement d'ordre de `tabs.ts` (Calendrier repassé
premier onglet, même session) — un clic sur "Suivre" n'atterrissait donc pas sur le premier
sous-onglet réel. Corrigé vers `/suivre/calendrier`.

**Fiche utilisateur : coins carrés + style de champs sur l'écran réel, refonte plus large sur un
brouillon dédié (02/09/2026)**

Deux volets bien distincts, suite au backlog "Checker l'UI de la fiche utilisateur".

Sur `UtilisateurFichePage.tsx` (écran réel, inchangé au-delà de ça) : coins carrés sur les cards
(`rounded-card` retiré des `<div className="bg-surface-card ...">`, gardé sur les `<Button>` —
distinction volontaire card/bouton) et style de champs repris de "Annuler cette demande"/"Ajuster
le solde" (`DetailCongePanel`/`SoldeDetailPanel`, plus tôt dans la session) — `FieldLabel` gagne un
prop `variant` (`"champ"` par défaut inchangé, `"carte"` = `text-ink-500 mb-1.5 block text-[11px]
font-bold`, additif donc sans risque pour les autres appelants du composant partagé), inputs/select
resserrés (`rounded-md text-xs`, className passé aux composants partagés `Input`/`Select` — override
confirmé fiable dans ce projet, déjà vu sur "Ajuster le solde").

Pour la suite, plus profonde ("à revoir à froid... pas juste le champ de saisie mais l'écran dans
son ensemble"), duplication en brouillon plutôt qu'itération en direct — même pattern que
`calendrier2` en son temps : `components/parametrer/UtilisateurFichePage2.tsx` + routes
`/parametrer/utilisateurs2/[id]` et `/nouveau` (pas de liste dédiée, `BackHeader` renvoie vers la
vraie liste `/parametrer/utilisateurs`). Partage la couche données (`useUtilisateurAdmin`), seule
l'UI diverge. Sur ce brouillon, mode édition uniquement (le mode création n'a volontairement pas
encore reçu le même traitement — voir Backlog) :

- **Card "Identité"** (Nom/Prénom/email fusionnés) : lecture seule + un seul stylo "Modifier" (popin
  unique `ModalModifierIdentite`, sans date d'effet ni historisation — contrairement à
  `ModalModifierChamp`, une correction remplace juste la valeur précédente). Nom en 24px, Prénom en
  20px sur sa propre ligne (`<br/>` dans le même `<span>`, ordre Nom puis Prénom partout sur cette
  card — demande explicite), email en 16px semi-bold gris. Encart "Entrée" (fond mint, 14px label +
  16px date) en haut-droite de la card ; lien "Modifier" (intitulé avant le picto, gris `ink-500`)
  déplacé au-dessus de la card avec un espacement de 1px, dans son propre conteneur `gap-[1px]`
  distinct du `gap-5` global du formulaire. Date d'entrée intégrée à cette même popin (retirée de la
  card contrat en édition) — cohérent avec le principe déjà appliqué ailleurs.
- **Nature du contrat / Durée de travail** : deux cards à 50% chacune (`grid grid-cols-2 gap-5`),
  remplacent l'ancien duo "lecture seule + tableau récap séparé plus bas dans la page" — valeur
  actuelle ET historique complet fusionnés dans la MÊME card
  (`construireLignesHistorique`, remplace `construirePeriodes`/`TableauPeriodes` supprimés),
  formatés "{valeur} depuis le {date}" (période en cours) / "{valeur} entre le {début} et le {fin}"
  (précédentes), la plus récente en tête. "+ Ajouter un événement" (icône `Plus`) ouvre la même
  popin qu'avant (`ModalModifierChamp`, inchangée). Titres de card repris du style "Annuler cette
  demande" (`text-sm font-bold`, mais en bleu nuit plutôt que la couleur du type). C'est le cœur du
  sujet d'origine du backlog : le caractère historique de ces deux champs est maintenant visible
  d'emblée, sans avoir à scroller jusqu'au tableau récap qui n'existe plus séparément.
- **Card "Rôle"** : déplacée en colonne de droite, au-dessus de "Suivi des modifications" — pour
  cela, `Formulaire` gère désormais lui-même la mise en page deux-colonnes (auparavant portée par le
  composant parent `UtilisateurFichePage2`), avec un nouveau prop `suiviEntrees` (calculé par le
  parent, transmis pour que `Formulaire` puisse rendre `SuiviModifications` dans SA colonne de
  droite aux côtés de la card Rôle). En création (pas de colonne de droite, pas de suivi), Rôle
  reste dans le flux principal — seul cas encore géré en `<Select>` de saisie libre à cet endroit.
- **Bandeau de statut** ("Salarié·e de l'effectif", mint/vert foncé slate, ou "Salarié·e archivée",
  tokens `status-warning` orange) — remplace l'ancien bandeau qui ne couvrait que le cas archivé
  (rien en actif). Positionné entre la card identité et les deux cards Nature/Durée, largeur de la
  colonne principale (après un premier essai en pleine largeur du corps de page, ajusté sur retour
  explicite).
- **"Soldes actuels" sorti du flux principal en édition** (demande explicite : "élément éphémère...
  n'a pas grand-chose à faire ici", confirmé — "une fois que tu as créé la fiche, tu gères les
  soldes ailleurs : suivre les soldes, suivre les demandes, export paie") — plus de "Modifier" ici,
  les corrections de solde vivent désormais uniquement sur Suivre les soldes ("Ajuster le solde",
  avec sa propre popin de confirmation forte, travaillée plus tôt dans la session). Affiché à la
  place en lecture seule dans "Suivi des modifications", associé à l'entrée de création, avec les
  pastilles `TypeBadge` (mêmes codes couleur CP/RTT/CPA que partout ailleurs) plutôt qu'une ligne de
  texte. `ModalModifierSoldeInitial` et tout son code mort (state, handler, prop non utilisée sur
  toute la chaîne `Formulaire`/`UtilisateurFichePage2`/hook) supprimés — reste utilisé tel quel en
  création (saisie initiale, hors de ce mécanisme de modale).
- **"Date de référence ancienneté" retirée de l'UI pour l'instant** ("pas un besoin Abeil
  actuellement... je ne me vois pas m'encombrer avec cela") — le champ reste fonctionnel côté
  données (`ancienneteDateReference`, calcul du bonus d'ancienneté dans `soldes.repository.ts`,
  retombe sur la date d'entrée par défaut si non renseigné), seule la saisie UI a disparu.

Reste ouvert (voir Backlog, priorité baissée de Haute à Moyenne — chantier bien avancé) : le
formulaire de création n'a pas reçu le même traitement (toujours l'ancien enchaînement de champs
libres), et la bascule finale de `/parametrer/utilisateurs` vers ce brouillon (ou abandon) n'est pas
tranchée.

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

**"Vérifier les fiches de paie" — comparaison de soldes CP/RTT par employé (25/08/2026)** :
Vincent, à partir d'une capture de fiche de paie réelle (colonnes Droit/Pris/Solde par catégorie) —
"L'objectif est de pouvoir vérifier que les données sur les fiches de paie du mois sont iso. Je
pense qu'il faut reprendre tous les soldes par employé : Soldes mois précédent / Soldes du mois en
cours / mouvement du mois / le 0 mouvement est important". Passé par un plan validé avant
implémentation (voir échange complet) — décision actée : un seul CP combiné (pas de split "CP n /
CP n-1+n-2" comme sur la fiche de paie, cf. `questions.md`), calcul rétrospectif exact plutôt qu'une
approximation limitée à la période en cours.

- **Moteur de solde généralisé** (`lib/data/soldes.repository.ts`) — `fetchSoldes`,
  `fetchHistoriqueCp`, `fetchHistoriqueRtt` gagnent un paramètre optionnel `dateReference?: Date`
  (défaut `new Date()`, comportement inchangé pour tous les appelants existants). Le moteur ancrait
  déjà tout son calcul interne (accrual, ancienneté, report) sur une `reference` threadée en
  paramètre — seul le point d'entrée figeait `aujourdhui = new Date()` en dur ; remplacé par
  `aujourdhui = dateReference ?? new Date()`, un changement additif et à faible risque.
- **`fetchComparaisonSoldes(periode)`** (`lib/data/exportsPaie.repository.ts`) — pour chaque
  utilisateur **actif** (pas seulement ceux avec des lignes transmises sur l'export — "le 0
  mouvement est important", donc tous les actifs apparaissent, y compris à 0), calcule le solde
  CP/RTT "tel qu'il était" fin du mois précédent et fin du mois en cours (`dateReference` = veille
  du `periode.debut` / `periode.fin`), et le mouvement (différence). CPA exclu (absent de la fiche
  de paie).
- **`VerifierFichesPaiePage.tsx`** — nouvelle section "Soldes" (tableau collaborateur × CP/RTT ×
  Mois précédent/Mois en cours/Mouvement, `formatMouvement` avec signe explicite "+"/"-"/"0"),
  affichée **indépendamment de l'existence d'un export** (contrairement au détail ligne par ligne
  existant, qui reste scopé à l'export généré) — le solde calculé par l'app existe et vaut la peine
  d'être vérifié même avant transmission. Les deux contrôles coexistent : macro (solde global) au-
  dessus, micro (congé par congé, "Ça matche"/"Écart") en dessous, inchangé.
- Vérifié en navigateur : juillet 2026 (période transmise) affiche les deux sections ensemble ; août
  2026 (pas encore transmis) affiche "Soldes" quand même, avec le message "Aucun export généré"
  seulement sous la partie détail. Mouvements à 0 explicitement affichés ("0 j", jamais masqués/vides).
  `tsc`/`eslint`/`npm run build` clean.

**Correction — "Vérifier les fiches de paie" ne comptait aucun mouvement (25/08/2026)** :
Vincent — "on ne prend pas en compte les congés exportés ? Olivier devrait avoir -0,5j dans ses CP
et salarié test 2 jours en plus suite a la régul / il faut aussi afficher les CPA". Bug réel, pas un
malentendu : tous les mouvements CP/RTT affichaient "0 j" quelle que soit la période.

- **Cause racine** : `sommeJours` (`soldes.repository.ts`, cœur du calcul de consommation, appelé
  partout dans le fichier) filtrait sur le statut **actuel** de la demande en base
  (`.eq("statut", statuts)`), pas sur son statut **tel qu'il était à la date demandée**. Résultat :
  interroger "solde au 31/07" et "solde au 31/08" utilisait le MÊME statut courant dans les deux cas
  — une demande régularisée (annulée) aujourd'hui disparaissait du calcul même pour une date
  antérieure à cette régularisation, faisant mécaniquement ressortir un mouvement à 0 partout.
- **Correctif** : `sommeJours` récupère désormais toutes les demandes de la période (sans filtrer
  par statut), puis détermine pour chacune son statut "à la date de référence" via le journal
  `decisions_demande` (la dernière décision avec `decide_le <= dateReference`), avec repli sur le
  statut actuel + `date_decision` pour les demandes décidées avant l'introduction du journal (même
  convention que le feed de `DetailCongePanel`). Les 11 appels de `sommeJours` dans le fichier
  (`fetchSoldes`, `fetchSoldeAnticipe`, `fetchHistoriqueCp`) mis à jour pour lui passer la date de
  référence déjà en contexte (`aujourdhui`/`reference`) — aucun changement de comportement pour un
  appel "maintenant" (aucune décision ne peut avoir eu lieu dans le futur).
- **CPA ajouté** au comparatif "Vérifier les fiches de paie" (`fetchComparaisonSoldes`,
  `VerifierFichesPaiePage.tsx`) — initialement exclu (absent de la fiche de paie photographiée),
  Vincent le veut quand même affiché à côté de CP/RTT.
- Vérifié en navigateur : les mouvements ne sont plus figés à 0 (ex. Salarie Test CP -18 j en août,
  Olivier Test -16,5 j) — les gros chiffres du jour reflètent l'activité de test intense de cette
  session (beaucoup de décisions prises aujourd'hui même, 25/08, donc "hors" du solde au 31/07 mais
  "dans" celui au 31/08/≈maintenant), pas une anomalie. `tsc`/`eslint`/`npm run build` clean.

**Correction — "mouvement" ancré sur l'export réel, pas un diff de solde global (25/08/2026)** :
Vincent a repris l'objectif en détail — "Delphine envoie les mouvements de congés qui ont eu lieu
pendant le mois au comptable (export CSV) ; le comptable crée les fiches de paie en conséquence, qui
contiennent les soldes ; Delphine doit vérifier que les soldes sont ok, que les jours consommés sont
bien implémentés et que les jours acquis sont bien pris en compte [...] chaque mois contrôler qu'il
n'y a pas un écart qui se crée entre le solde de l'outil et les soldes comptable." Signalé avec un
exemple concret (0,5j CP d'Olivier transmis en juillet, absent de la vérif) — après clarification
(question posée), le "mouvement" ne doit plus être un différentiel générique de solde (qui peut
capter des mouvements sans rapport, ex. une demande d'un autre mois validée le même jour), mais
**exactement ce qui a été transmis dans CET export**.

- **`fetchMouvementsExport(exportId)`** (`exportsPaie.repository.ts`) — somme signée des
  `export_paie_lignes` de l'export, par collaborateur et par type (CP/RTT/CPA) — `jours_inclus`
  positif (transmission normale) réduit le solde donc `-jours_inclus` ; négatif (correction/retro)
  le restitue.
- **`fetchComparaisonSoldes(periode, exportId)`** — `mouvement` vient désormais de
  `fetchMouvementsExport` (0 si `exportId` est `null`, aucune période sans export généré n'a de
  mouvement à vérifier) ; `moisPrecedent`/`moisEnCours` restent calculés indépendamment via le
  moteur de solde général (`fetchSoldes`, capture bien l'acquisition du mois). Les 3 valeurs restent
  volontairement indépendantes plutôt que l'une dérivée des autres : **la cohérence entre elles EST
  le contrôle** — `solde précédent − mouvement ≈ solde en cours` doit se vérifier à l'œil, un écart
  est justement ce qu'il faut détecter.
- Vérifié en navigateur (juillet 2026, export réel généré via SQL) : Salarie Test — solde précédent
  49 j, mouvement -2 j (exactement les "2 j transmis" du contrôle ligne par ligne juste en dessous),
  solde en cours 47 j → 49 − 2 = 47, cohérent. Olivier Test affiche 0 mouvement en juillet, à raison :
  son congé du 30/07 n'a été validé que le 25/08, donc absent de l'export de juillet — pas un bug,
  confirme que le mouvement colle bien au contenu réel de l'export. `tsc`/`eslint`/`npm run build`
  clean.

**Correction — "Générer l'export" figé une fois transmis, plus jamais le backlog live (25/08/2026)** :
Vincent — "la demi journée d'Olivier est quand même affichée dans l'export de juillet... ya un
soucis" (repris ensuite : "donc la 0,5j d'Olivier devrait même pas apparaître dans l'export de
juillet" — confirmé). Root cause : `CongesPaiePage` (source de "Générer l'export") interrogeait
toujours le backlog LIVE (`fetchCongesATransmettre`, "ce qui reste à transmettre maintenant"), même
pour une période DÉJÀ transmise — le congé d'Olivier (30/07, validé seulement le 25/08, donc après
la génération réelle de l'export de juillet) y réapparaissait comme repêchage alors qu'il n'a jamais
fait partie de cet export.

- **`figeParExport`** (`sourceTransmission && Boolean(exportId)`) — nouveau mode dans
  `CongesPaiePage.tsx` : une fois l'export généré, les 3 tableaux + le CSV se sourcent sur
  `fetchCheckFichesPaie(exportId)` (le contenu réel et immuable d'`export_paie_lignes`), plus sur le
  live. Catégorisation période courante/repêchage/corrections refaite sur le signe de
  `jours_inclus` (négatif = correction) plutôt que sur le statut ACTUEL de la demande (qui peut
  changer après coup sans toucher l'export d'origine).
- **Bug corrélé trouvé pendant la vérif** : même une fois la bonne demande placée dans le bon
  tableau, `grouperParCollaborateur` remettait son total à 0 — le garde interne excluait toujours les
  demandes au statut LIVE "annulé", y compris en mode figé (Salarie Test, transmis "en positif" en
  juillet puis régularisé depuis : son "2 j" retombait à 0 dans le tableau alors que l'export réel
  les contenait bien). `inclureAnnuleDansTotal` forcé à `true` en mode figé (les 3 tableaux) pour ne
  plus laisser le statut courant invalider un montant déjà réellement transmis.
- `previsionTransmission` (DetailCongePanel) masquée en mode figé — plus de "si on transmettait
  maintenant" à prévisualiser, c'est déjà transmis. `lignesTransmissionParId`/`selection` re-sourcés
  sur les demandes réellement affichées (figées ou live selon le mode) plutôt que sur le backlog live
  inconditionnellement.
- Vérifié en navigateur : juillet (déjà transmis) — Olivier absent partout, Salarie Test affiche
  "2 j" (plus 0), CSV export contient exactement une ligne "Salarie Test → 2 j (16/07 au 17/07/26)".
  Août (pas encore transmis, "Brouillon - non transmis") — comportement live inchangé, Olivier
  toujours visible en repêchage (correct, il sera capté au prochain "Transmettre"). `tsc`/`eslint`/
  `npm run build` clean.

**Chantier "Vérifier les fiches de paie" — mis en pause le 25/08/2026, reprise à prévoir** :
synthèse de toute la session du jour sur ce sujet, avant pause explicitement demandée par Vincent
("on a pas fini cette section on affinera plus tard"). Regroupe plusieurs entrées éclatées
ci-dessus en un seul point de repère.

**Objectif métier** (formulé par Vincent en cours de route, à retenir pour la suite) : chaque mois,
Delphine transmet au comptable les mouvements de congés du mois (CSV, "Générer l'export") ; le
comptable établit les fiches de paie en conséquence, qui affichent des soldes (Droit/Pris/Solde par
catégorie — CP n / CP n-1+n-2 / RTT, format observé sur une vraie fiche de paie). Delphine doit
pouvoir, chaque mois, vérifier en un coup d'œil que le solde de l'outil colle à celui du comptable —
et détecter tôt un écart qui se serait créé entre les deux.

**Ce qui a été construit aujourd'hui** :

1. Section "Soldes" dans `VerifierFichesPaiePage.tsx` — par collaborateur actif, CP/RTT/CPA : solde
   fin de mois précédent, solde fin de mois en cours, mouvement du mois (jamais masqué à 0).
2. Moteur de solde généralisé pour accepter une date de référence passée (`fetchSoldes`,
   `fetchHistoriqueCp`, `fetchHistoriqueRtt` — paramètre `dateReference` optionnel, défaut inchangé).
3. `fetchComparaisonSoldes(periode, exportId)` — solde précédent/en cours calculés indépendamment via
   le moteur général ; mouvement ancré sur le contenu réel de l'export (`fetchMouvementsExport`,
   `export_paie_lignes`), pas un différentiel générique — décision actée après clarification, pour
   que le mouvement affiché soit strictement ce que le comptable a reçu ce mois-ci.
4. `CongesPaiePage` (source de "Générer l'export") gagne un mode figé (`figeParExport`) : une fois
   l'export généré, les 3 tableaux + le CSV reflètent exactement `export_paie_lignes`, plus jamais le
   backlog live (`fetchCongesATransmettre`), qui peut diverger après coup.

**2 bugs réels trouvés et corrigés en cours de route** (pas des malentendus — vérifiés par Vincent
sur des cas concrets) :

- `sommeJours` (cœur du calcul de consommation CP/RTT, `soldes.repository.ts`) filtrait sur le
  statut ACTUEL de la demande plutôt que sur son statut à la date demandée — tout mouvement
  ressortait à 0 quelle que soit la période. Corrigé via replay du journal `decisions_demande`.
- `grouperParCollaborateur` (`CongesPaiePage.tsx`) — même famille de bug, sur le nombre de jours
  cette fois : son garde interne excluait les demandes au statut LIVE "annulé" même en mode figé, ce
  qui remettait à 0 le total d'une demande pourtant réellement transmise (positive) puis régularisée
  depuis. `inclureAnnuleDansTotal` forcé à `true` en mode figé.

**Ce qui N'A PAS été fait/vérifié — à reprendre** :

- **CP n / CP n-1+n-2** : toujours un seul total CP combiné, pas de split par ancienneté du solde
  comme sur la vraie fiche de paie (décision actée de ne pas s'y attaquer maintenant, voir
  `questions.md` — le report CP est à un seul niveau dans le moteur actuel, un vrai split demanderait
  de revoir ce moteur).
- **`fetchHistoriqueCp`/`fetchHistoriqueRtt`** ont bien le paramètre `dateReference`, mais leurs
  propres requêtes internes de construction du ledger mensuel (les lignes `.eq("statut", ...)` autour
  de 867/1059/1243 dans `soldes.repository.ts`) n'ont PAS reçu le même correctif que `sommeJours` —
  latent, sans impact aujourd'hui puisque `fetchComparaisonSoldes` passe par `fetchSoldes` et non ces
  deux fonctions, mais à corriger si un futur usage leur passe une `dateReference` passée.
- **"Quels congés transmettre" n'a pas de mode figé** — contrairement à "Générer l'export", cet
  onglet continue d'afficher le backlog live même pour une période déjà transmise. Comportement
  peut-être voulu (l'onglet sert justement à repérer ce qui reste à transmettre, période close ou
  pas), mais pas explicitement tranché avec Vincent — à confirmer.
- **Correction jamais vue en conditions réelles dans le tableau figé** : la régularisation de
  Salarie Test (16/07-17/07) n'a jamais été elle-même transmise dans un export réel (août n'a pas
  encore été transmis au moment de la pause) — la logique de catégorisation "corrections" en mode
  figé (`jours_inclus < 0`) est vérifiée par lecture de code, pas par un cas réel observé à l'écran.
- **Aucun audit de bout en bout** des soldes pour tous les collaborateurs/tous les mois — seuls
  juillet et août ont été spot-vérifiés sur les points signalés par Vincent, pas une passe
  exhaustive.
- Format Droit/Pris/Solde de la vraie fiche de paie simplifié à Solde précédent/Mouvement/Solde en
  cours (3 valeurs, pas de Droit/Pris détaillés séparément) — à revalider une fois Vincent en usage
  réel, si le niveau de détail s'avère insuffisant pour vraiment "checker que les jours sont bien
  pris en compte dans la FDP".

Voir aussi `Backlog.md` (item ajouté) et `questions.md` (les points ci-dessus qui nécessitent une
décision de Vincent avant de reprendre).

**Mise en cohérence design system — "Vérifier les fiches de paie" (25/08/2026)** : demande explicite
de reprendre le tableau et la représentation des types de congé selon les conventions déjà établies
ailleurs dans l'app (`components/demandes/TypeBadge.tsx`), avant de continuer sur le fond.

- **Section Soldes** : la colonne "Type" affichait "CP"/"RTT"/"CPA" en texte brut — remplacée par une
  pastille `TypeBadge` (`variant="pill"`, même code couleur que "Suivre les soldes"). Les valeurs
  "Mois en cours"/"Mouvement" reprennent la couleur du type (`classeTexteTypeBadge`) plutôt qu'un gris
  générique, et chaque ligne se teinte légèrement au survol (`classeFondSurvolTypeBadge`, même
  mécanique que `HistoriqueTable`). Rendu refactoré en boucle sur `TYPES_SOLDE` (`["CP","RTT","CPA"]`)
  plutôt que 3 blocs JSX dupliqués.
- **Détail par congé** (liste dépliable sous chaque collaborateur) : le type de congé était en texte
  brut ("CP" en gras) — remplacé par la même pastille `TypeBadge`, avec dérivation CPA
  (`type === "CP" && isAnticipation`) comme partout ailleurs dans l'app.
- Vérifié en navigateur : pastilles colorées (CP bleu, RTT vert, CPA gris) visibles dans les deux
  sections, valeurs "Mois en cours"/"Mouvement" teintées par type. `tsc`/`eslint`/`npm run build`
  clean.

**Incohérence de fond trouvée et documentée (25/08/2026, chantier resté en pause — pas corrigée)** :
Vincent, une fois août réellement transmis — "Delphine : mois précédent 62, mois en cours 47,
mouvement -1. C'est pas logique." Investigation (`Suivre les demandes`, pas un bug de calcul) : les
15 j d'écart (62 − 47) se retrouvent exactement dans 3 CP validés de Delphine entre les deux
instantanés — 21/09→25/09 (5 j), 16/09 (0,5 j), 31/08→11/09 (9,5 j, celle avec 1 j transmis en août)
= 15 j pile. Le "mouvement" (1 j) ne recolle pas avec le delta de solde (15 j) parce que ce sont deux
notions différentes de "solde" mélangées dans le même tableau :

- **Solde interne à l'outil** (`fetchSoldes`, moteur déjà utilisé partout ailleurs — Accueil, Suivre
  les soldes) : décompte le CP dès la validation, y compris des congés dont la date est dans le
  futur et jamais encore transmis au comptable (ici, les 2 congés de septembre).
- **Ce que le comptable connaît réellement** : uniquement la somme des `export_paie_lignes`
  effectivement envoyées jusqu'ici.

Pour que "Solde précédent"/"Solde en cours" soient vraiment comparables à une fiche de paie, il
faudraient les baser sur le cumul des exports réellement transmis (comme le "mouvement" l'est déjà
depuis la clarification précédente), pas sur l'engagement live du moteur de solde général — sinon
un écart comme celui-ci est structurellement garanti dès qu'un congé futur est validé avant d'être
transmis. Corrélé à la question déjà ouverte dans `questions.md` ("Format Droit/Pris/Solde... à
revalider") — non corrigé, chantier resté en pause à la demande de Vincent.

## À faire

Voir [Backlog.md](Backlog.md) — liste unique désormais (25/08/2026, cette section faisait doublon,
fusionnée dedans).
