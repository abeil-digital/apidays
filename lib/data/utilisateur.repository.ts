import type { Utilisateur } from "@/lib/types";
import { seedUtilisateur } from "@/lib/data/mock/utilisateur.mock";
import { simulateLatency } from "@/lib/data/mock/latency";

/**
 * Repository de l'utilisateur courant.
 *
 * Aujourd'hui : un seul utilisateur mocké (pas d'authentification réelle,
 * hors périmètre de cette étape). Le jour où l'auth est branchée, ce fichier
 * lira la session réelle — la signature `fetchUtilisateurCourant()` reste
 * identique.
 */

export async function fetchUtilisateurCourant(): Promise<Utilisateur> {
  await simulateLatency();
  return seedUtilisateur();
}
