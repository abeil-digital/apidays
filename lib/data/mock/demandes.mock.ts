import type { Demande } from "@/lib/types";

export function seedDemandes(): Demande[] {
  return [
    {
      id: "d1",
      type: "CP",
      debut: "2026-07-21",
      fin: "2026-07-25",
      datePose: "2026-05-15",
      statut: "validé",
      note: "",
      commentaireManager: "",
    },
    {
      id: "d2",
      type: "RTT",
      debut: "2026-08-12",
      fin: "2026-08-12",
      datePose: "2026-07-10",
      statut: "validé",
      note: "",
      commentaireManager: "",
    },
    {
      id: "d3",
      type: "CP",
      debut: "2026-07-30",
      fin: "2026-08-01",
      datePose: "2026-07-05",
      statut: "en attente",
      note: "Mariage d'un proche",
      commentaireManager: "",
    },
    {
      id: "d4",
      type: "CP",
      debut: "2026-05-04",
      fin: "2026-05-06",
      datePose: "2026-04-01",
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
      datePose: "2026-02-01",
      statut: "validé",
      note: "",
      commentaireManager: "",
    },
    {
      id: "d6",
      type: "CP",
      debut: "2026-12-30",
      fin: "2027-01-04",
      datePose: "2026-10-20",
      statut: "validé",
      note: "",
      commentaireManager: "",
    },
  ];
}
