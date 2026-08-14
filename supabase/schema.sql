-- ============================================================
-- APIDAYS — Schéma de base de données (Phase 0)
-- Basé sur : Cadrage fonctionnel (WIP) - 20/07/2026
-- ============================================================
--
-- Ce fichier est la référence versionnée du schéma Supabase. Il n'est PAS
-- encore appliqué par le code de l'app — l'Espace Salarié actuel tourne
-- entièrement sur des données mockées (voir lib/data/mock/). Voir
-- BASE-DE-DONNEES.md pour le commentaire et projet.md pour le principe de
-- bascule (lib/data/*.repository.ts, un fichier à la fois, sans toucher à
-- l'UI).

-- ------------------------------------------------------------
-- TYPES ENUM
-- ------------------------------------------------------------
create type user_role as enum ('salarie', 'manager', 'admin');
create type statut_utilisateur as enum ('actif', 'archive');
create type type_contrat as enum ('temps_plein', 'temps_partiel'); -- déprécié, voir nature_contrat/taux_activite plus bas
create type nature_contrat as enum ('cdi', 'cdd', 'alternance', 'stage');
create type type_absence_code as enum ('CP', 'RTT', 'CSS', 'CE', 'RECUP', 'EVT_FAM', 'DJ_IMPOSEE', 'CP_IMPOSE');
create type demi_journee as enum ('matin', 'apres_midi');
create type statut_demande as enum ('en_attente', 'validee', 'refusee', 'annulee');

-- ------------------------------------------------------------
-- UTILISATEURS
-- ------------------------------------------------------------
create table utilisateurs (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete set null,
  prenom text not null,
  nom text not null,
  email text unique not null,
  role user_role not null default 'salarie',
  date_entree date not null,
  -- type_contrat / taux_temps_partiel : dépréciés au profit de nature_contrat /
  -- taux_activite ci-dessous (24/07/2026). Gardés en base pour l'instant, migration
  -- additive volontaire — pas de suppression ni de backfill forcé à ce stade. À
  -- retirer une fois nature_contrat renseigné sur tous les profils existants.
  type_contrat type_contrat not null default 'temps_plein',
  taux_temps_partiel numeric(4,2), -- ex: 0.80 pour 80%, null si temps plein
  nature_contrat nature_contrat, -- nullable : pas de valeur par défaut forcée sur les profils existants
  taux_activite numeric(5,2) default 100.00, -- pourcentage, 100 = temps plein (ex. 80, 50, 33.33)
  anciennete_date_reference date, -- si différente de date_entree, à préciser avec Abeil
  statut statut_utilisateur not null default 'actif',
  date_archivage date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "Manager" = directeur de l'entreprise, autorité globale sur toute
-- l'entreprise (pas une équipe rattachée) — cette table n'est donc plus
-- utilisée par les policies RLS. Conservée en base, sans donnée exploitée,
-- au cas où une notion de délégation plus fine (habilitation ponctuelle
-- d'un manager sur un sous-ensemble de salariés) reviendrait un jour.
create table manager_salaries (
  id uuid primary key default gen_random_uuid(),
  salarie_id uuid not null references utilisateurs(id) on delete cascade,
  manager_id uuid not null references utilisateurs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (salarie_id, manager_id)
);

-- Délégation temporaire du droit de validation
create table delegations_validation (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references utilisateurs(id) on delete cascade,
  delegataire_id uuid not null references utilisateurs(id) on delete cascade,
  date_debut date not null,
  date_fin date not null,
  created_at timestamptz not null default now()
);

-- Destinataires en copie des notifications de validation/refus d'un manager
create table copies_notifications (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references utilisateurs(id) on delete cascade,
  copie_utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (manager_id, copie_utilisateur_id)
);

-- ------------------------------------------------------------
-- TYPES D'ABSENCE
-- ------------------------------------------------------------
create table types_absences (
  id uuid primary key default gen_random_uuid(),
  code type_absence_code not null unique,
  libelle text not null,
  necessite_solde boolean not null default true -- false pour les types sans compteur (CSS, CE, RECUP, EVT_FAM, DJ_IMPOSEE)
);

insert into types_absences (code, libelle, necessite_solde) values
  ('CP', 'Congés payés', true),
  ('RTT', 'RTT', true),
  ('CSS', 'Congé sans solde', false),
  ('CE', 'Congé exceptionnel', false),
  ('RECUP', 'Récupération', false),
  ('EVT_FAM', 'Événement Familial', false),
  ('DJ_IMPOSEE', 'Demi-journée imposée', false),
  ('CP_IMPOSE', 'Congé payé imposé', false);
-- Pas de ligne "Congés anticipés" : c'est un CP posé avec is_anticipation=true
-- (voir demandes_conges.is_anticipation ci-dessous), pas un type distinct.
-- DJ_IMPOSEE catégorise demi_journees_imposees et CP_IMPOSE catégorise
-- conges_imposes (Paramétrer > Calendrier) — mécanismes indépendants des
-- soldes RTT/CP calculés dans Congés & RTT, jamais choisis par le salarié
-- dans "Nouvelle demande".

-- ------------------------------------------------------------
-- SOLDES — deux compteurs distincts, périodes de référence différentes
-- CP : juin -> mai (reportable en fin de période)
-- RTT : année civile (non reportable, perdu en fin de période)
-- ------------------------------------------------------------
create table soldes (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  type_absence_id uuid not null references types_absences(id),
  periode_debut date not null,
  periode_fin date not null,
  solde_reel numeric(5,2) not null default 0,      -- utilisable sur l'année en cours
  solde_theorique numeric(5,2) not null default 0, -- cumulé pour l'année N+1 (anticipation)
  updated_at timestamptz not null default now(),
  unique (utilisateur_id, type_absence_id, periode_debut)
);

-- Historique des ajustements manuels de solde par Delphine (traçabilité obligatoire)
create table historique_soldes (
  id uuid primary key default gen_random_uuid(),
  solde_id uuid not null references soldes(id) on delete cascade,
  ancien_solde_reel numeric(5,2) not null,
  nouveau_solde_reel numeric(5,2) not null,
  motif text not null,
  auteur_id uuid not null references utilisateurs(id), -- Delphine
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- DEMANDES DE CONGÉS
-- ------------------------------------------------------------
create table demandes_conges (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  type_absence_id uuid not null references types_absences(id),
  date_debut date not null,
  demi_debut demi_journee not null default 'matin',
  date_fin date not null,
  demi_fin demi_journee not null default 'apres_midi',
  nb_demi_journees numeric(5,1) not null, -- calculé côté appli, en jours fériés/weekends exclus
  statut statut_demande not null default 'en_attente',
  is_anticipation boolean not null default false, -- pose sur solde théorique N+1
  commentaire_salarie text,
  validateur_id uuid references utilisateurs(id),
  commentaire_decision text,
  date_decision timestamptz,
  -- dévalidation par Delphine d'une demande déjà validée (distincte de l'annulation
  -- par le salarié d'une demande en attente, qui passe par statut='annulee')
  devalidee_par uuid references utilisateurs(id),
  date_devalidation timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- JOURS FÉRIÉS
-- ------------------------------------------------------------
create table jours_feries (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  libelle text not null
);

-- ------------------------------------------------------------
-- PARAMÉTRAGE ANNUEL (porté par le Manager) — écran Paramétrer > Calendrier
-- Demi-journées imposées (DJ imposées), semaine du 15 août imposée, etc.
-- Le nombre cible de DJ (16) et le jour de semaine par défaut (vendredi)
-- sont des données de configuration, pas des valeurs figées en dur — voir
-- lib/joursFeries.ts et components/parametrer/CalendrierPage.tsx.
-- ------------------------------------------------------------
create table parametrage_periode (
  id uuid primary key default gen_random_uuid(),
  annee int not null unique,
  semaine_aout_imposee date not null, -- lundi de la semaine du 15 août, calculé automatiquement
  nb_demi_journees_cible int not null default 16, -- configurable, pas figé en dur
  jour_semaine_defaut int not null default 5, -- ISO : 1=lundi … 5=vendredi … 7=dimanche, configurable
  defini_par uuid references utilisateurs(id),
  created_at timestamptz not null default now(),
  valide_le timestamptz -- date de publication du paramétrage (visible par les collaborateurs) ; null = brouillon
);

-- Demi-journées imposées pour une période donnée — nomenclature "DJ imposées"
-- provisoire (à confirmer avec Delphine), catégorisées sous le type
-- DJ_IMPOSEE de types_absences, indépendant du solde RTT (regles_acquisition).
create table demi_journees_imposees (
  id uuid primary key default gen_random_uuid(),
  parametrage_periode_id uuid not null references parametrage_periode(id) on delete cascade,
  type_absence_id uuid not null references types_absences(id),
  date date not null,
  demi_journee demi_journee not null default 'matin'
);

-- Périodes de congés imposés (ex. semaine du 15 août) pour une période
-- donnée, catégorisées sous le type CP_IMPOSE de types_absences,
-- indépendant du solde CP (regles_acquisition).
create table conges_imposes (
  id uuid primary key default gen_random_uuid(),
  parametrage_periode_id uuid not null references parametrage_periode(id) on delete cascade,
  type_absence_id uuid not null references types_absences(id),
  date_debut date not null,
  date_fin date not null,
  -- Même sémantique que demandes.demi_debut/demi_fin : 'apres_midi' au
  -- début = la période démarre l'après-midi (matin travaillé) ; 'matin' à
  -- la fin = la période s'arrête le matin (après-midi travaillé). Un seul
  -- jour (date_debut = date_fin) avec demi_debut='apres_midi' et
  -- demi_fin='matin' correspondrait à une demi-journée nulle — géré côté
  -- appli, pas de contrainte en base pour l'instant.
  demi_debut demi_journee not null default 'matin',
  demi_fin demi_journee not null default 'apres_midi',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- MOTEUR DE CALCUL DES SOLDES (porté par le Manager)
-- Paramétrage générique, indépendant des règles spécifiques Abeil
-- (celles-ci restent dans parametrage_periode/demi_journees_imposees ci-dessus).
-- ------------------------------------------------------------
create table regles_acquisition (
  id uuid primary key default gen_random_uuid(),
  type_absence_id uuid not null references types_absences(id),
  periode_debut_mois int not null,  -- 1-12
  periode_debut_jour int not null,  -- 1-31
  taux_acquisition_mensuel numeric(5,2) not null,
  report_autorise boolean not null default false,
  anticipation_autorisee boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (type_absence_id)
);

-- Objectifs annuels de volume CPI/DJI, paramétrés depuis Congés & RTT et
-- consommés par l'écran Calendrier (cible affichée sur les pastilles de
-- progression CPI/DJI, condition de publication du paramétrage d'une année).
-- Une seule ligne (id fixe) — pas de table de paramètres génériques dans ce
-- projet, on garde le même schéma singleton que le seed ci-dessous.
create table objectifs_calendrier (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  cible_jours_cpi numeric(5,2) not null default 5,
  cible_demi_journees_dji int not null default 16,
  updated_at timestamptz not null default now()
);

insert into objectifs_calendrier (id) values ('00000000-0000-0000-0000-000000000001');

-- Jours supplémentaires selon l'ancienneté — rattaché aux CP uniquement
create table regles_anciennete (
  id uuid primary key default gen_random_uuid(),
  type_absence_id uuid not null references types_absences(id),
  seuil_annees int not null,
  jours_supplementaires numeric(4,1) not null,
  created_at timestamptz not null default now()
);

-- Régulation manuelle du solde par Delphine (Espace Suivre, feed d'historique
-- CP) — table indépendante de `soldes`/`historique_soldes` (non exploitées :
-- le solde est calculé à la volée par `soldes.repository.ts`, pas
-- matérialisé, voir CONTEXTE.md 13/08/2026). Un ajustement est un mouvement
-- de plus dans le feed, intégré au calcul du solde au même titre qu'une
-- demande validée. `delta_jours` peut être positif (recrédit) ou négatif
-- (correction à la baisse).
create table ajustements_solde (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  type_absence_id uuid not null references types_absences(id),
  delta_jours numeric(5,2) not null,
  motif text not null,
  auteur_id uuid not null references utilisateurs(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- INDEX UTILES
-- ------------------------------------------------------------
create index idx_demandes_utilisateur on demandes_conges(utilisateur_id);
create index idx_demandes_statut on demandes_conges(statut);
create index idx_demandes_dates on demandes_conges(date_debut, date_fin);
create index idx_soldes_utilisateur on soldes(utilisateur_id);
create index idx_manager_salaries_salarie on manager_salaries(salarie_id);
create index idx_manager_salaries_manager on manager_salaries(manager_id);
create index idx_ajustements_solde_utilisateur on ajustements_solde(utilisateur_id);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Activation sur toutes les tables, avec verrou par défaut :
-- personne n'a accès via les clés anon/authenticated tant que
-- les policies dédiées (étape suivante) ne sont pas écrites.
-- Le rôle "service_role" (utilisé côté serveur) contourne RLS
-- par défaut et n'est pas concerné par ce verrou.
-- ------------------------------------------------------------
alter table utilisateurs enable row level security;
alter table manager_salaries enable row level security;
alter table delegations_validation enable row level security;
alter table copies_notifications enable row level security;
alter table types_absences enable row level security;
alter table soldes enable row level security;
alter table historique_soldes enable row level security;
alter table demandes_conges enable row level security;
alter table jours_feries enable row level security;
alter table parametrage_periode enable row level security;
alter table demi_journees_imposees enable row level security;
alter table conges_imposes enable row level security;
alter table regles_acquisition enable row level security;
alter table ajustements_solde enable row level security;
alter table objectifs_calendrier enable row level security;
alter table regles_anciennete enable row level security;

-- ------------------------------------------------------------
-- PROFILS DE TEST (Phase 0) — liés aux comptes Supabase Auth
-- ------------------------------------------------------------
-- nature_contrat volontairement absent ici : ces profils ont été créés avant
-- l'ajout de la colonne (nullable, pas de backfill forcé) — voir plus haut.
insert into utilisateurs (auth_id, prenom, nom, email, role, date_entree, type_contrat)
values
  ('44268804-dff6-4d08-a23d-cb452dd83420', 'Delphine', 'Test', 'test-admin@abeil.local', 'admin', '2020-01-01', 'temps_plein'),
  ('66606200-df4a-4d46-b0ca-edb8cb36106e', 'Manager', 'Test', 'test-manager@abeil.local', 'manager', '2020-01-01', 'temps_plein'),
  ('d384a6da-c678-40e3-9c4a-8b9fb4bb84d9', 'Salarie', 'Test', 'test-salarie@abeil.local', 'salarie', '2023-01-01', 'temps_plein');

-- Rattache le salarié de test à son manager de test (pour tester le circuit
-- de validation dès que les policies seront écrites)
insert into manager_salaries (salarie_id, manager_id)
select s.id, m.id
from utilisateurs s, utilisateurs m
where s.email = 'test-salarie@abeil.local'
  and m.email = 'test-manager@abeil.local';

-- ------------------------------------------------------------
-- FONCTIONS UTILITAIRES (évitent la récursion RLS et les
-- sous-requêtes répétées dans chaque policy)
-- ------------------------------------------------------------
create or replace function my_utilisateur_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from utilisateurs where auth_id = auth.uid();
$$;

create or replace function my_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from utilisateurs where auth_id = auth.uid();
$$;

-- Plus utilisée par les policies (manager = directeur, autorité globale,
-- pas une équipe rattachée) — conservée au cas où une délégation plus fine
-- reviendrait un jour, voir manager_salaries.
create or replace function is_manager_of(p_salarie_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from manager_salaries ms
    where ms.salarie_id = p_salarie_id
      and ms.manager_id = my_utilisateur_id()
  );
$$;

-- ------------------------------------------------------------
-- POLICIES — utilisateurs
-- ------------------------------------------------------------
create policy "utilisateurs: lecture de son propre profil"
  on utilisateurs for select
  using (auth_id = auth.uid());

-- "Manager" désigne ici les directeurs de l'entreprise : autorité globale,
-- pas une équipe rattachée (voir manager_salaries, devenue sans objet pour
-- ce scope mais conservée en base).
create policy "utilisateurs: manager lit tous les profils"
  on utilisateurs for select
  using (my_role() = 'manager');

create policy "utilisateurs: admin lit tout"
  on utilisateurs for select
  using (my_role() = 'admin');

create policy "utilisateurs: admin crée les profils"
  on utilisateurs for insert
  with check (my_role() = 'admin');

create policy "utilisateurs: admin modifie les profils (dont archivage)"
  on utilisateurs for update
  using (my_role() = 'admin');

-- ------------------------------------------------------------
-- POLICIES — manager_salaries
-- ------------------------------------------------------------
create policy "manager_salaries: admin gère tout"
  on manager_salaries for all
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

create policy "manager_salaries: manager voit ses rattachements"
  on manager_salaries for select
  using (manager_id = my_utilisateur_id());

create policy "manager_salaries: salarié voit son rattachement"
  on manager_salaries for select
  using (salarie_id = my_utilisateur_id());

-- ------------------------------------------------------------
-- POLICIES — delegations_validation
-- ------------------------------------------------------------
create policy "delegations: manager gère ses propres délégations"
  on delegations_validation for all
  using (manager_id = my_utilisateur_id())
  with check (manager_id = my_utilisateur_id());

create policy "delegations: admin gère tout"
  on delegations_validation for all
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

create policy "delegations: délégataire voit ce qu'on lui a délégué"
  on delegations_validation for select
  using (delegataire_id = my_utilisateur_id());

-- ------------------------------------------------------------
-- POLICIES — copies_notifications
-- ------------------------------------------------------------
create policy "copies: manager gère ses propres copies"
  on copies_notifications for all
  using (manager_id = my_utilisateur_id())
  with check (manager_id = my_utilisateur_id());

create policy "copies: admin gère tout"
  on copies_notifications for all
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

-- ------------------------------------------------------------
-- POLICIES — types_absences (référentiel, lecture large)
-- ------------------------------------------------------------
create policy "types_absences: lecture par tout utilisateur authentifié"
  on types_absences for select
  using (auth.role() = 'authenticated');

create policy "types_absences: admin modifie"
  on types_absences for all
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

-- ------------------------------------------------------------
-- POLICIES — soldes
-- ------------------------------------------------------------
create policy "soldes: salarié lit son propre solde"
  on soldes for select
  using (utilisateur_id = my_utilisateur_id());

create policy "soldes: manager lit tous les soldes"
  on soldes for select
  using (my_role() = 'manager');

create policy "soldes: admin gère tout"
  on soldes for all
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

-- ------------------------------------------------------------
-- POLICIES — historique_soldes (traçabilité des ajustements, admin)
-- ------------------------------------------------------------
create policy "historique_soldes: admin gère tout"
  on historique_soldes for all
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

-- ------------------------------------------------------------
-- POLICIES — demandes_conges
-- ------------------------------------------------------------
create policy "demandes: salarié lit ses propres demandes"
  on demandes_conges for select
  using (utilisateur_id = my_utilisateur_id());

create policy "demandes: salarié crée ses propres demandes"
  on demandes_conges for insert
  with check (utilisateur_id = my_utilisateur_id());

create policy "demandes: salarié modifie une demande en attente"
  on demandes_conges for update
  using (utilisateur_id = my_utilisateur_id() and statut = 'en_attente')
  with check (utilisateur_id = my_utilisateur_id());

create policy "demandes: manager lit toutes les demandes"
  on demandes_conges for select
  using (my_role() = 'manager');

create policy "demandes: manager valide/refuse toutes les demandes"
  on demandes_conges for update
  using (my_role() = 'manager');

create policy "demandes: admin gère tout (dont dévalidation)"
  on demandes_conges for all
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

-- ------------------------------------------------------------
-- POLICIES — jours_feries (référentiel, lecture large)
-- ------------------------------------------------------------
create policy "jours_feries: lecture par tout utilisateur authentifié"
  on jours_feries for select
  using (auth.role() = 'authenticated');

create policy "jours_feries: manager et admin modifient"
  on jours_feries for all
  using (my_role() in ('manager', 'admin'))
  with check (my_role() in ('manager', 'admin'));

-- ------------------------------------------------------------
-- POLICIES — parametrage_periode & demi_journees_imposees (porté par le Manager)
-- ------------------------------------------------------------
create policy "parametrage_periode: lecture par tout utilisateur authentifié"
  on parametrage_periode for select
  using (auth.role() = 'authenticated');

create policy "parametrage_periode: manager et admin modifient"
  on parametrage_periode for all
  using (my_role() in ('manager', 'admin'))
  with check (my_role() in ('manager', 'admin'));

create policy "demi_journees_imposees: lecture par tout utilisateur authentifié"
  on demi_journees_imposees for select
  using (auth.role() = 'authenticated');

create policy "demi_journees_imposees: manager et admin modifient"
  on demi_journees_imposees for all
  using (my_role() in ('manager', 'admin'))
  with check (my_role() in ('manager', 'admin'));

create policy "conges_imposes: lecture par tout utilisateur authentifié"
  on conges_imposes for select
  using (auth.role() = 'authenticated');

create policy "conges_imposes: manager et admin modifient"
  on conges_imposes for all
  using (my_role() in ('manager', 'admin'))
  with check (my_role() in ('manager', 'admin'));

-- ------------------------------------------------------------
-- POLICIES — regles_acquisition & regles_anciennete (moteur de calcul,
-- porté par le Manager) — mêmes policies que parametrage_periode
-- ------------------------------------------------------------
create policy "regles_acquisition: lecture par tout utilisateur authentifié"
  on regles_acquisition for select
  using (auth.role() = 'authenticated');

create policy "regles_acquisition: manager et admin modifient"
  on regles_acquisition for all
  using (my_role() in ('manager', 'admin'))
  with check (my_role() in ('manager', 'admin'));

create policy "objectifs_calendrier: lecture par tout utilisateur authentifié"
  on objectifs_calendrier for select
  using (auth.role() = 'authenticated');

create policy "objectifs_calendrier: manager et admin modifient"
  on objectifs_calendrier for all
  using (my_role() in ('manager', 'admin'))
  with check (my_role() in ('manager', 'admin'));

create policy "regles_anciennete: lecture par tout utilisateur authentifié"
  on regles_anciennete for select
  using (auth.role() = 'authenticated');

create policy "regles_anciennete: manager et admin modifient"
  on regles_anciennete for all
  using (my_role() in ('manager', 'admin'))
  with check (my_role() in ('manager', 'admin'));

-- ------------------------------------------------------------
-- POLICIES — ajustements_solde (régulation manuelle, Delphine uniquement)
-- ------------------------------------------------------------
create policy "ajustements_solde: lecture manager et admin"
  on ajustements_solde for select
  using (my_role() in ('manager', 'admin'));

create policy "ajustements_solde: admin gère tout"
  on ajustements_solde for all
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

-- ------------------------------------------------------------
-- GRANTS — nécessaires en complément de RLS : RLS filtre les
-- LIGNES visibles, mais Postgres exige aussi les droits de base
-- sur la table pour le rôle. Sans ce GRANT, la requête est
-- bloquée avant même que les policies RLS ne s'appliquent.
-- ------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  utilisateurs,
  manager_salaries,
  delegations_validation,
  copies_notifications,
  types_absences,
  soldes,
  historique_soldes,
  demandes_conges,
  jours_feries,
  parametrage_periode,
  demi_journees_imposees,
  conges_imposes,
  regles_acquisition,
  regles_anciennete,
  objectifs_calendrier,
  ajustements_solde
to authenticated;
