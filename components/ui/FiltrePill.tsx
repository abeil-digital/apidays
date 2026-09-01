import { ChevronDown, Search } from "lucide-react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

/**
 * Style de pill "filtre de tableau" — contour mint, `text-xs`/`px-2.5 py-1`
 * (taille resserrée le 14/08/2026, un premier essai plus spacieux que
 * `SelectPille` s'est avéré trop massif pour une barre de filtres). C'est le
 * standard à réutiliser à chaque fois qu'un tableau a des filtres (période,
 * statut, recherche…), établi sur `/historique` — ne pas réinventer un style
 * de filtre ad hoc ailleurs, importer `SelectFiltrePill`/`InputFiltrePill`
 * d'ici. Distinct de `SelectPille` par l'usage (filtre de page vs sélecteur
 * de créneau dans une popin DJI/CPI), pas par la taille — les deux sont
 * maintenant proches.
 */
const CLASSE_FILTRE_PILL_BASE =
  "rounded-full bg-surface-card px-2.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

const CLASSE_ACCENT_MINT = "border border-mint text-ink-900 font-medium focus-visible:ring-mint";

export const CLASSE_FILTRE_PILL = `${CLASSE_ACCENT_MINT} ${CLASSE_FILTRE_PILL_BASE}`;

/** Variante `<select>` — chevron mint superposé par défaut (le natif ne
 * permet pas de le coloriser directement). `classeBordure`/`classeChevron`
 * (29/08/2026, essai sur Historique) : override opt-in de l'accent mint par
 * défaut — bordure/anneau focus et couleur du chevron respectivement, sans
 * effet sur les autres appelants qui ne les passent pas. */
export function SelectFiltrePill(
  props: SelectHTMLAttributes<HTMLSelectElement> & {
    classeBordure?: string;
    classeChevron?: string;
  },
) {
  const { className, classeBordure, classeChevron, ...rest } = props;
  return (
    <div className="relative inline-block">
      <select
        {...rest}
        className={`${CLASSE_FILTRE_PILL_BASE} ${classeBordure ?? CLASSE_ACCENT_MINT} cursor-pointer appearance-none pr-6 ${className ?? ""}`}
      />
      <ChevronDown
        size={11}
        className={`pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 ${classeChevron ?? "text-mint"}`}
      />
    </div>
  );
}

/** Variante `<input>` (date, texte, recherche…) — même pill, sans chevron.
 * `avecIcone` (21/08/2026, opt-in) : superpose un picto loupe à gauche, même
 * principe que le chevron de `SelectFiltrePill` — réservé aux champs de
 * recherche (`type="search"`), les autres usages (date…) ne le passent pas
 * et gardent le rendu d'origine. `classeBordure`/`classeIcone` (29/08/2026,
 * essai sur Historique) : même override opt-in que `SelectFiltrePill`
 * (bordure/texte/anneau focus, et couleur de l'icône loupe le cas échéant). */
export function InputFiltrePill(
  props: InputHTMLAttributes<HTMLInputElement> & {
    avecIcone?: boolean;
    classeBordure?: string;
    classeIcone?: string;
  },
) {
  const { className, avecIcone, classeBordure, classeIcone, ...rest } = props;
  const classeAccent = classeBordure ?? CLASSE_ACCENT_MINT;
  if (!avecIcone) {
    return (
      <input
        {...rest}
        className={`${CLASSE_FILTRE_PILL_BASE} ${classeAccent} ${className ?? ""}`}
      />
    );
  }
  return (
    <div className="relative inline-block">
      <Search
        size={12}
        className={`pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 ${classeIcone ?? "text-mint"}`}
      />
      <input
        {...rest}
        className={`${CLASSE_FILTRE_PILL_BASE} ${classeAccent} pl-7 ${className ?? ""}`}
      />
    </div>
  );
}
