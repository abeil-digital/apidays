import { formatJours } from "@/lib/format";
import { TypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

export type SoldeCardTone = "cp" | "rtt" | "cpa";

const TONE_CODE: Record<SoldeCardTone, TypeBadgeCode> = {
  cp: "CP",
  rtt: "RTT",
  cpa: "CPA",
};

// Libellé affiché à côté du badge, mobile ET desktop (29/09/2026, essai
// Claude Design) — CPA abrégé ("C. en acquisition") pour tenir sur une
// ligne à côté du badge et de la condition, contrairement à `LABEL_LONG`
// (TypeBadge.tsx, "Congés en acquisition") pensé pour des contextes plus
// larges.
const LABEL_BADGE: Record<SoldeCardTone, string> = {
  cp: "Congés payés",
  rtt: "RTT",
  cpa: "C. en acquisition",
};

// Nom de la variable CSS du token couleur du type — même valeur que
// l'accent du sélecteur de date dans la popin "Nouvelle demande"
// (`PoserDemandeModal.tsx`, `VAR_COULEUR_TYPE`), pour teinter le fond de la
// card à 12% (test du 18/08/2026).
const VAR_COULEUR_TONE: Record<SoldeCardTone, string> = {
  cp: "--color-cp",
  rtt: "--color-rtt",
  cpa: "--color-cpa",
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
  /** Ouvre `SoldeDetailPanel` au clic sur la card entière (20/08/2026 —
   * remplace l'ancien lien "Suivre" dédié). Opt-in : défaut inchangé partout
   * ailleurs (Accueil2 notamment). */
  onClick?: () => void;
  /** Override explicite de la couleur du montant (29/08/2026, essai sur
   * Accueil collaborateur uniquement) — remplace `text-ink-900` par défaut.
   * Opt-in, sans effet sur les autres appelants. */
  classeValeur?: string;
}

export function SoldeCard({
  valeur,
  conditionPrefixe,
  conditionAccent,
  tone,
  carre = false,
  onClick,
  classeValeur,
}: SoldeCardProps) {
  const code = TONE_CODE[tone];
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`group flex h-full w-full cursor-pointer flex-col gap-1.5 p-4 shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:scale-105 hover:shadow-md hover:[--tone-darken:30%] ${carre ? "" : "rounded-xl"}`}
      style={
        {
          "--tone-mix": "12%",
          "--tone-darken": "0%",
          backgroundColor: `color-mix(in srgb, color-mix(in srgb, var(${VAR_COULEUR_TONE[tone]}) var(--tone-mix), white) calc(100% - var(--tone-darken)), black var(--tone-darken))`,
        } as React.CSSProperties
      }
    >
      {/* Mobile (29/09/2026, essai suite au brief Claude Design — corrigé le
          29/09/2026, "À poser avant le"/la date restent groupés ensemble à
          droite dans la maquette, pas répartis sur les deux lignes de la
          grille) : colonne de gauche (badge carré + libellé, puis chiffre en
          dessous) / colonne de droite (condition + date ensemble) —
          remplace la disposition verticale seulement en dessous de `sm:`,
          où la card retrouve son rendu d'origine (couleur de fond et
          position du badge inchangées), à ceci près que le badge lui-même
          (carré, fond plein, texte blanc) + son libellé sont désormais
          repris sur les deux tailles (même 2ᵉ correctif du 29/09/2026 —
          "on retrouve ce nouveau badge également sur la card en desktop"). */}
      <div className="flex items-start justify-between gap-2 sm:hidden">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <TypeBadge code={code} variant="carre" />
            <span className="text-ink-900 text-xs font-semibold">{LABEL_BADGE[tone]}</span>
          </div>
          <span className={`text-[1.725rem] font-bold ${classeValeur ?? "text-ink-900"}`}>
            {formatJours(valeur)} j
          </span>
        </div>
        <div className="flex flex-col items-end text-right">
          <span className="text-ink-500 text-[11px] leading-snug">{conditionPrefixe}</span>
          <span className="text-ink-900 text-xs font-bold">{conditionAccent}</span>
        </div>
      </div>

      <div className="hidden sm:flex sm:flex-col sm:gap-1.5">
        <div className="flex items-center gap-1.5">
          <TypeBadge code={code} variant="carre" />
          <span className="text-ink-900 text-xs font-semibold">{LABEL_BADGE[tone]}</span>
        </div>
        <span
          className={`inline-block origin-left text-[1.725rem] font-bold transition-transform duration-200 group-hover:scale-[1.2] ${classeValeur ?? "text-ink-900"}`}
        >
          {formatJours(valeur)} j
        </span>
        <span className="text-ink-500 text-xs leading-snug">
          {conditionPrefixe} <span className="text-ink-900 font-bold">{conditionAccent}</span>
        </span>
      </div>
    </div>
  );
}
