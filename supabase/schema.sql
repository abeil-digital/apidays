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
create type type_contrat as enum ('temps_plein', 'temps_partiel');
create type type_absence_code as enum ('CP', 'RTT');
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
  -- un salarié peut être rattaché à un ou plusieurs managers via table de jointure
  -- (voir manager_salaries) plutôt qu'un simple manager_id, car plusieurs
  -- associés peuvent avoir le droit de validation
  date_entree date not null,
  type_contrat type_contrat not null default 'temps_plein',
  taux_temps_partiel numeric(4,2), -- ex: 0.80 pour 80%, null si temps plein
  anciennete_date_reference date, -- si différente de date_entree, à préciser avec Abeil
  statut statut_utilisateur not null default 'actif',
  date_archivage date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rattachement salarié <-> manager(s) habilité(s) à valider ses demandes
-- (plusieurs associés peuvent avoir le rôle de validation)
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
  libelle text not null
);

insert into types_absences (code, libelle) values
  ('CP', 'Congés payés'),
  ('RTT', 'RTT');

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
-- PARAMÉTRAGE ANNUEL (porté par le Manager)
-- RTT imposés vs libres, semaine du 15 août imposée, etc.
-- ------------------------------------------------------------
create table parametrage_periode (
  id uuid primary key default gen_random_uuid(),
  annee int not null unique,
  semaine_aout_imposee date not null, -- lundi de la semaine du 15 août
  defini_par uuid references utilisateurs(id),
  created_at timestamptz not null default now()
);

-- Dates de RTT imposées pour une période donnée (répartition mixte libre/imposé)
create table rtt_imposes (
  id uuid primary key default gen_random_uuid(),
  parametrage_periode_id uuid not null references parametrage_periode(id) on delete cascade,
  date date not null,
  demi_journee demi_journee not null default 'matin'
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
alter table rtt_imposes enable row level security;

-- ------------------------------------------------------------
-- PROFILS DE TEST (Phase 0) — liés aux comptes Supabase Auth
-- ------------------------------------------------------------
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

create policy "utilisateurs: manager lit les profils de son équipe"
  on utilisateurs for select
  using (my_role() = 'manager' and is_manager_of(id));

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

create policy "soldes: manager lit les soldes de son équipe"
  on soldes for select
  using (my_role() = 'manager' and is_manager_of(utilisateur_id));

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

create policy "demandes: manager lit les demandes de son équipe"
  on demandes_conges for select
  using (my_role() = 'manager' and is_manager_of(utilisateur_id));

create policy "demandes: manager valide/refuse les demandes de son équipe"
  on demandes_conges for update
  using (my_role() = 'manager' and is_manager_of(utilisateur_id));

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

create policy "jours_feries: admin modifie"
  on jours_feries for all
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

-- ------------------------------------------------------------
-- POLICIES — parametrage_periode & rtt_imposes (porté par le Manager)
-- ------------------------------------------------------------
create policy "parametrage_periode: lecture par tout utilisateur authentifié"
  on parametrage_periode for select
  using (auth.role() = 'authenticated');

create policy "parametrage_periode: manager et admin modifient"
  on parametrage_periode for all
  using (my_role() in ('manager', 'admin'))
  with check (my_role() in ('manager', 'admin'));

create policy "rtt_imposes: lecture par tout utilisateur authentifié"
  on rtt_imposes for select
  using (auth.role() = 'authenticated');

create policy "rtt_imposes: manager et admin modifient"
  on rtt_imposes for all
  using (my_role() in ('manager', 'admin'))
  with check (my_role() in ('manager', 'admin'));

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
  rtt_imposes
to authenticated;
