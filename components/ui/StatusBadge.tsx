import { CheckCircle2, Hourglass, XCircle, type LucideIcon } from "lucide-react";
import type { StatutDemande } from "@/lib/types";

interface StatusConfig {
  bg: string;
  fg: string;
  label: string;
  Icon: LucideIcon;
}

const STATUT_CONFIG: Record<StatutDemande, StatusConfig> = {
  validé: {
    bg: "bg-status-success-bg",
    fg: "text-status-success-fg",
    label: "Validé",
    Icon: CheckCircle2,
  },
  "en attente": {
    bg: "bg-status-warning-bg",
    fg: "text-status-warning-fg",
    label: "En attente",
    Icon: Hourglass,
  },
  refusé: {
    bg: "bg-status-danger-bg",
    fg: "text-status-danger-fg",
    label: "Refusé",
    Icon: XCircle,
  },
};

interface StatusBadgeProps {
  statut: StatutDemande;
}

export function StatusBadge({ statut }: StatusBadgeProps) {
  const { bg, fg, label, Icon } = STATUT_CONFIG[statut];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${bg} ${fg}`}
    >
      <Icon size={13} strokeWidth={2.5} />
      {label}
    </span>
  );
}
