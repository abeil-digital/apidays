import type { Demande, DemandeEquipe } from "@/lib/types";
import {
  formatDateAction,
  formatJours,
  formatPeriodeDemande,
  formatPeriodePillNumerique,
} from "@/lib/format";
import {
  classeBordureTypeBadge,
  classeFondTypeBadge,
  LABEL_COURT,
  LABEL_LONG,
} from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface HistoriqueTablePropsCommunes {
  emptyText?: string;
  compact?: boolean;
  /** Pill Dates cliquable — ouvre le détail de cette demande côté appelant
   * (ex. `DetailCongePanel` dans `SuivreDemandesPage`). Pas de handler = pill
   * non cliquable, comportement par défaut inchangé. */
  onDateClick?: (id: string) => void;
  /** Id de la demande dont le détail est actuellement ouvert — inverse la
   * pill (même convention que les pills de solde de `SuivreSoldesPage`) pour
   * la relier visuellement au panneau ouvert. */
  selectedId?: string | null;
}

type HistoriqueTableProps =
  | ({ demandes: Demande[]; avecCollaborateur?: false } & HistoriqueTablePropsCommunes)
  | ({ demandes: DemandeEquipe[]; avecCollaborateur: true } & HistoriqueTablePropsCommunes);

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
 * contour couleur du type (repris du tableau Export paie, sans le point de
 * statut de ce dernier — redondant ici avec la colonne Statut juste à côté),
 * période via `formatPeriodeDemande` avec "au" remplacé par "-" pour rester
 * compact dans la pill (`periodeCourte`, local à ce fichier —
 * `formatPeriodeDemande` elle-même n'est pas touchée, son "au" reste voulu
 * ailleurs).
 *
 * Composant présentationnel pur (prend `demandes` en props, pas de fetch) —
 * réutilisé tel quel avec un sous-ensemble de demandes ou, avec
 * `avecCollaborateur`, pour une vue toute-l'entreprise (`SuivreDemandesPage`,
 * `demandes: DemandeEquipe[]`) qui ajoute une colonne Collaborateur
 * (avatar + nom, même pattern que le tableau Export paie) en tête de ligne.
 * Ne porte pas sa propre card (pas de `bg-surface-card`/ombre) : l'appelant
 * l'intègre dans son propre conteneur, ex. `HistoriquePage` qui regroupe
 * filtres + tableau dans une seule card (même principe que `CongesPaiePage`).
 *
 * `compact` (utilisé par `SuivreDemandesPage`, qui a déjà une colonne
 * Collaborateur en plus par rapport à `HistoriquePage`) : gagne en largeur —
 * type réduit aux initiales déjà utilisées ailleurs dans l'app (`LABEL_COURT`,
 * ex. "CP" au lieu de "Congés Payés") plutôt que le libellé complet, en-tête
 * "Durée" au lieu de "Nbre jours", colonne "Validé le" masquée. Colonne
 * Dates : format numérique jj/mm/aa (`formatPeriodePillNumerique`, 20/08/2026)
 * au lieu du format texte compact — même règle des 3 cas (jour unique,
 * période même année, période à cheval sur deux années) que les pills
 * CP/RTT/CPA de `SoldeDetailPanel`/Export paie.
 */
export function HistoriqueTable(props: HistoriqueTableProps) {
  const { emptyText = "Aucune demande.", compact = false, onDateClick, selectedId } = props;
  if (props.demandes.length === 0) return <EmptyRow text={emptyText} />;

  function cellulesCommunes(demande: Demande) {
    const code = demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
    const jours = demande.nbDemiJournees / 2;
    const libelleType = compact ? LABEL_COURT[code] : LABEL_LONG[code];
    const selectionnee = demande.id === selectedId;
    const pillDates = (
      <span
        className={`flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
          selectionnee
            ? `${classeFondTypeBadge(code)} border-transparent text-white`
            : `bg-surface-app text-ink-900 ${classeBordureTypeBadge(code)}`
        }`}
      >
        {compact
          ? formatPeriodePillNumerique(demande.debut, demande.fin)
          : periodeCourte(demande.debut, demande.fin)}
      </span>
    );

    return (
      <>
        <td className="px-4 py-3">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(code)}`} />
            <span className="text-ink-900 font-semibold">{libelleType}</span>
          </span>
        </td>
        <td className="px-4 py-3">
          {onDateClick ? (
            <button
              type="button"
              onClick={() => onDateClick(demande.id)}
              className="transition-opacity duration-150 hover:opacity-70"
            >
              {pillDates}
            </button>
          ) : (
            pillDates
          )}
        </td>
        <td className="text-ink-500 px-4 py-3">{formatJours(jours)} j</td>
        <td className="text-ink-500 hidden px-4 py-3 md:table-cell">
          {formatDateAction(demande.datePose)}
        </td>
        {!compact && (
          <td className="text-ink-500 hidden px-4 py-3 md:table-cell">
            {demande.dateDecision ? formatDateAction(demande.dateDecision) : "—"}
          </td>
        )}
        <td className="px-4 py-3">
          <StatusBadge statut={demande.statut} />
        </td>
      </>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm md:min-w-[760px]">
        <thead>
          <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
            {props.avecCollaborateur && <th className="px-4 py-3">Collaborateur</th>}
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Dates</th>
            <th className="px-4 py-3">{compact ? "Durée" : "Nbre jours"}</th>
            <th className="hidden px-4 py-3 md:table-cell">Posé le</th>
            {!compact && <th className="hidden px-4 py-3 md:table-cell">Validé le</th>}
            <th className="px-4 py-3">Statut</th>
          </tr>
        </thead>
        <tbody>
          {props.avecCollaborateur
            ? props.demandes.map((demande) => (
                <tr key={demande.id}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <Avatar
                        initiales={`${demande.demandeur.prenom[0]}${demande.demandeur.nom[0]}`.toUpperCase()}
                      />
                      <span className="text-ink-900 font-semibold">
                        {demande.demandeur.prenom} {demande.demandeur.nom}
                      </span>
                    </span>
                  </td>
                  {cellulesCommunes(demande)}
                </tr>
              ))
            : props.demandes.map((demande) => (
                <tr key={demande.id}>{cellulesCommunes(demande)}</tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
