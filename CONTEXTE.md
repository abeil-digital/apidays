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
