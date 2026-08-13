import type { DemandeEquipe } from "@/lib/types";
import { formatJours, formatPeriodeDemande } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { TypeBadge } from "@/components/demandes/TypeBadge";

interface DemandeEquipeRowProps {
  demande: DemandeEquipe;
  isLast: boolean;
  enCours: boolean;
  onApprouver: () => void;
  onRefuser: () => void;
}

export function DemandeEquipeRow({
  demande,
  isLast,
  enCours,
  onApprouver,
  onRefuser,
}: DemandeEquipeRowProps) {
  const jours = demande.nbDemiJournees / 2;
  const codeBadge = demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;

  return (
    <div className={`flex flex-col gap-3 px-4 py-3 ${isLast ? "" : "border-ink-300/60 border-b"}`}>
      <div className="flex items-center gap-3">
        <TypeBadge code={codeBadge} />
        <div className="min-w-0 flex-1">
          <div className="text-ink-900 text-sm font-bold">
            {demande.demandeur.prenom} {demande.demandeur.nom}
          </div>
          <div className="text-ink-500 text-xs">
            {formatPeriodeDemande(demande.debut, demande.fin)} · {formatJours(jours)} jour
            {jours > 1 ? "s" : ""}
          </div>
          {demande.note && <div className="text-ink-500 mt-0.5 text-xs">« {demande.note} »</div>}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={enCours}
          onClick={onRefuser}
          className="rounded-full px-3.5 py-1.5 text-xs"
        >
          Refuser
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={enCours}
          onClick={onApprouver}
          className="rounded-full px-3.5 py-1.5 text-xs"
        >
          Approuver
        </Button>
      </div>
    </div>
  );
}
