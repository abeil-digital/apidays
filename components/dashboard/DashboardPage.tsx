"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { todayISO } from "@/lib/format";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { SoldeCard } from "@/components/ui/SoldeCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { RequestList } from "@/components/demandes/RequestList";

export function DashboardPage() {
  const { utilisateur, loading: loadingUtilisateur } = useUtilisateur();
  const { soldes, loading: loadingSoldes } = useSoldes();
  const { demandes, loading: loadingDemandes } = useDemandes();

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
      <div className="flex items-center justify-between px-1 pt-5 md:pt-0">
        <h1 className="text-ink-900 text-[1.7rem] font-bold">Bonjour, {utilisateur.prenom}</h1>
        <Link
          href="/nouvelle-demande"
          className="rounded-card bg-brand text-brand-foreground flex h-10 w-10 shrink-0 items-center justify-center gap-2 md:h-auto md:w-auto md:rounded-full md:px-4 md:py-2.5"
        >
          <PlusCircle size={18} />
          <span className="hidden text-sm font-semibold md:inline">Nouvelle demande</span>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
        </div>
        <p className="text-ink-500 px-1 text-xs">
          Données de démonstration — le calcul réel sera défini avec Abeil.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <SectionLabel>Mes demandes en cours</SectionLabel>
          <RequestList demandes={enCours} emptyText="Aucune demande en attente." />
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>Mes prochains congés</SectionLabel>
          <RequestList demandes={prochains} emptyText="Rien de posé pour le moment." />
        </div>
      </div>
    </div>
  );
}
