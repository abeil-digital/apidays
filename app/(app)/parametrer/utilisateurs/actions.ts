"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/siteUrl";

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
 *
 * `prenom` (le nouveau collaborateur) est transmis en `data` d'invitation
 * (08/09/2026) pour personnaliser l'email ("Bienvenue {{ .Data.prenom }}")
 * — le prénom de l'admin à l'origine de l'invitation ("Contactez
 * {{ .Data.adminPrenom }}") est résolu ici via la session en cours, pas
 * passé en paramètre par l'appelant.
 */
export async function inviterUtilisateur(
  utilisateurId: string,
  email: string,
  prenom: string,
): Promise<InviterUtilisateurState> {
  // Ne jamais laisser une exception remonter jusqu'à l'appelant (07/09/2026,
  // corrigé le 08/09/2026 après un cas réel en prod) — le profil
  // `utilisateurs` est déjà créé au moment où cette fonction est appelée
  // (voir `Formulaire.handleSubmit`) ; si `createAdminClient()` ou l'appel
  // Admin API plante (ex. `SUPABASE_SERVICE_ROLE_KEY` absente en prod),
  // l'appelant doit recevoir un échec propre `{ ok: false }` pour afficher
  // "profil créé, invitation à renvoyer" — pas une exception qui ferait
  // croire à un échec total de la création.
  try {
    const supabase = await createClient();
    const {
      data: { user: adminAuthUser },
    } = await supabase.auth.getUser();
    const { data: adminProfil } = adminAuthUser
      ? await supabase
          .from("utilisateurs")
          .select("prenom")
          .eq("auth_id", adminAuthUser.id)
          .single()
      : { data: null };

    const admin = createAdminClient();
    const redirectTo = `${await getSiteUrl()}/connexion/confirmer/invite`;

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { prenom, adminPrenom: adminProfil?.prenom ?? "l'administrateur" },
    });

    if (error || !data.user) {
      return { ok: false, erreur: "invite_echouee" };
    }

    const { error: updateError } = await supabase
      .from("utilisateurs")
      .update({ auth_id: data.user.id })
      .eq("id", utilisateurId);

    if (updateError) {
      return { ok: false, erreur: "liaison_echouee" };
    }

    return { ok: true };
  } catch {
    return { ok: false, erreur: "invite_echouee" };
  }
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
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await getSiteUrl()}/connexion/confirmer/recovery`,
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
