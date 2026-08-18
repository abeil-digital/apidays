import type { CongeImpose, Demande, DemiJournee, DjImposee, JourFerie } from "@/lib/types";
import { classeFondTypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { MOIS_FR } from "@/components/ui/MiniCalendrier";

// Même abréviation que la grille `MiniCalendrier` (non exportée depuis
// là-bas) — semaine L-V, jamais de week-end.
const JOURS_SEMAINE_COURT = ["L", "M", "M", "J", "V"];

/**
 * Une demi-journée donnée (`demi`) d'un jour (`iso`) fait-elle partie d'une
 * période [debutP, finP] ? Vrai sur toute la période SAUF sur la demi-
 * journée exclue à chaque borne (`demiDebutP === "apres_midi"` exclut le
 * matin du premier jour, `demiFinP === "matin"` exclut l'après-midi du
 * dernier).
 */
export function demiCouvertePeriode(
  iso: string,
  demi: DemiJournee,
  debutP: string,
  finP: string,
  demiDebutP: DemiJournee,
  demiFinP: DemiJournee,
): boolean {
  if (iso < debutP || iso > finP) return false;
  if (iso === debutP && demiDebutP === "apres_midi" && demi === "matin") return false;
  if (iso === finP && demiFinP === "matin" && demi === "apres_midi") return false;
  return true;
}

/**
 * Construit le "résolveur d'occupant" — ce qui occupe DÉJÀ une demi-journée,
 * indépendamment d'une période en cours de saisie ou de revue : férié >
 * congé imposé (CPI) > demi-journée imposée (DJI) > une autre demande
 * personnelle. `null` si rien n'occupe cette demi-journée. Partagé entre
 * `PoserDemandeModal` (occupant = les propres demandes du collaborateur) et
 * le lien "Voir" côté validation manager (occupant = les AUTRES demandes du
 * même employé) — la même brique doit être utilisée partout pour que
 * comptage et affichage restent cohérents (18/08/2026).
 */
export function creerResolveurOccupant({
  joursFeries,
  congesImposes,
  djImposees,
  demandes,
}: {
  joursFeries: JourFerie[];
  congesImposes: CongeImpose[];
  djImposees: DjImposee[];
  demandes: Demande[];
}) {
  return function occupant(iso: string, demi: DemiJournee): TypeBadgeCode | null {
    if (joursFeries.some((f) => f.date === iso)) return "FERIE";
    const cpi = congesImposes.find((c) =>
      demiCouvertePeriode(iso, demi, c.debut, c.fin, c.demiDebut, c.demiFin),
    );
    if (cpi) return "CPI";
    if (djImposees.some((d) => d.date === iso && d.demiJournee === demi)) return "DJI";
    const demande = demandes.find(
      (d) =>
        d.statut !== "refusé" &&
        d.statut !== "annulé" &&
        demiCouvertePeriode(iso, demi, d.debut, d.fin, d.demiDebut, d.demiFin),
    );
    if (demande) return demande.isAnticipation ? "CPA" : (demande.type as TypeBadgeCode);
    return null;
  };
}

// Libellé de mois d'une semaine (L-V) — celui du mois majoritaire parmi ses
// jours, pas celui du premier jour : une semaine à cheval sur deux mois
// (ex. lundi 31 août, mardi-vendredi 1-4 septembre) doit s'afficher sous
// "Septembre" (4 jours sur 5), pas "Août" (bug de display signalé le
// 18/08/2026 — le premier jour donnait le libellé même quand il était
// minoritaire dans la semaine).
function moisMajoritaire(jours: { mois: number }[]): string {
  const comptes = new Map<number, number>();
  for (const j of jours) comptes.set(j.mois, (comptes.get(j.mois) ?? 0) + 1);
  let moisRetenu = jours[0].mois;
  let max = 0;
  for (const [mois, compte] of comptes) {
    if (compte > max) {
      max = compte;
      moisRetenu = mois;
    }
  }
  return MOIS_FR[moisRetenu];
}

interface DetailPeriodeCongesProps {
  debut: string;
  fin: string;
  demiDebut: DemiJournee;
  demiFin: DemiJournee;
  /** Couleur/type à afficher pour une demi-journée libre couverte par la
   * période (ce que la demande consomme réellement). */
  codeParDefaut: TypeBadgeCode;
  /** Ce qui occupe déjà une demi-journée, indépendamment de la période
   * affichée — voir `creerResolveurOccupant`. */
  occupant: (iso: string, demi: DemiJournee) => TypeBadgeCode | null;
}

/**
 * Détail par semaine (L-V, jamais de week-end) d'une période de congé —
 * chaque demi-journée colorée par ce qui l'occupe réellement (férié, CPI,
 * DJI, une autre demande, ou le type de la demande affichée), avec une
 * légère transparence sur tout ce qui est déjà occupé ailleurs : matérialise
 * visuellement qu'une demi-journée ne fait pas partie de CETTE demande,
 * même quand elle partage la couleur du type affiché (18/08/2026, ex. un CP
 * 10/08→13/08 avec le 11/08 déjà posé ailleurs, également en CP). Utilisé à
 * la fois par le détail "voir" de `PoserDemandeModal` (période en cours de
 * saisie) et par le lien "Voir" de la validation manager (une demande déjà
 * existante) — même rendu partout.
 */
export function DetailPeriodeConges({
  debut,
  fin,
  demiDebut,
  demiFin,
  codeParDefaut,
  occupant,
}: DetailPeriodeCongesProps) {
  function typeSurDemiJour(iso: string, demi: DemiJournee): TypeBadgeCode | null {
    const occ = occupant(iso, demi);
    if (occ) return occ;
    if (demiCouvertePeriode(iso, demi, debut, fin, demiDebut, demiFin)) return codeParDefaut;
    return null;
  }

  const semainesDetail: {
    libelleMois: string;
    jours: { iso: string; jour: number; jourSemaine: number }[];
  }[] = [];
  let semaineCourante: { iso: string; jour: number; jourSemaine: number; mois: number }[] = [];
  const curseurDetail = new Date(`${debut}T00:00:00Z`);
  const finDetail = new Date(`${fin}T00:00:00Z`);
  while (curseurDetail <= finDetail) {
    const iso = curseurDetail.toISOString().slice(0, 10);
    const jourSemaine = curseurDetail.getUTCDay();
    if (jourSemaine !== 0 && jourSemaine !== 6) {
      if (jourSemaine === 1 && semaineCourante.length > 0) {
        semainesDetail.push({
          libelleMois: moisMajoritaire(semaineCourante),
          jours: semaineCourante,
        });
        semaineCourante = [];
      }
      semaineCourante.push({
        iso,
        jour: curseurDetail.getUTCDate(),
        jourSemaine,
        mois: curseurDetail.getUTCMonth(),
      });
    }
    curseurDetail.setUTCDate(curseurDetail.getUTCDate() + 1);
  }
  if (semaineCourante.length > 0) {
    semainesDetail.push({ libelleMois: moisMajoritaire(semaineCourante), jours: semaineCourante });
  }

  // Regroupe les semaines consécutives du même mois — le libellé du mois
  // s'affiche une fois par groupe, sur le côté gauche, plutôt que répété
  // au-dessus de chaque semaine.
  const moisDetail: (typeof semainesDetail)[number][][] = [];
  for (const semaine of semainesDetail) {
    const dernierGroupe = moisDetail[moisDetail.length - 1];
    if (dernierGroupe && dernierGroupe[0].libelleMois === semaine.libelleMois) {
      dernierGroupe.push(semaine);
    } else {
      moisDetail.push([semaine]);
    }
  }

  if (semainesDetail.length === 0) return null;

  return (
    <div className="bg-surface-app rounded-xl p-3">
      {/* En-têtes L-M-M-J-V affichés une seule fois en haut — même colonne
          de gauche (largeur `w-16` + `gap-3`) qu'un nom de mois pour rester
          alignés avec les grilles de jours en dessous. */}
      <div className="flex items-start gap-3">
        <span className="w-16 shrink-0" />
        <div className="grid grid-cols-5 gap-1">
          {JOURS_SEMAINE_COURT.map((lettre, index) => (
            <span
              key={index}
              className="text-ink-500 flex h-5 w-5 items-center justify-center text-[10px]"
            >
              {lettre}
            </span>
          ))}
        </div>
      </div>

      {moisDetail.map((semainesDuMois, indexMois) => (
        <div
          key={semainesDuMois[0].jours[0].iso}
          className={`flex items-start gap-3 ${indexMois === 0 ? "mt-1" : "mt-4"}`}
        >
          <span className="w-16 shrink-0 pt-1 text-xs font-semibold text-[#374151]">
            {semainesDuMois[0].libelleMois}
          </span>
          <div className="flex flex-col gap-1">
            {semainesDuMois.map((semaine) => (
              <div key={semaine.jours[0].iso} className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((jourSemaine) => {
                  const j = semaine.jours.find((jour) => jour.jourSemaine === jourSemaine);
                  if (!j) return <div key={jourSemaine} className="h-5 w-5" />;
                  const codeMatin = typeSurDemiJour(j.iso, "matin");
                  const codeApresMidi = typeSurDemiJour(j.iso, "apres_midi");
                  const occupantMatin = occupant(j.iso, "matin");
                  const occupantApresMidi = occupant(j.iso, "apres_midi");
                  return (
                    <div
                      key={j.iso}
                      className="relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-md"
                    >
                      <div
                        className={`absolute inset-y-0 left-0 w-1/2 ${
                          codeMatin ? classeFondTypeBadge(codeMatin) : "bg-ink-300/40"
                        } ${occupantMatin ? "opacity-45" : ""}`}
                      />
                      <div
                        className={`absolute inset-y-0 right-0 w-1/2 ${
                          codeApresMidi ? classeFondTypeBadge(codeApresMidi) : "bg-ink-300/40"
                        } ${occupantApresMidi ? "opacity-45" : ""}`}
                      />
                      <span className="relative z-10 text-[10px] font-bold text-white">
                        {j.jour}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
