"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import type { StatutDemande } from "@/lib/types";
import { useDemandes } from "@/hooks/useDemandes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { BackHeader } from "@/components/ui/BackHeader";
import { RequestList } from "@/components/demandes/RequestList";

type Filtre = "Toutes" | "Validées" | "Refusées";

const FILTRES: Filtre[] = ["Toutes", "Validées", "Refusées"];

const STATUT_PAR_FILTRE: Partial<Record<Filtre, StatutDemande>> = {
  Validées: "validé",
  Refusées: "refusé",
};

export function HistoriquePage() {
  const { demandes } = useDemandes();
  const { utilisateur } = useUtilisateur();
  const [filtre, setFiltre] = useState<Filtre>("Toutes");

  const filtered = demandes
    .filter((d) => {
      const statutAttendu = STATUT_PAR_FILTRE[filtre];
      return statutAttendu ? d.statut === statutAttendu : true;
    })
    .sort((a, b) => b.debut.localeCompare(a.debut));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0 print:pb-0">
      <div className="print:hidden">
        <BackHeader href="/" title="Historique" />
      </div>

      <div className="flex items-center justify-between px-1 print:hidden">
        <div className="flex gap-2">
          {FILTRES.map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                filtre === f
                  ? "bg-brand text-brand-foreground"
                  : "bg-surface-card text-ink-900 shadow-sm"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          className="bg-surface-card text-ink-900 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm"
        >
          <Printer size={13} />
          Exporter
        </button>
      </div>

      <div className="hidden px-1 print:block">
        <h1 className="text-ink-900 text-2xl font-semibold">
          Historique des congés — {utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : ""}
        </h1>
      </div>

      <RequestList demandes={filtered} emptyText="Aucune demande sur cette période." />
    </div>
  );
}
