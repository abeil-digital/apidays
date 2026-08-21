import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

/** Chevron custom superposé (21/08/2026, mise en cohérence DS) — la flèche
 * native du navigateur n'est stylée nulle part ailleurs dans l'app
 * (`SelectFiltrePill`/`SelectPille` ont déjà ce traitement, en mint —
 * réservé à l'accent "filtre" ; ici en `text-ink-500`, neutre, pour un champ
 * de formulaire standard). `className` (largeur, marges…) passe désormais
 * sur le conteneur plutôt que sur le `<select>` lui-même, qui reste `w-full`
 * en interne. */
export function Select({ error, className = "", children, ...props }: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        className={`rounded-control bg-surface-card text-ink-900 w-full appearance-none border px-3 py-2.5 pr-8 text-sm ${
          error ? "border-status-danger-fg" : "border-ink-300"
        }`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="text-ink-500 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      />
    </div>
  );
}
