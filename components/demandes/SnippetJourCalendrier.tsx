import { formatDate, formatJours, formatPeriodeDemande } from "@/lib/format";
import { dureeCongeImpose } from "@/lib/joursFeries";
import type { CongeImpose, Demande, DjImposee, JourFerie } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

/** Ce qu'un clic sur un jour du calendrier peut révéler — une demande
 * personnelle, un congé imposé (CPI période, DJI demi-journée), ou un jour
 * férié (24/08/2026 — révèle son nom, `JourFerie.libelle`). */
export type JourCalendrierClique =
  | { kind: "demande"; demande: Demande }
  | { kind: "cpi"; cpi: CongeImpose }
  | { kind: "dji"; dji: DjImposee }
  | { kind: "ferie"; ferie: JourFerie };

function codeBadgeDemande(demande: Demande): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

/**
 * Overlay "typologie de congé" au clic sur un jour du calendrier (24/08/2026)
 * — comportement unifié entre Accueil (`DashboardPage`) et
 * `/suivre/calendrier` (`CalendrierCollaborateur`), remplace l'ancien
 * `SnippetDemande` local à chacun (qui ne réagissait qu'aux demandes
 * personnelles, pas aux congés imposés) et l'interaction retirée avec
 * "Prochains jours off" (plus de surlignage/scroll auto de la liste au clic
 * — un seul mécanisme de rappel désormais, cet overlay). Badge + période +
 * durée, plus un `StatusBadge` uniquement pour une demande personnelle (un
 * CPI/DJI n'a pas de statut de décision à afficher).
 */
export function SnippetJourCalendrier({
  jour,
  ancre,
  joursFeries,
  onFermer,
}: {
  jour: JourCalendrierClique;
  ancre: DOMRect;
  /** Nécessaire uniquement pour calculer la durée d'un CPI (jours ouvrés
   * moins fériés) — ignoré pour "demande"/"dji". */
  joursFeries: JourFerie[];
  onFermer: () => void;
}) {
  let code: TypeBadgeCode;
  let label: string | undefined;
  let periode: string;
  let duree: string;
  if (jour.kind === "demande") {
    code = codeBadgeDemande(jour.demande);
    periode = formatPeriodeDemande(jour.demande.debut, jour.demande.fin);
    const j = jour.demande.nbDemiJournees / 2;
    duree = `${formatJours(j)} jour${j > 1 ? "s" : ""}`;
  } else if (jour.kind === "cpi") {
    code = "CPI";
    periode = formatPeriodeDemande(jour.cpi.debut, jour.cpi.fin);
    duree = `${formatJours(dureeCongeImpose(jour.cpi, joursFeries))} j`;
  } else if (jour.kind === "dji") {
    // Couleur CPI + libellé "CI" (24/08/2026, demande explicite) — même
    // convention de fusion CPI/DJI sous "Congés imposés" que
    // `ProchainsJoursOffCard`/`compterTypologies`, plutôt que d'afficher
    // "DJI" isolément ici.
    code = "CPI";
    label = "CI";
    periode = formatDate(jour.dji.date);
    duree = jour.dji.demiJournee === "matin" ? "Matin" : "Après-midi";
  } else {
    code = "FERIE";
    periode = formatDate(jour.ferie.date);
    duree = jour.ferie.libelle;
  }

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onFermer} />
      <div
        style={{ position: "fixed", top: ancre.bottom + 8, left: ancre.left }}
        className="bg-surface-card z-30 flex w-56 flex-col gap-2 rounded-xl p-3 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <TypeBadge code={code} label={label} />
          <div className="text-ink-900 text-sm font-bold">{periode}</div>
        </div>
        <div className="text-ink-500 text-xs">{duree}</div>
        {jour.kind === "demande" && <StatusBadge statut={jour.demande.statut} />}
      </div>
    </>
  );
}
