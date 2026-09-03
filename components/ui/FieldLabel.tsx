import type { ReactNode } from "react";

interface FieldLabelProps {
  children: ReactNode;
  htmlFor?: string;
  /** "carte" (02/09/2026, refonte fiche utilisateur) — reprend le style des
   * champs sur les cards "Annuler cette demande"/"Ajuster le solde"
   * (`DetailCongePanel`/`SoldeDetailPanel`) : plus compact, `block` avec sa
   * propre marge basse plutôt que de compter sur un `mt-2` externe sur le
   * champ suivant. Défaut inchangé pour ne rien casser ailleurs. */
  variant?: "champ" | "carte";
}

const CLASSES_VARIANT: Record<NonNullable<FieldLabelProps["variant"]>, string> = {
  champ: "text-ink-500 px-1 text-xs font-bold",
  carte: "text-ink-500 mb-1.5 block text-[11px] font-bold",
};

export function FieldLabel({ children, htmlFor, variant = "champ" }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className={CLASSES_VARIANT[variant]}>
      {children}
    </label>
  );
}
