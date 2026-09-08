"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
}

export async function login(
  _prevState: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }

  // `next` (08/09/2026) : renvoie vers la destination d'origine (ex. lien de
  // notification email) plutôt que toujours l'Accueil — voir `proxy.ts`.
  // Revalidé ici (chemin relatif uniquement) même si `proxy.ts` l'a déjà
  // posé, `next` restant un champ de formulaire modifiable côté client.
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
