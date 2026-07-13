# Apidays — Journal de projet

Ce document complète le [README.md](README.md) (qui explique le _comment_ technique). Il explique
le _pourquoi_ : le contexte métier, ce qui est provisoire par construction, et surtout **le
principe de bascule vers Supabase**, pour qu'aucun dev (ou moi dans 6 mois) ne le redécouvre à la
dure.

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
  Utilisateur unique mocké (Camille Rio), pas d'authentification réelle.
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

## Ce qui est mocké aujourd'hui, et pourquoi c'est volontairement temporaire

| Élément                | État actuel                                                                            | Raison                                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demandes de congés/RTT | Tableau seedé en mémoire (`lib/data/mock/demandes.mock.ts`), mutable via le repository | Pas de base de données à cette étape                                                                                                                        |
| Soldes CP/RTT          | Valeurs fixes (`lib/data/mock/soldes.mock.ts`)                                         | Règles de calcul (ancienneté, demi-journées, temps partiel, report/perte...) non validées avec Abeil                                                        |
| Utilisateur courant    | Un seul compte en dur (Camille Rio)                                                    | Authentification réelle hors périmètre de cette étape                                                                                                       |
| Persistance            | Aucune — l'état repart de zéro à chaque rechargement complet de page                   | Volontaire : pas de `localStorage` ni d'API propre à un environnement de prototypage, pour ne rien introduire qui ne fonctionnerait pas tel quel sur Vercel |

**Point d'attention** : ne pas "corriger" l'absence de persistance en ajoutant du `localStorage`
en attendant Supabase. Ce serait une deuxième couche temporaire à défaire plus tard, alors que la
vraie solution (Supabase) est déjà prévue dans l'architecture. Le seul geste correct si la
non-persistance devient gênante avant que Supabase soit prêt : accélérer le branchement de
Supabase, pas contourner le manque.

## Bascule vers Supabase — ce qui change, ce qui ne change pas

Quand Supabase est prêt (schéma de base + client configuré), la bascule se fait **fichier par
fichier dans `lib/data/`, rien ailleurs** :

1. **Ne changent pas** : tous les composants (`components/`), tous les hooks (`hooks/`), les
   types (`lib/types.ts`). Leur contrat (noms de fonctions, formes des objets retournés) est déjà
   celui d'une vraie API — c'est tout l'intérêt de la couche repository.
2. **Changent, un par un, sans dépendance entre eux** :
   - `lib/data/demandes.repository.ts` — `fetchDemandes()`, `creerDemande()`,
     `reinitialiserDemandes()` (celle-ci disparaîtra probablement, voir plus bas) passent d'un
     tableau en mémoire à des requêtes `supabase.from("demandes")...`.
   - `lib/data/soldes.repository.ts` — `fetchSoldes()` passe d'une valeur fixe à un calcul réel
     (fonction pure ou vue SQL) une fois les règles validées avec Abeil.
   - `lib/data/utilisateur.repository.ts` — `fetchUtilisateurCourant()` lit la session Supabase
     Auth réelle au lieu de renvoyer un utilisateur en dur.
3. **Disparaît** : le dossier `lib/data/mock/` — ou reste en fallback de développement local si
   utile (seed de données de test), mais n'est plus lu en production.
4. **Cas particulier — `reinitialiserDemandes()`** : cette fonction existe uniquement pour le
   bouton "Réinitialiser les données de démo" de l'historique, qui n'a de sens que tant qu'il n'y
   a pas de vraies données à perdre. À supprimer (fonction + bouton + entrée du hook) au moment de
   la bascule Supabase, pas avant.

**Ce que cette convention permet concrètement** : on peut brancher Supabase progressivement
(d'abord les demandes, puis les soldes une fois les règles validées, puis l'auth) sans jamais
toucher à l'UI, et sans "big bang" de migration. Chaque repository est un point de bascule
indépendant.

**À respecter sur les prochaines fonctionnalités** (Espace Manager, Espace Delphine) : même
patron dès le départ — repository mocké + hook, jamais d'accès direct aux données mockées depuis
un composant. Ne pas réintroduire de raccourci "juste pour cette fois".

## Règles métier encore à valider avec Abeil

Ces points, listés dans le périmètre fonctionnel, bloquent le passage de `soldes.repository.ts`
d'une valeur fixe à un vrai calcul :

- Ancienneté : majoration des CP selon seuils, jours supplémentaires
- Répartition RTT imposés vs libres : quantité, règle de calcul
- CP/RTT non pris en fin de période : report ou perte
- Demi-journées : les congés se posent-ils en jours pleins uniquement ?
- Jours fériés inclus dans une période de congé : décomptés ou non
- Temps partiel : le calcul de solde diffère-t-il ?
- Solde négatif / anticipation : peut-on poser un congé non encore acquis ?
- Chevauchement d'une demande sur deux années

Tant que ces règles ne sont pas figées, `useSoldes()` continue de renvoyer des valeurs mockées —
c'est un choix assumé, pas un oubli.

## Hébergement du code — provisoire, sur le compte GitHub personnel

Le dépôt est hébergé sur le compte GitHub personnel de Vincent (`abeil-apidays`, privé), pas sur
une organisation Abeil. C'est le même principe que pour Supabase : un choix pragmatique pour
avancer vite tant qu'il n'y a pas de compte client, pas une décision d'architecture définitive.

Rien dans le code ne dépend de cet hébergement (pas de secrets, pas de config propre à ce compte),
donc le transfert vers une organisation GitHub Abeil — via `gh repo transfer` ou en ajoutant
l'organisation comme remote et en poussant l'historique — se fait sans aucun impact sur le code
ou son fonctionnement. À faire dès qu'un compte/organisation Abeil existe.

## Déploiement — provisoire, sur le compte Vercel personnel

Le projet est déployé sur le compte Vercel personnel de Vincent
(`vincent-mayols-projects/apidays`), relié au dépôt GitHub `vincent-uzi/abeil-apidays` : chaque
`git push` sur `main` redéploie automatiquement en production, les autres branches génèrent des
previews. URL actuelle : https://apidays-iota.vercel.app.

Même principe que pour GitHub et Supabase : un choix pour avancer vite avant qu'un compte/équipe
Vercel Abeil n'existe, pas un choix définitif. Aucune variable d'environnement ni configuration
spécifique à ce compte n'est en jeu à ce stade (pas de base de données branchée), donc transférer
le projet vers une équipe Vercel Abeil plus tard (`vercel teams` + transfert de projet, ou
recréation du lien sur le nouveau compte à partir du même dépôt GitHub) n'a aucun impact sur le
code. À faire dès qu'un compte/équipe Vercel Abeil existe — et impérativement avant tout
branchement de Supabase avec de vraies données, pour éviter d'avoir à migrer des secrets de
production entre comptes.

## Hors périmètre de l'Espace Salarié (rappel)

Authentification réelle, Espace Manager, Espace Delphine, accès Comptable, calcul réel des
soldes, connexion Supabase. Tous prévus, aucun ne nécessite de réécrire l'existant grâce à la
convention ci-dessus.
