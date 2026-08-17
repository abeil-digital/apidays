import { formatJours } from "@/lib/format";
import { TypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

export type SoldeCardTone = "cp" | "rtt" | "cpa";

const TONE_CODE: Record<SoldeCardTone, TypeBadgeCode> = {
  cp: "CP",
  rtt: "RTT",
  cpa: "CPA",
};

interface SoldeCardProps {
  valeur: number;
  conditionPrefixe: string;
  conditionAccent: string;
  tone: SoldeCardTone;
  /** Coins carrés au lieu d'arrondis — variante utilisée par Accueil2
   * (`Dashboard3Page`, en cours d'itération), défaut inchangé partout
   * ailleurs. */
  carre?: boolean;
}

export function SoldeCard({
  valeur,
  conditionPrefixe,
  conditionAccent,
  tone,
  carre = false,
}: SoldeCardProps) {
  return (
    <div
      className={`bg-surface-card flex h-full w-full flex-col gap-1.5 p-4 shadow-sm ${carre ? "" : "rounded-xl"}`}
    >
      <TypeBadge code={TONE_CODE[tone]} />
      <span className="text-ink-900 text-2xl font-bold">{formatJours(valeur)} j</span>
      <span className="text-ink-500 text-xs leading-snug">
        {conditionPrefixe} <span className="text-ink-900 font-bold">{conditionAccent}</span>
      </span>
    </div>
  );
}
