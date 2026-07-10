import type { Demande } from "@/lib/types";
import { formatRange } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RowIcon } from "@/components/demandes/RowIcon";

interface RequestRowProps {
  demande: Demande;
  isLast: boolean;
}

export function RequestRow({ demande, isLast }: RequestRowProps) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${isLast ? "" : "border-ink-300/60 border-b"}`}
    >
      <RowIcon type={demande.type} />
      <div className="min-w-0 flex-1">
        <div className="text-ink-900 truncate text-sm font-semibold">
          {formatRange(demande.debut, demande.fin)}
        </div>
        <div className="text-ink-500 text-xs">{demande.type === "CP" ? "Congé payé" : "RTT"}</div>
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
