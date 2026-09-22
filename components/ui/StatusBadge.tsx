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
   * du chantier "Parcours transmission paie", libellé figé "Annulé (paie)"
   * le 22/09/2026, demande explicite — le statut de la demande ne bouge plus
   * une fois qu'elle a touché la paie, seul `BadgeTransmission`, colonne
   * "Paie" d'`HistoriqueTable`, fait évoluer l'indicateur : À régulariser →
   * Régul transmise → Régul en paie) : un congé annulé APRÈS avoir été
   * transmis en paie reste "Annulé" tout court sinon, indiscernable d'un
   * congé jamais transmis. Absent = comportement inchangé partout ailleurs
   * (`RequestRow`, `SnippetJourCalendrier`, ...). */
  lignes?: LigneExportPaie[];
}

export function StatusBadge({ statut, lignes }: StatusBadgeProps) {
  const toucheLaPaie = statut === "annulé" && (lignes?.length ?? 0) > 0;
  const { tone, label, Icon } = toucheLaPaie
    ? { tone: "danger" as const, label: "Annulé (paie)", Icon: Ban }
    : STATUT_CONFIG[statut];

  return (
    <Badge tone={tone}>
      <Icon size={13} strokeWidth={2.5} />
      {label}
    </Badge>
  );
}
