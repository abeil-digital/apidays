"use server";

import { assertSuperAdmin } from "@/lib/supabase/superAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/siteUrl";
import { todayISO } from "@/lib/format";

export interface CreerTenantInput {
  nom: string;
  slug: string;
  couleurNavy?: string;
  couleurJaune?: string;
  prenomAdmin: string;
  nomAdmin: string;
  emailAdmin: string;
}

export interface CreerTenantState {
  ok: boolean;
  erreur?: string;
}

const REGEX_SLUG = /^[a-z0-9-]+$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Abeil = seul tenant réel aujourd'hui (`supabase/schema.sql`) — jamais
// supprimable depuis cet écran, même par erreur.
const ID_ABEIL = "c52b18b8-73b0-403c-990c-b2b4894acb92";

/**
 * Crée un tenant (`entreprises`) + son premier admin (`utilisateurs`,
 * invité via Supabase Auth) — 09/09/2026, flux d'onboarding, remplace les
 * scripts `service_role` jetables utilisés jusqu'ici pour les tenants de
 * test. `assertSuperAdmin()` revérifie l'autorité avant tout accès
 * `service_role` (même rigueur que la sécurisation des points RLS-bypass
 * du chantier multi-tenant) — `proxy.ts` n'est qu'une première ligne de
 * défense côté route.
 *
 * Best-effort de nettoyage si la création de l'admin ou l'invitation
 * échoue après que l'entreprise a été créée : supprime la ligne
 * `entreprises` pour éviter un tenant orphelin. Pas une vraie transaction
 * (le reste de l'app n'en utilise pas non plus), juste évite
 * l'incohérence la plus probable.
 */
export async function creerTenant(input: CreerTenantInput): Promise<CreerTenantState> {
  await assertSuperAdmin();

  const nom = input.nom.trim();
  const slug = input.slug.trim().toLowerCase();
  const prenomAdmin = input.prenomAdmin.trim();
  const nomAdmin = input.nomAdmin.trim();
  const emailAdmin = input.emailAdmin.trim();

  if (!nom || !slug || !prenomAdmin || !nomAdmin || !emailAdmin) {
    return { ok: false, erreur: "champs_manquants" };
  }
  if (!REGEX_SLUG.test(slug)) {
    return { ok: false, erreur: "slug_invalide" };
  }
  if (!REGEX_EMAIL.test(emailAdmin)) {
    return { ok: false, erreur: "email_invalide" };
  }

  const admin = createAdminClient();

  const entrepriseInsert: Record<string, string> = { nom, slug };
  if (input.couleurNavy) entrepriseInsert.couleur_navy = input.couleurNavy;
  if (input.couleurJaune) entrepriseInsert.couleur_yellow = input.couleurJaune;

  const { data: entreprise, error: erreurEntreprise } = await admin
    .from("entreprises")
    .insert(entrepriseInsert)
    .select("id")
    .single();

  if (erreurEntreprise || !entreprise) {
    if (erreurEntreprise?.code === "23505") {
      return { ok: false, erreur: "slug_deja_utilise" };
    }
    return { ok: false, erreur: "creation_entreprise_echouee" };
  }

  const { data: utilisateur, error: erreurUtilisateur } = await admin
    .from("utilisateurs")
    .insert({
      entreprise_id: entreprise.id,
      prenom: prenomAdmin,
      nom: nomAdmin,
      email: emailAdmin,
      role: "admin",
      date_entree: todayISO(),
      statut: "actif",
    })
    .select("id")
    .single();

  if (erreurUtilisateur || !utilisateur) {
    await admin.from("entreprises").delete().eq("id", entreprise.id);
    if (erreurUtilisateur?.code === "23505") {
      return { ok: false, erreur: "email_deja_utilise" };
    }
    return { ok: false, erreur: "creation_admin_echouee" };
  }

  const redirectTo = `${await getSiteUrl()}/connexion/confirmer/invite`;
  const { data: invite, error: erreurInvite } = await admin.auth.admin.inviteUserByEmail(
    emailAdmin,
    { redirectTo, data: { prenom: prenomAdmin, adminPrenom: "L'équipe Apidays" } },
  );

  if (erreurInvite || !invite.user) {
    await admin.from("utilisateurs").delete().eq("id", utilisateur.id);
    await admin.from("entreprises").delete().eq("id", entreprise.id);
    return { ok: false, erreur: "invite_echouee" };
  }

  const { error: erreurLiaison } = await admin
    .from("utilisateurs")
    .update({ auth_id: invite.user.id })
    .eq("id", utilisateur.id);

  if (erreurLiaison) {
    await admin.from("utilisateurs").delete().eq("id", utilisateur.id);
    await admin.from("entreprises").delete().eq("id", entreprise.id);
    return { ok: false, erreur: "liaison_echouee" };
  }

  return { ok: true };
}

export interface SupprimerTenantState {
  ok: boolean;
  erreur?: string;
}

/**
 * Supprime un tenant de test et son(ses) compte(s) — 09/09/2026, ajouté
 * après le premier test réel de `creerTenant` (Vincent a besoin de
 * nettoyer ce qu'il crée). `assertSuperAdmin()` revérifié comme partout
 * ailleurs dans ce fichier. Abeil (seul tenant réel) est protégée en dur —
 * jamais supprimable depuis cet écran.
 *
 * Ordre imposé par la contrainte FK `utilisateurs.entreprise_id` (pas de
 * `on delete cascade`) : les comptes `auth.users` puis les lignes
 * `utilisateurs` avant la ligne `entreprises`.
 */
export async function supprimerTenant(entrepriseId: string): Promise<SupprimerTenantState> {
  await assertSuperAdmin();

  if (entrepriseId === ID_ABEIL) {
    return { ok: false, erreur: "abeil_protegee" };
  }

  const admin = createAdminClient();

  const { data: utilisateurs } = await admin
    .from("utilisateurs")
    .select("id, auth_id")
    .eq("entreprise_id", entrepriseId);

  for (const u of utilisateurs ?? []) {
    if (u.auth_id) {
      await admin.auth.admin.deleteUser(u.auth_id);
    }
  }

  await admin.from("utilisateurs").delete().eq("entreprise_id", entrepriseId);

  const { error } = await admin.from("entreprises").delete().eq("id", entrepriseId);

  if (error) {
    return { ok: false, erreur: "suppression_echouee" };
  }

  return { ok: true };
}
