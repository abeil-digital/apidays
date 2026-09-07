"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface InviterUtilisateurState {
  ok: boolean;
  erreur?: string;
}

/**
 * Appelée juste après `creerUtilisateurAdmin` (insert `public.utilisateurs`,
 * toujours côté navigateur/anon — inchangé) et depuis le bouton "Renvoyer
 * l'invitation" en vue fiche. Invite le collaborateur via l'API Admin
 * (service_role) puis relie `auth_id` sur la ligne déjà créée avec le
 * client de session normal de l'admin connecté (RLS "utilisateurs: admin
 * modifie les profils") — le service_role reste cantonné au seul appel
 * qui l'exige réellement.
 */
export async function inviterUtilisateur(
  utilisateurId: string,
  email: string,
): Promise<InviterUtilisateurState> {
  const admin = createAdminClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/connexion/confirmer/invite`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (error || !data.user) {
    return { ok: false, erreur: "invite_echouee" };
  }

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("utilisateurs")
    .update({ auth_id: data.user.id })
    .eq("id", utilisateurId);

  if (updateError) {
    return { ok: false, erreur: "liaison_echouee" };
  }

  return { ok: true };
}

/**
 * Bouton "Envoyer un lien de réinitialisation" en vue fiche (07/09/2026) —
 * complète le "Renvoyer l'invitation" ci-dessus : celui-ci ne s'affiche que
 * tant que le compte n'a jamais été activé (`auth_id` vide), celui-là une
 * fois activé (le collaborateur a déjà un mot de passe à réinitialiser).
 * Même client anon que le parcours self-service
 * (`app/connexion/mot-de-passe-oublie/actions.ts`) — pas besoin du
 * service_role ici, `resetPasswordForEmail` est une opération publique par
 * conception. Contrairement au flux self-service, pas d'anti-énumération à
 * observer : l'admin sait déjà que ce compte existe.
 */
export async function envoyerLienReinitialisation(email: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/connexion/confirmer/recovery`,
  });
  return { ok: !error };
}
