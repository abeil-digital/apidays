"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MESSAGE_POLITIQUE_MOT_DE_PASSE, respectePolitiqueMotDePasse } from "@/lib/passwordPolicy";

export interface DefinirMotDePasseState {
  error?: string;
}

/**
 * Écran commun à l'invitation (nouveau collaborateur) et au "mot de passe
 * oublié" — les deux flux posent une session temporaire via
 * `app/auth/confirm/route.ts` avant d'arriver ici, `updateUser` s'applique
 * donc directement à cette session (invitée ou en cours de récupération).
 */
export async function definirMotDePasse(
  _prevState: DefinirMotDePasseState | undefined,
  formData: FormData,
): Promise<DefinirMotDePasseState> {
  const motDePasse = String(formData.get("motDePasse") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!respectePolitiqueMotDePasse(motDePasse)) {
    return { error: MESSAGE_POLITIQUE_MOT_DE_PASSE };
  }
  if (motDePasse !== confirmation) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: motDePasse });

  if (error) {
    // Supabase distingue "nouveau mot de passe = ancien" (code
    // `same_password`) d'un vrai souci de session/lien — les deux
    // remontaient jusqu'ici sous le même message trompeur "lien invalide"
    // (08/09/2026, cas réel rencontré en test).
    if (error.code === "same_password") {
      return { error: "Le nouveau mot de passe doit être différent de l'ancien." };
    }
    return { error: "Le lien a expiré ou est invalide. Refaites une demande." };
  }

  redirect("/");
}
