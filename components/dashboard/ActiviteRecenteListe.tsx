import type { Demande } from "@/lib/types";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { ActiviteRecenteCard } from "@/components/dashboard/ActiviteRecenteCard";

const NB_LIGNES = 6;

/**
 * "Activité récente" — colonne étroite (≈1/3 de la largeur de page) en
 * dessous de Soldes sur Accueil2 (16/08/2026), alternative à
 * `ActiviteRecenteTable` (tableau pleine largeur, essai précédent). 6
 * dernières actions (triées par `datePose` décroissant), pas de filtre.
 */
export function ActiviteRecenteListe({ demandes }: { demandes: Demande[] }) {
  const recentes = [...demandes]
    .sort((a, b) => b.datePose.localeCompare(a.datePose))
    .slice(0, NB_LIGNES);

  return (
    <div className="bg-surface-card w-full md:max-w-sm">
      <div className="px-4 py-3">
        <h2 className="text-ink-900 text-lg font-bold">Activité récente</h2>
      </div>

      <div className="border-ink-300/60 border-t">
        {recentes.length === 0 ? (
          <EmptyRow text="Aucune activité récente." />
        ) : (
          recentes.map((demande, i) => (
            <ActiviteRecenteCard
              key={demande.id}
              demande={demande}
              isLast={i === recentes.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
