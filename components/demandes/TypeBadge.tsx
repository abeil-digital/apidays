export type TypeBadgeCode =
  "CP" | "RTT" | "CPA" | "CSS" | "CE" | "RECUP" | "EVT_FAM" | "DJI" | "CPI" | "FERIE";

const CODE_STYLES: Record<TypeBadgeCode, string> = {
  CP: "bg-cp",
  RTT: "bg-rtt",
  CPA: "bg-cpa",
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
  CPA: "border-cpa text-cpa",
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
  CPA: "CPA",
  CSS: "CSS",
  CE: "CE",
  RECUP: "RÉC",
  EVT_FAM: "ÉVT",
  DJI: "DJI",
  CPI: "CPI",
  FERIE: "FE",
};

/** Classe Tailwind de fond plein d'un code — pour réutiliser la même couleur
 * hors du badge (ex. pastille de calendrier). */
export function classeFondTypeBadge(code: TypeBadgeCode): string {
  return CODE_STYLES[code];
}

// Variante atténuée (opacité 50%, ex. demande "en attente") — classes écrites
// en toutes lettres plutôt que construites dynamiquement (`${classe}/50`) :
// Tailwind ne génère que les classes qu'il peut voir littéralement dans le
// code source, une concaténation à l'exécution ne produit aucun style.
const CODE_STYLES_ATTENUE: Record<TypeBadgeCode, string> = {
  CP: "bg-cp/50",
  RTT: "bg-rtt/50",
  CPA: "bg-cpa/50",
  CSS: "bg-css/50",
  CE: "bg-ce/50",
  RECUP: "bg-recup/50",
  EVT_FAM: "bg-evtfam/50",
  DJI: "bg-dji/50",
  CPI: "bg-cp/50",
  FERIE: "bg-ferie/50",
};

/** Classe Tailwind de fond atténué (opacité 50%) d'un code — voir
 * `classeFondTypeBadge` pour la variante pleine. */
export function classeFondAttenueTypeBadge(code: TypeBadgeCode): string {
  return CODE_STYLES_ATTENUE[code];
}

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

interface TypeBadgePillEnhancedProps {
  code: TypeBadgeCode;
  label: string;
}

/** Variante pill agrandie de `TypeBadge` — soldes de premier plan (ex. solde
 * de référence / solde actuel), à distinguer visuellement des pastilles de
 * mouvement courantes. */
export function TypeBadgePillEnhanced({ code, label }: TypeBadgePillEnhancedProps) {
  return (
    <span
      className={`rounded-full px-4 py-1.5 text-base font-bold whitespace-nowrap text-white ${CODE_STYLES[code]}`}
    >
      {label}
    </span>
  );
}
