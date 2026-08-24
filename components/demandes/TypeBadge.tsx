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
  CPI: "bg-cpi",
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
  CPI: "border-cpi text-cpi",
  FERIE: "border-ferie text-ferie",
};

// Libellé court affiché dans le badge (cercle 36px) — les codes longs comme
// "EVT_FAM" ne tiennent pas tels quels.
export const LABEL_COURT: Record<TypeBadgeCode, string> = {
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

/** Libellé complet — variante "point de couleur + texte" (ex. `SuiviDemandeRow`),
 * reprend le mapping déjà utilisé par la légende d'Accueil 2. */
export const LABEL_LONG: Record<TypeBadgeCode, string> = {
  CP: "Congés Payés",
  RTT: "RTT",
  CPA: "Congés en acquisition",
  CSS: "Congé sans solde",
  CE: "Congé exceptionnel",
  RECUP: "Récupération",
  EVT_FAM: "Événement familial",
  DJI: "Demi-journée imposée",
  CPI: "Congé imposé",
  FERIE: "Jour férié",
};

/** Classe Tailwind de fond plein d'un code — pour réutiliser la même couleur
 * hors du badge (ex. pastille de calendrier). */
export function classeFondTypeBadge(code: TypeBadgeCode): string {
  return CODE_STYLES[code];
}

const CODE_STYLES_BORDURE: Record<TypeBadgeCode, string> = {
  CP: "border-cp",
  RTT: "border-rtt",
  CPA: "border-cpa",
  CSS: "border-css",
  CE: "border-ce",
  RECUP: "border-recup",
  EVT_FAM: "border-evtfam",
  DJI: "border-dji",
  CPI: "border-cpi",
  FERIE: "border-ferie",
};

/** Classe Tailwind de bordure seule (couleur du type, fond inchangé) — ex.
 * liséré coloré sur une pastille déjà stylée autrement. */
export function classeBordureTypeBadge(code: TypeBadgeCode): string {
  return CODE_STYLES_BORDURE[code];
}

const CODE_STYLES_TEXTE: Record<TypeBadgeCode, string> = {
  CP: "text-cp",
  RTT: "text-rtt",
  CPA: "text-cpa",
  CSS: "text-css",
  CE: "text-ce",
  RECUP: "text-recup",
  EVT_FAM: "text-evtfam",
  DJI: "text-dji",
  CPI: "text-cpi",
  FERIE: "text-ferie",
};

/** Classe Tailwind de texte seul (couleur du type) — ex. valeur signée d'un
 * mouvement de solde, colorée par le type plutôt qu'en rouge générique. */
export function classeTexteTypeBadge(code: TypeBadgeCode): string {
  return CODE_STYLES_TEXTE[code];
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
  CPI: "bg-cpi/50",
  FERIE: "bg-ferie/50",
};

/** Classe Tailwind de fond atténué (opacité 50%) d'un code — voir
 * `classeFondTypeBadge` pour la variante pleine. */
export function classeFondAttenueTypeBadge(code: TypeBadgeCode): string {
  return CODE_STYLES_ATTENUE[code];
}

// Fond teinté par le type au survol (opacité 15%, plus discrète que la
// variante 50% ci-dessus, pensée pour une ligne de tableau pleine largeur
// plutôt qu'une pastille) — même mécanique de couleur que le pill Dates
// (`classeFondTypeBadge`), appliquée à `HistoriqueTable` (24/08/2026, l'état
// hover neutre `bg-surface-app` n'était pas assez visible). Distincte de
// l'état "on" permanent (`classeFondActifTypeBadge`, 30%) d'une ligne dont
// le détail est ouvert — le survol doit rester plus discret que le "on".
const CODE_STYLES_HOVER: Record<TypeBadgeCode, string> = {
  CP: "hover:bg-cp/15",
  RTT: "hover:bg-rtt/15",
  CPA: "hover:bg-cpa/15",
  CSS: "hover:bg-css/15",
  CE: "hover:bg-ce/15",
  RECUP: "hover:bg-recup/15",
  EVT_FAM: "hover:bg-evtfam/15",
  DJI: "hover:bg-dji/15",
  CPI: "hover:bg-cpi/15",
  FERIE: "hover:bg-ferie/15",
};

/** Classe Tailwind `hover:bg-…/15` d'un code — teinte une ligne/zone entière
 * au survol avec la couleur du type, sans attendre une sélection. */
export function classeFondSurvolTypeBadge(code: TypeBadgeCode): string {
  return CODE_STYLES_HOVER[code];
}

// Teinte plus marquée que le survol (30% contre 15%) et permanente — état
// "on" d'une ligne consultée (panneau de détail ouvert dessus,
// `HistoriqueTable`, 24/08/2026), à distinguer du simple survol passager.
const CODE_STYLES_ACTIF: Record<TypeBadgeCode, string> = {
  CP: "bg-cp/30",
  RTT: "bg-rtt/30",
  CPA: "bg-cpa/30",
  CSS: "bg-css/30",
  CE: "bg-ce/30",
  RECUP: "bg-recup/30",
  EVT_FAM: "bg-evtfam/30",
  DJI: "bg-dji/30",
  CPI: "bg-cpi/30",
  FERIE: "bg-ferie/30",
};

/** Classe Tailwind `bg-…/30` (sans `hover:`) d'un code — même teinte que
 * `classeFondSurvolTypeBadge` mais appliquée en permanence, pour marquer
 * une ligne comme "active"/sélectionnée plutôt que simplement survolée. */
export function classeFondActifTypeBadge(code: TypeBadgeCode): string {
  return CODE_STYLES_ACTIF[code];
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
        className={`rounded-full border bg-white px-2.5 py-1 text-xs font-bold whitespace-nowrap ${CODE_STYLES_OUTLINE[code]}`}
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
      {label ?? LABEL_COURT[code]}
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
