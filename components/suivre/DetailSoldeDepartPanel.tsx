"use client";

import { X } from "lucide-react";
import { formatJours } from "@/lib/format";
import {
  classeFondTypeBadge,
  TypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";

// Pas de jour de semaine (14/09/2026, demande explicite de Vincent) — "Solde
// N-1" est une date de référence (début de période), pas un événement daté
// au jour près comme une régularisation (`DetailAjustementPanel`, qui garde
// le sien) : le jour de semaine n'apporte rien ici.
function formatDateLongue(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateIso}T00:00:00Z`));
}

/**
 * Détail de la constitution de "Solde N-1" (14/09/2026, "rendre tangible" la
 * bascule — demande explicite de Vincent, précisée après un premier essai en
 * lignes ajoutées directement dans le tableau d'événements, écarté au profit
 * d'un panneau latéral au clic, même gabarit que `DetailAjustementPanel` :
 * "Solde N-1" reste une seule ligne opaque dans le tableau, cliquable quand
 * un détail existe (`historique.decompositionDepart`), qui ouvre CE panneau
 * plutôt que d'éclater la ligne elle-même. Repris à l'identique de
 * `DetailAjustementPanel` — même structure de card/bandeau/pied — seul le
 * corps change : une liste de composantes (CPA N-1/ancienneté/report) au
 * lieu d'un delta unique.
 */
export function DetailSoldeDepartPanel({
  code,
  nomComplet,
  date,
  total,
  decomposition,
  onClose,
  pleineLargeur = false,
}: {
  code: TypeBadgeCode;
  nomComplet: string;
  date: string;
  total: number;
  decomposition: { libelle: string; jours: number }[];
  onClose: () => void;
  pleineLargeur?: boolean;
}) {
  return (
    <div
      className={`flex w-full flex-col gap-[3px] ${pleineLargeur ? "" : "xl:sticky xl:top-4 xl:w-64 xl:shrink-0"}`}
    >
      <div className="bg-surface-card w-full pb-[25px] shadow-sm">
        <div className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(code)}`}>
          <div className="flex items-center gap-2.5">
            <div className="rounded-full ring-2 ring-white">
              <TypeBadge code={code} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{nomComplet}</div>
              <div className="text-xs font-semibold text-white/80">Solde N-1</div>
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
          <div className="text-ink-900 min-w-0 flex-1 text-sm font-semibold capitalize">
            {formatDateLongue(date)}
          </div>
          <span className="text-ink-900 text-sm font-bold">{formatJours(total)} j</span>
        </div>

        <div className="border-ink-300/60 flex flex-col gap-1.5 border-t px-4 pt-3">
          {decomposition.map((c) => (
            <div key={c.libelle} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${classeFondTypeBadge(code)}`} />
                <span className="text-ink-500 truncate text-[11px]">{c.libelle}</span>
              </div>
              <span className="text-ink-900 shrink-0 text-[11px] font-semibold">
                {c.jours > 0 ? "+" : ""}
                {formatJours(c.jours)} j
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
