"use client";

import { useDemandes } from "@/hooks/useDemandes";
import { ProchainsJoursOffCard } from "@/components/dashboard/ProchainsJoursOffCard";
import { ActiviteRecenteTable } from "@/components/dashboard/ActiviteRecenteTable";
import { ActiviteRecenteListe } from "@/components/dashboard/ActiviteRecenteListe";

// Page de test temporaire (18/08/2026) — permet à Vincent de visualiser les
// composants orphelins de components/dashboard/ (jamais importés ailleurs,
// restes d'essais Accueil2 du 16/08/2026) avant de décider s'ils sont
// supprimés pour de bon. À retirer une fois la décision prise — voir la
// tâche en arrière-plan "Supprimer les composants dashboard orphelins".
export default function PreviewOrphelinsPage() {
  const { demandes, loading: loadingDemandes } = useDemandes();

  if (loadingDemandes) return <div>Chargement…</div>;

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="mb-2 text-xl font-bold">ProchainsJoursOffCard</h1>
        <ProchainsJoursOffCard />
      </div>
      <div>
        <h1 className="mb-2 text-xl font-bold">ActiviteRecenteTable</h1>
        <ActiviteRecenteTable demandes={demandes} />
      </div>
      <div>
        <h1 className="mb-2 text-xl font-bold">ActiviteRecenteListe (+ ActiviteRecenteCard)</h1>
        <ActiviteRecenteListe demandes={demandes} />
      </div>
    </div>
  );
}
