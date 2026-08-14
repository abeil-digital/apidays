import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DemandeEquipe } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { TypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

interface CongesConsommesCardProps {
  demandes: DemandeEquipe[];
  loading: boolean;
  libellePeriode: string;
}

const TYPES: TypeBadgeCode[] = ["CP", "RTT", "CPA", "CSS"];

function calculerTotaux(demandes: DemandeEquipe[]): Record<string, number> {
  const totaux: Record<string, number> = { CP: 0, RTT: 0, CPA: 0, CSS: 0 };
  for (const d of demandes) {
    if (d.statut === "annulé") continue;
    const bucket = d.type === "CP" && d.isAnticipation ? "CPA" : d.type;
    if (bucket in totaux) totaux[bucket] += d.nbDemiJournees / 2;
  }
  return totaux;
}

/** Encart de récap paie (Espace Suivre, vue admin) — au-dessus de "Suivi des
 * demandes". Ouvre `/suivre/paie` pour le détail par collaborateur et
 * l'export CSV. */
export function CongesConsommesCard({
  demandes,
  loading,
  libellePeriode,
}: CongesConsommesCardProps) {
  const totaux = calculerTotaux(demandes);

  return (
    <Link
      href="/suivre/paie"
      className="bg-surface-card flex flex-col gap-3 rounded-xl p-4 shadow-sm transition-opacity duration-150 hover:opacity-80"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-ink-900 text-sm font-bold">Congés consommés</div>
          <div className="text-ink-500 text-xs">{libellePeriode}</div>
        </div>
        <ChevronRight size={18} className="text-ink-500 shrink-0" />
      </div>

      {loading ? (
        <div className="text-ink-500 text-xs">Chargement…</div>
      ) : (
        <div className="grid grid-cols-2 justify-items-start gap-2">
          {TYPES.map((code) => (
            <TypeBadge
              key={code}
              code={code}
              variant="pill"
              label={`${formatJours(totaux[code])} j`}
            />
          ))}
        </div>
      )}
    </Link>
  );
}
