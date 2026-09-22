"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, CheckCircle2 } from "lucide-react";
import { todayISO } from "@/lib/format";
import { fetchExportPaie } from "@/lib/data/exportsPaie.repository";

/** "Décembre 2026" — même libellé que `nomMoisAnnee` de
 * `TransmissionsPaiePage.tsx`/`VerifierFichesPaiePage2.tsx`/
 * `KanbanDemandes.tsx` (non exporté, réécrit ici comme partout ailleurs
 * dans le projet). */
function nomMoisAnnee(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(`${dateIso}T00:00:00Z`),
  );
}

function bornesMoisEnCours(): { debut: string; fin: string } {
  const aujourdhui = todayISO();
  const [annee, mois] = aujourdhui.split("-").map(Number);
  const dernierJour = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return {
    debut: `${aujourdhui.slice(0, 7)}-01`,
    fin: `${aujourdhui.slice(0, 7)}-${String(dernierJour).padStart(2, "0")}`,
  };
}

/**
 * Bandeau "rappel export paie" au-dessus du Kanban de "Suivre les
 * demandes" (22/09/2026, demande de Vincent) — n'apparaît qu'à partir du
 * 21 de chaque mois (on repart à zéro le 1er, aucune notion de retard
 * reporté d'un mois sur l'autre), 3 états selon l'avancement de l'export
 * du mois en cours (`exports_paie`, même donnée que "Quels congés
 * transmettre"/"Vérifier les fiches de paie") :
 * 1. Aucun export généré → rappel "à préparer", ton warning.
 * 2. Export généré mais pas encore `pris_en_compte` → rappel "à vérifier",
 *    ton warning.
 * 3. Export généré ET pris en compte → confirmation, ton success, pas de
 *    bouton.
 */
export function BandeauExportPaie() {
  const bornes = bornesMoisEnCours();
  const jourDuMois = Number(todayISO().slice(8, 10));
  const [exportPaie, setExportPaie] = useState<Awaited<ReturnType<typeof fetchExportPaie>>>(null);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    if (jourDuMois < 21) return;
    let cancelled = false;
    fetchExportPaie(bornes).then((data) => {
      if (!cancelled) {
        setExportPaie(data);
        setCharge(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `bornes` recalculée à l'identique tant qu'on reste dans le même mois
  }, [bornes.debut]);

  if (jourDuMois < 21 || !charge) return null;

  const mois = nomMoisAnnee(bornes.debut);
  const lien = `/suivre/transmissions-paie/${bornes.debut}`;

  if (exportPaie?.prisEnCompte) {
    return (
      <div className="text-ink-900 flex items-center gap-2 rounded-xl bg-yellow-200 px-4 py-3 text-sm font-semibold">
        <CheckCircle2 size={16} className="shrink-0" />
        Fiches de paie {mois} vérifiées.
      </div>
    );
  }

  return (
    <div className="text-ink-900 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-yellow-200 px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Clock size={16} className="shrink-0" />
        {exportPaie
          ? `Export paie passé — vérifier les soldes fiche de paie ${mois}`
          : `Tic Tac Tic Tac — il est temps de préparer les exports paie ${mois}`}
      </span>
      <Link
        href={lien}
        className="bg-status-success-fg shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
      >
        Let&apos;s go
      </Link>
    </div>
  );
}
