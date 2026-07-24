# Apidays — Base de données (Supabase)

Schéma cible pour la persistance réelle, conçu en parallèle du front (Espace Salarié). Le SQL
versionné dans [`supabase/schema.sql`](supabase/schema.sql) est appliqué au projet Supabase
`abeil-digital/Apidays`, et les repositories `demandes` et `utilisateur` y sont branchés (voir
[README.md](README.md), section "Couche données") ; seul `soldes.repository.ts` reste mocké, les
règles de calcul CP/RTT n'étant pas encore validées avec Abeil. Ce document explique le schéma ;
le fichier `.sql` fait foi pour le détail exact.

Basé sur le cadrage fonctionnel (WIP, 20/07/2026) — certains points restent à confirmer avec
Abeil, signalés plus bas.

## Vue d'ensemble

| Table                    | Rôle                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `utilisateurs`           | Salarié·es, managers, admin (Delphine) — un seul compte peut porter plusieurs rôles au sens large de l'app, mais `role` est unique par ligne |
| `manager_salaries`       | Rattachement salarié ↔ manager(s) habilité(s) à valider (plusieurs managers possibles)                                                       |
| `delegations_validation` | Délégation temporaire du droit de validation (absence d'un manager)                                                                          |
| `copies_notifications`   | Destinataires en copie des mails de validation/refus d'un manager                                                                            |
| `types_absences`         | Référentiel CP / RTT                                                                                                                         |
| `soldes`                 | Solde réel + théorique, par utilisateur, par type d'absence, par période                                                                     |
| `historique_soldes`      | Traçabilité des ajustements manuels de solde par Delphine                                                                                    |
| `demandes_conges`        | Les demandes elles-mêmes — dates, statut, décision, dévalidation                                                                             |
| `jours_feries`           | Référentiel des jours fériés (utilisé pour exclure du décompte)                                                                              |
| `parametrage_periode`    | Paramétrage annuel porté par le Manager (semaine du 15 août imposée, etc.)                                                                   |
| `rtt_imposes`            | Dates de RTT imposées pour une période donnée                                                                                                |

## Points de modélisation notables

- **Plusieurs managers par salarié** : `manager_salaries` est une table de jointure, pas un
  `manager_id` unique sur `utilisateurs` — plusieurs associés peuvent valider les demandes d'un
  même salarié.
- **Deux compteurs par solde** (`solde_reel` / `solde_theorique`) : le réel est utilisable tout de
  suite, le théorique est le cumul en cours pour l'année suivante — une demande peut être posée en
  anticipation dessus (`demandes_conges.is_anticipation`).
- **Demi-journées** : `demi_debut` / `demi_fin` (matin/après-midi) sur les demandes — les congés ne
  se posent donc pas uniquement en jours pleins.
- **Dévalidation ≠ annulation** : une demande déjà validée que Delphine invalide passe par
  `devalidee_par` / `date_devalidation`, distincts du `statut = 'annulee'` qui couvre le retrait
  d'une demande encore en attente par le salarié lui-même.
- **`nb_demi_journees` est calculé côté application**, pas en base — le commentaire du schéma
  précise "jours fériés/weekends exclus".

## Rôles & sécurité (RLS)

Trois rôles applicatifs (`user_role` : `salarie`, `manager`, `admin`), distincts des rôles Postgres
(`authenticated`, `service_role`). Row Level Security est activée sur **toutes** les tables, avec
un verrou par défaut : sans policy, personne n'a accès via les clés `anon`/`authenticated`. Le
`service_role` (utilisé côté serveur) contourne RLS et n'est pas concerné par ce verrou.

Trois fonctions utilitaires (`security definer`, donc pas de récursion RLS) portent la logique
d'autorisation :

- `my_utilisateur_id()` — l'id `utilisateurs` correspondant à `auth.uid()`
- `my_role()` — le rôle de l'utilisateur courant
- `is_manager_of(salarie_id)` — vrai si l'utilisateur courant est manager du salarié donné

Logique générale des policies : chacun lit ses propres données ; un manager lit/valide celles de
son équipe (via `is_manager_of`) ; l'admin (Delphine) a un accès large sur tout. Les tables
référentielles (`types_absences`, `jours_feries`, `parametrage_periode`, `rtt_imposes`) sont en
lecture ouverte à tout utilisateur authentifié, modification réservée à manager/admin selon la
table.

**RLS ne suffit pas seul** : Postgres exige aussi des `GRANT` de base sur chaque table pour le rôle
`authenticated` — sans ça, la requête est bloquée avant même l'évaluation des policies. Voir la
section GRANTS en fin de fichier `.sql`.

## Ce que ce schéma répond (ou pas) aux questions métier en suspens

Le schéma précise/tranche plusieurs points listés dans [projet.md](projet.md#règles-métier-encore-à-valider-avec-abeil) :

| Question                                 | Réponse d'après le schéma                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demi-journées possibles ?                | **Oui** — `demi_debut`/`demi_fin` par demande                                                                                                           |
| Jours fériés décomptés ?                 | **Non**, exclus du calcul (`nb_demi_journees`, calculé côté appli)                                                                                      |
| Anticipation sur solde non acquis ?      | **Oui**, via `solde_theorique` + `demandes_conges.is_anticipation`                                                                                      |
| CP reportables en fin de période ?       | **Oui** (période juin → mai) — d'après le commentaire du schéma                                                                                         |
| RTT reportables en fin de période ?      | **Non**, perdus en fin d'année civile — d'après le commentaire du schéma                                                                                |
| Ancienneté : date de référence           | **Toujours ouvert** — `anciennete_date_reference` existe mais le commentaire dit explicitement "à préciser avec Abeil"                                  |
| Temps partiel : calcul de solde          | **Toujours ouvert** — `type_contrat`/`taux_temps_partiel` modélisés, mais aucune formule de calcul encore posée                                         |
| Chevauchement d'une demande sur 2 années | **Pas explicitement traité** — `soldes` a une période par type/année ; le cas d'une demande à cheval sur deux périodes n'est pas visible dans le schéma |

À noter : ce cadrage est encore **WIP** (20/07/2026) — les réponses ci-dessus reflètent l'état du
schéma, pas une validation formelle avec Abeil.

## Comptes de test (Phase 0)

Trois profils insérés, liés à des comptes Supabase Auth existants (`auth_id`), avec des emails
factices `@abeil.local` (aucune donnée réelle) : `test-admin`, `test-manager`, `test-salarie` — ce
dernier rattaché au manager de test via `manager_salaries`, pour pouvoir tester le circuit de
validation une fois les policies en place.

## Branchement — état actuel

1. ~~Appliquer `supabase/schema.sql` sur le projet Supabase (`abeil-digital/Apidays`)~~ — fait.
2. ~~Variables d'environnement `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`~~ —
   fait (`.env.local` + Vercel Production/Preview/Development).
3. `lib/data/utilisateur.repository.ts` et `lib/data/demandes.repository.ts` parlent à Supabase
   (voir [projet.md](projet.md#bascule-vers-supabase--ce-qui-change-ce-qui-ne-change-pas)) — les
   composants et hooks n'ont pas changé. `soldes.repository.ts` reste mocké.
4. Les `id` (uuid) réels remplacent les identifiants mockés type `"d1"` pour les demandes issues de
   Supabase.
5. Authentification réelle via Supabase Auth (`proxy.ts`, page `/connexion`) — voir projet.md.
   Seul le rôle `salarie` a été exercé de bout en bout ; les policies manager/admin restent à
   valider une fois les espaces correspondants construits.
