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
| `historique_utilisateur` | Historique des changements de `taux_activite`/`nature_contrat` (21/08/2026) — une ligne par changement avec `date_effet`, pour prorater le calcul de solde mois par mois sans recalcul rétroactif |
| `soldes_initiaux`        | Report de la dernière fiche de paie à la création d'un salarié (21/08/2026) — une ligne par utilisateur (upsert), remplace le report/accrual automatique tant que la période en cours est celle de la date de référence saisie |
| `exports_paie`           | Transmission paie (Suivre > Clôture paie, 24/08/2026) — un enregistrement par clic sur "Transmettre", une seule transmission par période (`exports_paie_periode_unique`)                                                       |
| `export_paie_lignes`     | Ledger de transmission (24/08/2026) — combien de jours d'une demande sont partis dans quel export, avec son propre statut (`transmis`/`en_paye`/`ecart`) ; `jours_inclus` peut être négatif (ligne de correction)              |

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
- **Historisation `taux_activite`/`nature_contrat` + solde initial (21/08/2026)** — deux tables
  additives, détail complet (mécanique de calcul, bugs découverts/corrigés, questions encore
  ouvertes) dans CONTEXTE.md à cette date :
  - `historique_utilisateur` (une ligne par changement, `date_effet` distincte de `created_at`) —
    remplace le recalcul rétroactif plat par une proratisation **mois par mois** du calcul de
    solde (`resolverTauxActiviteEffectif`, `soldes.repository.ts`). `utilisateurs.cree_par_id`
    (auto-référence, nullable) ajoutée en parallèle, `null` sur les profils existants.
  - `soldes_initiaux` (une ligne par utilisateur, `unique(utilisateur_id)`, upsert) — report de la
    dernière fiche de paie à la création d'un profil, corrigeable ensuite ; remplace le
    report/accrual automatiquement calculé tant que la période en cours est celle de la date de
    référence saisie.
  - **RLS des deux tables** (et de `ajustements_solde`, préexistante) élargie à
    `my_role() in ('manager','admin') or utilisateur_id = my_utilisateur_id()` — sans ce `or`, un
    salarié consultant SON PROPRE solde (Accueil, self-service) ne peut pas lire ses propres lignes
    (RLS filtre silencieusement, pas d'erreur), et voit un solde différent de celui affiché à un
    manager/admin pour la même personne sur "Suivre les soldes".
  - **Piège PostgREST à retenir** : un embed de jointure sur une **auto-référence** (`utilisateurs`
    référençant `utilisateurs` via `cree_par_id`) peut se résoudre dans le mauvais sens (l'enfant
    qui référence la ligne plutôt que la ligne référencée), y compris en nommant explicitement la
    contrainte FK en hint. Contournement retenu : requête séparée plutôt qu'embed pour ce cas
    précis (`fetchNomUtilisateur`, `utilisateurs.repository.ts`).
- **Transmission paie — deux statuts orthogonaux, jamais confondus** (24/08/2026, `exports_paie`/
  `export_paie_lignes`, écran Suivre > Clôture paie) :
  - **Statut de décision** (`demandes_conges.statut` : `en_attente`/`validee`/`refusee`/`annulee`)
    — répond à "ce congé a-t-il été accordé ?". Inchangé, c'est le statut historique de l'app.
  - **Statut de transmission** — répond à "ce congé a-t-il été envoyé à la paie, et le comptable
    l'a-t-il confirmé ?". Ne vit **pas** sur `demandes_conges` (pas de colonne `statut_transmission`
    dessus) mais sur une table de ledger séparée, `export_paie_lignes`, une ligne par "tranche"
    envoyée. Raison : un congé à cheval sur deux périodes de paie (ex. 26/08 → 03/09) peut être
    transmis **en plusieurs fois** — 2 jours sur l'export d'août, les 4 restants sur celui de
    septembre — chaque tranche évoluant ensuite indépendamment (`transmis` → `en_paye`/`ecart`). Un
    champ unique sur la demande ne peut pas porter deux statuts différents pour la même demande en
    même temps.
  - **"Solde de transmission" d'une demande** = somme de tous ses `export_paie_lignes.jours_inclus`
    (toutes tranches confondues). Pour une demande validée, `nb_demi_journees/2 - solde_transmission`
    donne le reliquat encore à transmettre (0 = intégralement transmise). C'est ce calcul, **sans
    aucun filtre de date**, qui pilote l'onglet "Quels congés transmettre" — un congé validé un mois
    donné mais jamais transmis remonte automatiquement le mois suivant, quelle que soit sa date de
    prise (corrige un bug de la première version de l'écran, qui filtrait par `date_debut` dans la
    période et perdait les congés à cheval/de période précédente).
  - **Génération d'un export** (`genererExportPaie`, `lib/data/exportsPaie.repository.ts`) : pour
    chaque congé validé avec un reliquat, si sa date de fin tombe **avant ou dans** la période
    exportée, tout le reliquat part d'un coup (rattrapage complet — aucun futur export ne le
    réclamerait sinon) ; s'il déborde sur le mois suivant, seule la portion jusqu'à la fin de la
    période part maintenant, le reste attend le prochain export. Un congé dont la date de début est
    **après** la fin de la période exportée n'est jamais inclus (pas encore dû) — évite qu'un congé
    déjà validé pour un mois futur soit transmis en avance.
  - **Correction après transmission** : régulariser (annuler) une demande déjà transmise ne modifie
    **jamais** les lignes déjà créées (trace d'audit immuable — un export généré reflète exactement
    ce qui a été envoyé au comptable à l'époque). À la place, le prochain export généré ajoute une
    **ligne négative** (`jours_inclus = -solde_transmission`) qui ramène son solde de transmission à
    0, matérialisée dans le récap comme une correction distincte.
  - **Aucun impact sur les soldes CP/RTT/CPA** — volontaire. Le calcul du solde (`soldes.repository.ts`)
    filtre uniquement sur `demandes_conges.statut = 'validee'`, jamais sur `export_paie_lignes` : un
    congé décompte le solde du salarié dès sa validation, indépendamment de son statut de
    transmission. "Transmis"/"En paye"/"Écart" ne sont que le suivi de la communication avec le
    comptable (est-ce que ce qui est sur la fiche de paie correspond à ce qui a été validé dans
    l'app), pas un second decompte de solde.
  - **3 statuts de transmission possibles** sur une ligne (`statut_transmission` enum) :
    - `transmis` — valeur par défaut à la création de la ligne, posée par le clic "Transmettre".
    - `en_paye` — une fois la fiche de paie reçue vérifiée conforme (`validerCheckPaie`, action "Ça
      matche"/"OK" dans l'onglet "Vérifier les fiches de paie").
    - `ecart` — si la fiche de paie ne correspond pas (`signalerEcart`, avec `motif_ecart`
      obligatoire) ; reste visible/traçable, ne bloque rien côté solde.
  - **"Poser pour un collaborateur"** (`poserCongePourCollaborateur`) : seule façon de créer une
    demande déjà `validee` sans passer par le circuit normal (salarié pose → manager décide) — pour
    un oubli de saisie ou une correction ponctuelle repérée par Delphine. `commentaire_decision`
    trace "Ajouté par {prénom} {nom}", visible dans l'historique du salarié concerné (transparence
    voulue, pas de ligne cachée). N'affecte pas la mécanique de transmission différemment d'une
    demande posée normalement — une fois `validee`, elle entre dans le même calcul de solde de
    transmission que n'importe quelle autre.

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
