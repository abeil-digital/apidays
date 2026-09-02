"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Send } from "lucide-react";
import { libellePeriode, periodePaieParDefaut, periodesPrecedentes } from "@/lib/periodePaie";
import { fetchExportsPaie } from "@/lib/data/exportsPaie.repository";

const NB_ARCHIVES = 12;

function LignePeriode({
  periode,
  sousTitre,
  exportPaie,
}: {
  periode: { debut: string; fin: string };
  sousTitre?: string;
  /** Statut de transmission de cette période (25/08/2026, repasse technique
   * — voir doc du composant) — `undefined` tant que le chargement groupé
   * n'a pas répondu, `null` si la période n'a jamais été transmise. */
  exportPaie: { id: string; genereLe: string } | null | undefined;
}) {
  return (
    <Link
      href={`/suivre/transmissions-paie/${periode.debut}`}
      className="bg-surface-card hover:bg-mint-tint group flex items-center gap-3 rounded-xl px-4 py-3 shadow-sm transition-colors duration-150"
    >
      <div className="min-w-0 flex-1">
        <div className="text-ink-900 font-semibold">{libellePeriode(periode)}</div>
        {sousTitre && <div className="text-ink-500 text-xs">{sousTitre}</div>}
      </div>
      {exportPaie && (
        <span className="text-status-success-fg flex shrink-0 items-center gap-1 text-xs font-semibold">
          <Send size={12} />
          Transmis le {new Date(exportPaie.genereLe).toLocaleDateString("fr-FR")}
        </span>
      )}
      <ChevronRight size={18} className="text-ink-500 shrink-0" />
    </Link>
  );
}

/**
 * "Transmissions paie" (`/suivre/transmissions-paie`, 24/08/2026) — page liste en amont
 * du parcours par période (`TransmissionsPaiePage`, onglets "Quels congés
 * transmettre"/"Générer l'export"/"Vérifier les fiches de paie"). Deux
 * sections, demande explicite de Vincent :
 * - **Mois en cours** : accès direct à la période active
 *   (`periodePaieParDefaut`), carte seule mise en avant.
 * - **Archives** : les `NB_ARCHIVES` périodes précédentes
 *   (`periodesPrecedentes`), chacune menant au même écran par période — même
 *   route `/suivre/transmissions-paie/[debut]`, `debut` (01 du mois) sert de clé de
 *   période dans l'URL.
 *
 * Statut de transmission par ligne (25/08/2026, repasse technique — jusque-là
 * absent : une archive montrait les mêmes données qu'une période en cours,
 * sans distinction de ce qui avait réellement été transmis, alors que
 * `exports_paie` porte cette information depuis le 24/08/2026) —
 * `fetchExportsPaie` en un seul aller-retour groupé pour les 13 périodes
 * affichées, plutôt qu'un fetch par ligne.
 */
export function ListeTransmissionsPaiePage() {
  const moisEnCours = periodePaieParDefaut();
  const archives = periodesPrecedentes(NB_ARCHIVES, new Date(`${moisEnCours.debut}T00:00:00`));
  const [exportsParPeriode, setExportsParPeriode] = useState<
    Record<string, { id: string; genereLe: string }>
  >({});

  useEffect(() => {
    let cancelled = false;
    fetchExportsPaie([moisEnCours, ...archives]).then((data) => {
      if (!cancelled) setExportsParPeriode(data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- périodes dérivées de la date du jour, stables pour la durée de vie du composant
  }, []);

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0">
      <h1 className="text-slate px-1 text-2xl font-semibold">Transmissions paie</h1>

      <div className="flex flex-col gap-2">
        <h2 className="text-ink-500 px-1 text-sm font-bold">Mois en cours</h2>
        <LignePeriode
          periode={moisEnCours}
          sousTitre="Quels congés transmettre + génération de l'export"
          exportPaie={exportsParPeriode[moisEnCours.debut]}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-ink-500 px-1 text-sm font-bold">Archives</h2>
        <div className="flex flex-col gap-2">
          {archives.map((periode) => (
            <LignePeriode
              key={periode.debut}
              periode={periode}
              exportPaie={exportsParPeriode[periode.debut]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
