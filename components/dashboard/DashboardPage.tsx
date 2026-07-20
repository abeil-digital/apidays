"use client";

import { useState } from "react";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { todayISO } from "@/lib/format";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { SoldeCard } from "@/components/ui/SoldeCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { RequestList } from "@/components/demandes/RequestList";
import { ReglesCongesModal } from "@/components/dashboard/ReglesCongesModal";

export function DashboardPage() {
  const { utilisateur, loading: loadingUtilisateur } = useUtilisateur();
  const { soldes, loading: loadingSoldes } = useSoldes();
  const { demandes, loading: loadingDemandes } = useDemandes();
  const [reglesOuvertes, setReglesOuvertes] = useState(false);

  const loading = loadingUtilisateur || loadingSoldes || loadingDemandes;

  if (loading || !utilisateur || !soldes) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  const today = todayISO();
  const prochains = demandes
    .filter((d) => d.statut === "validé" && d.fin >= today)
    .sort((a, b) => a.debut.localeCompare(b.debut));
  const enCours = demandes
    .filter((d) => d.statut === "en attente")
    .sort((a, b) => a.debut.localeCompare(b.debut));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-4 md:max-w-6xl md:pt-0">
      <div className="px-1 pt-5 md:pt-0">
        <h1 className="text-ink-900 text-[1.7rem] font-bold">Bonjour, {utilisateur.prenom}</h1>
      </div>

      <div className="flex flex-col gap-2">
        <div className="bg-mint/10 border-mint/25 flex flex-col gap-4 rounded-2xl border p-4 md:flex-row md:items-center md:gap-6 md:p-5">
          <div className="flex shrink-0 flex-col gap-1 md:w-44">
            <h2 className="text-ink-900 text-lg font-bold">Soldes</h2>
            <p className="text-ink-500 text-xs leading-snug">Quels congés imposés cette année ?</p>
            <button
              type="button"
              onClick={() => setReglesOuvertes(true)}
              className="text-ink-900 w-fit text-xs font-semibold underline"
            >
              découvrir
            </button>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <SoldeCard
              label="CP"
              valeur={soldes.cp.valeur}
              conditionPrefixe={soldes.cp.conditionPrefixe}
              conditionAccent={soldes.cp.conditionAccent}
              tone="cp"
            />
            <SoldeCard
              label="RTT"
              valeur={soldes.rtt.valeur}
              conditionPrefixe={soldes.rtt.conditionPrefixe}
              conditionAccent={soldes.rtt.conditionAccent}
              tone="rtt"
            />
            <SoldeCard
              label="CPT"
              valeur={soldes.cpt.valeur}
              conditionPrefixe={soldes.cpt.conditionPrefixe}
              conditionAccent={soldes.cpt.conditionAccent}
              tone="cpt"
            />
            <Link
              href="/nouvelle-demande"
              className="bg-mint flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl p-4 text-white shadow-sm"
            >
              <span className="text-sm font-semibold">Poser un congé</span>
              <PlusCircle size={20} />
            </Link>
          </div>
        </div>
        <p className="text-ink-500 px-1 text-xs">
          Données de démonstration — le calcul réel sera défini avec Abeil.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <SectionLabel>Demandes en cours</SectionLabel>
          <RequestList demandes={enCours} emptyText="Aucune demande en attente." />
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>Prochains congés</SectionLabel>
          <RequestList demandes={prochains} emptyText="Rien de posé pour le moment." />
        </div>
      </div>

      {reglesOuvertes && (
        <ReglesCongesModal soldes={soldes} onClose={() => setReglesOuvertes(false)} />
      )}
    </div>
  );
}
