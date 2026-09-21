"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { DemandeEquipe, LigneExportPaie } from "@/lib/types";
import { formatDateActionCourte, formatJours, formatPeriodePillNumerique, todayISO } from "@/lib/format";
import {
  classeBordureTypeBadge,
  classeFondTypeBadge,
  LABEL_COURT,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";

/** "Décembre 2026" — même libellé que `nomMoisAnnee` de
 * `VerifierFichesPaiePage2.tsx`/`TransmissionsPaiePage.tsx` (non exporté,
 * réécrit ici comme partout ailleurs dans le projet). */
function nomMoisAnnee(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(`${dateIso}T00:00:00Z`),
  );
}

type Colonne = "en_attente" | "prochain_export" | "pas_encore_due" | "archive";
/** Sous-groupes affichés à l'intérieur de la colonne "Prochain export"
 * uniquement (demande de Vincent, 21/09/2026 — une seule colonne plutôt que
 * plusieurs colonnes séparées pour Régul/Rattrapage/Congés du mois). */
type SousGroupe = "annules" | "periodes_precedentes" | "mois";

const LABEL_COLONNE: Record<Colonne, string> = {
  en_attente: "En attente de validation",
  prochain_export: "Prochain export",
  pas_encore_due: "Exports futurs",
  archive: "Refusées et annulées",
};

const FOND_COLONNE: Record<Colonne, string> = {
  en_attente: "bg-status-warning-bg",
  prochain_export: "bg-status-success-bg",
  pas_encore_due: "bg-status-success-bg/50",
  archive: "bg-status-danger-bg",
};

const TITRE_COLONNE: Record<Colonne, string> = {
  en_attente: "text-status-warning-fg",
  prochain_export: "text-status-success-fg",
  pas_encore_due: "text-status-success-fg",
  archive: "text-status-danger-fg",
};

const LABEL_SOUS_GROUPE: Record<SousGroupe, string> = {
  annules: "Congés annulés",
  periodes_precedentes: "Périodes précédentes",
  mois: "Congés du mois",
};

function codeDemande(demande: DemandeEquipe): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

/** Bornes du mois en cours (même cadence mensuelle que partout ailleurs
 * dans le parcours transmission paie). Une demande validée dont la date de
 * début tombe après `fin` n'est pas encore due — même règle que
 * `genererExportPaie` (`demande.debut > periode.fin`,
 * `exportsPaie.repository.ts:452`). Avant `debut` : backlog jamais
 * transmis d'une période antérieure ("Périodes précédentes"). */
function bornesMoisEnCours(): { debut: string; fin: string } {
  const aujourdhui = todayISO();
  const [annee, mois] = aujourdhui.split("-").map(Number);
  const dernierJour = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return {
    debut: `${aujourdhui.slice(0, 7)}-01`,
    fin: `${aujourdhui.slice(0, 7)}-${String(dernierJour).padStart(2, "0")}`,
  };
}

/** Solde net déjà transmis pour une demande — même calcul que
 * `BadgeTransmission` (`HistoriqueTable.tsx`) : positif tant que la
 * correction (ligne négative) n'a pas encore été envoyée dans un export. */
function soldeNetTransmis(lignes: LigneExportPaie[]): number {
  return lignes.reduce((somme, l) => somme + l.joursInclus, 0);
}

function classer(
  demande: DemandeEquipe,
  bornes: { debut: string; fin: string },
  lignes: LigneExportPaie[],
): { colonne: Colonne; sousGroupe?: SousGroupe } | null {
  if (demande.statut === "en attente") return { colonne: "en_attente" };
  // Annulée après avoir déjà été transmise : la correction (ligne négative)
  // n'est pas encore partie — "les congés posés, passés en paie et annulés
  // depuis" (demande explicite de Vincent).
  if (demande.statut === "annulé") {
    if (soldeNetTransmis(lignes) <= 0) return { colonne: "archive" }; // déjà soldée
    return { colonne: "prochain_export", sousGroupe: "annules" };
  }
  if (demande.statut === "refusé") return { colonne: "archive" };
  if (demande.statut !== "validé") return null;
  if (demande.debut > bornes.fin) return { colonne: "pas_encore_due" };
  const sousGroupe: SousGroupe = demande.debut < bornes.debut ? "periodes_precedentes" : "mois";
  return { colonne: "prochain_export", sousGroupe };
}

function dateLabel(sousGroupe: SousGroupe | undefined, colonne: Colonne, demande: DemandeEquipe): string {
  if (colonne === "en_attente") return `Posé le ${formatDateActionCourte(demande.datePose)}`;
  if (!demande.dateDecision) return "";
  if (colonne === "archive") {
    const verbe = demande.statut === "refusé" ? "Refusée" : "Annulée";
    return `${verbe} le ${formatDateActionCourte(demande.dateDecision)}`;
  }
  if (sousGroupe === "annules") return `Annulée le ${formatDateActionCourte(demande.dateDecision)}`;
  return `Validée le ${formatDateActionCourte(demande.dateDecision)}`;
}

function CardKanban({
  demande,
  sousGroupe,
  colonne,
  soldeARegulariser,
  onClick,
  selectionnee,
}: {
  demande: DemandeEquipe;
  sousGroupe: SousGroupe | undefined;
  colonne: Colonne;
  soldeARegulariser: number;
  onClick: () => void;
  selectionnee: boolean;
}) {
  const code = codeDemande(demande);
  const estRegul = sousGroupe === "annules";
  const jours = estRegul ? soldeARegulariser : demande.nbDemiJournees / 2;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col gap-2 rounded-lg border bg-surface-card px-3 py-2.5 text-left shadow-sm transition-shadow hover:shadow ${
        selectionnee ? classeBordureTypeBadge(code) : "border-ink-300/60"
      }`}
    >
      <span className="text-ink-500 text-[11px]">{dateLabel(sousGroupe, colonne, demande)}</span>
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
            estRegul ? "text-status-danger-fg" : "text-status-success-fg"
          }`}
        >
          {estRegul ? "-" : ""}
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

type Item = { demande: DemandeEquipe; lignes: LigneExportPaie[]; sousGroupe?: SousGroupe };

/**
 * Vue Kanban de "Suivre les demandes" — test d'affichage (21/09/2026, voir
 * Backlog "Suivre les demandes : vue Kanban"). **3 colonnes** (une 1ère
 * itération à 5 colonnes incluait Transmise/En paie/Refusée, abandonnées :
 * elles font doublon avec "Quels congés transmettre"/"Vérifier les fiches
 * de paie" — voir CONTEXTE.md). La colonne du milieu, "Prochain export",
 * se subdivise en 3 sous-groupes optionnels (Congés annulés / Périodes
 * précédentes / Congés du mois) — un sous-titre ne s'affiche que s'il a au
 * moins une card, ET "Congés du mois" ne s'affiche que si un AUTRE
 * sous-groupe est aussi présent (sinon la colonne est déjà homogène, pas
 * besoin de la nommer). Aucune colonne n'est bornée par une date. Clic sur
 * une card réutilise `DetailCongePanel` tel quel via `selectionId`.
 */
export function KanbanDemandes({
  demandes,
  lignesTransmissionParDemande,
  selectionId,
  onCardClick,
}: KanbanDemandesProps) {
  const bornes = bornesMoisEnCours();
  // Filtre "mois d'export" de la colonne "Validées — exports futurs"
  // (21/09/2026, demande de Vincent) — "tous" par défaut, propre à cette
  // colonne uniquement (n'affecte pas les 2 autres).
  const [moisExportFutur, setMoisExportFutur] = useState("tous");
  // Colonne "Refusées et annulées" repliée par défaut (21/09/2026, demande
  // de Vincent) — rien à traiter dedans, juste une archive consultable au
  // besoin, pas la peine de lui donner la même place qu'aux 3 colonnes
  // actionnables en permanence.
  const [archiveOuverte, setArchiveOuverte] = useState(false);

  const parColonne: Record<Colonne, Item[]> = {
    en_attente: [],
    prochain_export: [],
    pas_encore_due: [],
    archive: [],
  };

  for (const demande of demandes) {
    const lignes = lignesTransmissionParDemande[demande.id] ?? [];
    const resultat = classer(demande, bornes, lignes);
    if (resultat) parColonne[resultat.colonne].push({ demande, lignes, sousGroupe: resultat.sousGroupe });
  }

  const moisDisponibles = [
    ...new Set(parColonne.pas_encore_due.map(({ demande }) => demande.debut.slice(0, 7))),
  ].sort();
  const itemsExportsFuturs =
    moisExportFutur === "tous"
      ? parColonne.pas_encore_due
      : parColonne.pas_encore_due.filter(({ demande }) => demande.debut.slice(0, 7) === moisExportFutur);

  (Object.keys(parColonne) as Colonne[]).forEach((colonne) => {
    parColonne[colonne].sort((a, b) =>
      colonne === "en_attente"
        ? b.demande.datePose.localeCompare(a.demande.datePose)
        : b.demande.debut.localeCompare(a.demande.debut),
    );
  });

  const sousGroupesOrdre: SousGroupe[] = ["annules", "periodes_precedentes", "mois"];

  return (
    <div className="flex w-full gap-3 overflow-x-auto pb-2">
      {(Object.keys(parColonne) as Colonne[]).map((colonne) => {
        const items = parColonne[colonne];
        const parSousGroupe: Record<SousGroupe, Item[]> = {
          annules: items.filter((i) => i.sousGroupe === "annules"),
          periodes_precedentes: items.filter((i) => i.sousGroupe === "periodes_precedentes"),
          mois: items.filter((i) => i.sousGroupe === "mois"),
        };
        const aDesExceptions =
          parSousGroupe.annules.length > 0 || parSousGroupe.periodes_precedentes.length > 0;

        // Strip repliée (colonne "archive" par défaut) — juste le compteur
        // en vertical, cliquable pour déplier la colonne complète.
        if (colonne === "archive" && !archiveOuverte) {
          return (
            <button
              key={colonne}
              type="button"
              onClick={() => setArchiveOuverte(true)}
              className={`flex w-10 shrink-0 flex-col items-center gap-2 rounded-xl py-3 ${FOND_COLONNE[colonne]}`}
              title={LABEL_COLONNE[colonne]}
            >
              <ChevronLeft size={14} className={TITRE_COLONNE[colonne]} />
              <span
                className={`text-xs font-semibold whitespace-nowrap ${TITRE_COLONNE[colonne]}`}
                style={{ writingMode: "vertical-rl" }}
              >
                {LABEL_COLONNE[colonne]} · {items.length}
              </span>
            </button>
          );
        }

        return (
          <div
            key={colonne}
            className={`flex w-[240px] shrink-0 flex-col gap-2 rounded-xl ${FOND_COLONNE[colonne]} p-3`}
          >
            <h3 className={`flex items-center justify-between text-sm font-bold ${TITRE_COLONNE[colonne]}`}>
              {colonne === "archive" && (
                <button
                  type="button"
                  onClick={() => setArchiveOuverte(false)}
                  className="shrink-0"
                  title="Replier"
                >
                  <ChevronRight size={14} />
                </button>
              )}
              {colonne === "pas_encore_due" && moisDisponibles.length > 0 ? (
                <div className="relative inline-flex w-fit items-center">
                  <select
                    value={moisExportFutur}
                    onChange={(e) => setMoisExportFutur(e.target.value)}
                    className="relative appearance-none bg-transparent pr-4 font-bold underline underline-offset-2 outline-none"
                  >
                    <option value="tous">{LABEL_COLONNE[colonne]}</option>
                    {moisDisponibles.map((mois) => (
                      <option key={mois} value={mois}>
                        {nomMoisAnnee(`${mois}-01`)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-0" />
                </div>
              ) : (
                LABEL_COLONNE[colonne]
              )}
              <span className="text-xs font-semibold opacity-70">
                {colonne === "pas_encore_due" ? itemsExportsFuturs.length : items.length}
              </span>
            </h3>

            {colonne !== "prochain_export" ? (
              <div className="flex flex-col gap-2">
                {(colonne === "pas_encore_due" ? itemsExportsFuturs : items).slice(0, 15).map(({ demande }) => (
                  <CardKanban
                    key={demande.id}
                    demande={demande}
                    sousGroupe={undefined}
                    colonne={colonne}
                    soldeARegulariser={0}
                    onClick={() => onCardClick(demande.id)}
                    selectionnee={demande.id === selectionId}
                  />
                ))}
                {(colonne === "pas_encore_due" ? itemsExportsFuturs : items).length === 0 && (
                  <p className="text-ink-500 py-6 text-center text-xs">Aucune</p>
                )}
                {(colonne === "pas_encore_due" ? itemsExportsFuturs : items).length > 15 && (
                  <p className="text-ink-500 text-center text-[11px]">
                    + {(colonne === "pas_encore_due" ? itemsExportsFuturs : items).length - 15} autres
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sousGroupesOrdre.map((sg) => {
                  const sousItems = parSousGroupe[sg];
                  if (sousItems.length === 0) return null;
                  // "Congés du mois" ne se nomme que s'il faut le distinguer
                  // d'un autre sous-groupe présent (demande explicite).
                  if (sg === "mois" && !aDesExceptions) {
                    return sousItems.slice(0, 15).map(({ demande, lignes }) => (
                      <CardKanban
                        key={demande.id}
                        demande={demande}
                        sousGroupe={sg}
                        colonne={colonne}
                        soldeARegulariser={soldeNetTransmis(lignes)}
                        onClick={() => onCardClick(demande.id)}
                        selectionnee={demande.id === selectionId}
                      />
                    ));
                  }
                  const visibles = sousItems.slice(0, 15);
                  return (
                    <div key={sg} className="flex flex-col gap-2">
                      <span className="text-ink-500 text-[11px] font-bold tracking-wide uppercase">
                        {LABEL_SOUS_GROUPE[sg]}
                      </span>
                      {visibles.map(({ demande, lignes }) => (
                        <CardKanban
                          key={demande.id}
                          demande={demande}
                          sousGroupe={sg}
                          colonne={colonne}
                          soldeARegulariser={soldeNetTransmis(lignes)}
                          onClick={() => onCardClick(demande.id)}
                          selectionnee={demande.id === selectionId}
                        />
                      ))}
                      {sousItems.length > 15 && (
                        <p className="text-ink-500 text-center text-[11px]">
                          + {sousItems.length - 15} autres
                        </p>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && <p className="text-ink-500 py-6 text-center text-xs">Aucune</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
