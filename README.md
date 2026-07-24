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
- Pas de base de données pour l'instant — toutes les données sont mockées (voir "Couche données")

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
lib/data/*.repository.ts → fonctions async qui font "comme si" elles parlaient à une API
lib/data/mock/*.mock.ts  → données mockées + seed, utilisées par les repositories aujourd'hui
```

Exemple concret avec les demandes de congés :

- [`lib/data/mock/demandes.mock.ts`](lib/data/mock/demandes.mock.ts) — le jeu de données mocké
  (`seedDemandes()`).
- [`lib/data/demandes.repository.ts`](lib/data/demandes.repository.ts) — expose
  `fetchDemandes()`, `creerDemande()`, `reinitialiserDemandes()`, toutes `async` et avec une
  latence simulée (`simulateLatency`) pour que la forme de l'API soit déjà réaliste.
- [`hooks/useDemandes.ts`](hooks/useDemandes.ts) — appelle le repository, expose
  `{ demandes, loading, error, ajouterDemande, reinitialiser }` aux composants.
- [`components/dashboard/DashboardPage.tsx`](components/dashboard/DashboardPage.tsx) et les
  autres écrans n'importent **que** le hook, jamais `lib/data/*`.

**Pourquoi cette séparation en trois couches (et pas juste un hook avec des données en dur) :**
le jour où Supabase est branché, seuls les fichiers `*.repository.ts` changent (ils feront de
vrais appels réseau au lieu de lire `*.mock.ts`) — signature identique, donc **aucun hook ni
aucun composant d'UI n'est modifié**. C'est le seul endroit du code qui a le droit de savoir que
la persistance n'existe pas encore.

Pour toute nouvelle fonctionnalité (Espace Manager, Espace Delphine...), suivre le même patron :
un repository dans `lib/data/`, un hook dans `hooks/`, jamais d'accès direct aux données mockées
depuis un composant.

Le schéma de base de données cible (Supabase, pas encore branché) est documenté séparément dans
[BASE-DE-DONNEES.md](BASE-DE-DONNEES.md).

### Stockage des données mockées

Les demandes vivent dans une variable module-level (`lib/data/demandes.repository.ts`), donc
l'état est partagé entre les écrans pendant la session (poser une demande sur `/nouvelle-demande`
la fait apparaître immédiatement dans l'historique), mais repart de zéro à chaque rechargement
complet de la page — il n'y a volontairement pas de `localStorage` ni d'API navigateur
spécifique à un environnement de prototypage : rien qui ne fonctionnerait pas tel quel sur
Vercel.

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
  layout.tsx              racine, monte AppShell + globals.css
  page.tsx                 route "/" — Dashboard
  nouvelle-demande/page.tsx route "/nouvelle-demande" — formulaire
  historique/page.tsx       route "/historique" — historique + filtre + impression

components/
  dashboard/         DashboardPage, ReglesCongesModal (RTT imposés + échéances, ouverte via
                     "découvrir" dans le bloc Soldes)
  nouvelle-demande/, historique/   écrans (client components, appellent les hooks)
  demandes/         RequestRow, RequestList, TypeBadge — réutilisables entre Dashboard/Historique
                     (et plus tard Espace Manager pour la vue équipe)
  layout/            AppShell, HeaderBar, niveau1.ts, SideNav, BottomNav — navigation par vraies
                     routes Next.js, header général + sous-navigation
  ui/                 primitives neutres (SoldeCard, Modal, StatusBadge, ListCard, BackHeader...)

hooks/                useDemandes, useSoldes, useUtilisateur — seul point de contact données ↔ UI

lib/
  types.ts             types partagés (Demande, Soldes, Utilisateur...)
  format.ts             formatage de dates (fr-FR)
  data/                 repositories + mocks, voir "Couche données"
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
- **Authentification mockée** : un seul utilisateur (`Camille Rio`) via `useUtilisateur()`. Pas
  d'auth réelle à cette étape — hors périmètre.
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
- Authentification réelle, connexion Supabase (remplace uniquement `lib/data/*.repository.ts`)
- Règles de calcul réelles des soldes CP/RTT
