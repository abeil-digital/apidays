import { formatJours } from "@/lib/format";
import {
  classeFondTypeBadge,
  TypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";

export type SoldeCardTone = "cp" | "rtt" | "cpa";

const TONE_CODE: Record<SoldeCardTone, TypeBadgeCode> = {
  cp: "CP",
  rtt: "RTT",
  cpa: "CPA",
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
  /** Pastille "i" (17/08/2026, Accueil) — alignée à droite du solde (41 j /
   * 1,75 j), pas du `TypeBadge`. Fond teinté de la couleur du type (plus
   * visible qu'un picto gris neutre, associe directement le picto au congé
   * concerné), ouvre `SoldeDetailPanel` au clic (`onInfoClick`). Un simple
   * caractère "i" (pas l'icône `Info` de lucide, qui a son propre contour de
   * cercle — double contour avec la pastille sinon), sans bordure, avec un
   * état survol. Opt-in : défaut inchangé partout ailleurs (Accueil2
   * notamment). */
  avecInfo?: boolean;
  onInfoClick?: () => void;
}

export function SoldeCard({
  valeur,
  conditionPrefixe,
  conditionAccent,
  tone,
  carre = false,
  avecInfo = false,
  onInfoClick,
}: SoldeCardProps) {
  const code = TONE_CODE[tone];
  return (
    <div
      className={`flex h-full w-full flex-col gap-1.5 p-4 shadow-sm ${carre ? "" : "rounded-xl"}`}
      style={{
        backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_TONE[tone]}) 12%, white)`,
      }}
    >
      <TypeBadge code={code} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-900 text-2xl font-bold">{formatJours(valeur)} j</span>
        {avecInfo && (
          <button
            type="button"
            onClick={onInfoClick}
            aria-label={`Détail du solde ${code}`}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] leading-none font-bold text-white transition-[filter] duration-150 hover:brightness-110 ${classeFondTypeBadge(code)}`}
          >
            i
          </button>
        )}
      </div>
      <span className="text-ink-500 text-xs leading-snug">
        {conditionPrefixe} <span className="text-ink-900 font-bold">{conditionAccent}</span>
      </span>
    </div>
  );
}
