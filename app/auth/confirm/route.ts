import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Point d'atterrissage partagé des liens envoyés par email (invitation
 * collaborateur ET "mot de passe oublié") — Supabase pose une session
 * temporaire via `verifyOtp` (type "invite" ou "recovery" selon le lien),
 * puis on redirige vers `next` (par défaut `/connexion/definir-mot-de-passe`,
 * même écran pour les deux flux). Dépend d'une config manuelle côté
 * dashboard Supabase (templates email pointant ici avec `token_hash`/`type`,
 * voir CONTEXTE.md) — rien de tout ça n'est versionné dans ce dépôt.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/connexion?erreur=lien_invalide`);
}
