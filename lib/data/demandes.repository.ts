import type { Demande, NouvelleDemandeInput } from "@/lib/types";
import { seedDemandes } from "@/lib/data/mock/demandes.mock";
import { simulateLatency } from "@/lib/data/mock/latency";

/**
 * Repository des demandes de congés/RTT.
 *
 * Aujourd'hui : données mockées en mémoire (module-level, remises à zéro au
 * rechargement complet de la page). Le jour où Supabase est branché, ce
 * fichier est le SEUL à réécrire — sa signature (fonctions async retournant
 * des `Demande[]`) ne change pas, donc aucun hook ni composant n'est touché.
 * Voir README.md > "Couche données".
 */

let demandesEnMemoire: Demande[] = seedDemandes();

export async function fetchDemandes(): Promise<Demande[]> {
  await simulateLatency();
  return [...demandesEnMemoire];
}

export async function creerDemande(input: NouvelleDemandeInput): Promise<Demande> {
  await simulateLatency();
  const demande: Demande = {
    id: `d${Date.now()}`,
    statut: "en attente",
    commentaireManager: "",
    ...input,
  };
  demandesEnMemoire = [demande, ...demandesEnMemoire];
  return demande;
}

export async function reinitialiserDemandes(): Promise<Demande[]> {
  await simulateLatency();
  demandesEnMemoire = seedDemandes();
  return [...demandesEnMemoire];
}
