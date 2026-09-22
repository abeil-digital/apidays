import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const TONE_STYLES: Record<BadgeTone, string> = {
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  danger: "bg-status-danger-bg text-status-danger-fg",
  neutral: "bg-status-neutral-bg text-status-neutral-fg",
  /** "info" (22/09/2026) — bleu réservé aux statuts paie déjà confirmés par
   * le comptable (`BadgeTransmission`/`statutPill`, ex. "En paie"). */
  info: "bg-status-info-bg text-status-info-fg",
};

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
}

/**
 * Pastille de statut générique — brique de premier niveau du design system.
 * `StatusBadge` (statuts de demande) en est une fine couche ; toute nouvelle
 * pastille de statut (validation manager, exports paie...) doit passer par
 * `Badge` plutôt que réimplémenter le style à la main.
 */
export function Badge({ tone, children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${TONE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
