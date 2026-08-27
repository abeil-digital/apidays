"use client";

import { X } from "lucide-react";
import { formatJours } from "@/lib/format";
import {
  classeFondTypeBadge,
  LABEL_LONG,
  TypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { Badge } from "@/components/ui/Badge";

function formatDateLongue(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateIso}T00:00:00Z`));
}

export interface AjustementDetail {
  code: TypeBadgeCode;
  nomComplet: string;
  deltaJours: number;
  date: string;
  auteurNom: string;
  motif: string;
}

/**
 * Card de détail d'une régularisation manuelle (27/08/2026, demande
 * explicite — "les régul méritent leur card", puis "le composant régul n'a
 * pas du tout la forme et l'aspect des popin congé") : repris à l'identique
 * du gabarit `DetailCongePanel` — même structure `flex flex-col gap-[3px]` +
 * `bg-surface-card pb-[25px] shadow-sm`, même bandeau (`TypeBadge` en
 * anneau blanc + nom + fermer), même ligne date/pastille juste en dessous
 * (`Badge` à `scale-90`), même feed à points en bas (`border-t` + point
 * coloré + texte `text-[10px]` + note en italique) — seul le CONTENU change
 * (date de création au lieu d'une période, "Créé par" au lieu de "Posé le",
 * commentaire en note plutôt que motif de refus).
 */
export function DetailAjustementPanel({
  ajustement,
  onClose,
  pleineLargeur = false,
}: {
  ajustement: AjustementDetail;
  onClose: () => void;
  pleineLargeur?: boolean;
}) {
  const { code, nomComplet, deltaJours, date, auteurNom, motif } = ajustement;

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
              <div className="text-xs font-semibold text-white/80">
                Régularisation {LABEL_LONG[code]}
              </div>
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
          <span className="origin-right scale-90">
            <Badge tone={deltaJours >= 0 ? "success" : "danger"}>
              <span className="text-[14.4px]">
                {deltaJours > 0 ? "+" : ""}
                {formatJours(deltaJours)} j
              </span>
            </Badge>
          </span>
        </div>

        <div className="border-ink-300/60 flex flex-col border-t px-4 pt-3">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${classeFondTypeBadge(code)}`} />
            <span className="text-ink-500 text-[10px]">Créé par {auteurNom}</span>
          </div>
          {motif && (
            <div className="text-ink-500 pt-1 pb-2 pl-[0.875rem] text-[10px] italic">{motif}</div>
          )}
        </div>
      </div>
    </div>
  );
}
