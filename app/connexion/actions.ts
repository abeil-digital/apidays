"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/siteUrl";
import { cibleRedirectSure } from "@/lib/redirectSur";

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

  // Vérifie que le compte appartient bien au tenant affiché par la page de
  // connexion (09/09/2026) — sans ça, des identifiants valides pour le
  // tenant A connectés depuis l'espace de connexion du tenant B
  // réussissaient quand même (la RLS empêche bien toute fuite de données
  // une fois connecté, mais atterrir malgré tout dans SON PROPRE tenant
  // après avoir "utilisé" l'espace d'un autre est trompeur — remarque de
  // Vincent). `slug` absent (`/connexion` sans sous-domaine/chemin, ou
  // `/admin/connexion`, qui ne pose jamais ce champ) ⇒ aucune vérification,
  // aucun tenant précis n'a été affiché.
  const slug = String(formData.get("slug") ?? "").trim();
  if (slug) {
    const { data: entreprise } = await supabase.from("entreprises").select("slug").single();
    if (entreprise?.slug !== slug) {
      await supabase.auth.signOut();
      return { error: "Ce compte n'appartient pas à cet espace de connexion." };
    }
  }

  // `next` (08/09/2026) : renvoie vers la destination d'origine (ex. lien de
  // notification email) plutôt que toujours l'Accueil — voir `proxy.ts`.
  // Revalidé ici, même origine uniquement (`cibleRedirectSure`, 28/09/2026 —
  // corrige une redirection ouverte, `next` restant un champ de formulaire
  // modifiable côté client) même si `proxy.ts` l'a déjà posé.
  const next = String(formData.get("next") ?? "");
  redirect(cibleRedirectSure(next, await getSiteUrl()));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
