import { Ban, CheckCircle2, Hourglass, XCircle, type LucideIcon } from "lucide-react";
import type { LigneExportPaie, StatutDemande } from "@/lib/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

interface StatusConfig {
  tone: BadgeTone;
  label: string;
  Icon: LucideIcon;
}

/** Exportée pour les variantes qui remplacent le libellé par défaut (ex.
 * `SuiviDemandeRow`, qui affiche le nombre de jours à la place du statut). */
export const STATUT_CONFIG: Record<StatutDemande, StatusConfig> = {
  validé: { tone: "success", label: "Validé", Icon: CheckCircle2 },
  "en attente": { tone: "warning", label: "En attente", Icon: Hourglass },
  refusé: { tone: "danger", label: "Refusé", Icon: XCircle },
  annulé: { tone: "danger", label: "Annulé", Icon: Ban },
};

interface StatusBadgeProps {
  statut: StatutDemande;
  /** Lignes de transmission paie (18/09/2026, demande explicite — point (9)
   * du chantier "Parcours transmission paie") : un congé annulé APRÈS avoir
   * été pris en compte en paie reste "Annulé" (rouge) indéfiniment une fois
   * la ligne de correction (retro) transmise, alors que sa régularisation
   * est bel et bien prise en compte — trompeur, à distinguer visuellement.
   * Absent = comportement inchangé partout ailleurs (`RequestRow`,
   * `SnippetJourCalendrier`, ...). */
  lignes?: LigneExportPaie[];
}

export function StatusBadge({ statut, lignes }: StatusBadgeProps) {
  const ligneRegul = lignes?.find((l) => l.joursInclus < 0);
  const regularise = statut === "annulé" && ligneRegul?.prisEnCompteLe != null;
  const { tone, label, Icon } = regularise
    ? { tone: "success" as const, label: "Régularisé", Icon: CheckCircle2 }
    : STATUT_CONFIG[statut];

  return (
    <Badge tone={tone}>
      <Icon size={13} strokeWidth={2.5} />
      {label}
    </Badge>
  );
}
