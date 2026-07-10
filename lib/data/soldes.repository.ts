import type { Soldes } from "@/lib/types";
import { seedSoldes } from "@/lib/data/mock/soldes.mock";
import { simulateLatency } from "@/lib/data/mock/latency";

/**
 * Repository des soldes de congés/RTT.
 *
 * Valeurs fixes pour l'instant : les règles de calcul réel (ancienneté,
 * demi-journées, temps partiel...) restent à valider avec Abeil. Le jour où
 * elles le sont, seul ce fichier change (calcul ou appel Supabase) — pas les
 * composants qui consomment `useSoldes`.
 */

export async function fetchSoldes(): Promise<Soldes> {
  await simulateLatency();
  return seedSoldes();
}
