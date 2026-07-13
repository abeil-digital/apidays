import { formatJours } from "@/lib/format";

export type SoldeCardTone = "cp" | "rtt" | "cpt";

const TONE_BAND: Record<SoldeCardTone, string> = {
  cp: "bg-solde-cp",
  rtt: "bg-solde-rtt",
  cpt: "bg-solde-cpt",
};

interface SoldeCardProps {
  label: string;
  valeur: number;
  conditionPrefixe: string;
  conditionAccent: string;
  tone: SoldeCardTone;
}

export function SoldeCard({
  label,
  valeur,
  conditionPrefixe,
  conditionAccent,
  tone,
}: SoldeCardProps) {
  return (
    <div className="rounded-card bg-surface-card flex w-full overflow-hidden shadow-sm">
      <div className={`w-2 shrink-0 ${TONE_BAND[tone]}`} />
      <div className="flex flex-1 items-center gap-3 px-4 py-3.5">
        <span className="text-solde-ink text-2xl font-bold">{label}</span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-solde-ink text-lg font-bold">{formatJours(valeur)} j</span>
          <span className="text-solde-ink/60 text-xs leading-snug">
            {conditionPrefixe} <span className="text-solde-ink font-bold">{conditionAccent}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
