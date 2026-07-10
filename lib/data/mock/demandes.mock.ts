import type { Demande } from "@/lib/types";

export function seedDemandes(): Demande[] {
  return [
    {
      id: "d1",
      type: "CP",
      debut: "2026-07-21",
      fin: "2026-07-25",
      statut: "validé",
      note: "",
      commentaireManager: "",
    },
    {
      id: "d2",
      type: "RTT",
      debut: "2026-08-12",
      fin: "2026-08-12",
      statut: "validé",
      note: "",
      commentaireManager: "",
    },
    {
      id: "d3",
      type: "CP",
      debut: "2026-07-30",
      fin: "2026-08-01",
      statut: "en attente",
      note: "Mariage d'un proche",
      commentaireManager: "",
    },
    {
      id: "d4",
      type: "CP",
      debut: "2026-05-04",
      fin: "2026-05-06",
      statut: "refusé",
      note: "",
      commentaireManager:
        "Période chargée sur le chantier de Fréville, à repositionner si possible.",
    },
    {
      id: "d5",
      type: "RTT",
      debut: "2026-03-13",
      fin: "2026-03-13",
      statut: "validé",
      note: "",
      commentaireManager: "",
    },
  ];
}
