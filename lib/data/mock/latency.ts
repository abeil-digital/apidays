/**
 * Simule la latence réseau d'un vrai appel API, pour que les hooks aient déjà
 * la bonne forme (état `loading`) le jour où les repositories parlent à Supabase.
 */
export function simulateLatency(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
