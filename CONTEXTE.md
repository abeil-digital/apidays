# Apidays — Contexte projet

## Quoi

Outil de gestion des congés/RTT pour Abeil (bureau d'aménagement foncier), premier projet client
de Citizen D.

## Stack

- Frontend : **Next.js 16 (App Router)** + TypeScript strict + Tailwind CSS v4
- Backend : **Supabase** (Postgres + Data API) — prévu, pas encore branché : toutes les données
  sont mockées pour l'instant derrière une couche `hooks/` → `lib/data/*.repository.ts` →
  `lib/data/mock/*.mock.ts` (voir [README.md](README.md), section "Couche données")
- Déploiement : Vercel, projet `abeil-digital/apidays` importé depuis GitHub, déploiement auto sur
  push vers `main`
- Repo Git : remote `origin` → `https://github.com/abeil-digital/apidays.git` (remote `perso` en
  local, conservé, pointe vers l'ancien dépôt personnel `vincent-uzi/abeil-apidays`)

## État actuel

**Fait** :

- Espace Salarié (Next.js) : Dashboard, Nouvelle demande, Historique — 3 routes fonctionnelles
- Couche données isolée et mockée (demandes, soldes, utilisateur) — architecture prête pour
  Supabase, aucune donnée réelle branchée
- Header général (navigation niveau 1 Poser/Suivre/Paramétrer, Poser seul fonctionnel), sous-nav
  Accueil/Nouvelle demande/Historique
- Design system : palette de catégories CP/RTT/CPT centralisée dans `app/globals.css`, cartes de
  solde, badges de type, modale "Règles de congés"
- Dépôt transféré sur l'organisation GitHub `abeil-digital` (repo officiel)

**En cours / pas encore fait** :

- Connexion Supabase (base de données réelle) — aucune donnée réelle pour l'instant
- Intégration de la vraie charte graphique Abeil (`Charte-abeil/` reçu en local, contient PDF +
  nouveau pack de logos, **non commité** — voir Conventions)
- Exploitation de `documentation-conges/` (état préparatoire des salaires, modèles de demande
  CP/RTT) pour définir les vraies règles de calcul de solde — **non commité**, contient
  potentiellement des données de paie
- Authentification réelle (un seul utilisateur mocké, Camille Rio, pour l'instant)
- Espace Manager, Espace Delphine (administratrice), accès Comptable

## Décisions prises

- Un seul compte de travail utilisé côté Abeil : `abeil-it@proton.me` (GitHub : `Abeil35`)
- Repo hébergé sous l'organisation GitHub `abeil-digital` ; Vincent (`vincent-uzi`) collaborateur
  avec accès _Write_
- Projet Supabase créé : organisation `abeil-digital`, projet `Apidays`, région West EU (Ireland),
  URL `https://eaizbjovkrdjmujxovvs.supabase.co` — clé publishable côté client, pas encore utilisée
  dans le code
- Variables d'environnement Vercel configurées : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (⚠️ préfixe `VITE_` hérité d'un gabarit Vite — à renommer en `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` au moment du branchement réel, Next.js n'utilise pas le préfixe
  `VITE_`)
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
2. Dépouiller `documentation-conges/` pour définir les règles de calcul CP/RTT réelles
3. Brancher Supabase (remplacer `lib/data/*.repository.ts` un par un, voir
   [projet.md](projet.md#bascule-vers-supabase--ce-qui-change-ce-qui-ne-change-pas))
4. Authentification réelle
5. Espace Manager, puis Espace Delphine
