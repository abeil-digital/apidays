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
