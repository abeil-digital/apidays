export type TypeBadgeCode = "CP" | "RTT" | "CPT" | "CSS" | "CE" | "RECUP" | "EVT_FAM";

const CODE_STYLES: Record<TypeBadgeCode, string> = {
  CP: "bg-cp",
  RTT: "bg-rtt",
  CPT: "bg-cpt",
  CSS: "bg-css",
  CE: "bg-ce",
  RECUP: "bg-recup",
  EVT_FAM: "bg-evtfam",
};

// Libellé court affiché dans le badge (cercle 36px) — les codes longs comme
// "EVT_FAM" ne tiennent pas tels quels.
const LABEL_COURT: Record<TypeBadgeCode, string> = {
  CP: "CP",
  RTT: "RTT",
  CPT: "CPT",
  CSS: "CSS",
  CE: "CE",
  RECUP: "RÉC",
  EVT_FAM: "ÉVT",
};

interface TypeBadgeProps {
  code: TypeBadgeCode;
}

export function TypeBadge({ code }: TypeBadgeProps) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${CODE_STYLES[code]}`}
    >
      {LABEL_COURT[code]}
    </div>
  );
}
