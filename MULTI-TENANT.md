# Apidays — Multi-tenant

Référence du chantier multi-tenant (livré le 09/09/2026, voir CONTEXTE.md pour le détail
chronologique de chaque étape et les décisions prises avec Vincent au fil de l'eau). Ce document
explique comment le système fonctionne aujourd'hui et comment le tester ; le fichier
[`supabase/schema.sql`](supabase/schema.sql) fait foi pour le détail SQL exact.

## Principe général

Un seul projet Supabase, une seule app Next.js, plusieurs entreprises clientes ("tenants") isolées
par ligne (`entreprise_id`) plutôt que par base de données séparée. Aujourd'hui, **Abeil est le seul
tenant réel** (`c52b18b8-73b0-403c-990c-b2b4894acb92`, slug `abeil`) — tout le reste (branding par
tenant, résolution par sous-domaine, onboarding) est construit et testé avec des tenants de test
jetables, créés puis supprimés en fin de vérification.

L'isolation des données repose entièrement sur la RLS (Row Level Security) Postgres — pas sur du
filtrage côté application. Un salarié Abeil ne voit jamais les données d'un autre tenant non pas
parce que le code le lui interdit, mais parce que la base de données elle-même ne lui renvoie que
ses propres lignes.

## Schéma

### Table `entreprises`

Une ligne par tenant :

```sql
create table entreprises (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  couleur_navy text not null default '#001e32',
  couleur_yellow text not null default '#ebc850',
  slug text not null default 'abeil' unique,
  logo_url text,               -- logo header (fond navy), null = fallback Abeil
  logo_url_fond_clair text,    -- logo pages /connexion (fond clair), null = fallback Abeil
  logo_url_signe text,         -- petit signe SideNav, null = fallback Abeil
  created_at timestamptz not null default now()
);
```

### `entreprise_id` sur les tables métier

19 tables portent une colonne `entreprise_id uuid not null references entreprises(id) default
'<uuid Abeil>'` : `utilisateurs`, `manager_salaries`, `delegations_validation`,
`copies_notifications`, `soldes`, `historique_soldes`, `demandes_conges`, `decisions_demande`,
`parametrage_periode`, `demi_journees_imposees`, `conges_imposes`, `regles_acquisition`,
`regles_anciennete`, `faqs`, `ajustements_solde`, `historique_utilisateur`, `soldes_initiaux`,
`exports_paie`, `export_paie_lignes`.

Le `default` vers l'uuid Abeil est un **pont temporaire, assumé** : il permet à toute requête
applicative existante (aucune ne passe `entreprise_id` explicitement) de continuer à fonctionner
sans changement — la RLS filtre automatiquement sur l'entreprise déduite de la session, comme elle
filtre déjà par rôle. Sans ce défaut, la moindre requête d'écriture depuis du code qui ne connaît
pas encore la notion de tenant échouerait sur la contrainte `not null`.

**Tables volontairement globales, sans `entreprise_id`** (décision actée avant de coder) :
`types_absences`, `jours_feries` — partagées par tous les tenants, plus simple pour démarrer ; un
tenant peut désactiver un type via une règle d'acquisition à zéro plutôt que via une table séparée.

**2 tables singleton devenues une ligne par tenant** — `id` fixe remplacé par `entreprise_id` comme
clé primaire : `objectifs_calendrier`, `parametrage_notifications`. Leurs repositories
(`lib/data/objectifsCalendrier.repository.ts`, `lib/data/parametrageNotifications.repository.ts`)
n'ont plus besoin de filtrer par un id fixe — `.single()` suffit, la RLS restreint déjà à l'unique
ligne du tenant courant.

## RLS — isolation des données

Helper au même principe que `my_role()`/`my_utilisateur_id()` (déjà en place avant ce chantier) :

```sql
create or replace function my_entreprise_id()
returns uuid
language sql security definer stable
set search_path = public
as $$
  select entreprise_id from utilisateurs where auth_id = auth.uid();
$$;
```

Les 63 policies RLS pré-existantes ont toutes été réécrites pour ajouter `and entreprise_id =
my_entreprise_id()` à leur clause `using`/`with check`. Exemple représentatif :

```sql
create policy "demandes: salarié lit ses propres demandes"
  on demandes_conges for select
  using (utilisateur_id = my_utilisateur_id() and entreprise_id = my_entreprise_id());
```

`entreprises` elle-même n'a qu'**une seule policy**, en lecture :

```sql
create policy "entreprises: lecture de sa propre entreprise"
  on entreprises for select
  using (id = my_entreprise_id());
```

Aucune policy INSERT/UPDATE/DELETE sur `entreprises` — créer ou modifier un tenant n'est possible
que via `service_role` (bypass RLS), jamais depuis une session normale, quel que soit le rôle.
C'est délibéré : créer un tenant est un acte platform-level, pas un acte d'un admin d'entreprise
(voir "Super-admin & onboarding" plus bas).

## `service_role` — points de contournement RLS, et leur sécurisation

`service_role` (client `lib/supabase/admin.ts`, `createAdminClient()`) bypass entièrement la RLS —
y compris le filtre `entreprise_id`. Chaque endroit qui l'utilise doit donc filtrer manuellement.
Points identifiés et sécurisés :

| Fichier | Usage | Comment il filtre |
| --- | --- | --- |
| `lib/resend/destinataires.ts` | Résout les destinataires d'un email de notification | `resolverDestinataires(entrepriseId)` — paramètre obligatoire |
| `lib/data/notificationsDemandes.actions.ts` | Notifie une nouvelle demande / décision | Fetch la `demande` d'abord (avec son `entreprise_id`), l'utilise pour scoper la suite |
| `app/api/cron/notifications-digest/route.ts` | Digest hebdo (tourne sans session, `CRON_SECRET`) | Boucle sur **toutes** les entreprises en `hebdomadaire`, chacune traitée indépendamment (`traiterDigestEntreprise`) |
| `app/(app)/parametrer/utilisateurs/actions.ts` | Invitation/sync email d'un utilisateur | N'accède qu'à l'API Auth (jamais une table `public.*` avec ce client) |
| `app/admin/actions.ts` (`creerTenant`) | Création d'un tenant + premier admin | `assertSuperAdmin()` revérifié avant tout accès — voir plus bas |

## Branding par tenant

### Couleurs

`--color-brand-primary`/`--color-brand-accent` (tokens `app/globals.css`, ex-`abeil-navy`/
`abeil-yellow`) — noms de rôle plutôt que d'apparence. Scope volontairement réduit à ces 2 tokens :
`--color-slate`, encore utilisée pour la plupart des boutons/liens dans le reste de l'app, n'est
**pas** encore généralisée à la vraie charte (chantier séparé "Refacto & récap Design System").

- **Post-connexion** : `lib/data/branding.repository.ts` (`fetchBrandingCourant()`) lit
  `couleur_navy`/`couleur_yellow` via la session normale (RLS `entreprises`, `.single()` sans
  `.eq()` nécessaire — même principe singleton que les tables ci-dessus). `app/(app)/layout.tsx`
  (Server Component async) les passe à `AppShell.tsx`, qui les applique en variables CSS inline sur
  son conteneur racine — la cascade CSS fait le reste, tous les descendants héritent sans code
  supplémentaire.
- **Pré-connexion** (page `/connexion` uniquement, pas les 3 autres pages `/connexion/*`) : la RLS
  ne peut rien renvoyer avant authentification, d'où une route publique dédiée,
  `app/api/branding-public/route.ts`, en `service_role` — voir "Résolution par sous-domaine"
  ci-dessous, qui explique comment elle sait quel tenant demander.

### Logo

3 colonnes nullables (`logo_url`, `logo_url_fond_clair`, `logo_url_signe`), une par usage réel dans
l'app (header fond navy, pages `/connexion` fond clair, signe SideNav). `null` ⇒ fallback sur le
fichier Abeil en dur (`/logo-abeil.svg`, `/logo-abeil-fond-clair.png`, `/abeil-signe.png`). **URL
saisie à la main**, pas de Supabase Storage (première utilisation potentielle dans ce projet, non
justifiée pour un seul tenant réel) — un logo peut pointer vers un fichier déposé dans `public/`
(servi automatiquement par Vercel, comme les logos Abeil actuels) ou une image hébergée ailleurs.
Même mécanique de propagation que les couleurs (`AppShell.tsx` → `HeaderBar`/`SideNav` en props ;
`branding-public` → page de connexion).

## Résolution du tenant par sous-domaine ou par chemin

Sert à une seule chose : savoir quoi afficher (logo/couleurs) sur la page de connexion **avant**
authentification. **Ça ne va pas plus loin** — une fois connecté, la RLS
(`entreprise_id = my_entreprise_id()`) scope déjà tout correctement à partir du profil de la
personne connectée, indépendamment de comment elle est arrivée. Aucune propagation du tenant dans
les Server Actions/repositories n'a été nécessaire (une reformulation par rapport à l'inventaire
initial du chantier, qui redoutait ce point comme le plus complexe).

`entreprises.slug` (unique) identifie le tenant. `app/api/branding-public/route.ts` résout le slug
de deux façons, qui coexistent sans conflit (la seconde n'empêche pas de basculer sur la première
plus tard, une fois un vrai domaine configuré) :

- **Sous-domaine** — premier label de l'en-tête `Host` (`abeil` dans `abeil.mondomaine.fr`), retombe
  sur `abeil` pour localhost/le domaine Vercel nu. Demande un vrai domaine + DNS wildcard configurés
  côté Vercel (pas possible sur `apidays-seven.vercel.app` tel quel) — DNS/Vercel pas encore
  configurés, Phase 0.
- **Chemin** (`/t/<slug>`, 09/09/2026) — `app/t/[slug]/route.ts` redirige vers
  `/connexion?slug=<slug>`, que la page de connexion transmet à `/api/branding-public`. Utilisable
  dès aujourd'hui sans domaine dédié. Namespace `/t/` dédié plutôt qu'un slug à la racine (ex.
  `/abeil`) — choix explicite avec Vincent pour ne jamais entrer en collision avec une route réelle
  de l'app (`/suivre`, `/parametrer`, `/admin`...), pas de liste de slugs réservés à maintenir. Pas
  de vérification que le slug existe dans la route `/t/[slug]` elle-même — la résolution (et le
  fallback Abeil si inconnu) reste entièrement dans `branding-public/route.ts`.

Dans les deux cas, `branding-public/route.ts` ne répond jamais que pour LE tenant demandé (jamais
une liste) — exposer publiquement la liste des clients via une policy RLS ouverte n'a jamais été
envisagé.

## Super-admin & onboarding d'un tenant

### Le problème

Aucun rôle (`salarie`/`manager`/`admin`) n'a d'autorité au-dessus d'une seule entreprise — tous
scopés à leur propre `entreprise_id` par la RLS, `entreprises` n'a aucune policy d'écriture. Créer
un tenant est un acte platform-level, structurellement différent d'un acte d'admin d'entreprise.

### Le statut super-admin

Table séparée, **pas** une 4ᵉ valeur de l'enum `role` :

```sql
create table super_admins (
  auth_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
```

Orthogonal à `utilisateurs`/`entreprise_id`/`role` — une personne peut être à la fois salariée
d'une entreprise (avec un solde de congés, etc.) ET super-admin de la plateforme, sans lien entre
les deux statuts. C'est le cas de Vincent : son compte `vincent.mayol@gmail.com` a un profil
`utilisateurs` normal chez Abeil (rôle `salarie`, pour poser ses propres congés) et, en plus,
figure dans `super_admins`.

Aucune policy INSERT/UPDATE/DELETE sur `super_admins` — accorder/retirer ce statut reste un acte
manuel via SQL (même niveau de confiance que la création d'un tenant elle-même), pas une
fonctionnalité de l'app.

**Premier et seul super-admin aujourd'hui** : `vincent.mayol@gmail.com`.

### L'écran `/admin`

- Gate à deux niveaux : `proxy.ts` redirige vers `/` tout compte authentifié non super-admin
  visitant `/admin/*` (première ligne de défense côté route) ; `lib/supabase/superAdmin.ts`
  (`assertSuperAdmin()`) revérifie systématiquement au tout début de chaque page/Server Action qui
  va utiliser `service_role` — jamais de confiance aveugle en `proxy.ts` seul, même rigueur que la
  sécurisation des points RLS-bypass ci-dessus.
- Layout minimal (`app/admin/layout.tsx`), sans `AppShell` — écran platform-level, pas de branding
  tenant.
- **Page de connexion dédiée** : `app/admin/connexion/page.tsx`, distincte de `/connexion` —
  `proxy.ts` y redirige tout visiteur non connecté sur `/admin/*` (plutôt que vers `/connexion`).
  Se connecter à l'espace super-admin via un écran estampillé du logo/couleurs d'un tenant (Abeil
  aujourd'hui) n'a pas de sens logiquement — remarque de Vincent en testant. Réutilise le même
  Server Action `login()` (l'authentification reste unique dans l'app), habillage neutre hérité du
  layout ci-dessus (bandeau "Administration — Apidays", pas de logo ni de couleurs de tenant).
- `app/admin/page.tsx` : liste en lecture des tenants existants (nom, slug, date de création,
  nombre d'utilisateurs).
- `app/admin/nouveau/page.tsx` + `app/admin/actions.ts` (`creerTenant`) : formulaire de création —
  nom, slug, couleurs optionnelles, prénom/nom/email du premier admin. Crée `entreprises`, puis
  `utilisateurs` (`role: admin`, `date_entree` = aujourd'hui, `nature_contrat` laissé `null`,
  `taux_activite` garde son défaut DB), invite le premier admin par email (même route de
  confirmation que l'invitation existante, `app/connexion/confirmer/invite`). **Rollback
  best-effort** si une étape échoue après la création de l'entreprise (supprime `utilisateurs` puis
  `entreprises`, dans cet ordre — contrainte FK) : évite un tenant orphelin sans admin.
- Pas de champ logo dans le formulaire (reste réglable par SQL, comme les couleurs peuvent aussi
  l'être directement en base si besoin). Pas d'édition d'un tenant existant depuis `/admin`
  aujourd'hui (repoussé, pas de besoin identifié avec un seul vrai client).
- **Suppression** (`app/admin/actions.ts`, `supprimerTenant`) : ajoutée après le premier test réel
  de création, pour nettoyer les tenants de test. Supprime les comptes `auth.users` de tous les
  utilisateurs du tenant, puis les lignes `utilisateurs`, puis `entreprises` (ordre imposé par la
  FK). Abeil protégée en dur — jamais supprimable depuis cet écran, même par erreur. Confirmation
  "haute" par popin (`components/admin/SupprimerTenantButton.tsx`) : il faut retaper le slug exact
  du tenant pour activer le bouton, pas un simple `window.confirm`.

## Comment créer/tester un tenant

**Via `/admin`** (recommandé, remplace les scripts `service_role` utilisés pendant la construction
de ce chantier) :
1. Aller sur `/admin` (redirige vers `/admin/connexion`, la page de login dédiée, si pas encore
   connecté) et se connecter avec `vincent.mayol@gmail.com`.
2. Cliquer "Créer un tenant".
3. Renseigner nom, slug (lettres minuscules/chiffres/tirets), couleurs optionnelles, et
   prénom/nom/email du premier admin.
4. Le premier admin reçoit un email d'invitation (même parcours que "Créer un profil" dans
   Paramétrer > Utilisateurs) — il définit son mot de passe et arrive directement sur son tenant,
   isolé du reste.

**Pour vérifier l'isolation** : se connecter avec le compte du nouveau tenant, confirmer qu'aucune
donnée Abeil n'apparaît (soldes, demandes, calendrier, paramétrages tous vides/propres à ce
tenant).

**Pour voir le branding pré-connexion d'un tenant** (pas besoin de sous-domaine, ni en local ni en
prod) : aller sur `/t/<slug-du-tenant>` — redirige vers `/connexion` avec son logo/couleurs
appliqués. `http://localhost:3000/api/branding-public?slug=<slug>` renvoie directement le JSON si
besoin de vérifier juste la résolution, sans passer par l'écran.

**Pour nettoyer un tenant de test** : depuis `/admin`, cliquer l'icône de suppression sur sa ligne
et retaper son slug dans la popin de confirmation — supprime les comptes `auth.users`, les lignes
`utilisateurs` et la ligne `entreprises`, dans le bon ordre.

## Limites connues, volontairement hors scope aujourd'hui

- **Pas de DNS/Vercel réel configuré pour le sous-domaine** — reste simulé en local (en-tête `Host`
  forcé) tant qu'un vrai domaine n'existe pas ; à faire par Vincent le moment venu. Sans impact sur
  l'usage réel aujourd'hui : `/t/<slug>` (résolution par chemin) fonctionne déjà en prod sans domaine
  dédié.
- **`--color-slate` pas encore branding-able** — dépend du chantier séparé "Refacto & récap Design
  System" (Backlog).
- **Pas de vérification post-connexion d'un mismatch sous-domaine/tenant** — un utilisateur du
  tenant A qui se connecte depuis le sous-domaine du tenant B verrait quand même ses propres
  données (la RLS s'en assure), juste sans que l'app ne le prévienne du mismatch. Confort, pas un
  problème de sécurité — pas testable de toute façon sans un vrai 2ᵉ sous-domaine.
- **Pas d'édition/désactivation d'un tenant existant depuis `/admin`** — repoussé faute de besoin
  identifié avec un seul vrai client.
- **Le `default` vers l'uuid Abeil sur les 19 colonnes `entreprise_id`** reste un pont temporaire.
  Il ne gêne rien tant que toute création de compte/ligne passe par un flux qui connaît déjà le bon
  tenant (RLS post-connexion, ou `service_role` explicite dans `app/admin/actions.ts`) — mais il ne
  faut jamais le lire comme "la valeur par défaut légitime d'un nouveau tenant", seulement comme un
  filet de compatibilité pour le code écrit avant ce chantier.
