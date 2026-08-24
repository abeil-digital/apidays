import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, TriangleAlert } from "lucide-react";
import type { Demande, DemandeEquipe, LigneExportPaie } from "@/lib/types";
import {
  formatDateAction,
  formatJours,
  formatPeriodeDemande,
  formatPeriodePillNumerique,
} from "@/lib/format";
import {
  classeBordureTypeBadge,
  classeFondActifTypeBadge,
  classeFondSurvolTypeBadge,
  classeFondTypeBadge,
  LABEL_COURT,
  LABEL_LONG,
} from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { StatusBadge } from "@/components/ui/StatusBadge";

// Statut de paie le plus significatif d'une demande, quand elle a plusieurs
// lignes de transmission (congé à cheval) — un écart sur une seule tranche
// doit rester visible même si les autres tranches sont en paye.
function statutTransmissionAgrege(lignes: LigneExportPaie[]): LigneExportPaie["statut"] | null {
  if (lignes.length === 0) return null;
  if (lignes.some((l) => l.statut === "ecart")) return "ecart";
  if (lignes.every((l) => l.statut === "en_paye")) return "en_paye";
  return "transmis";
}

function BadgeTransmission({ lignes }: { lignes: LigneExportPaie[] }) {
  const statut = statutTransmissionAgrege(lignes);
  if (!statut) return <span className="text-ink-500">—</span>;
  if (statut === "ecart") {
    return (
      <Badge tone="danger">
        <TriangleAlert size={12} strokeWidth={2.5} />
        <span>Écart</span>
      </Badge>
    );
  }
  if (statut === "en_paye") {
    return (
      <Badge tone="success">
        <Check size={12} strokeWidth={2.5} />
        <span>En paye</span>
      </Badge>
    );
  }
  return <Badge tone="warning">Transmis</Badge>;
}

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
  /** Contenu de la colonne Durée — par défaut `{jours} j`. Utilisé par
   * "Quels congés transmettre" (Clôture paie, 24/08/2026) pour afficher
   * "X/Y j" sur un congé partiellement transmis (à cheval sur deux
   * périodes de paie). */
  renderDuree?: (demande: Demande) => ReactNode;
  /** Lignes de transmission paie (`export_paie_lignes`) par demande — ajoute
   * une colonne "Paie" (Transmis/En paye/Écart) quand fourni (24/08/2026,
   * "Suivre les demandes"). Absent = pas de colonne, comportement inchangé
   * ailleurs. */
  lignesTransmissionParDemande?: Record<string, LigneExportPaie[]>;
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
// Tri "Posé le"/"Dates" (22/08/2026, étendu aux dates de congé le 24/08/2026,
// demande explicite) — cliquer un en-tête triable bascule plus récent →
// moins récent → (retour à l'ordre transmis par l'appelant). Un seul tri
// actif à la fois : cliquer une autre colonne remplace le tri en cours
// plutôt que de les cumuler — cliquer une colonne déjà triée reprend le même
// cycle recent → ancien → aucun.
type ColonneTriable = "posele" | "dates";
type DirectionTri = "recent" | "ancien";
interface TriTable {
  colonne: ColonneTriable;
  direction: DirectionTri;
}

function champTri(colonne: ColonneTriable): "datePose" | "debut" {
  return colonne === "posele" ? "datePose" : "debut";
}

function trierDemandes<T extends Demande>(demandes: T[], tri: TriTable | null): T[] {
  if (!tri) return demandes;
  const champ = champTri(tri.colonne);
  return [...demandes].sort((a, b) =>
    tri.direction === "recent"
      ? b[champ].localeCompare(a[champ])
      : a[champ].localeCompare(b[champ]),
  );
}

export function HistoriqueTable(props: HistoriqueTableProps) {
  const {
    emptyText = "Aucune demande.",
    compact = false,
    onDateClick,
    selectedId,
    renderDuree,
    lignesTransmissionParDemande,
  } = props;
  const [tri, setTri] = useState<TriTable | null>(null);

  function handleToggleTri(colonne: ColonneTriable) {
    setTri((prev) => {
      if (!prev || prev.colonne !== colonne) return { colonne, direction: "recent" };
      if (prev.direction === "recent") return { colonne, direction: "ancien" };
      return null;
    });
  }

  function iconeTri(colonne: ColonneTriable) {
    if (tri?.colonne !== colonne) return <ArrowUpDown size={12} />;
    return tri.direction === "recent" ? <ArrowDown size={12} /> : <ArrowUp size={12} />;
  }

  if (props.demandes.length === 0) return <EmptyRow text={emptyText} />;

  function codeDemande(demande: Demande) {
    return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
  }

  // État "on" permanent (`classeFondActifTypeBadge`) sur la ligne dont le
  // panneau de détail est ouvert, sinon simple survol passager
  // (`classeFondSurvolTypeBadge`) — même teinte 30%, l'un persiste, l'autre
  // s'efface au départ du curseur.
  function classeLigne(demande: Demande) {
    const code = codeDemande(demande);
    return demande.id === selectedId
      ? classeFondActifTypeBadge(code)
      : classeFondSurvolTypeBadge(code);
  }

  function cellulesCommunes(demande: Demande) {
    const code = codeDemande(demande);
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
        <td className="text-ink-500 px-4 py-3">
          {renderDuree ? renderDuree(demande) : `${formatJours(jours)} j`}
        </td>
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
        {lignesTransmissionParDemande && (
          <td className="px-4 py-3">
            <BadgeTransmission lignes={lignesTransmissionParDemande[demande.id] ?? []} />
          </td>
        )}
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
            <th className="px-4 py-3">
              <button
                type="button"
                onClick={() => handleToggleTri("dates")}
                className="hover:text-ink-900 flex items-center gap-1"
              >
                Dates
                {iconeTri("dates")}
              </button>
            </th>
            <th className="px-4 py-3">{compact ? "Durée" : "Nbre jours"}</th>
            <th className="hidden px-4 py-3 md:table-cell">
              <button
                type="button"
                onClick={() => handleToggleTri("posele")}
                className="hover:text-ink-900 flex items-center gap-1"
              >
                Posé le
                {iconeTri("posele")}
              </button>
            </th>
            {!compact && <th className="hidden px-4 py-3 md:table-cell">Validé le</th>}
            <th className="px-4 py-3">Statut</th>
            {lignesTransmissionParDemande && <th className="px-4 py-3">Paie</th>}
          </tr>
        </thead>
        <tbody>
          {props.avecCollaborateur
            ? trierDemandes(props.demandes, tri).map((demande) => (
                <tr
                  key={demande.id}
                  className={`transition-colors duration-150 ${classeLigne(demande)}`}
                >
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
            : trierDemandes(props.demandes, tri).map((demande) => (
                <tr
                  key={demande.id}
                  className={`transition-colors duration-150 ${classeLigne(demande)}`}
                >
                  {cellulesCommunes(demande)}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
