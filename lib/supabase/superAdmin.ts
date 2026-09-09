import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Vérifie que l'utilisateur courant a le statut super-admin (09/09/2026,
 * flux d'onboarding d'un tenant, table `super_admins` — voir
 * `supabase/schema.sql`), lève sinon. Appelée au tout début de `/admin`
 * (Server Component) ET du Server Action `creerTenant` — même rigueur que
 * la sécurisation des points `service_role` (chantier multi-tenant,
 * "sécuriser les 5 points RLS-bypass") : ne jamais faire confiance
 * uniquement à `proxy.ts` pour un point d'entrée qui va utiliser
 * `createAdminClient()`, revérifier ici.
 */
export async function assertSuperAdmin(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non authentifié.");
  }

  const { data } = await supabase
    .from("super_admins")
    .select("auth_id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!data) {
    throw new Error("Accès réservé aux super-admins.");
  }
}
