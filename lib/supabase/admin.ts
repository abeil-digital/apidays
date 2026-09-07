import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé service_role — bypass RLS. Jamais importé
 * depuis un composant client ni un fichier sans "use server" : la clé
 * serait exposée au bundle navigateur. Utilisable uniquement depuis des
 * Server Actions/Route Handlers. `server-only` fait planter le build en
 * cas d'import côté client. Usage volontairement limité à l'appel Admin
 * API d'invitation (`inviterUtilisateur`) — tout le reste (y compris la
 * mise à jour de `utilisateurs.auth_id`) passe par le client de session
 * normal, RLS active.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
