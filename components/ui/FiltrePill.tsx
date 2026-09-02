import { ChevronDown, Search } from "lucide-react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

/**
 * Style de pill "filtre de tableau" — contour vert header (`slate`, depuis le
 * 29/08/2026 — mint à l'origine), `text-xs`/`px-2.5 py-1` (taille resserrée
 * le 14/08/2026, un premier essai plus spacieux que `SelectPille` s'est avéré
 * trop massif pour une barre de filtres). C'est le standard à réutiliser à
 * chaque fois qu'un tableau a des filtres (période, statut, recherche…),
 * établi sur `/historique` — ne pas réinventer un style de filtre ad hoc
 * ailleurs, importer `SelectFiltrePill`/`InputFiltrePill` d'ici. Distinct de
 * `SelectPille` par l'usage (filtre de page vs sélecteur de créneau dans une
 * popin DJI/CPI), pas par la taille — les deux sont maintenant proches.
 */
const CLASSE_FILTRE_PILL_BASE =
  "rounded-full px-2.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

const CLASSE_ACCENT_DEFAUT =
  "border border-slate text-slate font-medium hover:bg-slate/10 focus-visible:ring-slate";

const CLASSE_FOND_DEFAUT = "bg-surface-card";

export const CLASSE_FILTRE_PILL = `${CLASSE_ACCENT_DEFAUT} ${CLASSE_FOND_DEFAUT} ${CLASSE_FILTRE_PILL_BASE}`;

/** Variante `<select>` — chevron superposé par défaut (le natif ne permet pas
 * de le coloriser directement). `classeBordure`/`classeChevron` (29/08/2026) :
 * override opt-in de l'accent par défaut — bordure/anneau focus et couleur du
 * chevron respectivement, sans effet sur les autres appelants qui ne les
 * passent pas. `classeFond` (29/08/2026) : override opt-in du fond (défaut
 * `bg-surface-card`) — ex. aligner le fond des sélecteurs sur celui de
 * l'en-tête de colonnes du tableau juste en dessous. */
export function SelectFiltrePill(
  props: SelectHTMLAttributes<HTMLSelectElement> & {
    classeBordure?: string;
    classeChevron?: string;
    classeFond?: string;
  },
) {
  const { className, classeBordure, classeChevron, classeFond, ...rest } = props;
  return (
    <div className="relative inline-block">
      <select
        {...rest}
        className={`${CLASSE_FILTRE_PILL_BASE} ${classeFond ?? CLASSE_FOND_DEFAUT} ${classeBordure ?? CLASSE_ACCENT_DEFAUT} cursor-pointer appearance-none pr-6 ${className ?? ""}`}
      />
      <ChevronDown
        size={11}
        className={`pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 ${classeChevron ?? "text-slate"}`}
      />
    </div>
  );
}

/** Variante `<input>` (date, texte, recherche…) — même pill, sans chevron.
 * `avecIcone` (21/08/2026, opt-in) : superpose un picto loupe à gauche, même
 * principe que le chevron de `SelectFiltrePill` — réservé aux champs de
 * recherche (`type="search"`), les autres usages (date…) ne le passent pas
 * et gardent le rendu d'origine. `classeBordure`/`classeIcone` (29/08/2026) :
 * même override opt-in que `SelectFiltrePill` (bordure/texte/anneau focus, et
 * couleur de l'icône loupe le cas échéant). */
export function InputFiltrePill(
  props: InputHTMLAttributes<HTMLInputElement> & {
    avecIcone?: boolean;
    classeBordure?: string;
    classeIcone?: string;
    classeFond?: string;
  },
) {
  const { className, avecIcone, classeBordure, classeIcone, classeFond, ...rest } = props;
  const classeAccent = classeBordure ?? CLASSE_ACCENT_DEFAUT;
  const fond = classeFond ?? CLASSE_FOND_DEFAUT;
  if (!avecIcone) {
    return (
      <input
        {...rest}
        className={`${CLASSE_FILTRE_PILL_BASE} ${fond} ${classeAccent} ${className ?? ""}`}
      />
    );
  }
  return (
    <div className="relative inline-block">
      <Search
        size={12}
        className={`pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 ${classeIcone ?? "text-slate"}`}
      />
      <input
        {...rest}
        className={`${CLASSE_FILTRE_PILL_BASE} ${fond} ${classeAccent} pl-7 ${className ?? ""}`}
      />
    </div>
  );
}
