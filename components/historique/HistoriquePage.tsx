"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import type { StatutDemande } from "@/lib/types";
import { useDemandes } from "@/hooks/useDemandes";
import { useReglesConges } from "@/hooks/useReglesConges";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { periodeReferenceCp } from "@/lib/periodeReferenceCp";
import { InputFiltrePill, SelectFiltrePill } from "@/components/ui/FiltrePill";
import { HistoriqueTable } from "@/components/historique/HistoriqueTable";

type Filtre = "Toutes" | "En validation" | "Validées" | "Refusées";
type PeriodeFiltre = "annee_en_cours" | "periode_reference" | "personnalisee";

const FILTRES: Filtre[] = ["Toutes", "En validation", "Validées", "Refusées"];

const STATUT_PAR_FILTRE: Partial<Record<Filtre, StatutDemande>> = {
  "En validation": "en attente",
  Validées: "validé",
  Refusées: "refusé",
};

const LABEL_PERIODE: Record<PeriodeFiltre, string> = {
  annee_en_cours: "Année en cours",
  periode_reference: "Période de référence",
  personnalisee: "Sélectionner une période",
};

export function HistoriquePage() {
  const { demandes } = useDemandes();
  const { utilisateur } = useUtilisateur();
  const { reglesAcquisition } = useReglesConges();
  const [filtre, setFiltre] = useState<Filtre>("Toutes");
  const [periodeFiltre, setPeriodeFiltre] = useState<PeriodeFiltre>("annee_en_cours");
  const [debutPerso, setDebutPerso] = useState("");
  const [finPerso, setFinPerso] = useState("");

  const anneeActuelle = new Date().getFullYear();
  const regleCp = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const periodeReference = periodeReferenceCp(regleCp);

  const { debut, fin } =
    periodeFiltre === "annee_en_cours"
      ? { debut: `${anneeActuelle}-01-01`, fin: `${anneeActuelle}-12-31` }
      : periodeFiltre === "periode_reference"
        ? periodeReference
        : { debut: debutPerso, fin: finPerso };

  const filtered = demandes
    .filter((d) => {
      const statutAttendu = STATUT_PAR_FILTRE[filtre];
      if (statutAttendu && d.statut !== statutAttendu) return false;
      if (debut && d.debut < debut) return false;
      if (fin && d.debut > fin) return false;
      return true;
    })
    .sort((a, b) => b.debut.localeCompare(a.debut));

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-4xl md:pt-0 print:pb-0">
      <h1 className="text-ink-900 px-1 text-2xl font-semibold print:hidden">Historique</h1>

      <div className="hidden px-1 print:block">
        <h1 className="text-ink-900 text-2xl font-semibold">
          Historique des congés — {utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : ""}
        </h1>
      </div>

      <div className="bg-surface-card w-full">
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3 print:hidden">
          <div className="flex flex-wrap items-end gap-2">
            <SelectFiltrePill value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)}>
              {FILTRES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </SelectFiltrePill>
            <SelectFiltrePill
              value={periodeFiltre}
              onChange={(e) => setPeriodeFiltre(e.target.value as PeriodeFiltre)}
            >
              {(Object.entries(LABEL_PERIODE) as [PeriodeFiltre, string][]).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </SelectFiltrePill>
            {periodeFiltre === "personnalisee" && (
              <>
                <InputFiltrePill
                  type="date"
                  aria-label="Du"
                  value={debutPerso}
                  onChange={(e) => setDebutPerso(e.target.value)}
                />
                <InputFiltrePill
                  type="date"
                  aria-label="Au"
                  value={finPerso}
                  onChange={(e) => setFinPerso(e.target.value)}
                />
              </>
            )}
          </div>
          <button
            onClick={() => window.print()}
            className="bg-surface-app text-ink-900 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
          >
            <Printer size={13} />
            Exporter
          </button>
        </div>

        <div className="border-ink-300/60 border-t">
          <HistoriqueTable demandes={filtered} emptyText="Aucune demande sur cette période." />
        </div>
      </div>
    </div>
  );
}
