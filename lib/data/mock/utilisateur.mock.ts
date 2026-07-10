import type { Utilisateur } from "@/lib/types";

export function seedUtilisateur(): Utilisateur {
  return {
    id: "u1",
    prenom: "Camille",
    nom: "Rio",
    poste: "Ingénieure VRD",
    initiales: "CR",
  };
}
