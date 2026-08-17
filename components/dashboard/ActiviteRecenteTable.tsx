import type { Demande } from "@/lib/types";
import { formatDateAction, formatJours, formatPeriodeDemande } from "@/lib/format";
import {
  classeBordureTypeBadge,
  classeFondTypeBadge,
  LABEL_COURT,
} from "@/components/demandes/TypeBadge";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { StatusBadge } from "@/components/ui/StatusBadge";

// "12 juin au 16 juin" → "12 juin - 16 juin", même convention que la pill
// Dates de `HistoriqueTable`.
function periodeCourte(debut: string, fin: string): string {
  return formatPeriodeDemande(debut, fin).replace(" au ", " - ");
}

const NB_LIGNES = 6;

/**
 * "Activité récente" — encart Accueil2 (16/08/2026), en dessous de Soldes.
 * Reprend le style visuel du tableau de `HistoriqueTable`/Suivre les
 * demandes (pill Type initiales, pill Dates contour couleur, `StatusBadge`)
 * mais avec un **ordre de colonnes différent** demandé pour cet encart —
 * Posé le en premier plutôt que Type — donc composant dédié plutôt qu'un
 * énième mode sur `HistoriqueTable` (qui ne fait pas de réordonnancement de
 * colonnes). Pas de filtre, 6 dernières actions (triées par `datePose`
 * décroissant), largeur calée sur celle du tableau de Suivre les soldes.
 */
export function ActiviteRecenteTable({ demandes }: { demandes: Demande[] }) {
  const recentes = [...demandes]
    .sort((a, b) => b.datePose.localeCompare(a.datePose))
    .slice(0, NB_LIGNES);

  return (
    <div className="bg-surface-card w-full md:max-w-[900px]">
      <div className="px-4 py-3">
        <h2 className="text-ink-900 text-lg font-bold">Activité récente</h2>
      </div>

      <div className="border-ink-300/60 overflow-x-auto border-t">
        {recentes.length === 0 ? (
          <EmptyRow text="Aucune activité récente." />
        ) : (
          <table className="w-full text-left text-sm md:min-w-[640px]">
            <thead>
              <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
                <th className="px-4 py-3">Posé le</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date du congé</th>
                <th className="px-4 py-3">Durée</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Validé le</th>
              </tr>
            </thead>
            <tbody>
              {recentes.map((demande) => {
                const code = demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
                const jours = demande.nbDemiJournees / 2;

                return (
                  <tr key={demande.id}>
                    <td className="text-ink-500 px-4 py-3">{formatDateAction(demande.datePose)}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(code)}`}
                        />
                        <span className="text-ink-900 font-semibold">{LABEL_COURT[code]}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`bg-surface-app text-ink-900 flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classeBordureTypeBadge(code)}`}
                      >
                        {periodeCourte(demande.debut, demande.fin)}
                      </span>
                    </td>
                    <td className="text-ink-500 px-4 py-3">{formatJours(jours)} j</td>
                    <td className="px-4 py-3">
                      <StatusBadge statut={demande.statut} />
                    </td>
                    <td className="text-ink-500 px-4 py-3">
                      {demande.dateDecision ? formatDateAction(demande.dateDecision) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
