import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DestinatairesNotification {
  managers: string[];
  administrateurs: string[];
}

/**
 * Résolution des destinataires des notifications de demande de congé.
 * Utilise le client service_role : le déclencheur (création d'une demande)
 * tourne pour le compte d'un salarié, qui n'a pas le droit RLS de lire les
 * profils manager/admin.
 *
 * `entrepriseId` obligatoire (09/09/2026, fondations multi-tenant) —
 * `service_role` contourne totalement la RLS/`entreprise_id`, donc sans ce
 * filtre explicite cette fonction remonterait les managers/admins de
 * TOUTES les entreprises, pas seulement celle de la demande à l'origine de
 * l'appel. Voir Backlog "sécuriser les points RLS-bypass".
 */
export async function resolverDestinataires(
  entrepriseId: string,
): Promise<DestinatairesNotification> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("utilisateurs")
    .select("email, role")
    .eq("entreprise_id", entrepriseId)
    .in("role", ["manager", "admin"])
    .eq("statut", "actif");

  if (error || !data) return { managers: [], administrateurs: [] };

  return {
    managers: data.filter((u) => u.role === "manager").map((u) => u.email),
    administrateurs: data.filter((u) => u.role === "admin").map((u) => u.email),
  };
}
