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
  violet) et "CPI" (même couleur que CP)
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
