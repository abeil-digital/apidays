import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

/**
 * Select stylé en pilule (fond + coins arrondis complets, chevron bas) —
 * utilisé pour les sélecteurs de créneau (demi-journée) dans les popins
 * DJI/CPI. Fond mint au survol quand actif (`enabled:hover:`, jamais sur un
 * select désactivé), grisé en lecture seule.
 */
export function SelectPille(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, disabled, ...rest } = props;
  const couleur = disabled
    ? "border-ink-300 text-ink-500"
    : "border-mint text-ink-900 enabled:hover:bg-mint-tint cursor-pointer";
  const couleurChevron = disabled ? "text-ink-500" : "text-mint";
  return (
    <div className="relative inline-block">
      <select
        disabled={disabled}
        {...rest}
        className={`bg-surface-card focus-visible:ring-mint appearance-none rounded-full border py-1 pr-6 pl-3 text-xs transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${couleur} ${className ?? ""}`}
      />
      <ChevronDown
        size={12}
        className={`pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 ${couleurChevron}`}
      />
    </div>
  );
}
