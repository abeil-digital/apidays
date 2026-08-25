"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { libellePeriode, periodePaieParDefaut, periodesPrecedentes } from "@/lib/periodePaie";

const NB_ARCHIVES = 12;

function LignePeriode({
  periode,
  sousTitre,
}: {
  periode: { debut: string; fin: string };
  sousTitre?: string;
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
      <ChevronRight size={18} className="text-ink-500 shrink-0" />
    </Link>
  );
}

/**
 * "Transmissions paie" (`/suivre/transmissions-paie`, 24/08/2026) — page liste en amont
 * du parcours par période (`TransmissionsPaiePage`, onglets Récap congé/Générer
 * l'export). Deux sections, demande explicite de Vincent :
 * - **Mois en cours** : accès direct à la période active
 *   (`periodePaieParDefaut`), carte seule mise en avant.
 * - **Archives** : les `NB_ARCHIVES` périodes précédentes
 *   (`periodesPrecedentes`), chacune menant au même écran par période — même
 *   route `/suivre/transmissions-paie/[debut]`, `debut` (01 du mois) sert de clé de
 *   période dans l'URL.
 *
 * Pas encore de statut "transmis"/"vérifié" affiché sur les archives (le
 * modèle de données ne le porte pas encore, voir discussion du 24/08/2026
 * sur la refonte export paie) — une archive montre aujourd'hui les mêmes
 * données qu'une période en cours (tout ce qui est validé/en attente sur
 * cette période), sans distinction de ce qui a réellement été transmis à
 * l'époque.
 */
export function ListeTransmissionsPaiePage() {
  const moisEnCours = periodePaieParDefaut();
  const archives = periodesPrecedentes(NB_ARCHIVES, new Date(`${moisEnCours.debut}T00:00:00`));

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0">
      <h1 className="text-ink-900 px-1 text-2xl font-semibold">Transmissions paie</h1>

      <div className="flex flex-col gap-2">
        <h2 className="text-ink-500 px-1 text-sm font-bold">Mois en cours</h2>
        <LignePeriode periode={moisEnCours} sousTitre="Récap congé + génération de l'export" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-ink-500 px-1 text-sm font-bold">Archives</h2>
        <div className="flex flex-col gap-2">
          {archives.map((periode) => (
            <LignePeriode key={periode.debut} periode={periode} />
          ))}
        </div>
      </div>
    </div>
  );
}
