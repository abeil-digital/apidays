import type { ReactNode } from "react";

interface JourBadgeProps {
  /** Repère court (ex. "Lu", "Ve", un chiffre de jour) — pas de contrainte de contenu. */
  children: ReactNode;
  /** Ligne grisée (ex. jour fixe neutralisé) — bascule le texte en `ink-500`. */
  muted?: boolean;
  className?: string;
}

/**
 * Encart carré arrondi utilisé en tête d'une ligne "jour" dans les listes
 * référentielles (DJI/CPI/Fériés) — abréviation du jour de semaine ou numéro,
 * fond neutre `surface-app`. Toujours le même gabarit 36×36 (`h-9 w-9`) pour
 * garder les listes alignées entre popins.
 */
export function JourBadge({ children, muted, className = "" }: JourBadgeProps) {
  return (
    <div
      className={`bg-surface-app flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
        muted ? "text-ink-500" : "text-ink-900"
      } ${className}`}
    >
      {children}
    </div>
  );
}
