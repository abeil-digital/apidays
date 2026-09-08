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
 */
export async function resolverDestinataires(): Promise<DestinatairesNotification> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("utilisateurs")
    .select("email, role")
    .in("role", ["manager", "admin"])
    .eq("statut", "actif");

  if (error || !data) return { managers: [], administrateurs: [] };

  return {
    managers: data.filter((u) => u.role === "manager").map((u) => u.email),
    administrateurs: data.filter((u) => u.role === "admin").map((u) => u.email),
  };
}
