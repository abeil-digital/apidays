import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase côté navigateur — utilisé par les repositories (lib/data/),
 * jamais directement par les hooks ou composants. Voir README.md > "Couche
 * données".
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes (voir .env.local).",
    );
  }

  return createBrowserClient(url, anonKey);
}
