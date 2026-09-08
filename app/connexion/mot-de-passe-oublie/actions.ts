"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/siteUrl";

export interface MotDePasseOublieState {
  envoye?: boolean;
}

/**
 * Retourne TOUJOURS { envoye: true }, que l'email corresponde à un compte
 * ou non — anti-énumération, ne jamais faire fuiter l'existence d'un
 * compte via ce formulaire (ni ici, ni côté UI).
 */
export async function demanderReinitialisation(
  _prevState: MotDePasseOublieState | undefined,
  formData: FormData,
): Promise<MotDePasseOublieState> {
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getSiteUrl()}/connexion/confirmer/recovery`,
  });

  return { envoye: true };
}
