export type TypeBadgeCode = "CP" | "RTT" | "CPT";

const CODE_STYLES: Record<TypeBadgeCode, string> = {
  CP: "bg-brand text-brand-foreground",
  RTT: "bg-ink-400 text-white",
  CPT: "bg-solde-cpt text-solde-ink",
};

interface TypeBadgeProps {
  code: TypeBadgeCode;
}

export function TypeBadge({ code }: TypeBadgeProps) {
  return (
    <div
      className={`rounded-control flex h-9 w-11 shrink-0 items-center justify-center text-xs font-bold ${CODE_STYLES[code]}`}
    >
      {code}
    </div>
  );
}
