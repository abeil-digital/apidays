import type { Soldes } from "@/lib/types";

export function seedSoldes(): Soldes {
  return {
    cp: { valeur: 18, conditionPrefixe: "À poser avant le", conditionAccent: "31/05/2026" },
    rtt: { valeur: 3, conditionPrefixe: "À poser avant le", conditionAccent: "31/12/2026" },
    cpa: {
      valeur: 2.25,
      conditionPrefixe: "En cours d'acquisition, à poser à partir de",
      conditionAccent: "juin 2026",
    },
    rttImposes: [
      { date: "2026-05-08", motif: "Pont de mai" },
      { date: "2026-12-24", motif: "Fermeture de fin d'année" },
      { date: "2026-12-31", motif: "Fermeture de fin d'année" },
    ],
  };
}
