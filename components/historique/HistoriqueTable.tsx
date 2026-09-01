import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from "lucide-react";
import type { Demande, DemandeEquipe, LigneExportPaie, StatutDemande } from "@/lib/types";
import { formatJours, formatPeriodeDemande, formatPeriodePillNumerique } from "@/lib/format";
import {
  classeBordureTypeBadge,
  classeFondActifTypeBadge,
  classeFondSurvolTypeBadgeActif,
  classeFondTypeBadge,
  LABEL_COURT,
  LABEL_LONG,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { StatusBadge } from "@/components/ui/StatusBadge";

// Couleur de la colonne Durée reprise du statut de la ligne (29/08/2026,
// demande explicite) — même mapping tone que `StatusBadge` (`STATUT_CONFIG`),
// exprimé ici en classe de texte plutôt qu'en fond de badge.
const TEXTE_STATUT: Record<StatutDemande, string> = {
  "en attente": "text-status-warning-fg",
  validé: "text-status-success-fg",
  refusé: "text-status-danger-fg",
  annulé: "text-status-danger-fg",
};

// Alpha propres aux effets over (90% de transparence = 10% d'opacité)/
// déclenché (80% de transparence = 20% d'opacité, plus marqué) des LIGNES de
// ce tableau (29/08/2026, demande explicite) — propres à cet écran plutôt
// qu'ajoutés aux teintes 15%/30% standard de `classeFondSurvolTypeBadge`/
// `classeFondActifTypeBadge` (`TypeBadge.tsx`).
const CODE_HOVER_10: Record<TypeBadgeCode, string> = {
  CP: "hover:bg-cp/10",
  RTT: "hover:bg-rtt/10",
  CPA: "hover:bg-cpa/10",
  CSS: "hover:bg-css/10",
  CE: "hover:bg-ce/10",
  RECUP: "hover:bg-recup/10",
  EVT_FAM: "hover:bg-evtfam/10",
  DJI: "hover:bg-dji/10",
  CPI: "hover:bg-cpi/10",
  FERIE: "hover:bg-ferie/10",
};

const CODE_ACTIF_20: Record<TypeBadgeCode, string> = {
  CP: "bg-cp/20",
  RTT: "bg-rtt/20",
  CPA: "bg-cpa/20",
  CSS: "bg-css/20",
  CE: "bg-ce/20",
  RECUP: "bg-recup/20",
  EVT_FAM: "bg-evtfam/20",
  DJI: "bg-dji/20",
  CPI: "bg-cpi/20",
  FERIE: "bg-ferie/20",
};

function BadgeTransmission({ lignes }: { lignes: LigneExportPaie[] }) {
  if (lignes.length === 0) return null;
  return (
    <Badge tone="warning">
      <Check size={12} strokeWidth={2.5} />
      <span>Transmis</span>
    </Badge>
  );
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
   * "Quels congés transmettre" (Transmissions paie, 24/08/2026) pour afficher
   * "X/Y j" sur un congé partiellement transmis (à cheval sur deux
   * périodes de paie). */
  renderDuree?: (demande: Demande) => ReactNode;
  /** Lignes de transmission paie (`export_paie_lignes`) par demande — ajoute
   * une colonne "Paie" (Transmis/En paye/Écart) quand fourni (24/08/2026,
   * "Suivre les demandes"). Absent = pas de colonne, comportement inchangé
   * ailleurs. */
  lignesTransmissionParDemande?: Record<string, LigneExportPaie[]>;
  /** Colonne triée par défaut à l'ouverture (25/08/2026, "Quels congés
   * transmettre" veut démarrer trié par collaborateur) — juste un état
   * initial, l'en-tête reste cliquable ensuite comme d'habitude. Absent =
   * pas de tri par défaut, comportement inchangé ailleurs. */
  triParDefaut?: ColonneTriable;
  /** Libellé de l'en-tête de la colonne Durée — par défaut "Durée". "Quels
   * congés transmettre" (25/08/2026) la renomme "Transmis", plus parlant une
   * fois la colonne au format X/Y. */
  libelleColonneDuree?: string;
  /** Libellé court du Type (`LABEL_COURT`, ex. "CP") plutôt que le libellé
   * complet (`LABEL_LONG`, ex. "Congés Payés") — 29/08/2026, indépendant de
   * `compact` (qui change aussi le format Dates/masque "Validé le", pas
   * demandé ici pour Historique). `compact` continue d'impliquer les
   * initiales également (comportement inchangé). */
  typeCourt?: boolean;
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

// "26" au lieu de "2026" pour les colonnes Posé le/Validé le (29/08/2026,
// demande explicite) — `formatDateAction` (lib/format.ts, année sur 4
// chiffres) reste inchangée partout ailleurs, ce format compact est propre
// à ce tableau.
function formatDateActionCourte(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
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
type ColonneTriable = "posele" | "dates" | "statut" | "collaborateur";
type DirectionTri = "recent" | "ancien";
interface TriTable {
  colonne: ColonneTriable;
  direction: DirectionTri;
}

function champTri(colonne: "posele" | "dates"): "datePose" | "debut" {
  return colonne === "posele" ? "datePose" : "debut";
}

// Ordre métier du statut (25/08/2026, colonne "Statut" rendue triable) — pas
// alphabétique : "en attente" en premier (ce qui demande une action), les 3
// statuts décidés ensuite. `direction: "recent"` réutilise le même sens que
// les colonnes de date (icône flèche vers le bas) pour rester cohérent,
// même si "récent"/"ancien" n'a pas de sens littéral ici.
const STATUT_ORDRE: Record<StatutDemande, number> = {
  "en attente": 0,
  validé: 1,
  refusé: 2,
  annulé: 3,
};

// Nom complet du collaborateur — uniquement appelée quand `tri.colonne ===
// "collaborateur"`, ce qui n'arrive que via l'en-tête `avecCollaborateur`
// (voir plus bas), donc `demandes` est garanti `DemandeEquipe[]` à ce
// moment malgré la contrainte générique `T extends Demande` de la fonction.
function nomCollaborateur(demande: Demande): string {
  const equipe = demande as unknown as DemandeEquipe;
  return `${equipe.demandeur.prenom} ${equipe.demandeur.nom}`;
}

function trierDemandes<T extends Demande>(demandes: T[], tri: TriTable | null): T[] {
  if (!tri) return demandes;
  if (tri.colonne === "statut") {
    return [...demandes].sort((a, b) =>
      tri.direction === "recent"
        ? STATUT_ORDRE[a.statut] - STATUT_ORDRE[b.statut]
        : STATUT_ORDRE[b.statut] - STATUT_ORDRE[a.statut],
    );
  }
  if (tri.colonne === "collaborateur") {
    return [...demandes].sort((a, b) =>
      tri.direction === "recent"
        ? nomCollaborateur(a).localeCompare(nomCollaborateur(b))
        : nomCollaborateur(b).localeCompare(nomCollaborateur(a)),
    );
  }
  const champ = champTri(tri.colonne);
  return [...demandes].sort((a, b) =>
    tri.direction === "recent"
      ? b[champ].localeCompare(a[champ])
      : a[champ].localeCompare(b[champ]),
  );
}

// Trie puis, uniquement quand le tri actif porte sur "collaborateur", fusionne
// visuellement les lignes consécutives d'un même collaborateur (25/08/2026,
// demande explicite) — `rowSpan` porte le nombre de lignes du groupe sur la
// première ligne (la cellule Collaborateur s'étire dessus via l'attribut
// HTML `rowSpan`), `rowSpan: 0` sur les suivantes indique de ne pas
// re-render la cellule (déjà couverte par le `rowSpan` de la première).
// Sans tri par collaborateur (tri absent ou sur une autre colonne), chaque
// ligne garde `rowSpan: 1` — comportement inchangé, un même collaborateur
// peut apparaître à des endroits non consécutifs de la liste. `groupeIds`
// (les ids de toutes les demandes du groupe) sert à synchroniser le survol
// de la cellule fusionnée avec n'importe quelle ligne du groupe — voir
// `hoveredId` dans `HistoriqueTable`, un simple `tr:hover` CSS ne peut pas
// l'atteindre depuis une ligne qui n'est pas la première du groupe.
function trierEtGrouperParCollaborateur(
  demandes: DemandeEquipe[],
  tri: TriTable | null,
): { demande: DemandeEquipe; rowSpan: number; groupeIds: string[] }[] {
  const triees = trierDemandes(demandes, tri);
  if (tri?.colonne !== "collaborateur") {
    return triees.map((demande) => ({ demande, rowSpan: 1, groupeIds: [demande.id] }));
  }

  const resultat: { demande: DemandeEquipe; rowSpan: number; groupeIds: string[] }[] = [];
  let i = 0;
  while (i < triees.length) {
    let j = i + 1;
    while (j < triees.length && triees[j].demandeur.id === triees[i].demandeur.id) j++;
    const groupeIds = triees.slice(i, j).map((d) => d.id);
    resultat.push({ demande: triees[i], rowSpan: j - i, groupeIds });
    for (let k = i + 1; k < j; k++) resultat.push({ demande: triees[k], rowSpan: 0, groupeIds });
    i = j;
  }
  return resultat;
}

export function HistoriqueTable(props: HistoriqueTableProps) {
  const {
    emptyText = "Aucune demande.",
    compact = false,
    onDateClick,
    selectedId,
    renderDuree,
    lignesTransmissionParDemande,
    triParDefaut,
    libelleColonneDuree,
    typeCourt = false,
  } = props;
  const [tri, setTri] = useState<TriTable | null>(
    triParDefaut ? { colonne: triParDefaut, direction: "recent" } : null,
  );
  // Ligne actuellement survolée — uniquement pour synchroniser la cellule
  // Collaborateur fusionnée (`rowSpan`) avec le survol de n'importe quelle
  // ligne de son groupe, voir `trierEtGrouperParCollaborateur`.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
    return demande.id === selectedId ? CODE_ACTIF_20[code] : CODE_HOVER_10[code];
  }

  function cellulesCommunes(demande: Demande) {
    const code = codeDemande(demande);
    const jours = demande.nbDemiJournees / 2;
    const libelleType = compact || typeCourt ? LABEL_COURT[code] : LABEL_LONG[code];
    const selectionnee = demande.id === selectedId;
    const pillDates = (
      <span
        className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
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
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(code)}`} />
            <span className="text-ink-900 font-semibold">{libelleType}</span>
          </span>
        </td>
        <td className="w-px px-4 py-3 whitespace-nowrap">{pillDates}</td>
        <td
          className={`w-px px-4 py-3 font-semibold whitespace-nowrap ${TEXTE_STATUT[demande.statut]}`}
        >
          {renderDuree ? renderDuree(demande) : `${formatJours(jours)} j`}
        </td>
        <td className="text-ink-500 hidden py-3 pr-2 pl-4 md:table-cell">
          {formatDateActionCourte(demande.datePose)}
        </td>
        {!compact && (
          <td className="text-ink-500 hidden py-3 pr-4 pl-2 md:table-cell">
            {demande.dateDecision ? formatDateActionCourte(demande.dateDecision) : "—"}
          </td>
        )}
        <td className="w-px px-4 py-3 whitespace-nowrap">
          <StatusBadge statut={demande.statut} />
        </td>
        {lignesTransmissionParDemande && (
          <td className="w-px px-4 py-3 whitespace-nowrap">
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
          <tr className="border-slate/30 text-slate bg-mint-tint/50 border-b text-xs font-semibold tracking-wide">
            {props.avecCollaborateur && (
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleToggleTri("collaborateur")}
                  className="hover:text-ink-900 flex items-center gap-1"
                >
                  Collaborateur
                  {iconeTri("collaborateur")}
                </button>
              </th>
            )}
            <th className="px-4 py-3">Type</th>
            <th className="w-px px-4 py-3 whitespace-nowrap">
              <button
                type="button"
                onClick={() => handleToggleTri("dates")}
                className="hover:text-ink-900 flex items-center gap-1"
              >
                Dates
                {iconeTri("dates")}
              </button>
            </th>
            <th className="w-px px-4 py-3 whitespace-nowrap">{libelleColonneDuree ?? "Durée"}</th>
            <th className="hidden py-3 pr-2 pl-4 md:table-cell">
              <button
                type="button"
                onClick={() => handleToggleTri("posele")}
                className="hover:text-ink-900 flex items-center gap-1"
              >
                Posé le
                {iconeTri("posele")}
              </button>
            </th>
            {!compact && <th className="hidden py-3 pr-4 pl-2 md:table-cell">Validé le</th>}
            <th className="w-px px-4 py-3 whitespace-nowrap">
              <button
                type="button"
                onClick={() => handleToggleTri("statut")}
                className="hover:text-ink-900 flex items-center gap-1"
              >
                Statut
                {iconeTri("statut")}
              </button>
            </th>
            {lignesTransmissionParDemande && (
              <th className="w-px px-4 py-3 whitespace-nowrap">Paie</th>
            )}
          </tr>
        </thead>
        <tbody>
          {props.avecCollaborateur
            ? trierEtGrouperParCollaborateur(props.demandes, tri).map(
                ({ demande, rowSpan, groupeIds }) => {
                  const code = codeDemande(demande);
                  // La ligne qui porte la cellule fusionnée (rowSpan > 0)
                  // reçoit déjà sa propre teinte via `classeLigne` sur son
                  // `<tr>` (active ou survolée) — cette teinte native couvre
                  // aussi la cellule fusionnée, puisqu'elle en est l'enfant.
                  // N'ajouter la classe JS que si c'est une AUTRE ligne du
                  // groupe qui est active, sinon les deux se cumulent et la
                  // première ligne du groupe apparaît deux fois plus foncée.
                  const autreLigneSelectionnee =
                    selectedId != null &&
                    selectedId !== demande.id &&
                    groupeIds.includes(selectedId);
                  const autreLigneSurvolee =
                    hoveredId !== null && hoveredId !== demande.id && groupeIds.includes(hoveredId);
                  const classeCollaborateur = autreLigneSelectionnee
                    ? classeFondActifTypeBadge(code)
                    : autreLigneSurvolee
                      ? classeFondSurvolTypeBadgeActif(code)
                      : "";
                  return (
                    <tr
                      key={demande.id}
                      className={`transition-colors duration-150 ${classeLigne(demande)} ${onDateClick ? "cursor-pointer" : ""}`}
                      onClick={onDateClick ? () => onDateClick(demande.id) : undefined}
                      onMouseEnter={() => setHoveredId(demande.id)}
                      onMouseLeave={() => setHoveredId((h) => (h === demande.id ? null : h))}
                    >
                      {rowSpan > 0 && (
                        <td
                          rowSpan={rowSpan}
                          className={`px-4 py-3 align-top transition-colors duration-150 ${classeCollaborateur}`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Avatar
                              initiales={`${demande.demandeur.prenom[0]}${demande.demandeur.nom[0]}`.toUpperCase()}
                            />
                            <span className="text-ink-900 font-semibold">
                              {demande.demandeur.prenom} {demande.demandeur.nom}
                            </span>
                          </span>
                        </td>
                      )}
                      {cellulesCommunes(demande)}
                    </tr>
                  );
                },
              )
            : trierDemandes(props.demandes, tri).map((demande) => (
                <tr
                  key={demande.id}
                  className={`transition-colors duration-150 ${classeLigne(demande)} ${onDateClick ? "cursor-pointer" : ""}`}
                  onClick={onDateClick ? () => onDateClick(demande.id) : undefined}
                >
                  {cellulesCommunes(demande)}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
