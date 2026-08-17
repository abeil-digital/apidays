import Link from "next/link";
import { PlusCircle } from "lucide-react";
import type { Soldes } from "@/lib/types";
import { SoldeCard } from "@/components/ui/SoldeCard";

/**
 * Card "Mes soldes" (16/08/2026, Accueil2, essai) — même format 1/3 largeur
 * que `ActiviteRecenteListe`/`CalendrierMoisCourantCard`, fond `mint-tint`
 * (même teinte que le bandeau Soldes existant) plutôt que `bg-surface-card`.
 * Reprend `SoldeCard` (CP/RTT/CPA, coins carrés) empilées en colonne pleine
 * largeur au lieu de la grille 2 colonnes du bandeau du haut — plus adapté
 * à une colonne étroite. En-tête : pilule "Poser un congé" (`bg-mint`, même
 * couleur que la tuile CTA du bandeau du haut — action primaire de l'écran,
 * pas la pilule neutre `bg-surface-app` des autres en-têtes d'Historique).
 */
export function MesSoldesCard({ soldes }: { soldes: Soldes }) {
  return (
    <div className="bg-mint-tint w-full md:max-w-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-ink-900 text-lg font-bold">Mes soldes</h2>
        <Link
          href="/nouvelle-demande"
          className="bg-mint flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
        >
          <PlusCircle size={14} />
          Poser un congé
        </Link>
      </div>

      <div className="border-ink-300/60 flex flex-col gap-3 border-t p-4">
        <SoldeCard
          valeur={soldes.cp.valeur}
          conditionPrefixe={soldes.cp.conditionPrefixe}
          conditionAccent={soldes.cp.conditionAccent}
          tone="cp"
          carre
        />
        <SoldeCard
          valeur={soldes.rtt.valeur}
          conditionPrefixe={soldes.rtt.conditionPrefixe}
          conditionAccent={soldes.rtt.conditionAccent}
          tone="rtt"
          carre
        />
        <SoldeCard
          valeur={soldes.cpa.valeur}
          conditionPrefixe={soldes.cpa.conditionPrefixe}
          conditionAccent={soldes.cpa.conditionAccent}
          tone="cpa"
          carre
        />
      </div>
    </div>
  );
}
