"use client";

import type { DemandeEquipe, LigneExportPaie } from "@/lib/types";
import { formatDateActionCourte, formatJours, formatPeriodePillNumerique, todayISO } from "@/lib/format";
import {
  classeBordureTypeBadge,
  classeFondTypeBadge,
  LABEL_COURT,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";

type ColonneKanban = "en_attente" | "prochain_export" | "pas_encore_due" | "regul";

const COLONNES: { id: ColonneKanban; label: string; classeFond: string; classeTitre: string }[] = [
  {
    id: "en_attente",
    label: "En attente de validation",
    classeFond: "bg-status-warning-bg",
    classeTitre: "text-status-warning-fg",
  },
  {
    id: "prochain_export",
    label: "Validées — prochain export",
    classeFond: "bg-status-success-bg",
    classeTitre: "text-status-success-fg",
  },
  {
    id: "regul",
    label: "Régul — prochain export",
    classeFond: "bg-status-danger-bg",
    classeTitre: "text-status-danger-fg",
  },
  {
    id: "pas_encore_due",
    label: "Validées — pas encore dues",
    classeFond: "bg-status-neutral-bg",
    classeTitre: "text-status-neutral-fg",
  },
];

function codeDemande(demande: DemandeEquipe): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

/** Fin du "prochain export" = fin du mois en cours, même cadence mensuelle
 * que partout ailleurs dans le parcours transmission paie. Une demande
 * validée dont la date de début tombe après cette borne n'est pas encore
 * due — même règle que `genererExportPaie` (`demande.debut > periode.fin`,
 * `exportsPaie.repository.ts:452`). */
function finMoisEnCours(): string {
  const aujourdhui = todayISO();
  const [annee, mois] = aujourdhui.split("-").map(Number);
  const dernierJour = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return `${aujourdhui.slice(0, 7)}-${String(dernierJour).padStart(2, "0")}`;
}

/** Solde net déjà transmis pour une demande — même calcul que
 * `BadgeTransmission` (`HistoriqueTable.tsx`) : positif tant que la
 * correction (ligne négative) n'a pas encore été envoyée dans un export. */
function soldeNetTransmis(lignes: LigneExportPaie[]): number {
  return lignes.reduce((somme, l) => somme + l.joursInclus, 0);
}

function colonneDemande(
  demande: DemandeEquipe,
  borneExport: string,
  lignes: LigneExportPaie[],
): ColonneKanban | null {
  if (demande.statut === "en attente") return "en_attente";
  // Annulée après avoir déjà été transmise : la correction (ligne négative)
  // n'est pas encore partie — demande explicite de Vincent (21/09/2026),
  // ce sont "les congés posés, passés en paie et annulés depuis".
  if (demande.statut === "annulé") {
    return soldeNetTransmis(lignes) > 0 ? "regul" : null;
  }
  if (demande.statut !== "validé") return null; // refusé — hors scope de cette vue
  return demande.debut > borneExport ? "pas_encore_due" : "prochain_export";
}

function dateLabel(colonne: ColonneKanban, demande: DemandeEquipe): string {
  if (colonne === "en_attente") return `Posé le ${formatDateActionCourte(demande.datePose)}`;
  if (colonne === "regul") {
    return demande.dateDecision ? `Annulée le ${formatDateActionCourte(demande.dateDecision)}` : "";
  }
  return demande.dateDecision ? `Validée le ${formatDateActionCourte(demande.dateDecision)}` : "";
}

function CardKanban({
  demande,
  colonne,
  soldeARegulariser,
  onClick,
  selectionnee,
}: {
  demande: DemandeEquipe;
  colonne: ColonneKanban;
  soldeARegulariser: number;
  onClick: () => void;
  selectionnee: boolean;
}) {
  const code = codeDemande(demande);
  const jours = colonne === "regul" ? soldeARegulariser : demande.nbDemiJournees / 2;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col gap-2 rounded-lg border bg-surface-card px-3 py-2.5 text-left shadow-sm transition-shadow hover:shadow ${
        selectionnee ? classeBordureTypeBadge(code) : "border-ink-300/60"
      }`}
    >
      <span className="text-ink-500 text-[11px]">{dateLabel(colonne, demande)}</span>
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-900 min-w-0 truncate text-sm font-bold">
          {demande.demandeur.prenom} {demande.demandeur.nom}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(code)}`} />
          <span className="text-ink-900 text-xs font-semibold">{LABEL_COURT[code]}</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`bg-surface-app text-ink-900 inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${classeBordureTypeBadge(code)}`}
        >
          {formatPeriodePillNumerique(demande.debut, demande.fin)}
        </span>
        <span
          className={`shrink-0 text-sm font-bold ${
            colonne === "regul" ? "text-status-danger-fg" : "text-status-success-fg"
          }`}
        >
          {colonne === "regul" ? "-" : ""}
          {formatJours(jours)} j
        </span>
      </div>
    </button>
  );
}

interface KanbanDemandesProps {
  demandes: DemandeEquipe[];
  lignesTransmissionParDemande: Record<string, LigneExportPaie[]>;
  selectionId: string | null;
  onCardClick: (id: string) => void;
}

/**
 * Vue Kanban de "Suivre les demandes" — test d'affichage (21/09/2026, voir
 * Backlog "Suivre les demandes : vue Kanban"). **Scope réduit à 4 colonnes**
 * après réflexion avec Vincent (une 1ère itération à 5 colonnes incluait
 * Transmise/En paie/Refusée, abandonnées : elles font doublon avec "Quels
 * congés transmettre"/"Vérifier les fiches de paie", qui remplissent déjà
 * bien ce rôle — voir CONTEXTE.md pour le raisonnement complet). Les 4
 * colonnes retenues ne sont **jamais bornées par une date** — contrairement
 * aux colonnes terminales abandonnées, une demande non traitée depuis
 * longtemps est justement ce que ce Kanban doit faire remonter. Clic sur
 * une card réutilise `DetailCongePanel` tel quel via `selectionId`.
 */
export function KanbanDemandes({
  demandes,
  lignesTransmissionParDemande,
  selectionId,
  onCardClick,
}: KanbanDemandesProps) {
  const borneExport = finMoisEnCours();

  const parColonne: Record<ColonneKanban, { demande: DemandeEquipe; lignes: LigneExportPaie[] }[]> = {
    en_attente: [],
    prochain_export: [],
    pas_encore_due: [],
    regul: [],
  };

  for (const demande of demandes) {
    const lignes = lignesTransmissionParDemande[demande.id] ?? [];
    const colonne = colonneDemande(demande, borneExport, lignes);
    if (colonne) parColonne[colonne].push({ demande, lignes });
  }

  for (const colonne of COLONNES) {
    parColonne[colonne.id].sort((a, b) =>
      colonne.id === "en_attente"
        ? b.demande.datePose.localeCompare(a.demande.datePose)
        : b.demande.debut.localeCompare(a.demande.debut),
    );
  }

  return (
    <div className="flex w-full gap-3 overflow-x-auto pb-2">
      {COLONNES.map((colonne) => {
        const items = parColonne[colonne.id];
        const visibles = items.slice(0, 15);
        return (
          <div
            key={colonne.id}
            className={`flex w-[240px] shrink-0 flex-col gap-2 rounded-xl ${colonne.classeFond} p-3`}
          >
            <h3 className={`flex items-center justify-between text-sm font-bold ${colonne.classeTitre}`}>
              {colonne.label}
              <span className="text-xs font-semibold opacity-70">{items.length}</span>
            </h3>
            <div className="flex flex-col gap-2">
              {visibles.map(({ demande, lignes }) => (
                <CardKanban
                  key={demande.id}
                  demande={demande}
                  colonne={colonne.id}
                  soldeARegulariser={soldeNetTransmis(lignes)}
                  onClick={() => onCardClick(demande.id)}
                  selectionnee={demande.id === selectionId}
                />
              ))}
              {items.length === 0 && <p className="text-ink-500 py-6 text-center text-xs">Aucune</p>}
              {items.length > 15 && (
                <p className="text-ink-500 text-center text-[11px]">+ {items.length - 15} autres</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
