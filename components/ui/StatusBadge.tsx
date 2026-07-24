import { CheckCircle2, Hourglass, XCircle, type LucideIcon } from "lucide-react";
import type { StatutDemande } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

interface StatusConfig {
  tone: BadgeTone;
  label: string;
  Icon: LucideIcon;
}

const STATUT_CONFIG: Record<StatutDemande, StatusConfig> = {
  validé: { tone: "success", label: "Validé", Icon: CheckCircle2 },
  "en attente": { tone: "warning", label: "En attente", Icon: Hourglass },
  refusé: { tone: "danger", label: "Refusé", Icon: XCircle },
};

interface StatusBadgeProps {
  statut: StatutDemande;
}

export function StatusBadge({ statut }: StatusBadgeProps) {
  const { tone, label, Icon } = STATUT_CONFIG[statut];

  return (
    <Badge tone={tone}>
      <Icon size={13} strokeWidth={2.5} />
      {label}
    </Badge>
  );
}
