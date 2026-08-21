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
export const CLASSE_FILTRE_PILL =
  "rounded-full border border-mint bg-surface-card px-2.5 py-1 text-xs font-medium text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-mint focus-visible:ring-offset-1";

/** Variante `<select>` — chevron mint superposé (le natif ne permet pas de
 * le coloriser directement). */
export function SelectFiltrePill(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return (
    <div className="relative inline-block">
      <select
        {...rest}
        className={`${CLASSE_FILTRE_PILL} cursor-pointer appearance-none pr-6 ${className ?? ""}`}
      />
      <ChevronDown
        size={11}
        className="text-mint pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
      />
    </div>
  );
}

/** Variante `<input>` (date, texte, recherche…) — même pill, sans chevron.
 * `avecIcone` (21/08/2026, opt-in) : superpose un picto loupe à gauche, même
 * principe que le chevron de `SelectFiltrePill` — réservé aux champs de
 * recherche (`type="search"`), les autres usages (date…) ne le passent pas
 * et gardent le rendu d'origine. */
export function InputFiltrePill(
  props: InputHTMLAttributes<HTMLInputElement> & { avecIcone?: boolean },
) {
  const { className, avecIcone, ...rest } = props;
  if (!avecIcone) {
    return <input {...rest} className={`${CLASSE_FILTRE_PILL} ${className ?? ""}`} />;
  }
  return (
    <div className="relative inline-block">
      <Search
        size={12}
        className="text-mint pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
      />
      <input {...rest} className={`${CLASSE_FILTRE_PILL} pl-7 ${className ?? ""}`} />
    </div>
  );
}
