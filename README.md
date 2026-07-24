# Apidays — Espace Salarié

Outil de gestion des congés/RTT pour Abeil (bureau d'étude en aménagement/VRD, Rennes/Saint-Malo).
Ce dépôt couvre l'**Espace Salarié** (dashboard, dépôt d'une demande de congé/RTT, historique) et
le tout premier écran de l'**Espace Delphine** (administratrice) : Paramétrer > Gestion des
utilisateurs. Le reste de l'Espace Delphine et l'Espace Manager viendront dans des étapes
suivantes, en réutilisant une partie des composants ci-dessous.

Ce n'est pas un jetable de démo : pas de backend pour l'instant, mais le code (TypeScript strict,
composants découpés, couche données isolée) est écrit pour durer.

Ce README documente le _comment_ technique. Pour le contexte projet et le détail du principe de
bascule vers Supabase, voir [projet.md](projet.md). Pour un résumé rapide de l'état du projet
(stack, décisions, à faire), voir [CONTEXTE.md](CONTEXTE.md).

## Stack

- **Next.js 16 (App Router)** + **TypeScript strict**, déployé sur Vercel
- **Tailwind CSS v4**, thème custom via `@theme` (voir plus bas)
- **lucide-react** pour les icônes
- **ESLint** (config Next + `eslint-config-prettier`) et **Prettier** (+ `prettier-plugin-tailwindcss`
  pour trier automatiquement les classes)
- **Supabase** (Postgres + Auth) — demandes, utilisateur et authentification branchés ; le solde
  reste mocké en attendant les règles de calcul (voir "Couche données")

## Démarrer

```bash
npm install
npm run dev        # serveur de dev sur http://localhost:3000
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run format       # Prettier — réécrit les fichiers
npm run format:check # Prettier — vérifie sans réécrire
```

## Couche données — convention à respecter sur les prochaines fonctionnalités

**Aucun composant ne doit savoir d'où viennent les données.** Toute donnée transite par un hook
dédié dans `hooks/`, qui est le seul point du code autorisé à connaître la source réelle. Trois
couches, dans cet ordre :

```
components/*        → appellent uniquement les hooks (useDemandes, useSoldes, useUtilisateur)
hooks/*.ts           → état React (loading/error/data) + appellent un repository
lib/data/*.repository.ts → fonctions async — parlent à Supabase (demandes, utilisateur) ou
                           lisent encore lib/data/mock/*.mock.ts (soldes, en attendant les règles)
```

Exemple concret avec les demandes de congés :

- [`lib/data/demandes.repository.ts`](lib/data/demandes.repository.ts) — expose
  `fetchDemandes()`, `creerDemande()`, qui interrogent `demandes_conges` via
  [`lib/supabase/client.ts`](lib/supabase/client.ts) (RLS : chacun ne voit que ses propres
  demandes).
- [`hooks/useDemandes.ts`](hooks/useDemandes.ts) — appelle le repository, expose
  `{ demandes, loading, error, ajouterDemande }` aux composants.
- [`components/dashboard/DashboardPage.tsx`](components/dashboard/DashboardPage.tsx) et les
  autres écrans n'importent **que** le hook, jamais `lib/data/*`.

`lib/data/soldes.repository.ts` suit le même patron mais lit encore
[`lib/data/mock/soldes.mock.ts`](lib/data/mock/soldes.mock.ts) : les règles de calcul (ancienneté,
demi-journées, temps partiel, report/perte...) ne sont pas encore validées avec Abeil — voir
[BASE-DE-DONNEES.md](BASE-DE-DONNEES.md).

Pour toute nouvelle fonctionnalité (Espace Manager, Espace Delphine...), suivre le même patron :
un repository dans `lib/data/`, un hook dans `hooks/`, jamais d'accès direct à Supabase ou aux
données mockées depuis un composant.

Le schéma de base de données (Supabase, appliqué et branché) est documenté séparément dans
[BASE-DE-DONNEES.md](BASE-DE-DONNEES.md).

## Thème & design tokens

Tailwind v4 ne se configure plus via un `tailwind.config.ts` par défaut : les tokens de thème se
déclarent dans un bloc `@theme` en CSS ([`app/globals.css`](app/globals.css)), qui génère
automatiquement les utilities (`bg-brand`, `text-ink-500`, `rounded-card`, etc.). Ce bloc **est**
la configuration du thème — l'équivalent du `theme.extend` d'un `tailwind.config.ts` classique.

Palette actuelle : header en `slate` (`#496580`), fond d'app gris clair, cartes blanches, et une
palette de catégorie (`cp` / `rtt` / `cpt` / `mint`) reprise d'une maquette "design system" fournie
en artifact — pas encore la charte Abeil officielle. Les tokens sont nommés sémantiquement
(`brand`, `slate`, `ink-900`, `surface-card`, `cp`/`rtt`/`cpt`/`mint`/`mint-tint`,
`status-success-fg`...) et non par valeur de couleur, précisément pour que l'arrivée de la charte
Abeil soit un changement de **valeurs** dans `app/globals.css`, jamais une réécriture de
composant : aucun composant ne contient de couleur en dur (`#0A84FF`, etc.). Le logo Abeil n'est
plus affiché dans le header pour l'instant (texte "Apidays" seul) ; le fichier reçu
(`public/abeil-logo.jpeg`) reste sur le disque mais n'est plus référencé.

Les bordures décoratives ont été retirées des cartes/boutons au profit d'une ombre légère
(`shadow-sm`) ou d'un simple contraste de fond — seuls les champs de formulaire (dates, message)
gardent une délimitation, via un fond gris clair (`bg-surface-app`) plutôt qu'un trait, pour rester
identifiables comme zones de saisie.

## Composants du design system

Primitifs bas niveau dans `components/ui/`, à réutiliser avant d'écrire un nouveau style à la main.
**Référence vivante : [`/design-system`](app/design-system/page.tsx)**
([`components/design-system/DesignSystemPage.tsx`](components/design-system/DesignSystemPage.tsx))
— importe et rend les vrais composants avec de vraies props (palette, typographie, composants,
états). Si un composant change, cette page change avec lui : c'est elle qu'il faut consulter et
mettre à jour au fil de l'eau, pas cette section markdown qui peut se désynchroniser.

- **`Badge`** ([`components/ui/Badge.tsx`](components/ui/Badge.tsx)) — pastille de statut
  générique, brique de premier niveau pour tout badge à venir (validation manager, exports
  paie...). Un seul prop `tone`, le libellé est un enfant libre (pas une énumération fermée) :

  ```tsx
  <Badge tone="success">Actif</Badge>
  <Badge tone="warning">En attente</Badge>
  <Badge tone="danger">Refusé</Badge>
  <Badge tone="neutral">Archivé</Badge>
  ```

  Chaque `tone` est mappé sur les tokens `@theme` `--color-status-<tone>-bg`/`-fg` (voir
  "Thème & design tokens" ci-dessus) — jamais de couleur en dur. `StatusBadge`
  ([`components/ui/StatusBadge.tsx`](components/ui/StatusBadge.tsx)) est une fine couche par-dessus
  pour les statuts de demande (`StatutDemande` → tone + libellé + icône) : aucun appelant existant
  (`RequestRow`...) n'a changé. `UtilisateursListPage` (Actif/Archivé) consomme `Badge` directement,
  sans réimplémenter le style à la main.

- **`Modal`** ([`components/ui/Modal.tsx`](components/ui/Modal.tsx)) — modale générique (fond +
  carte + bouton fermer), réutilisée pour `ReglesCongesModal` (Dashboard) et la confirmation
  d'archivage (`UtilisateurFichePage`).
- **`Avatar`** ([`components/ui/Avatar.tsx`](components/ui/Avatar.tsx)) — pastille d'initiales
  neutre (header), sans logique de tonalité.

## Structure

```
app/
  layout.tsx              racine minimale (html/body + globals.css)
  connexion/page.tsx       route "/connexion" — hors AppShell, formulaire Supabase Auth
  connexion/actions.ts      Server Actions login()/logout()
  design-system/page.tsx    route "/design-system" — référence vivante du design system
  (app)/layout.tsx          monte AppShell — groupe de routes protégées par proxy.ts
  (app)/page.tsx            route "/" — Dashboard
  (app)/nouvelle-demande/page.tsx route "/nouvelle-demande" — formulaire
  (app)/historique/page.tsx       route "/historique" — historique + filtre + impression
  (app)/parametrer/utilisateurs/page.tsx           route "/parametrer/utilisateurs" — tableau
  (app)/parametrer/utilisateurs/nouveau/page.tsx    route "/parametrer/utilisateurs/nouveau"
  (app)/parametrer/utilisateurs/[id]/page.tsx        route "/parametrer/utilisateurs/:id" — fiche

proxy.ts                 rafraîchit la session Supabase, protège les routes hors /connexion,
                         bloque /parametrer/* pour le rôle salarié

components/
  dashboard/         DashboardPage, ReglesCongesModal (RTT imposés + échéances, ouverte via
                     "découvrir" dans le bloc Soldes)
  nouvelle-demande/, historique/   écrans (client components, appellent les hooks)
  demandes/         RequestRow, RequestList, TypeBadge — réutilisables entre Dashboard/Historique
                     (et plus tard Espace Manager pour la vue équipe)
  parametrer/        UtilisateursListPage (tableau, filtres, tri), UtilisateurFichePage
                     (création/édition/archivage) — Espace Delphine
  design-system/     DesignSystemPage — référence vivante, importe les vrais composants ui/
  layout/            AppShell, HeaderBar (profil + déconnexion), niveau1.ts (nav niveau 1,
                     dépendante du rôle), tabs.ts (sous-nav dépendante de la section active),
                     SideNav, BottomNav
  ui/                 primitives neutres (Badge, SoldeCard, Modal, StatusBadge, ListCard,
                     BackHeader...) — voir "Composants du design system" ci-dessus

hooks/                useDemandes, useSoldes, useUtilisateur, useUtilisateursAdmin,
                     useUtilisateurAdmin — seul point de contact données ↔ UI

lib/
  types.ts             types partagés (Demande, Soldes, Utilisateur, UtilisateurAdmin...)
  format.ts             formatage de dates (fr-FR)
  data/                 repositories (+ mock pour soldes), voir "Couche données"
  supabase/             client.ts (navigateur), server.ts (Server Actions/cookies)
```

## Choix notables

- **Navigation par vraies routes** (`/`, `/nouvelle-demande`, `/historique`) plutôt qu'un état
  `view` en mémoire comme dans le prototype d'origine : back/forward navigateur, URL partageable,
  et c'est ce que Next.js App Router fait de mieux.
- **Header général à deux niveaux** ([`components/layout/HeaderBar.tsx`](components/layout/HeaderBar.tsx)) :
  "Apidays" (texte seul, pas de logo pour l'instant), navigation niveau 1 (`Poser` / `Suivre` /
  `Paramétrer`). `Poser` fonctionnel pour tous, `Paramétrer` cliquable pour manager/admin
  uniquement (`getNiveau1Items(role)` dans
  [`components/layout/niveau1.ts`](components/layout/niveau1.ts)), `Suivre` reste un emplacement
  réservé pour le futur Espace Manager. Profil + déconnexion à droite. La sous-navigation
  (Accueil/Nouvelle demande/Historique vs Utilisateurs) dépend de la section active
  (`getNavTabs(pathname)` dans [`components/layout/tabs.ts`](components/layout/tabs.ts)).
- **Gestion des utilisateurs** (Paramétrer, `/parametrer/utilisateurs`) : tableau (recherche
  nom/email, filtres rôle/statut/contrat, tri Nom/Date d'entrée, "Actif" par défaut), lignes
  cliquables vers une fiche création/édition partagée
  ([`components/parametrer/UtilisateurFichePage.tsx`](components/parametrer/UtilisateurFichePage.tsx)),
  archivage avec confirmation (`Modal`). Aucune logique d'autorisation dupliquée côté UI : la RLS
  Supabase déjà en place fait foi (admin voit/gère tout, manager voit son équipe en lecture seule
  côté création/modification — une tentative de création par un manager échoue proprement, message
  d'erreur affiché).
- **Bloc "Soldes" du Dashboard** : les 3 cartes de solde (CP/RTT/CPT) et une 4ᵉ tuile CTA "Poser un
  congé" (qui mène au formulaire `/nouvelle-demande`) partagent une grille `grid-cols-4` dans un
  même panneau teinté. Le lien "découvrir" ouvre `ReglesCongesModal` — RTT imposés et échéances
  CP/RTT, purement informatif.
- **Écrans larges** : au-delà de 1440px, tout le shell applicatif (header + sidebar + contenu) est
  capé et centré — pas seulement le contenu — pour ne pas s'étirer sur moniteur 4K/ultrawide (voir
  `AppShell.tsx` et `HeaderBar.tsx`, `md:max-w-[1440px]`). En dessous, comportement fluide inchangé.
- **Authentification réelle** (Supabase Auth) : `/connexion` (hors `AppShell`), `proxy.ts`
  rafraîchit la session et protège les autres routes, déconnexion depuis `HeaderBar`.
  `useUtilisateur()` lit désormais la session réelle. Testé avec le rôle `salarie` ; les policies
  manager/admin restent à exercer une fois ces espaces construits.
- **Soldes CP/RTT à valeurs fixes** : les règles métier (ancienneté, demi-journées, jours fériés,
  temps partiel, report/perte...) ne sont pas encore validées avec Abeil. `useSoldes()` renvoie
  des valeurs mockées ; le calcul réel remplacera uniquement `lib/data/soldes.repository.ts`. Le
  formulaire de nouvelle demande affiche un aperçu du solde avant/après (informatif, non bloquant
  même si négatif — les règles de dépassement ne sont pas tranchées).
- **Export historique = impression navigateur** (`window.print()` + classes `print:*`), en
  attendant un vrai export PDF/CSV côté Delphine plus tard.

## Prochaines étapes (hors périmètre ici)

- Espace Manager (validation/refus, vue d'équipe)
- Suite de l'Espace Delphine : paramétrage RTT imposés, export paie, correction de solde
- Règles de calcul réelles des soldes CP/RTT, puis branchement de `lib/data/soldes.repository.ts`
- Consolidation design system identifiée par audit (24/07/2026), pas encore traitée : mapping
  couleur CP/RTT/CPT dupliqué entre `SoldeCard`/`TypeBadge`, pas de composant `Input`/`Select`
  partagé (style répété), pas de composant "pill toggle" partagé (`NouvelleDemandeForm` /
  `HistoriquePage`) — `/design-system` sert d'aide visuelle pour vérifier chaque composant au fil
  de cette consolidation
