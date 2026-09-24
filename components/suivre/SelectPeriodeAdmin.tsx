import { ChevronDown } from "lucide-react";

export type ModePeriode = "aujourdhui" | "il_y_a_3_mois" | "periode_reference" | "annee_civile";

/** Sélecteur "Commence : Aujourd'hui / Il y a 3 mois / Période de
 * référence / Année civile" — variante ADMIN de `SelectCommence`
 * (24/09/2026, demande de Delphine — les critères d'affichage côté admin
 * doivent être plus précis qu'une simple fenêtre glissante relative à
 * "aujourd'hui"). "Période de référence" cale la fenêtre sur la vraie
 * période de référence CP (`periodeReferenceCp`, même calcul que
 * Historique/`SoldeDetailPanel`), "Année civile" sur le 1er janvier → 31
 * décembre (indépendant de la période CP configurée — les deux peuvent
 * diverger, ex. une période CP juin→mai).
 *
 * Extrait dans un fichier partagé le 24/09/2026 (état remonté dans
 * `SuivreCalendrierPage`, sur la même ligne que le sélecteur
 * "Collaborateur :" — demande explicite de Vincent) : `CalendrierGlobal`/
 * `CalendrierCollaborateur` reçoivent désormais `modePeriode` en prop plutôt
 * que de le posséder chacun indépendamment (bonus : la sélection persiste en
 * changeant de collaborateur, avant elle se réinitialisait). Seule cette
 * variante expose ces 4 options, `DashboardPage.tsx` (vue collaborateur)
 * garde son propre `SelectCommence` à 2 options d'origine, hors scope de
 * cette demande admin.
 *
 * Texte + chevron rendus séparément du `<select>` (24/09/2026, correctif) :
 * un `<select>` natif stylé se dimensionne sur son option la plus LONGUE
 * ("Période de référence"), pas sur celle affichée — avec seulement 2
 * options de longueur proche ("Aujourd'hui"/"Il y a 3 mois") l'écart passait
 * inaperçu, mais dès qu'"Période de référence"/"Année civile" ont été
 * ajoutées, le chevron (collé au bord droit de la boîte) se retrouvait loin
 * du texte visible quand une option courte était sélectionnée. Le vrai
 * `<select>` reste la seule interaction (accessible), juste rendu invisible
 * et superposé au texte+chevron visibles (mêmes dimensions que leur propre
 * contenu) — même principe que l'ancien sélecteur "Collaborateur" avant son
 * passage en `SelectPille`. */
const LIBELLE_MODE: Record<ModePeriode, string> = {
  aujourdhui: "Aujourd'hui",
  il_y_a_3_mois: "Il y a 3 mois",
  periode_reference: "Période de référence",
  annee_civile: "Année civile",
};

export function SelectPeriodeAdmin({
  mode,
  onChange,
}: {
  mode: ModePeriode;
  onChange: (v: ModePeriode) => void;
}) {
  return (
    <div className="inline-flex w-fit items-center gap-1.5">
      <span className="text-ink-500 text-xs">Commence :</span>
      <span className="text-mint relative inline-flex w-fit items-center gap-1 text-xs font-normal underline underline-offset-2">
        {LIBELLE_MODE[mode]}
        <ChevronDown size={11} className="text-mint pointer-events-none" />
        <select
          value={mode}
          onChange={(e) => onChange(e.target.value as ModePeriode)}
          aria-label="Commence"
          className="absolute inset-0 cursor-pointer appearance-none opacity-0"
        >
          <option value="aujourdhui">Aujourd&apos;hui</option>
          <option value="il_y_a_3_mois">Il y a 3 mois</option>
          <option value="periode_reference">Période de référence</option>
          <option value="annee_civile">Année civile</option>
        </select>
      </span>
    </div>
  );
}
