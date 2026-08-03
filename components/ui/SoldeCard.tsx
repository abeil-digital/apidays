import { formatJours } from "@/lib/format";

export type SoldeCardTone = "cp" | "rtt" | "cpt";

const TONE_DOT: Record<SoldeCardTone, string> = {
  cp: "bg-cp",
  rtt: "bg-rtt",
  cpt: "bg-cpt",
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
    <div className="bg-surface-card flex h-full w-full flex-col gap-1.5 rounded-xl p-4 shadow-sm">
      <span className={`h-5 w-5 rounded-full ${TONE_DOT[tone]}`} />
      <span className="text-ink-900 text-sm font-semibold">{label}</span>
      <span className="text-ink-900 text-2xl font-bold">{formatJours(valeur)} j</span>
      <span className="text-ink-500 text-xs leading-snug">
        {conditionPrefixe} <span className="text-ink-900 font-bold">{conditionAccent}</span>
      </span>
    </div>
  );
}
