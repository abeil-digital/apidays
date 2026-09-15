"use client";

import { X } from "lucide-react";
import { formatDate, formatJours, formatPeriodeDemande } from "@/lib/format";
import { dureeCongeImpose } from "@/lib/joursFeries";
import type { CongeImpose, DjImposee, JourFerie } from "@/lib/types";
import { classeFondTypeBadge, TypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

/** Jour "commun" cliqué — congé imposé (CPI, période), demi-journée imposée
 * (DJI) ou jour férié. Sous-ensemble de `JourCalendrierClique` (exclut
 * "demande", qui ouvre `DetailCongePanel`, pas ce panneau). */
export type JourCommunClique =
  | { kind: "cpi"; cpi: CongeImpose }
  | { kind: "dji"; dji: DjImposee }
  | { kind: "ferie"; ferie: JourFerie };

/**
 * Détail d'un jour "commun" (CI/FE) dans la 4ᵉ colonne du calendrier
 * (14/09/2026, demande explicite de Vincent — "traiter en card congé détail
 * les CI... et les FE aussi") : même gabarit que `DetailCongePanel`/
 * `DetailSoldeDepartPanel` (bandeau coloré + `TypeBadge` + fermer, `xl:sticky`),
 * mais en lecture seule — un CI/FE n'est jamais modifiable par le
 * collaborateur, pas de section Décision/Annulation comme sur une demande
 * personnelle. Ne remplace PAS `SnippetJourCalendrier` (le popover au clic
 * reste utilisé ailleurs/pour l'instant, demande explicite "tu ne remplaces
 * pas les over") — ce panneau est un point d'entrée supplémentaire, propre
 * à ce calendrier.
 */
export function DetailJourCommunPanel({
  jour,
  joursFeries,
  onClose,
}: {
  jour: JourCommunClique;
  /** Nécessaire uniquement pour calculer la durée d'un CPI (jours ouvrés
   * moins fériés) — ignoré pour "dji"/"ferie". */
  joursFeries: JourFerie[];
  onClose: () => void;
}) {
  let code: TypeBadgeCode;
  let label: string | undefined;
  let titre: string;
  let periode: string;
  let duree: string;
  if (jour.kind === "cpi") {
    code = "CPI";
    titre = "Congé imposé";
    periode = formatPeriodeDemande(jour.cpi.debut, jour.cpi.fin);
    duree = `${formatJours(dureeCongeImpose(jour.cpi, joursFeries))} j`;
  } else if (jour.kind === "dji") {
    code = "CPI";
    label = "CI";
    titre = "Congé imposé";
    periode = formatDate(jour.dji.date);
    duree = jour.dji.demiJournee === "matin" ? "Matin" : "Après-midi";
  } else {
    code = "FERIE";
    titre = "Jour férié";
    periode = formatDate(jour.ferie.date);
    duree = jour.ferie.libelle;
  }

  return (
    <div className="flex w-full flex-col gap-[3px] xl:sticky xl:top-4 xl:w-64 xl:shrink-0">
      <div className="bg-surface-card w-full pb-[25px] shadow-sm">
        <div className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(code)}`}>
          <div className="flex items-center gap-2.5">
            <div className="rounded-full ring-2 ring-white">
              <TypeBadge code={code} label={label} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{titre}</div>
              <div className="text-xs font-semibold text-white/80">{periode}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-white/70 hover:text-white"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="text-ink-500 text-xs">{duree}</div>
        </div>

        {/* Pas de section Décision/Annulation (14/09/2026, "non modifiable
            par le collaborateur") — juste un rappel explicite, même
            registre que les mentions "Passé en paie..." de
            `DetailCongePanel`. */}
        <div className="border-ink-300/60 text-ink-500 mt-3 border-t px-4 pt-3 text-[11px]">
          Non modifiable — paramétré par l&apos;administrateur.
        </div>
      </div>
    </div>
  );
}
