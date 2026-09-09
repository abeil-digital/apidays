import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé service_role — bypass RLS. Jamais importé
 * depuis un composant client ni un fichier sans "use server" : la clé
 * serait exposée au bundle navigateur. Utilisable uniquement depuis des
 * Server Actions/Route Handlers. `server-only` fait planter le build en
 * cas d'import côté client.
 *
 * Utilisé pour l'appel Admin API d'invitation/synchronisation d'email
 * (`app/(app)/parametrer/utilisateurs/actions.ts` — n'importe quelle table
 * `public.*` y passe par le client de session normal, RLS active) et pour
 * les notifications email/le cron de digest (`lib/data/
 * notificationsDemandes.actions.ts`, `app/api/cron/notifications-digest`,
 * `lib/resend/destinataires.ts`), qui lisent des tables scopées par
 * entreprise pour le compte d'un salarié sans droit RLS de les consulter —
 * **chaque appelant y filtre alors explicitement par `entreprise_id`**
 * (09/09/2026, fondations multi-tenant : `service_role` contourne aussi ce
 * filtre-là, contrairement à une requête RLS normale).
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
