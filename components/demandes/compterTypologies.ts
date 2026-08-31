import { dureeCongeImpose } from "@/lib/joursFeries";
import type { CongeImpose, Demande, DjImposee, JourFerie } from "@/lib/types";
import type { TypeBadgeCode } from "@/components/demandes/TypeBadge";

export interface TypologieCompteur {
  code: TypeBadgeCode;
  label: string;
  jours: number;
}

// Congés imposés (CPI + DJI) fusionnés sous le code "CPI" — même convention
// que la carte "CI" de `ProchainsJoursOffCard` (couleur CPI, DJI/CPI non
// distingués côté collaborateur/manager). Ordre d'affichage fixe. "Congé(s)"
// abrégé "C." et "Jours" abrégé "J." (24/08/2026, demande explicite) —
// libellés sinon repris de `LABEL_LONG` (`TypeBadge.tsx`).
const LABEL_TYPOLOGIE: Partial<Record<TypeBadgeCode, string>> = {
  CP: "C. payés",
  RTT: "RTT",
  CPA: "C. en acquisition",
  CSS: "C. sans solde",
  CE: "C. exceptionnel",
  RECUP: "Récupération",
  EVT_FAM: "Événement familial",
  CPI: "C. imposés",
  FERIE: "J. fériés",
};

const ORDRE: TypeBadgeCode[] = [
  "CP",
  "RTT",
  "CPA",
  "CPI",
  "FERIE",
  "CSS",
  "CE",
  "RECUP",
  "EVT_FAM",
];

function codeBadgeDemande(demande: Demande): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

/**
 * Compteur de jours par typologie sur une période active (24/08/2026,
 * Accueil/`DashboardPage` et `/suivre/calendrier`/`CalendrierCollaborateur`)
 * — un total par type de "day off" réellement présent sur la période
 * (`rangeActive`), zéro affiché nulle part (types absents filtrés en amont
 * par l'appelant). Les listes `congesImposes`/`djImposees`/`joursFeries`
 * doivent déjà être filtrées par l'appelant aux années effectivement
 * visibles (même règle que les pastilles du calendrier — CPI/DJI de l'année
 * à venir non publiée ne comptent pas, les fériés comptent toujours) ;
 * `joursFeriesPourDuree` sert uniquement au calcul de durée d'un CPI
 * (jours ouvrés moins fériés, `dureeCongeImpose`) et n'a pas besoin d'être
 * bornée à la période active — un CPI qui déborde légèrement doit quand
 * même avoir sa durée calculée avec tous les fériés qui le couvrent.
 */
export function compterTypologies({
  demandes,
  rangeActive,
  congesImposes,
  djImposees,
  joursFeries,
  joursFeriesPourDuree,
}: {
  demandes: Demande[];
  rangeActive: { debut: string; fin: string };
  congesImposes: CongeImpose[];
  djImposees: DjImposee[];
  joursFeries: JourFerie[];
  joursFeriesPourDuree: JourFerie[];
}): TypologieCompteur[] {
  const totaux = new Map<TypeBadgeCode, number>();

  function ajouter(code: TypeBadgeCode, jours: number) {
    totaux.set(code, (totaux.get(code) ?? 0) + jours);
  }

  demandes
    .filter(
      (d) =>
        d.statut !== "refusé" &&
        d.statut !== "annulé" &&
        d.debut <= rangeActive.fin &&
        d.fin >= rangeActive.debut,
    )
    .forEach((d) => ajouter(codeBadgeDemande(d), d.nbDemiJournees / 2));

  congesImposes
    .filter((c) => c.debut <= rangeActive.fin && c.fin >= rangeActive.debut)
    .forEach((c) => ajouter("CPI", dureeCongeImpose(c, joursFeriesPourDuree)));

  djImposees
    .filter((d) => d.date >= rangeActive.debut && d.date <= rangeActive.fin)
    .forEach(() => ajouter("CPI", 0.5));

  joursFeries
    .filter((f) => f.date >= rangeActive.debut && f.date <= rangeActive.fin)
    .forEach(() => ajouter("FERIE", 1));

  return ORDRE.filter((code) => (totaux.get(code) ?? 0) > 0).map((code) => ({
    code,
    label: LABEL_TYPOLOGIE[code] ?? code,
    jours: totaux.get(code)!,
  }));
}
