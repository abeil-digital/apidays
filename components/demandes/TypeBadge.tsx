export type TypeBadgeCode =
  "CP" | "RTT" | "CPT" | "CSS" | "CE" | "RECUP" | "EVT_FAM" | "DJI" | "CPI" | "FERIE";

const CODE_STYLES: Record<TypeBadgeCode, string> = {
  CP: "bg-cp",
  RTT: "bg-rtt",
  CPT: "bg-cpt",
  CSS: "bg-css",
  CE: "bg-ce",
  RECUP: "bg-recup",
  EVT_FAM: "bg-evtfam",
  DJI: "bg-dji",
  CPI: "bg-cp", // même couleur que CP — congé payé imposé
  FERIE: "bg-ferie",
};

// Variante "outline" (liséré coloré, fond transparent, texte coloré) — utilisée
// pour les pastilles de sous-catégorie (ex. Matin/A. Midi sur une DJ imposée).
const CODE_STYLES_OUTLINE: Record<TypeBadgeCode, string> = {
  CP: "border-cp text-cp",
  RTT: "border-rtt text-rtt",
  CPT: "border-cpt text-cpt",
  CSS: "border-css text-css",
  CE: "border-ce text-ce",
  RECUP: "border-recup text-recup",
  EVT_FAM: "border-evtfam text-evtfam",
  DJI: "border-dji text-dji",
  CPI: "border-cp text-cp",
  FERIE: "border-ferie text-ferie",
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
  DJI: "DJI",
  CPI: "CPI",
  FERIE: "FE",
};

interface TypeBadgeProps {
  code: TypeBadgeCode;
  variant?: "circle" | "outline" | "pill";
  /** Texte affiché à la place du libellé court par défaut (ex. "Matin" au lieu de "DJI"). */
  label?: string;
}

export function TypeBadge({ code, variant = "circle", label }: TypeBadgeProps) {
  if (variant === "outline") {
    return (
      <span
        className={`rounded-full border bg-transparent px-2.5 py-1 text-xs font-bold whitespace-nowrap ${CODE_STYLES_OUTLINE[code]}`}
      >
        {label ?? LABEL_COURT[code]}
      </span>
    );
  }

  if (variant === "pill") {
    return (
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap text-white ${CODE_STYLES[code]}`}
      >
        {label ?? LABEL_COURT[code]}
      </span>
    );
  }

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${CODE_STYLES[code]}`}
    >
      {LABEL_COURT[code]}
    </div>
  );
}
