import type { Demande } from "@/lib/types";
import { formatDate, formatJours, formatPeriodeDemande } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TypeBadge } from "@/components/demandes/TypeBadge";

interface RequestRowProps {
  demande: Demande;
  isLast: boolean;
}

export function RequestRow({ demande, isLast }: RequestRowProps) {
  const jours = demande.nbDemiJournees / 2;
  // "Congés anticipés" n'est pas un type d'absence distinct en base (voir
  // NouvelleDemandeForm) — c'est un CP avec is_anticipation=true, affiché
  // avec le badge "CPA" pour le distinguer visuellement d'un CP classique.
  const codeBadge = demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${isLast ? "" : "border-ink-300/60 border-b"}`}
    >
      <TypeBadge code={codeBadge} />
      <div className="min-w-0 flex-1">
        <div className="text-ink-900 text-sm font-bold">
          {formatPeriodeDemande(demande.debut, demande.fin)}
        </div>
        <div className="text-ink-500 text-xs">
          {formatJours(jours)} jour{jours > 1 ? "s" : ""} - posé le{" "}
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
