import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

interface SelectPilleProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Couleur de bordure à l'état actif — défaut `border-mint`. Opt-in : les
   * appelants existants (popins DJI/CPI) ne passent rien, comportement
   * inchangé. */
  borderClassName?: string;
  /** Couleur du chevron à l'état actif — défaut `text-mint`. */
  chevronClassName?: string;
  /** Fond au survol à l'état actif — défaut `enabled:hover:bg-mint-tint`. */
  hoverClassName?: string;
  /** Retire l'anneau de focus (`focus-visible:ring-mint`) — utilisé par
   * "Poser un jour" (18/08/2026) dont l'état actif est déjà porté par la
   * couleur du type, l'anneau devenait redondant. Défaut : anneau conservé. */
  sansAnneauFocus?: boolean;
}

/**
 * Select stylé en pilule (fond + coins arrondis complets, chevron bas) —
 * utilisé pour les sélecteurs de créneau (demi-journée) dans les popins
 * DJI/CPI. Fond mint au survol quand actif (`enabled:hover:`, jamais sur un
 * select désactivé), grisé en lecture seule.
 */
export function SelectPille({
  className,
  disabled,
  borderClassName = "border-mint",
  chevronClassName = "text-mint",
  hoverClassName = "enabled:hover:bg-mint-tint",
  sansAnneauFocus = false,
  ...rest
}: SelectPilleProps) {
  const couleur = disabled
    ? "border-ink-300 text-ink-500"
    : `${borderClassName} text-ink-900 ${hoverClassName} cursor-pointer`;
  const couleurChevron = disabled ? "text-ink-500" : chevronClassName;
  const anneau = sansAnneauFocus
    ? ""
    : "focus-visible:ring-mint focus-visible:ring-2 focus-visible:ring-offset-1";
  return (
    <div className="relative inline-block">
      <select
        disabled={disabled}
        {...rest}
        className={`bg-surface-card appearance-none rounded-full border py-1 pr-6 pl-3 text-xs transition-colors duration-150 outline-none ${anneau} ${couleur} ${className ?? ""}`}
      />
      <ChevronDown
        size={12}
        className={`pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 ${couleurChevron}`}
      />
    </div>
  );
}
