import type { Soldes } from "@/lib/types";

export function seedSoldes(): Soldes {
  return {
    cp: { valeur: 18, conditionPrefixe: "À poser avant le", conditionAccent: "31/05/2026" },
    rtt: { valeur: 3, conditionPrefixe: "À poser avant le", conditionAccent: "31/12/2026" },
    cpt: {
      valeur: 2.25,
      conditionPrefixe: "En cours d'acquisition, à poser à partir de",
      conditionAccent: "juin 2026",
    },
  };
}
