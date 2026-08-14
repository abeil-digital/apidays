import type { Demande } from "@/lib/types";
import { formatDateAction, formatJours, formatPeriodeDemande } from "@/lib/format";
import {
  classeBordureTypeBadge,
  classeFondTypeBadge,
  LABEL_LONG,
} from "@/components/demandes/TypeBadge";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { StatusBadge } from "@/components/ui/StatusBadge";

const CLASSE_POINT_STATUT: Record<string, string> = {
  validé: "bg-status-success-fg",
  "en attente": "bg-status-warning-fg",
  refusé: "bg-status-danger-fg",
  annulé: "bg-status-danger-fg",
};

interface HistoriqueTableProps {
  demandes: Demande[];
  emptyText?: string;
}

// "12 juin au 16 juin" → "12 juin - 16 juin" pour la pill de la colonne
// Dates (plus compact) — ne touche pas `formatPeriodeDemande` elle-même,
// gardée telle quelle pour ses autres usages ("au" voulu ailleurs).
function periodeCourte(debut: string, fin: string): string {
  return formatPeriodeDemande(debut, fin).replace(" au ", " - ");
}

/**
 * Tableau "Type / Dates / Durée / Statut" des demandes d'un collaborateur —
 * remplace le rendu en cartes (`RequestList`) sur `/historique`, jugé pas
 * assez lisible pour un historique. Réutilise les mêmes briques que le reste
 * de l'app plutôt que d'inventer un nouveau style : pastille de couleur +
 * libellé complet du type (`classeFondTypeBadge`/`LABEL_LONG`, pattern repris
 * de `SuiviDemandeRow`), `StatusBadge` pour le statut. Colonne Dates : pill
 * contour couleur du type + point couleur du statut (repris du tableau
 * Export paie), période via `formatPeriodeDemande` avec "au" remplacé par
 * "-" pour rester compact dans la pill (`periodeCourte`, local à ce fichier —
 * `formatPeriodeDemande` elle-même n'est pas touchée, son "au" reste voulu
 * ailleurs).
 *
 * Composant présentationnel pur (prend `demandes` en props, pas de fetch) —
 * pensé pour être réutilisé tel quel avec un sous-ensemble de demandes (ex.
 * les dernières entrées sur l'Accueil, à venir). Ne porte pas sa propre card
 * (pas de `bg-surface-card`/ombre) : l'appelant l'intègre dans son propre
 * conteneur, ex. `HistoriquePage` qui regroupe filtres + tableau dans une
 * seule card (même principe que `CongesPaiePage`).
 */
export function HistoriqueTable({ demandes, emptyText = "Aucune demande." }: HistoriqueTableProps) {
  if (demandes.length === 0) return <EmptyRow text={emptyText} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm md:min-w-[760px]">
        <thead>
          <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Dates</th>
            <th className="px-4 py-3">Nbre jours</th>
            <th className="hidden px-4 py-3 md:table-cell">Posé le</th>
            <th className="hidden px-4 py-3 md:table-cell">Validé le</th>
            <th className="px-4 py-3">Statut</th>
          </tr>
        </thead>
        <tbody>
          {demandes.map((demande) => {
            const code = demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
            const jours = demande.nbDemiJournees / 2;

            return (
              <tr key={demande.id}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(code)}`}
                    />
                    <span className="text-ink-900 font-semibold">{LABEL_LONG[code]}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`bg-surface-app text-ink-900 flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${classeBordureTypeBadge(code)}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${CLASSE_POINT_STATUT[demande.statut]}`}
                    />
                    {periodeCourte(demande.debut, demande.fin)}
                  </span>
                </td>
                <td className="text-ink-500 px-4 py-3">{formatJours(jours)} j</td>
                <td className="text-ink-500 hidden px-4 py-3 md:table-cell">
                  {formatDateAction(demande.datePose)}
                </td>
                <td className="text-ink-500 hidden px-4 py-3 md:table-cell">
                  {demande.dateDecision ? formatDateAction(demande.dateDecision) : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge statut={demande.statut} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
