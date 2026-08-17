import type { DemiJournee } from "@/lib/types";
import { formatDate, formatPeriodeDemande, nomJourSemaine } from "@/lib/format";
import { JourBadge } from "@/components/ui/JourBadge";

interface PeriodeAvecPastillesProps {
  debut: string;
  fin: string;
  demiDebut: DemiJournee;
  demiFin: DemiJournee;
  /** Typo légèrement plus grande (16/08/2026, `ProchainsJoursOffCard`) —
   * opt-in pour ne pas changer le format par défaut des autres appelants
   * (`SuiviDemandeRow`, `ActiviteRecenteCard`...). */
  grand?: boolean;
}

/**
 * Affichage d'une période de congé avec pastille(s) jour (`JourBadge`,
 * abréviation 2 lettres) — extrait de `SuiviDemandeRow` (16/08/2026) pour
 * être réutilisé ailleurs (`ActiviteRecenteCard`) sans dupliquer la logique
 * jour plein/demi-journée/période sur deux lignes. Comportement identique à
 * l'original, voir `SuiviDemandeRow` pour l'historique des choix de rendu.
 */
export function PeriodeAvecPastilles({
  debut,
  fin,
  demiDebut,
  demiFin,
  grand = false,
}: PeriodeAvecPastillesProps) {
  const estPeriode = debut !== fin;
  const labelDemiJournee = estPeriode
    ? null
    : demiDebut === "apres_midi"
      ? "apm"
      : demiFin === "matin"
        ? "ma"
        : null;
  const labelDemiDebut = estPeriode && demiDebut === "apres_midi" ? "apm" : null;
  const labelDemiFin = estPeriode && demiFin === "matin" ? "ma" : null;

  const tailleBadge = grand ? "h-[17px] w-[17px]" : "h-[18px] w-[18px]";
  const texteBadge = grand ? "text-[11px]" : "text-[10px]";
  const texteDate = grand ? "text-sm" : "text-xs";

  if (estPeriode) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <JourBadge className={`!text-ink-500 ${tailleBadge} !rounded-[2px] ${texteBadge}`}>
            {nomJourSemaine(debut).slice(0, 2)}
          </JourBadge>
          <div className={`text-ink-900 ${texteDate} font-semibold`}>
            {formatDate(debut)}
            {labelDemiDebut && <span className="text-ink-500"> - {labelDemiDebut}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <JourBadge className={`!text-ink-500 ${tailleBadge} !rounded-[2px] ${texteBadge}`}>
            {nomJourSemaine(fin).slice(0, 2)}
          </JourBadge>
          <div className={`text-ink-900 ${texteDate} font-semibold`}>
            {formatDate(fin)}
            {labelDemiFin && <span className="text-ink-500"> - {labelDemiFin}</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <JourBadge className={`!text-ink-500 ${tailleBadge} !rounded-[2px] ${texteBadge}`}>
        {nomJourSemaine(debut).slice(0, 2)}
      </JourBadge>
      <div className={`text-ink-900 ${texteDate} font-semibold`}>
        {formatPeriodeDemande(debut, fin)}
        {labelDemiJournee && <span className="text-ink-500"> - {labelDemiJournee}</span>}
      </div>
    </div>
  );
}
