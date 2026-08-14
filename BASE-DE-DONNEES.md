# Apidays — Base de données (Supabase)

Schéma cible pour la persistance réelle, conçu en parallèle du front (Espace Salarié). Le SQL
versionné dans [`supabase/schema.sql`](supabase/schema.sql) est appliqué au projet Supabase
`abeil-digital/Apidays`, et les repositories `demandes`, `utilisateur` et `soldes` y sont branchés
(voir [README.md](README.md), section "Couche données"). `soldes.repository.ts` calcule le solde à
la volée (pas de lecture/écriture de la table `soldes` elle-même) à partir de
`regles_acquisition`/`regles_anciennete` et des demandes décidées — formule actée avec Vincent
(pas via `documentation-conges/`, toujours non dépouillé), détaillée dans CONTEXTE.md
(13/08/2026). Ce document explique le schéma ; le fichier `.sql` fait foi pour le détail exact.

Basé sur le cadrage fonctionnel (WIP, 20/07/2026) — certains points restent à confirmer avec
Abeil, signalés plus bas.

## Vue d'ensemble

| Table                    | Rôle                                                                                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utilisateurs`           | Salarié·es, managers (= directeurs, autorité globale), admin (Delphine) — un seul compte peut porter plusieurs rôles au sens large de l'app, mais `role` est unique par ligne                                                                             |
| `manager_salaries`       | Rattachement salarié ↔ manager — **non exploitée par les policies RLS actuelles** (les managers sont les directeurs, autorité globale sur toute l'entreprise, pas une équipe rattachée), conservée au cas où une délégation plus fine reviendrait un jour |
| `delegations_validation` | Délégation temporaire du droit de validation (absence d'un manager)                                                                                                                                                                                       |
| `copies_notifications`   | Destinataires en copie des mails de validation/refus d'un manager                                                                                                                                                                                         |
| `types_absences`         | Référentiel des types d'absence — CP, RTT, 4 types sans compteur de solde (CSS, CE, RECUP, EVT_FAM), DJ_IMPOSEE et CP_IMPOSE                                                                                                                              |
| `soldes`                 | Solde réel + théorique, par utilisateur, par type d'absence, par période — **non exploitée**, le solde est calculé à la volée par `soldes.repository.ts` (voir plus bas)                                                                                  |
| `historique_soldes`      | Traçabilité des ajustements manuels de solde par Delphine — **non exploitée**, couplée à `soldes` (`solde_id`) donc inutilisable telle quelle avec le calcul à la volée ; voir `ajustements_solde` ci-dessous, sa remplaçante en usage réel               |
| `ajustements_solde`      | Régulation manuelle du solde CP par Delphine (Espace Suivre) — indépendante de `soldes`/`historique_soldes`, intégrée au calcul comme un mouvement de plus (13/08/2026)                                                                                   |
| `demandes_conges`        | Les demandes elles-mêmes — dates, statut, décision, dévalidation                                                                                                                                                                                          |
| `jours_feries`           | Référentiel des jours fériés (utilisé pour exclure du décompte, et écran Paramétrer > Calendrier)                                                                                                                                                         |
| `parametrage_periode`    | Paramétrage annuel porté par le Manager — semaine du 15 août imposée, nombre cible et jour de semaine par défaut des DJ imposées                                                                                                                          |
| `demi_journees_imposees` | Demi-journées imposées (DJ imposées) pour une période donnée — indépendant du solde RTT calculé dans Congés & RTT                                                                                                                                         |
| `conges_imposes`         | Périodes de congés imposés (ex. semaine du 15 août) pour une période donnée — indépendant du solde CP calculé dans Congés & RTT                                                                                                                           |
| `regles_acquisition`     | Moteur de calcul générique CP/RTT — période de référence, taux d'acquisition/mois, report, anticipation (une ligne par type d'absence)                                                                                                                    |
| `regles_anciennete`      | Jours supplémentaires selon l'ancienneté, rattachés aux CP uniquement, plusieurs règles non cumulables (la plus favorable s'applique)                                                                                                                     |

## Points de modélisation notables

- **"Manager" = directeur de l'entreprise** (08/2026) : les managers ont une autorité globale sur
  toute l'entreprise, pas une équipe rattachée. `manager_salaries` (rattachement salarié ↔ manager)
  n'est donc plus exploitée par les policies RLS — un manager lit/valide les demandes, soldes et
  profils de tout le monde, à l'instar de l'admin en lecture (l'écriture sur les profils reste
  admin-only). La table et la fonction `is_manager_of()` restent en base, inutilisées, au cas où
  une délégation plus fine reviendrait un jour.
- **Deux compteurs par solde** (`solde_reel` / `solde_theorique`) : le réel est utilisable tout de
  suite, le théorique est le cumul en cours pour l'année suivante — une demande peut être posée en
  anticipation dessus (`demandes_conges.is_anticipation`).
- **Demi-journées** : `demi_debut` / `demi_fin` (matin/après-midi) sur les demandes — les congés ne
  se posent donc pas uniquement en jours pleins.
- **`devalidee_par` / `date_devalidation` : colonnes prévues mais finalement pas utilisées**
  (14/08/2026) — l'intention initiale était de distinguer "dévalidation d'une demande validée" de
  "annulation d'une demande en attente" via deux mécanismes séparés. En construisant la
  régularisation d'Export paie (voir CONTEXTE.md), le choix final a été de réutiliser
  `statut = 'annulee'` pour les deux cas (mêmes colonnes de décision que valider/refuser :
  `validateur_id`, `commentaire_decision`, `date_decision`) plutôt que d'ajouter un chemin dédié
  pour un cas rare — plus simple à tracer (un seul jeu de colonnes de décision) au prix de perdre la
  distinction sémantique fine. Les colonnes `devalidee_par`/`date_devalidation` restent en base,
  inutilisées.
- **`nb_demi_journees` est calculé côté application**, pas en base — le commentaire du schéma
  précise "jours fériés/weekends exclus".
- **Contrat en deux dimensions indépendantes** : `nature_contrat` (CDI/CDD/Alternance/Stage) et
  `taux_activite` (pourcentage, 100 = temps plein, ex. 80, 50, 33.33), qui remplacent à terme
  l'ancien `type_contrat`/`taux_temps_partiel` (binaire temps plein/partiel). **Migration additive
  volontaire (24/07/2026)** : les deux anciennes colonnes restent en base pour l'instant, pas de
  suppression ni de backfill forcé — `nature_contrat` est donc `null` sur les profils créés avant
  ce champ (l'app l'affiche "Non précisé" et le complète dès la première modification du profil).
  Nettoyage (suppression des anciennes colonnes, `not null` + défaut sur `nature_contrat`) à faire
  une fois tous les profils repassés en édition.
- **Moteur de calcul CP/RTT paramétrable, indépendant des règles Abeil** : `regles_acquisition`
  (upsert par type d'absence, contrainte `unique(type_absence_id)`) porte la période de référence
  (mois/jour de début), le taux d'acquisition mensuel, le report et l'anticipation — générique, pas
  spécifique à Abeil. Les règles propres à Abeil (demi-journées imposées, semaine du 15 août
  imposée) sont dans `parametrage_periode`/`demi_journees_imposees`, traitées dans l'écran
  Paramétrer > Calendrier (voir ci-dessous). `regles_anciennete` ne concerne que les CP ; plusieurs
  règles peuvent coexister mais ne se cumulent pas entre elles côté métier (seule la plus favorable
  s'applique — logique portée par l'application, pas contrainte en base).
- **Demi-journées imposées (DJ imposées), indépendantes du solde RTT** (05/08/2026) : écran
  Paramétrer > Calendrier, deux vues — "Année en cours" (lecture seule + correction ponctuelle
  d'une DJ mal saisie) et "Paramétrage année à venir" (sélection des vendredis de l'année + ajout
  libre de dates hors vendredi, figée par un bouton "Valider" qui remplace intégralement les lignes
  `demi_journees_imposees` de la période). Catégorisées sous le code technique `DJ_IMPOSEE` de
  `types_absences` (`necessite_solde = false`) — **volontairement indépendant du moteur
  `regles_acquisition`** : le nombre de RTT disponible (paramétré dans Congés & RTT) et le nombre de
  DJ imposées (paramétré dans Calendrier) sont deux compteurs distincts qui ne se recoupent pas en
  base. Le nombre cible de DJ (16 par défaut) et le jour de semaine par défaut (vendredi, ISO 5)
  sont des colonnes de configuration sur `parametrage_periode`
  (`nb_demi_journees_cible`/`jour_semaine_defaut`), pas des valeurs figées en dur — la nomenclature
  "DJ imposées" elle-même reste provisoire, à confirmer avec Delphine. Jours fériés légaux calculés
  côté app (`lib/joursFeries.ts`, incluant Pâques mobile) et pré-remplis sur demande dans
  `jours_feries`, avec ajout manuel possible (ex. lundi de Pentecôte) ; policy RLS élargie à
  manager+admin (auparavant admin seul).
- **Types d'absence étendus au-delà de CP/RTT** (04/08/2026) : `types_absences.necessite_solde`
  (booléen, défaut `true`) distingue les types adossés à un compteur de solde (CP, RTT) des 4 types
  "hors compteur" ajoutés — CSS (congé sans solde), CE (congé exceptionnel), RECUP (récupération),
  EVT_FAM (événement familial) — qui n'ont ni ligne `soldes` ni règle d'acquisition, mais restent
  visibles dans les demandes pour le contrôle mensuel de Delphine. **"Congés anticipés" n'est pas un
  type d'absence distinct** : c'est un CP (`type_absence_code = 'CP'`) posé avec
  `demandes_conges.is_anticipation = true`, qui consomme `soldes.solde_theorique` au lieu de
  `solde_reel` — affiché côté UI avec un badge "CPT" pour le distinguer visuellement d'un CP
  classique (voir `components/demandes/TypeBadge.tsx`).

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

Logique générale des policies : chacun lit ses propres données ; un manager (= directeur, autorité
globale) lit/valide celles de toute l'entreprise ; l'admin (Delphine) a un accès large sur tout, y
compris l'écriture sur les profils. Les tables
référentielles (`types_absences`, `jours_feries`, `parametrage_periode`, `rtt_imposes`,
`regles_acquisition`, `regles_anciennete`) sont en lecture ouverte à tout utilisateur authentifié,
modification réservée à manager/admin selon la table.

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
| Temps partiel : calcul de solde          | **Tranché (13/08/2026)** — `taux_activite` proratise le taux d'acquisition mensuel CP/RTT                                                               |
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
   composants et hooks n'ont pas changé. `soldes.repository.ts` calcule désormais le solde réel à
   la volée (13/08/2026, voir CONTEXTE.md pour la formule).
4. Les `id` (uuid) réels remplacent les identifiants mockés type `"d1"` pour les demandes issues de
   Supabase.
5. Authentification réelle via Supabase Auth (`proxy.ts`, page `/connexion`) — voir projet.md.
6. Premier écran de l'Espace Delphine — Paramétrer > Gestion des utilisateurs
   (`lib/data/utilisateurs.repository.ts`, `/parametrer/utilisateurs`) — exerce pour la première
   fois les policies `manager`/`admin` sur `utilisateurs` en conditions réelles : admin voit/gère
   tout, manager voit tout le monde en lecture seule (les policies `insert`/`update` sont
   admin-only — une tentative de création/modification par un manager échoue proprement côté UI).
   Accès route bloqué pour `salarie` dans `proxy.ts`.
