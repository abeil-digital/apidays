"use client";

import Link from "next/link";
import { CalendarDays, Coffee, PlusCircle, Sun } from "lucide-react";
import { todayISO } from "@/lib/format";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { StatTile } from "@/components/ui/StatTile";
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
    <div className="flex flex-col gap-6 pb-4 md:pt-0">
      <div className="px-1 pt-5 md:pt-0">
        <h1 className="text-ink-900 text-[1.7rem] font-bold">Bonjour, {utilisateur.prenom}</h1>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={Sun} value={soldes.cpReel} unit="j" label="CP réel" tone="brand" />
          <StatTile
            icon={CalendarDays}
            value={soldes.cpTheorique}
            unit="j"
            label="CP théorique"
            tone="accent"
          />
          <StatTile
            icon={Coffee}
            value={`${soldes.rttLibresRestant}/${soldes.rttLibresTotal}`}
            label="RTT libres"
            tone="ink900"
          />
          <StatTile
            icon={Coffee}
            value={`${soldes.rttImposesRestant}/${soldes.rttImposesTotal}`}
            label="RTT imposés"
            tone="ink400"
          />
        </div>
        <p className="text-ink-500 px-1 text-xs">
          Données de démonstration — le calcul réel sera défini avec Abeil.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Mes demandes en cours</SectionLabel>
        <RequestList demandes={enCours} emptyText="Aucune demande en attente." />
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Mes prochains congés</SectionLabel>
        <RequestList demandes={prochains} emptyText="Rien de posé pour le moment." />
      </div>

      <Link
        href="/nouvelle-demande"
        className="rounded-card bg-brand text-brand-foreground mt-1 flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold"
      >
        <PlusCircle size={17} />
        Poser une nouvelle demande
      </Link>
    </div>
  );
}
