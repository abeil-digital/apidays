"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { DemandeEquipe, LigneExportPaie } from "@/lib/types";
import { formatDateActionCourte, formatJours, formatPeriodePillNumerique, todayISO } from "@/lib/format";
import {
  classeBordureTypeBadge,
  classeFondTypeBadge,
  LABEL_COURT,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

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
  // "prochain_export" n'est jamais lu directement (22/09/2026, renommé en
  // "Export de {mois}" — dynamique, calculé au rendu avec `bornes.debut`) ;
  // gardé pour que le Record reste complet sur les 4 colonnes.
  prochain_export: "Export du mois",
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
): { colonne: Colonne; sousGroupe?: SousGroupe; joursRestants?: number } | null {
  if (demande.statut === "en attente") return { colonne: "en_attente" };
  // Annulée après avoir déjà été transmise : la correction (ligne négative)
  // n'est pas encore partie — "les congés posés, passés en paie et annulés
  // depuis" (demande explicite de Vincent).
  if (demande.statut === "annulé") {
    if (soldeNetTransmis(lignes) <= 0) {
      // Archive (22/09/2026, demande explicite de Vincent) : bornée sur la
      // date du CONGÉ lui-même (pas la date d'annulation) — pertinent tant
      // que le congé concerné tombe dans le mois en cours.
      if (demande.debut >= bornes.debut && demande.debut <= bornes.fin) return { colonne: "archive" };
      return null;
    }
    return { colonne: "prochain_export", sousGroupe: "annules" };
  }
  if (demande.statut === "refusé") {
    // Archive bornée cette fois sur la date de DÉCISION (le refus lui-même),
    // pas la date du congé — les deux dates n'ont pas le même sens ici : un
    // refus reste pertinent tant qu'il est récent, peu importe quand le
    // congé refusé aurait eu lieu.
    if (demande.dateDecision && demande.dateDecision >= bornes.debut && demande.dateDecision <= bornes.fin) {
      return { colonne: "archive" };
    }
    return null;
  }
  if (demande.statut !== "validé") return null;
  // Reliquat pas encore transmis — même calcul que `genererExportPaie`
  // (`joursRestants`, `exportsPaie.repository.ts`).
  const joursRestants = demande.nbDemiJournees / 2 - soldeNetTransmis(lignes);
  if (demande.debut > bornes.fin) {
    if (joursRestants <= 0) return null; // rare, mais par cohérence
    return { colonne: "pas_encore_due", joursRestants };
  }
  if (demande.debut < bornes.debut) {
    // Backlog d'une période ANTÉRIEURE au mois en cours ("Périodes
    // précédentes") — disparaît une fois transmis, il n'a plus rien à faire
    // là. Bug trouvé par Vincent le 22/09/2026 en testant sur Abeil
    // (sandbox) : des congés déjà passés en paie fin août réapparaissaient
    // en septembre — corrigé en excluant ce cas précis.
    if (joursRestants <= 0) return null;
    return { colonne: "prochain_export", sousGroupe: "periodes_precedentes", joursRestants };
  }
  // Congé DU mois en cours : reste affiché tout le mois même une fois
  // transmis/pris en compte (22/09/2026, demande explicite de Vincent —
  // "Export de {mois}" doit montrer tout ce qui concerne ce mois, pas
  // seulement ce qui reste à faire) ; `joursRestants` peut valoir 0 ici,
  // c'est voulu — voir `statutPaieLabel` sur la card pour le distinguer
  // visuellement d'un congé encore dû.
  return { colonne: "prochain_export", sousGroupe: "mois", joursRestants };
}

/** Pill de statut de la card (22/09/2026, réorganisation demandée par
 * Vincent — "la pill statut alterne le statut : En attente / Validé /
 * Transmis / Pris en compte / Annulé / À régulariser...") : combine la
 * logique déjà établie de `StatusBadge`/`BadgeTransmission`
 * (`HistoriqueTable.tsx`) en une seule pastille par card, plutôt que deux
 * composants séparés — mêmes tons/libellés, pas de nouvelle convention. */
function statutPill(
  colonne: Colonne,
  sousGroupe: SousGroupe | undefined,
  demande: DemandeEquipe,
  lignes: LigneExportPaie[],
): { tone: BadgeTone; label: string } {
  if (colonne === "en_attente") return { tone: "warning", label: "En attente" };
  if (sousGroupe === "annules") return { tone: "danger", label: "À régulariser" };
  if (colonne === "archive") {
    if (demande.statut === "refusé") return { tone: "danger", label: "Refusé" };
    const ligneRegul = lignes.find((l) => l.joursInclus < 0);
    return ligneRegul?.prisEnCompteLe != null
      ? { tone: "success", label: "Régularisé" }
      : { tone: "danger", label: "Annulé" };
  }
  // Validée (colonnes "Export de {mois}"/"Exports futurs") — pas encore
  // transmise, transmise, ou déjà confirmée par le comptable.
  if (lignes.length === 0) return { tone: "success", label: "Validé" };
  const toutesConfirmees = lignes.every((l) => l.prisEnCompteLe);
  return toutesConfirmees
    ? { tone: "success", label: "Pris en compte" }
    : { tone: "warning", label: "Transmis" };
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
  joursRestants,
  lignes,
  justArrivee,
  onClick,
  selectionnee,
}: {
  demande: DemandeEquipe;
  sousGroupe: SousGroupe | undefined;
  colonne: Colonne;
  soldeARegulariser: number;
  joursRestants: number | undefined;
  lignes: LigneExportPaie[];
  /** Vient de changer de colonne/sous-groupe depuis le dernier rendu
   * (21/09/2026, demande de Vincent) — un bref surlignage qui s'estompe,
   * pour rendre visible le "transfert" d'une card (ex. juste validée)
   * plutôt qu'un réapparition muette dans une autre colonne. Pas de vraie
   * translation physique entre colonnes (jugé trop complexe pour ce test),
   * juste un fondu d'arrivée — `transition-colors` fait tout le travail. */
  justArrivee: boolean;
  onClick: () => void;
  selectionnee: boolean;
}) {
  const code = codeDemande(demande);
  const estRegul = sousGroupe === "annules";
  const jourseTotal = demande.nbDemiJournees / 2;
  // Reliquat affiché (au lieu de la durée totale) uniquement s'il diffère —
  // congé à cheval déjà partiellement transmis (bug trouvé le 22/09/2026 en
  // testant sur Abeil sandbox : un congé transmis en août ré-apparaissait
  // en septembre avec toujours sa durée totale, pas le reste à transmettre).
  const partiellementTransmis =
    joursRestants !== undefined && Math.abs(joursRestants - jourseTotal) > 0.001;
  const jours = estRegul ? soldeARegulariser : partiellementTransmis ? joursRestants! : jourseTotal;
  const pill = statutPill(colonne, sousGroupe, demande, lignes);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-ink-500 pl-1 text-[11px]">{dateLabel(sousGroupe, colonne, demande)}</span>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full flex-col gap-3 rounded-lg border px-3 py-2.5 text-left shadow-sm transition-colors duration-700 hover:shadow ${
          justArrivee ? "bg-status-success-bg" : "bg-surface-card"
        } ${selectionnee ? classeBordureTypeBadge(code) : "border-ink-300/60"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(code)}`} />
            <span className="text-ink-900 text-xs font-semibold">{LABEL_COURT[code]}</span>
          </span>
          <Badge tone={pill.tone}>{pill.label}</Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink-900 min-w-0 truncate text-sm font-bold">
            {demande.demandeur.prenom} {demande.demandeur.nom}
          </span>
          <span
            className={`shrink-0 text-lg font-bold ${
              estRegul ? "text-status-danger-fg" : "text-status-success-fg"
            }`}
          >
            {estRegul ? "-" : ""}
            {partiellementTransmis
              ? `${formatJours(jours)}/${formatJours(jourseTotal)} j`
              : `${formatJours(jours)} j`}
          </span>
        </div>
        <span
          className={`bg-surface-app text-ink-900 inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${classeBordureTypeBadge(code)}`}
        >
          {formatPeriodePillNumerique(demande.debut, demande.fin)}
        </span>
      </button>
    </div>
  );
}

interface KanbanDemandesProps {
  demandes: DemandeEquipe[];
  lignesTransmissionParDemande: Record<string, LigneExportPaie[]>;
  selectionId: string | null;
  onCardClick: (id: string) => void;
}

type Item = {
  demande: DemandeEquipe;
  lignes: LigneExportPaie[];
  sousGroupe?: SousGroupe;
  joursRestants?: number;
};

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
  // Surlignage d'arrivée quand une card change de colonne/sous-groupe
  // (21/09/2026, demande de Vincent — "il faudrait une transition qui
  // montre le transfert") : `positionPrecedente` mémorise la dernière
  // position connue de chaque demande entre deux rendus ; `justArrivees`
  // déclenche le fondu, effacé après coup (voir l'effet plus bas).
  const positionPrecedente = useRef<Map<string, string>>(new Map());
  const [justArrivees, setJustArrivees] = useState<Set<string>>(new Set());

  const parColonne: Record<Colonne, Item[]> = {
    en_attente: [],
    prochain_export: [],
    pas_encore_due: [],
    archive: [],
  };

  for (const demande of demandes) {
    const lignes = lignesTransmissionParDemande[demande.id] ?? [];
    const resultat = classer(demande, bornes, lignes);
    if (resultat) {
      parColonne[resultat.colonne].push({
        demande,
        lignes,
        sousGroupe: resultat.sousGroupe,
        joursRestants: resultat.joursRestants,
      });
    }
  }

  useEffect(() => {
    const positionsActuelles = new Map<string, string>();
    const nouvellesArrivees = new Set<string>();
    (Object.keys(parColonne) as Colonne[]).forEach((colonne) => {
      for (const { demande, sousGroupe } of parColonne[colonne]) {
        const position = `${colonne}:${sousGroupe ?? ""}`;
        positionsActuelles.set(demande.id, position);
        const avant = positionPrecedente.current.get(demande.id);
        if (avant && avant !== position) nouvellesArrivees.add(demande.id);
      }
    });
    positionPrecedente.current = positionsActuelles;
    if (nouvellesArrivees.size > 0) {
      setJustArrivees(nouvellesArrivees);
      const timer = setTimeout(() => setJustArrivees(new Set()), 1200);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- comparaison faite à la main sur le contenu de `demandes`/`lignesTransmissionParDemande`, pas sur `parColonne` recréé à chaque rendu
  }, [demandes, lignesTransmissionParDemande]);

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
              ) : colonne === "prochain_export" ? (
                `Export de ${nomMoisAnnee(bornes.debut)}`
              ) : (
                LABEL_COLONNE[colonne]
              )}
              <span className="text-xs font-semibold opacity-70">
                {colonne === "pas_encore_due" ? itemsExportsFuturs.length : items.length}
              </span>
            </h3>

            {colonne !== "prochain_export" ? (
              <div className="flex flex-col gap-2">
                {(colonne === "pas_encore_due" ? itemsExportsFuturs : items)
                  .slice(0, 15)
                  .map(({ demande, lignes, joursRestants }) => (
                    <CardKanban
                      key={demande.id}
                      demande={demande}
                      sousGroupe={undefined}
                      colonne={colonne}
                      soldeARegulariser={0}
                      joursRestants={joursRestants}
                      lignes={lignes}
                      justArrivee={justArrivees.has(demande.id)}
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
              <div className="flex flex-col gap-6">
                {sousGroupesOrdre.map((sg) => {
                  const sousItems = parSousGroupe[sg];
                  if (sousItems.length === 0) return null;
                  // "Congés du mois" ne se nomme que s'il faut le distinguer
                  // d'un autre sous-groupe présent (demande explicite).
                  if (sg === "mois" && !aDesExceptions) {
                    return sousItems.slice(0, 15).map(({ demande, lignes, joursRestants }) => (
                      <CardKanban
                        key={demande.id}
                        demande={demande}
                        sousGroupe={sg}
                        colonne={colonne}
                        soldeARegulariser={soldeNetTransmis(lignes)}
                        joursRestants={joursRestants}
                        lignes={lignes}
                        justArrivee={justArrivees.has(demande.id)}
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
                      {visibles.map(({ demande, lignes, joursRestants }) => (
                        <CardKanban
                          key={demande.id}
                          demande={demande}
                          sousGroupe={sg}
                          colonne={colonne}
                          soldeARegulariser={soldeNetTransmis(lignes)}
                          joursRestants={joursRestants}
                          lignes={lignes}
                          justArrivee={justArrivees.has(demande.id)}
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
