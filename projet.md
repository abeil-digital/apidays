# Apidays — Journal de projet

Ce document complète le [README.md](README.md) (qui explique le _comment_ technique). Il explique
le _pourquoi_ : le contexte métier, ce qui est provisoire par construction, et surtout **le
principe de bascule vers Supabase**, pour qu'aucun dev (ou moi dans 6 mois) ne le redécouvre à la
dure. Pour un résumé rapide et à jour de l'état du projet, voir [CONTEXTE.md](CONTEXTE.md).

## Contexte

Apidays est l'outil de gestion des congés/RTT d'Abeil (bureau d'étude en aménagement/VRD,
Rennes/Saint-Malo). Il remplace un circuit aujourd'hui 100% papier. C'est un vrai produit destiné
à être vendu et maintenu dans la durée — pas un jetable de démo, même si on démarre sans backend
et sans compte client pour avancer vite sur l'UI.

Quatre profils identifiés à terme : Salarié·e, Manager, Delphine (administratrice RH), Comptable
(pas de compte, reçoit un export). Le périmètre fonctionnel complet et les règles métier encore à
valider avec Abeil sont dans `20260709-abeil-Périmètre fonctionnel.pdf` (hors dépôt).

## Étapes livrées

- **Espace Salarié** (cette étape) : dashboard (solde, demandes en cours, prochains congés),
  nouvelle demande (avec aperçu du solde avant/après), historique filtrable + export impression.
- **Connexion Supabase + authentification réelle** : `demandes.repository.ts` et
  `utilisateur.repository.ts` parlent à Supabase (RLS), connexion/déconnexion via Supabase Auth
  (page `/connexion`, `proxy.ts`) — plus d'utilisateur unique mocké "Camille Rio" pour ces deux
  repositories. `soldes.repository.ts` reste mocké (règles de calcul non validées avec Abeil).
- **Header général** : logo Abeil + Apidays, navigation niveau 1 (Poser / Suivre / Paramétrer),
  profil. Prépare la place pour les futurs espaces sans les construire.

À venir : Espace Manager (validation/refus, vue équipe), Espace Delphine (gestion des comptes,
export paie, correction de solde), authentification réelle, calcul réel des soldes CP/RTT.

## Logo Abeil — asset temporaire

Le logo affiché dans le header (`public/abeil-logo.jpeg`) est le fichier fourni tel quel par
Vincent, au format JPEG avec un fond blanc opaque (pas de transparence). Il est affiché sur une
pastille blanche dans le header noir pour éviter un rectangle blanc flottant à l'aspect non
maîtrisé. Dès qu'un fichier officiel (SVG ou PNG à fond transparent) est disponible, il suffit de
remplacer `public/abeil-logo.jpeg` et d'ajuster la référence dans
[`components/layout/HeaderBar.tsx`](components/layout/HeaderBar.tsx) — aucun autre fichier n'est
concerné.

## Navigation niveau 1 — Poser / Suivre / Paramétrer

Le header expose trois entrées ([`components/layout/niveau1.ts`](components/layout/niveau1.ts)),
pensées comme la structure cible de l'application, pas comme des fonctionnalités livrées :

- **Poser** : fonctionnel, c'est l'Espace Salarié actuel (`/`, `/nouvelle-demande`, `/historique`).
- **Suivre** et **Paramétrer** : non cliquables (pas de route derrière), grisés, réservés
  respectivement aux futurs espaces Manager (suivi/validation des demandes) et Delphine
  (paramétrage RTT, gestion des comptes). Les activer consistera à leur donner un `href` dans
  `niveau1.ts` une fois l'espace correspondant construit — aucune restructuration du header.

## Le principe temporaire : pourquoi une couche mockée plutôt que "coder en dur"

Sans base de données ni backend, il y avait deux façons d'écrire le code :

1. **Le raccourci** — mettre les données mockées directement dans les composants (`useState`
   initialisé avec un tableau en dur, ou pire, des valeurs codées dans le JSX). Rapide à écrire,
   mais le jour où Supabase arrive, il faut retoucher chaque composant qui affiche une donnée.
2. **Le choix fait ici** — isoler _toute_ donnée derrière un hook (`useDemandes`, `useSoldes`,
   `useUtilisateur`), qui appelle un repository (`lib/data/*.repository.ts`), qui aujourd'hui lit
   des données mockées (`lib/data/mock/*.mock.ts`) mais a déjà la forme d'un vrai appel API :
   fonctions `async`, retour `Promise`, latence simulée.

C'est le choix (2) qui a été fait partout, précisément pour que **"pas de backend" reste un détail
d'implémentation invisible depuis les composants**, et non une hypothèque sur l'architecture. Voir
le détail des trois couches dans le [README.md](README.md), section "Couche données".

## Ce qui reste mocké aujourd'hui, et pourquoi c'est volontairement temporaire

**Mise à jour du 13/08/2026 : plus rien n'est mocké.** Cette section décrivait l'état où seul le
solde restait à brancher — `soldes.repository.ts` calcule désormais le solde réel (voir
CONTEXTE.md et BASE-DE-DONNEES.md pour la formule), formule actée directement avec Vincent plutôt
que via `documentation-conges/` (toujours non dépouillé). Le raisonnement ci-dessous (ne pas
bricoler de couche temporaire type `localStorage`) reste valable comme principe général pour toute
future donnée pas encore branchée.

## Bascule vers Supabase — ce qui change, ce qui ne change pas

La bascule se fait **fichier par fichier dans `lib/data/`, rien ailleurs** :

1. **Ne changent pas** : tous les composants (`components/`), tous les hooks (`hooks/`), les
   types (`lib/types.ts`). Leur contrat (noms de fonctions, formes des objets retournés) était déjà
   celui d'une vraie API — c'est tout l'intérêt de la couche repository.
2. **Basculés** :
   - `lib/data/demandes.repository.ts` — `fetchDemandes()`/`creerDemande()` interrogent
     `demandes_conges` via `lib/supabase/client.ts` (RLS + jointure `types_absences` pour le code
     CP/RTT, calcul de `nb_demi_journees` en excluant weekends/jours fériés).
   - `lib/data/utilisateur.repository.ts` — `fetchUtilisateurCourant()` lit la session Supabase
     Auth réelle (jointure `utilisateurs` via `auth_id`) au lieu de renvoyer un utilisateur en dur.
3. **Basculé aussi (13/08/2026)** : `lib/data/soldes.repository.ts` — `fetchSoldes()` calcule
   désormais le solde réel au lieu d'une valeur fixe (voir section précédente). `soldes.mock.ts` a
   été supprimé ; `demandes.mock.ts`/`utilisateur.mock.ts` ne sont plus lus en dehors d'éventuels
   tests.
4. **`reinitialiserDemandes()` a disparu** (fonction + bouton "Réinitialiser les données de démo"
   de l'historique + entrée du hook `useDemandes`), comme prévu au moment de la bascule.

**Authentification réelle** : Supabase Auth remplace l'utilisateur unique mocké "Camille Rio".
`proxy.ts` (fichier qui remplace `middleware.ts` depuis Next.js 16) rafraîchit la session à chaque
requête et redirige vers `/connexion` en son absence ; les routes de l'Espace Salarié vivent dans
`app/(app)/` (groupe de routes portant l'`AppShell`), `/connexion` en dehors pour ne pas afficher
le header/nav avant connexion. Connexion/déconnexion : Server Actions dans
`app/connexion/actions.ts`. Testé de bout en bout avec le compte `test-salarie@abeil.local` — les
policies manager/admin n'ont pas encore été exercées (Espace Manager/Delphine pas construits).

**Le schéma cible** est appliqué au projet Supabase et branché au code pour demandes/utilisateur.
Voir [BASE-DE-DONNEES.md](BASE-DE-DONNEES.md) pour le détail (tables, rôles, RLS) et
[`supabase/schema.sql`](supabase/schema.sql) pour le SQL versionné.

**À respecter sur les prochaines fonctionnalités** (Espace Manager, Espace Delphine) : même
patron dès le départ — repository mocké + hook, jamais d'accès direct aux données mockées depuis
un composant. Ne pas réintroduire de raccourci "juste pour cette fois".

## Règles métier encore à valider avec Abeil

Ces points, listés dans le périmètre fonctionnel, bloquent le passage de `soldes.repository.ts`
d'une valeur fixe à un vrai calcul. Le schéma de base de données (voir
[BASE-DE-DONNEES.md](BASE-DE-DONNEES.md)) a modélisé une réponse de travail pour certains — encore
**WIP**, pas une validation formelle avec Abeil :

- ~~Demi-journées : les congés se posent-ils en jours pleins uniquement ?~~ → modélisé : oui,
  demi-journées possibles (`demi_debut`/`demi_fin`)
- ~~Jours fériés inclus dans une période de congé : décomptés ou non~~ → modélisé : exclus du
  décompte
- ~~Solde négatif / anticipation : peut-on poser un congé non encore acquis ?~~ → modélisé : oui,
  via le solde théorique (`is_anticipation`)
- ~~CP/RTT non pris en fin de période : report ou perte~~ → modélisé : CP reportables (période
  juin → mai), RTT perdus en fin d'année civile
- **Toujours ouvert** — Ancienneté : majoration des CP selon seuils, jours supplémentaires (le
  champ `anciennete_date_reference` existe, sans règle de calcul)
- **Toujours ouvert** — Répartition RTT imposés vs libres : quantité, règle de calcul
- **Toujours ouvert** — Temps partiel : le calcul de solde diffère-t-il ? (`taux_temps_partiel`
  modélisé, sans formule)
- **Toujours ouvert** — Chevauchement d'une demande sur deux années (pas traité dans le schéma)

Tant que ces règles ne sont pas figées avec Abeil, `useSoldes()` continue de renvoyer des valeurs
mockées — c'est un choix assumé, pas un oubli.

## Hébergement du code — GitHub Abeil (chapitre "provisoire" clos)

Le dépôt est désormais hébergé sur l'organisation GitHub officielle **`abeil-digital`**
(repo `abeil-digital/apidays`, privé), accessible via le compte de travail `abeil-it@proton.me`
(compte GitHub `Abeil35`). Vincent (`vincent-uzi`) reste collaborateur avec accès _Write_.

Transfert effectué comme prévu, sans impact sur le code : le remote local `origin` pointe
maintenant vers `abeil-digital/apidays.git`. L'ancien dépôt personnel reste accessible en local
sous le remote `perso` (`vincent-uzi/abeil-apidays.git`), conservé mais non poussé par défaut.

Ce chapitre du principe "provisoire" est donc clos pour GitHub — et pour Vercel aussi, voir
juste en dessous.

## Déploiement — sur l'équipe Vercel Abeil (chapitre "provisoire" clos)

Ce chapitre est désormais **clos** : une équipe Vercel Abeil (`abeil-digital`, compte
`abeil-it@proton.me`) existe et héberge le projet officiel `apidays`, relié au dépôt GitHub
`abeil-digital/apidays` (remote `origin`) — chaque `git push` sur `main` redéploie automatiquement
en production. URL actuelle : https://apidays-seven.vercel.app. Les variables
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` du projet Supabase
`abeil-digital/Apidays` y sont poussées (Production/Preview/Development) — pour l'instant avec des
comptes de test Phase 0 uniquement (`@abeil.local`), aucune donnée réelle.

**Un second projet Vercel existe encore**, sur le compte personnel de Vincent
(`vincent-mayols-projects/apidays`, relié au dépôt `perso`/`vincent-uzi/abeil-apidays`, URL
https://apidays-iota.vercel.app) : c'est l'ancien déploiement provisoire décrit ci-dessus dans les
versions précédentes de ce document. **Décision (24/07/2026) : abandonné, on n'y touche plus.** Il
n'a pas reçu la bascule Supabase (le remote `perso` n'est pas poussé par défaut) et reste sur
l'ancienne version mockée — c'est volontaire, ce n'est plus le déploiement de référence. Pas de
suppression active pour l'instant (au cas où l'URL serait encore référencée quelque part), mais
plus aucune action dessus : ni push sur `perso`, ni variables d'environnement, ni redéploiement.
Le seul déploiement à considérer pour Apidays est désormais celui de l'équipe `abeil-digital`
ci-dessus.

**Accès CLI** : `vercel login abeil-it@proton.me` (device flow) — bien ouvrir le lien dans une
fenêtre sans session Vercel perso déjà active, sinon le code d'autorisation s'attache au mauvais
compte. Une fois connecté, utiliser `--scope abeil-digital` (ou `vercel link --scope abeil-digital`
pour relier durablement un répertoire local à ce projet).

## Hors périmètre de l'Espace Salarié (rappel)

Espace Manager, Espace Delphine, accès Comptable, calcul réel des soldes (CP/RTT/CPT). Tous
prévus, aucun ne nécessite de réécrire l'existant grâce à la convention ci-dessus. Authentification
réelle et connexion Supabase sont désormais faites pour l'Espace Salarié (voir plus haut).
