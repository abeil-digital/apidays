# Apidays — Espace Salarié

Outil de gestion des congés/RTT pour Abeil (bureau d'étude en aménagement/VRD, Rennes/Saint-Malo).
Ce dépôt couvre la première étape du produit : l'**Espace Salarié** — dashboard, dépôt d'une
demande de congé/RTT, historique. Les espaces Manager et Delphine (administratrice) viendront
dans des étapes suivantes, en réutilisant une partie des composants ci-dessous.

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

## Structure

```
app/
  layout.tsx              racine minimale (html/body + globals.css)
  connexion/page.tsx       route "/connexion" — hors AppShell, formulaire Supabase Auth
  connexion/actions.ts      Server Actions login()/logout()
  (app)/layout.tsx          monte AppShell — groupe de routes protégées par proxy.ts
  (app)/page.tsx            route "/" — Dashboard
  (app)/nouvelle-demande/page.tsx route "/nouvelle-demande" — formulaire
  (app)/historique/page.tsx       route "/historique" — historique + filtre + impression

proxy.ts                 rafraîchit la session Supabase, protège les routes hors /connexion

components/
  dashboard/         DashboardPage, ReglesCongesModal (RTT imposés + échéances, ouverte via
                     "découvrir" dans le bloc Soldes)
  nouvelle-demande/, historique/   écrans (client components, appellent les hooks)
  demandes/         RequestRow, RequestList, TypeBadge — réutilisables entre Dashboard/Historique
                     (et plus tard Espace Manager pour la vue équipe)
  layout/            AppShell, HeaderBar (profil + déconnexion), niveau1.ts, SideNav, BottomNav —
                     navigation par vraies routes Next.js, header général + sous-navigation
  ui/                 primitives neutres (SoldeCard, Modal, StatusBadge, ListCard, BackHeader...)

hooks/                useDemandes, useSoldes, useUtilisateur — seul point de contact données ↔ UI

lib/
  types.ts             types partagés (Demande, Soldes, Utilisateur...)
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
  `Paramétrer` — seul `Poser` est fonctionnel, les deux autres sont des emplacements réservés pour
  les futurs espaces Manager et Delphine, voir [`components/layout/niveau1.ts`](components/layout/niveau1.ts)),
  profil à droite. La sous-navigation actuelle (Accueil / Nouvelle demande / Historique) reste
  rattachée à `Poser`.
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
- Espace Delphine (administratrice) : gestion des comptes, export paie, correction de solde
- Règles de calcul réelles des soldes CP/RTT, puis branchement de `lib/data/soldes.repository.ts`
