import type { Demande } from "@/lib/types";
import { formatDate, formatPeriodeDemande, nombreJours } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TypeBadge } from "@/components/demandes/TypeBadge";

interface RequestRowProps {
  demande: Demande;
  isLast: boolean;
}

export function RequestRow({ demande, isLast }: RequestRowProps) {
  const jours = nombreJours(demande.debut, demande.fin);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${isLast ? "" : "border-ink-300/60 border-b"}`}
    >
      <TypeBadge code={demande.type} />
      <div className="min-w-0 flex-1">
        <div className="text-ink-900 text-sm font-bold">
          {formatPeriodeDemande(demande.debut, demande.fin)}
        </div>
        <div className="text-ink-500 text-xs">
          {jours} jour{jours > 1 ? "s" : ""} - posé le{" "}
          <span className="font-bold">{formatDate(demande.datePose)}</span>
        </div>
        {demande.commentaireManager && (
          <div className="text-status-danger-fg mt-0.5 text-xs">
            « {demande.commentaireManager} »
          </div>
        )}
      </div>
      <StatusBadge statut={demande.statut} />
    </div>
  );
}
