export type TypeBadgeCode = "CP" | "RTT" | "CPT";

const CODE_STYLES: Record<TypeBadgeCode, string> = {
  CP: "bg-cp",
  RTT: "bg-rtt",
  CPT: "bg-cpt",
};

interface TypeBadgeProps {
  code: TypeBadgeCode;
}

export function TypeBadge({ code }: TypeBadgeProps) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${CODE_STYLES[code]}`}
    >
      {code}
    </div>
  );
}
