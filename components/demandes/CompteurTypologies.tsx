import { formatJours } from "@/lib/format";
import { classeFondTypeBadge } from "@/components/demandes/TypeBadge";
import type { TypologieCompteur } from "@/components/demandes/compterTypologies";

/**
 * Rangée de compteurs "puce de couleur + intitulé (X j)" par typologie de
 * congé — entre les onglets de sélection de période et le calendrier/liste,
 * sur Accueil et `/suivre/calendrier` (24/08/2026, demande explicite : puce
 * `classeFondTypeBadge`, texte `text-[11px] font-semibold text-ink-500`).
 * `null` si aucune typologie sur la période (rien à afficher plutôt qu'une
 * rangée vide).
 */
export function CompteurTypologies({ typologies }: { typologies: TypologieCompteur[] }) {
  if (typologies.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 px-1">
      {typologies.map((t) => (
        <span key={t.code} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(t.code)}`} />
          <span className="text-ink-500 text-[11px] font-semibold">
            {t.label} ({formatJours(t.jours)} j)
          </span>
        </span>
      ))}
    </div>
  );
}
