"use client";

import { X } from "lucide-react";
import type { CongeImpose, DemiJournee, DjImposee, JourFerie } from "@/lib/types";
import { classeFondTypeBadge, TypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { PeriodeAvecPastilles } from "@/components/ui/PeriodeAvecPastilles";

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
  onClose,
}: {
  jour: JourCommunClique;
  onClose: () => void;
}) {
  let code: TypeBadgeCode;
  let label: string | undefined;
  let titre: string;
  let debut: string;
  let fin: string;
  let demiDebut: DemiJournee;
  let demiFin: DemiJournee;
  if (jour.kind === "cpi") {
    code = "CPI";
    titre = "Congé imposé";
    debut = jour.cpi.debut;
    fin = jour.cpi.fin;
    demiDebut = "matin";
    demiFin = "apres_midi";
  } else if (jour.kind === "dji") {
    code = "CPI";
    label = "CI";
    titre = "Congé imposé";
    debut = jour.dji.date;
    fin = jour.dji.date;
    demiDebut = jour.dji.demiJournee === "apres_midi" ? "apres_midi" : "matin";
    demiFin = jour.dji.demiJournee === "matin" ? "matin" : "apres_midi";
  } else {
    // Nom du férié en titre, pas de libellé générique (15/09/2026, 3e
    // itération, demande explicite de Vincent).
    code = "FERIE";
    titre = jour.ferie.libelle;
    debut = jour.ferie.date;
    fin = jour.ferie.date;
    demiDebut = "matin";
    demiFin = "apres_midi";
  }

  return (
    <div className="flex w-full flex-col gap-[3px] xl:sticky xl:top-4 xl:w-64 xl:shrink-0">
      <div className="bg-surface-card w-full pb-[25px] shadow-sm">
        <div className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(code)}`}>
          <div className="flex items-center gap-2.5">
            <div className="rounded-full ring-2 ring-white">
              <TypeBadge code={code} label={label} />
            </div>
            <div className="text-sm font-bold text-white">{titre}</div>
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

        {/* Date/jour au format des congés normaux (`PeriodeAvecPastilles`,
            `JourBadge` 2 lettres) — 15/09/2026, demande explicite de Vincent.
            Pas de badge durée ni de mention "Non modifiable" (retirés le
            même jour, 2e itération). */}
        <div className="px-4 pt-3">
          <PeriodeAvecPastilles debut={debut} fin={fin} demiDebut={demiDebut} demiFin={demiFin} />
        </div>
      </div>
    </div>
  );
}
