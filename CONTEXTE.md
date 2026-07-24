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
- Déploiement : Vercel, projet `abeil-digital/apidays` importé depuis GitHub, déploiement auto sur
  push vers `main`
- Repo Git : remote `origin` → `https://github.com/abeil-digital/apidays.git` (remote `perso` en
  local, conservé, pointe vers l'ancien dépôt personnel `vincent-uzi/abeil-apidays`)

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
- Header général (navigation niveau 1 Poser/Suivre/Paramétrer, Poser seul fonctionnel), sous-nav
  Accueil/Nouvelle demande/Historique
- Design system : palette de catégories CP/RTT/CPT/mint centralisée dans `app/globals.css`
  (reprise d'une maquette "design system" fournie en artifact, pas encore la charte Abeil), cartes
  de solde en grille 4 colonnes (CP/RTT/CPT + CTA "Poser un congé"), badges de type circulaires,
  modale "Règles de congés" (RTT imposés + échéances, ouverte via "découvrir")
- Bordures décoratives retirées des cartes/boutons (ombre légère ou fond à la place) ; le logo
  Abeil n'est plus affiché dans le header pour l'instant (texte seul)
- Dépôt transféré sur l'organisation GitHub `abeil-digital` (repo officiel)
- Schéma de base de données Supabase conçu (11 tables, RLS + policies par rôle
  salarié/manager/admin) — voir [BASE-DE-DONNEES.md](BASE-DE-DONNEES.md)

**En cours / pas encore fait** :

- Intégration de la vraie charte graphique Abeil (`Charte-abeil/` reçu en local, contient PDF +
  nouveau pack de logos, **non commité** — voir Conventions)
- Exploitation de `documentation-conges/` (état préparatoire des salaires, modèles de demande
  CP/RTT) pour définir les vraies règles de calcul de solde — **non commité**, contient
  potentiellement des données de paie — bloque le branchement de `soldes.repository.ts`
- Espace Manager, Espace Delphine (administratrice), accès Comptable — et avec eux, les policies
  RLS manager/admin restent à exercer en conditions réelles (seul le rôle salarié est testé pour
  l'instant)

## Décisions prises

- Un seul compte de travail utilisé côté Abeil : `abeil-it@proton.me` (GitHub : `Abeil35`)
- Repo hébergé sous l'organisation GitHub `abeil-digital` ; Vincent (`vincent-uzi`) collaborateur
  avec accès _Write_
- Projet Supabase créé : organisation `abeil-digital`, projet `Apidays`, région West EU (Ireland),
  URL `https://eaizbjovkrdjmujxovvs.supabase.co` — clé publishable utilisée côté client
- Variables d'environnement `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` :
  présentes dans `.env.local` (non commité) et poussées sur Vercel (Production/Preview/Development)
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
3. Espace Manager, puis Espace Delphine
