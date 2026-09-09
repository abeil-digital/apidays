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
my_entreprise_id()` : `utilisateurs`, `manager_salaries`, `delegations_validation`,
`copies_notifications`, `soldes`, `historique_soldes`, `demandes_conges`, `decisions_demande`,
`parametrage_periode`, `demi_journees_imposees`, `conges_imposes`, `regles_acquisition`,
`regles_anciennete`, `faqs`, `ajustements_solde`, `historique_utilisateur`, `soldes_initiaux`,
`exports_paie`, `export_paie_lignes`.

**Correctif du 09/09/2026** : à l'origine (phase mono-tenant), ce `default` pointait vers l'uuid
Abeil en dur — "pont temporaire" censé permettre à toute requête applicative existante (aucune ne
passe `entreprise_id` explicitement) de continuer à fonctionner sans changement de code. En pratique
ce pont s'est révélé **cassé pour tout tenant autre qu'Abeil** : la première vraie utilisation d'un
second tenant ("test3") via l'UI a montré qu'écrire une FAQ, un objectif CPI/DJI, etc. échouait
systématiquement — chaque `INSERT` sans `entreprise_id` explicite tentait d'écrire l'uuid Abeil,
rejeté par la RLS `with check (entreprise_id = my_entreprise_id())` pour tout autre tenant. Corrigé
en remplaçant le `default` par la fonction `my_entreprise_id()` (`security definer stable`, déjà
utilisée pour la RLS elle-même) — la fonction doit être définie juste après la table `utilisateurs`
(dont elle dépend), donc AVANT toutes les autres tables de `supabase/schema.sql`, avec un
`alter table utilisateurs alter column entreprise_id set default my_entreprise_id();` séparé juste
après (chicken-and-egg : `utilisateurs` elle-même ne peut pas référencer la fonction dans sa propre
définition de colonne).

**Tables volontairement globales, sans `entreprise_id`** (décision actée avant de coder) :
`types_absences`, `jours_feries` — partagées par tous les tenants, plus simple pour démarrer ; un
tenant peut désactiver un type via une règle d'acquisition à zéro plutôt que via une table séparée.

**2 tables singleton devenues une ligne par tenant** — `id` fixe remplacé par `entreprise_id` comme
clé primaire : `objectifs_calendrier`, `parametrage_notifications`. Doivent être explicitement
seedées (une ligne) à la création d'un tenant — `creerTenant()` (`app/admin/actions.ts`) s'en charge
depuis le 09/09/2026 (absent initialement, provoquait "Impossible de charger…" pour tout nouveau
tenant tant qu'aucune ligne n'existait).

Leurs repositories (`lib/data/objectifsCalendrier.repository.ts`,
`lib/data/parametrageNotifications.repository.ts`) n'ont plus besoin de filtrer par un id fixe en
**lecture** — `.single()` suffit, la RLS restreint déjà à l'unique ligne du tenant courant. **Piège
sur l'`UPDATE`** (bug du 09/09/2026, corrigé le jour même) : la RLS scope bien la ligne, mais
PostgREST refuse tout `UPDATE`/`DELETE` sans clause `WHERE` explicite dans la requête — une garde
syntaxique indépendante de la RLS. Un `.update({...}).select().single()` sans `.eq(...)` ni
équivalent échoue donc avec `21000 "UPDATE requires a WHERE clause"`, quelle que soit la RLS. Les
deux repositories utilisent `.not("entreprise_id", "is", null)` (toujours vrai, colonne `NOT NULL`)
pour satisfaire cette exigence tout en laissant la RLS faire le vrai scoping — le client ne connaît
pas nécessairement `entreprise_id` pour poser un `.eq()` explicite.

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
`abeil-yellow`) — noms de rôle plutôt que d'apparence.

**Scope resserré au header + à la nav secondaire uniquement** (09/09/2026, correction — voir
plus bas) : `--color-slate`, encore utilisée pour la plupart des boutons/liens dans le reste de
l'app, n'est **pas** généralisée à la vraie charte (chantier séparé "Refacto & récap Design
System") — et depuis cette correction, **les titres/labels/montants du contenu de page ne le sont
plus non plus**, ils utilisent `text-ink-900` (noir générique) comme partout ailleurs.

- **Post-connexion** : `lib/data/branding.repository.ts` (`fetchBrandingCourant()`) lit
  `couleur_navy`/`couleur_yellow` via la session normale (RLS `entreprises`, `.single()` sans
  `.eq()` nécessaire — même principe singleton que les tables ci-dessus). `app/(app)/layout.tsx`
  (Server Component async) les passe à `AppShell.tsx`, qui les applique en variables CSS inline sur
  son conteneur racine — la cascade CSS atteint tous les descendants, mais **seuls `HeaderBar.tsx`
  (fond) et `SideNav.tsx`/`BottomNav.tsx` (icônes/état actif) consomment encore ces variables** ;
  le contenu de page (H1, labels, montants de solde...) a été délibérément désabonné.
- **Pré-connexion** : plus aucune page `/connexion/*` n'applique de couleur de tenant (seul le
  logo, voir "Logo" ci-dessous, y reste spécifique) — `/connexion` étant la seule à avoir jamais eu
  ce mécanisme (les 3 autres pages `/connexion/*` ne l'ont jamais eu), sa surcharge CSS
  `--color-brand-primary`/`--color-brand-accent` posée en `style` inline a été retirée avec ses
  derniers consommateurs.

**Correction du 09/09/2026** : en testant "test3" avec un header changé en orange, Vincent a
constaté que la couleur se propageait bien au-delà du header — H1, labels, montants de solde,
chevrons de menus déroulants (87 usages de `brand-primary`/`brand-accent` dans le code, dont
seulement 7 réellement dans `HeaderBar.tsx`/`SideNav.tsx`/`BottomNav.tsx`, tout le reste — 80
occurrences dans 20 fichiers de contenu — a été retiré). Un cas particulier : le bandeau de modale
`EnTeteModalNavy` (`UtilisateurFichePage.tsx`) utilisait `bg-brand-primary` pour son fond sombre ;
remplacé par `bg-slate` (déjà la couleur générique des boutons primaires), faute de fond sombre
générique déjà établi dans le codebase pour ce cas précis.

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

Sert principalement à savoir quoi afficher (logo/couleurs) sur la page de connexion **avant**
authentification, et — depuis le 09/09/2026 — à vérifier **à la connexion** que le compte utilisé
appartient bien au tenant affiché (voir "Vérification à la connexion" plus bas). **Ça ne va pas plus
loin que ça** : une fois connecté, la RLS (`entreprise_id = my_entreprise_id()`) scope déjà tout
correctement à partir du profil de la personne connectée, indépendamment de comment elle est
arrivée — aucune propagation du tenant dans les Server Actions/repositories n'a été nécessaire (une
reformulation par rapport à l'inventaire initial du chantier, qui redoutait ce point comme le plus
complexe).

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

### Vérification à la connexion

Sans ce contrôle, des identifiants valides pour le tenant A connectés depuis l'espace de connexion
du tenant B réussissaient quand même — la RLS empêchait bien toute fuite de données (l'utilisateur
atterrissait sur SON propre tenant, jamais celui affiché), mais rien n'empêchait d'"utiliser" la
page de connexion d'un tenant avec les identifiants d'un autre, ce qui n'a pas de sens logiquement
(remarque de Vincent).

`app/connexion/page.tsx` transmet le `slug` déjà résolu pour le branding à `login()`
(`app/connexion/actions.ts`) via un champ caché. Après authentification réussie, si un `slug` était
affiché, `login()` vérifie qu'il correspond à l'entreprise du compte (même principe RLS-scopé que
`fetchBrandingCourant()`) — sinon déconnexion immédiate et message dédié
("Ce compte n'appartient pas à cet espace de connexion."). Aucune vérification si `slug` absent
(`/connexion` nu, `/admin/connexion`) : aucun tenant précis n'a été affiché, rien à comparer.

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
  nom, slug, couleurs et logos optionnels (les 3 mêmes champs que `entreprises.logo_url*`),
  prénom/nom/email du premier admin. Crée `entreprises`, puis `utilisateurs` (`role: admin`,
  `date_entree` = aujourd'hui, `nature_contrat` laissé `null`, `taux_activite` garde son défaut DB),
  invite le premier admin par e-mail (voir "E-mails d'invitation brandés par tenant" ci-dessous).
  **Rollback best-effort** si la création de l'admin échoue après celle de l'entreprise (supprime
  `utilisateurs` puis `entreprises`, dans cet ordre — contrainte FK) : évite un tenant orphelin sans
  admin — un échec d'ENVOI de l'e-mail seul ne déclenche PAS ce rollback (voir plus bas).
- Pas d'édition d'un tenant existant depuis `/admin` aujourd'hui (repoussé, pas de besoin identifié
  avec un seul vrai client).
- **Suppression** (`app/admin/actions.ts`, `supprimerTenant`) : ajoutée après le premier test réel
  de création, pour nettoyer les tenants de test. Supprime les comptes `auth.users` de tous les
  utilisateurs du tenant, puis les lignes `utilisateurs`, puis `entreprises` (ordre imposé par la
  FK). Abeil protégée en dur — jamais supprimable depuis cet écran, même par erreur. Confirmation
  "haute" par popin (`components/admin/SupprimerTenantButton.tsx`) : il faut retaper le slug exact
  du tenant pour activer le bouton, pas un simple `window.confirm`.

## E-mails d'invitation brandés par tenant

**Le problème** : l'e-mail envoyé pour initialiser le compte d'un nouvel utilisateur (premier admin
d'un tenant, ou tout collaborateur invité ensuite via Paramétrer > Utilisateurs) était estampillé
Apidays/Abeil de bout en bout — adresse d'envoi, contenu, ET logo des pages
`/connexion/confirmer/*`/`/connexion/definir-mot-de-passe` sur lesquelles ce lien atterrit (ces
pages n'avaient volontairement pas été branded en Phase 4, seule `/connexion` elle-même l'était).
Le template natif Supabase Auth est unique pour tout le projet — pas possible de le faire varier
par tenant sans le remplacer.

**Mécanique** : `admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } })`
remplace `inviteUserByEmail` aux deux points d'appel (`app/admin/actions.ts` `creerTenant`,
`app/(app)/parametrer/utilisateurs/actions.ts` `inviterUtilisateur`) — crée le compte `auth.users`
identiquement, mais **sans envoyer d'e-mail**. `lib/resend/invitation.ts` (`envoyerInvitation`)
envoie le sien à la place, via Resend (déjà utilisé pour les notifications de demandes de congés,
`lib/resend/notifications.ts`) :
- Lien construit par l'app elle-même à partir de `properties.hashed_token` renvoyé par
  `generateLink` — jamais par le moteur de template Supabase (celui qui corrompt tout paramètre de
  requête au-delà du premier, voir commentaire `app/connexion/confirmer/[type]/page.tsx`), donc
  libre d'y ajouter `?slug=<slug>` en plus de `token_hash` sans risque.
- Logo du tenant (`logo_url_fond_clair`, converti en URL absolue si c'est un chemin `public/` — un
  `<img>` d'e-mail n'a pas de contexte d'origine, contrairement à l'app) ; pas de logo par défaut
  Abeil si le tenant n'en a pas configuré (jamais le logo d'un AUTRE tenant dans cet e-mail-là).
- **Domaine d'envoi dédié à la plateforme**, `notifications@apidays.citizen-d.fr` — distinct de
  `abeil-conges.citizen-d.fr` (notifications propres à Abeil, inchangé) : "abeil" n'a pas sa place
  dans l'adresse d'invitation d'un AUTRE tenant. Seul le domaine reste unique (vérification
  DKIM/SPF/DMARC par tenant non réaliste à ce stade) — le **nom d'expéditeur affiché** varie par
  tenant (ex. `"Mon Client" <notifications@apidays.citizen-d.fr>`). **Ce domaine doit être vérifié
  dans Resend (DNS) par Vincent avant de fonctionner** — sans ça, l'envoi échoue proprement (voir
  ci-dessous), rien à corriger côté code dans ce cas.

`slug` propagé jusqu'à `/connexion/definir-mot-de-passe` via `next` (`/auth/confirm` relaie déjà
`next` verbatim, inchangé) — `app/connexion/confirmer/[type]/page.tsx` et
`app/connexion/definir-mot-de-passe/page.tsx` appliquent le même mécanisme de branding par slug que
`/connexion` (`lib/data/brandingPublic.ts`, extrait de `app/api/branding-public/route.ts` pour être
aussi appelable directement depuis un Server Component).

**Tolérance à l'échec d'envoi** — différente selon le point d'appel :
- `creerTenant` (`/admin`) : le tenant/compte restent créés même si l'envoi échoue (Resend
  indisponible, domaine pas encore vérifié...) — supprimer un compte qui fonctionne à cause d'un
  e-mail non parti serait pire que le problème. Un avertissement (`CreerTenantState.avertissement`)
  s'affiche à la place du toast de succès sur `/admin`, pas de "renvoyer" pour l'instant (à ajouter
  si le besoin se confirme).
- `inviterUtilisateur` (Paramétrer > Utilisateurs) : comportement inchangé, un échec renvoie
  `{ ok: false }` — l'UI existante propose déjà "Renvoyer l'invitation".

**Hors scope, explicitement** : les e-mails de réinitialisation de mot de passe
(`resetPasswordForEmail`, self-service et depuis la fiche utilisateur) restent sur le template
Supabase par défaut — chantier séparé si besoin (même mécanisme réutilisable). La page
`/connexion/mot-de-passe-oublie` reste donc aussi non brandée (aucun `slug` n'y transite).

## Comment créer/tester un tenant

**Via `/admin`** (recommandé, remplace les scripts `service_role` utilisés pendant la construction
de ce chantier) :
1. Aller sur `/admin` (redirige vers `/admin/connexion`, la page de login dédiée, si pas encore
   connecté) et se connecter avec `vincent.mayol@gmail.com`.
2. Cliquer "Créer un tenant".
3. Renseigner nom, slug (lettres minuscules/chiffres/tirets), couleurs/logos optionnels, et
   prénom/nom/email du premier admin.
4. Le premier admin reçoit un e-mail d'invitation brandé à son nom (voir "E-mails d'invitation
   brandés par tenant" — nécessite `apidays.citizen-d.fr` vérifié dans Resend, sinon `/admin`
   affiche un avertissement mais le tenant/compte sont quand même créés) — il définit son mot de
   passe et arrive directement sur son tenant, isolé du reste.

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
- **Pas d'édition/désactivation d'un tenant existant depuis `/admin`** — repoussé faute de besoin
  identifié avec un seul vrai client.
- **`apidays.citizen-d.fr` pas encore vérifié dans Resend** — les e-mails d'invitation échouent
  proprement (`{ ok: false }`) tant que Vincent n'a pas ajouté les enregistrements DNS SPF/DKIM/DMARC
  fournis par Resend pour ce domaine (même chose que ce qui a dû être fait pour
  `abeil-conges.citizen-d.fr`). Testé en local en générant manuellement un lien
  (`admin.auth.admin.generateLink`) plutôt qu'en recevant un vrai e-mail —
  `RESEND_API_KEY` n'existe que sur Vercel, pas en local.
- **Réinitialisation de mot de passe non brandée** — `resetPasswordForEmail` (self-service et depuis
  la fiche utilisateur) reste sur le template Supabase par défaut, hors scope du chantier e-mails
  d'invitation (même mécanisme réutilisable si besoin).
- **Le `default` vers l'uuid Abeil sur les 19 colonnes `entreprise_id`** reste un pont temporaire.
  Il ne gêne rien tant que toute création de compte/ligne passe par un flux qui connaît déjà le bon
  tenant (RLS post-connexion, ou `service_role` explicite dans `app/admin/actions.ts`) — mais il ne
  faut jamais le lire comme "la valeur par défaut légitime d'un nouveau tenant", seulement comme un
  filet de compatibilité pour le code écrit avant ce chantier.
