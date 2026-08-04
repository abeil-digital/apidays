import type { SupabaseClient } from "@supabase/supabase-js";
import type { TypeDemande } from "@/lib/types";

/**
 * Table de référence `types_absences` (CP, RTT, CSS, CE, RECUP, EVT_FAM) —
 * mise en cache en mémoire, elle ne change pas en cours de session. Partagé
 * entre `demandes.repository.ts` et `reglesConges.repository.ts`, tous deux
 * ayant besoin de résoudre un code vers l'id `types_absences`.
 */
let typesAbsenceCache: Partial<Record<TypeDemande, string>> | null = null;

export async function getTypeAbsenceId(
  supabase: SupabaseClient,
  type: TypeDemande,
): Promise<string> {
  if (!typesAbsenceCache) {
    const { data, error } = await supabase.from("types_absences").select("id, code");
    if (error || !data) {
      throw new Error("Impossible de charger les types d'absence.");
    }
    typesAbsenceCache = Object.fromEntries(data.map((t) => [t.code, t.id]));
  }

  const id = typesAbsenceCache![type];
  if (!id) {
    throw new Error(`Type d'absence inconnu : ${type}`);
  }
  return id;
}
