"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { todayISO } from "@/lib/format";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import { useReglesConges } from "@/hooks/useReglesConges";
import {
  classeFondAttenueTypeBadge,
  classeFondTypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import {
  SnippetJourCalendrier,
  type JourCalendrierClique,
} from "@/components/demandes/SnippetJourCalendrier";
import { CompteurTypologies } from "@/components/demandes/CompteurTypologies";
import { compterTypologies } from "@/components/demandes/compterTypologies";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { ProchainsJoursOffCard } from "@/components/dashboard/ProchainsJoursOffCard";
import type { Demande } from "@/lib/types";

type Onglet = "en_cours" | "periode_cp" | "annee_suivante";

function isoDate(annee: number, moisIndex: number, jour: number): string {
  return new Date(Date.UTC(annee, moisIndex, jour)).toISOString().slice(0, 10);
}

function ajouterJoursIso(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "Juin 26" — mois abrégé + année sur 2 chiffres, pour le libellé de
 * l'onglet "Période de référence" (ex. "Juin 26 → Mai 27"). */
function formatMoisAnneeCourt(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const texte = new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(d);
  return texte.charAt(0).toUpperCase() + texte.slice(1).replace(".", "");
}

/** Sélecteur "Débute : {mois en cours} / {début de la période}" — même
 * composant que `DashboardPage`. */
function SelectAffichage({
  actif,
  onChange,
  labelMoisEnCours,
  labelDebut,
}: {
  actif: boolean;
  onChange: (v: boolean) => void;
  labelMoisEnCours: string;
  labelDebut: string;
}) {
  return (
    <div className="relative inline-flex w-fit items-center gap-1.5">
      <span className="text-ink-500 text-xs">Débute :</span>
      <select
        value={actif ? "complete" : "mois_en_cours"}
        onChange={(e) => onChange(e.target.value === "complete")}
        className="text-ink-900 relative appearance-none pr-4 text-xs font-normal underline underline-offset-2 outline-none"
      >
        <option value="mois_en_cours">{labelMoisEnCours}</option>
        <option value="complete">{labelDebut}</option>
      </select>
      <ChevronDown size={11} className="text-slate pointer-events-none absolute right-0" />
    </div>
  );
}

/** Tous les mois (année + index) couverts par une plage de dates ISO, bornes
 * incluses. */
function moisEntre(debutIso: string, finIso: string): { annee: number; moisIndex: number }[] {
  const mois: { annee: number; moisIndex: number }[] = [];
  let annee = Number(debutIso.slice(0, 4));
  let moisIndex = Number(debutIso.slice(5, 7)) - 1;
  const anneeFin = Number(finIso.slice(0, 4));
  const moisIndexFin = Number(finIso.slice(5, 7)) - 1;

  while (annee < anneeFin || (annee === anneeFin && moisIndex <= moisIndexFin)) {
    mois.push({ annee, moisIndex });
    moisIndex += 1;
    if (moisIndex > 11) {
      moisIndex = 0;
      annee += 1;
    }
  }

  return mois;
}

function codeBadgeDemande(demande: Demande): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

// Voir DashboardPage.tsx (même constante, duplication assumée entre les
// deux variantes de calendrier, comme le reste de leurs helpers).
const VAR_COULEUR_TYPE: Record<TypeBadgeCode, string> = {
  CP: "--color-cp",
  RTT: "--color-rtt",
  CPA: "--color-cpa",
  CSS: "--color-css",
  CE: "--color-ce",
  RECUP: "--color-recup",
  EVT_FAM: "--color-evtfam",
  DJI: "--color-dji",
  CPI: "--color-cpi",
  FERIE: "--color-ferie",
};

/**
 * Calendrier d'un collaborateur, pour `/suivre/calendrier` (24/08/2026,
 * manager/admin) — reprend le gabarit du calendrier "nouvelle version"
 * d'Accueil (`DashboardPage`, section "Mon Calendrier" : onglets Année en
 * cours/Période de référence CP/Année suivante, colonne "Prochains jours
 * off" + grille `MiniCalendrier` 3/ligne), PAS l'ancienne page dédiée
 * `/mon-calendrier` (`MonCalendrierPage.tsx`, gabarit différent — colonne
 * légende CPI/DJI/Fériés au lieu de "Prochains jours off").
 *
 * Différences volontaires avec `DashboardPage` : pas de bouton "+"/clic sur
 * un jour vide pour poser un congé (un manager ne pose pas de congé à la
 * place d'un collaborateur depuis cet écran, hors scope), pas de cartes
 * Soldes/FAQ/activité récente — uniquement le bloc calendrier, `utilisateurId`
 * pilote quelles demandes sont affichées (`useDemandes`/`ProchainsJoursOffCard`
 * acceptent tous deux ce prop depuis cette date).
 */
export function CalendrierCollaborateur({ utilisateurId }: { utilisateurId: string }) {
  const { demandes, loading: loadingDemandes } = useDemandes(utilisateurId);
  const { reglesAcquisition, loading: loadingRegles } = useReglesConges();
  const [snippet, setSnippet] = useState<{ jour: JourCalendrierClique; ancre: DOMRect } | null>(
    null,
  );
  const [onglet, setOnglet] = useState<Onglet>("en_cours");
  const [vueCompleteEnCours, setVueCompleteEnCours] = useState(false);
  const [vueCompletePeriodeCp, setVueCompletePeriodeCp] = useState(false);

  const anneeActuelle = new Date().getFullYear();
  const anneePrecedente = anneeActuelle - 1;
  const anneeSuivante = anneeActuelle + 1;
  const calendrierAnneePrecedente = useCalendrier(anneePrecedente);
  const calendrierAnneeA = useCalendrier(anneeActuelle);
  const calendrierAnneeB = useCalendrier(anneeSuivante);

  const loading =
    loadingDemandes ||
    loadingRegles ||
    calendrierAnneePrecedente.loading ||
    calendrierAnneeA.loading ||
    calendrierAnneeB.loading;

  if (loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  const todayIso = todayISO();
  const debutAnneeActuelle = isoDate(anneeActuelle, 0, 1);
  const finAnneeActuelle = isoDate(anneeActuelle, 11, 31);
  // Voir DashboardPage.tsx — même fix (25/08/2026) : la vue "mois en cours"
  // doit démarrer le 1er du mois, pas littéralement aujourd'hui.
  const debutMoisActuel = isoDate(anneeActuelle, new Date().getMonth(), 1);

  const regleCp = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const debutPeriodeCp = regleCp
    ? todayIso >= isoDate(anneeActuelle, regleCp.periodeDebutMois - 1, regleCp.periodeDebutJour)
      ? isoDate(anneeActuelle, regleCp.periodeDebutMois - 1, regleCp.periodeDebutJour)
      : isoDate(anneePrecedente, regleCp.periodeDebutMois - 1, regleCp.periodeDebutJour)
    : debutAnneeActuelle;
  const finPeriodeCp = regleCp
    ? ajouterJoursIso(
        isoDate(
          Number(debutPeriodeCp.slice(0, 4)) + 1,
          regleCp.periodeDebutMois - 1,
          regleCp.periodeDebutJour,
        ),
        -1,
      )
    : finAnneeActuelle;

  const ranges: Record<Onglet, { debut: string; fin: string }> = {
    en_cours: {
      debut: vueCompleteEnCours ? debutAnneeActuelle : debutMoisActuel,
      fin: finAnneeActuelle,
    },
    periode_cp: {
      debut: vueCompletePeriodeCp ? debutPeriodeCp : debutMoisActuel,
      fin: finPeriodeCp,
    },
    annee_suivante: { debut: isoDate(anneeSuivante, 0, 1), fin: isoDate(anneeSuivante, 11, 31) },
  };
  const rangeActive = ranges[onglet];
  const moisActifs = moisEntre(rangeActive.debut, rangeActive.fin);
  const anneeSuivanteParametree = Boolean(calendrierAnneeB.parametrage?.valideLe);

  function calendrierPourAnnee(annee: number) {
    if (annee === anneePrecedente) return calendrierAnneePrecedente;
    if (annee === anneeSuivante) return calendrierAnneeB;
    return calendrierAnneeA;
  }

  function anneeVisiblePourCommuns(annee: number): boolean {
    return annee === anneeActuelle || Boolean(calendrierPourAnnee(annee).parametrage?.valideLe);
  }

  const joursFeriesToutesAnnees = [
    ...calendrierAnneePrecedente.joursFeries,
    ...calendrierAnneeA.joursFeries,
    ...calendrierAnneeB.joursFeries,
  ];
  const congesImposesVisibles = [
    ...calendrierAnneePrecedente.congesImposes,
    ...calendrierAnneeA.congesImposes,
    ...calendrierAnneeB.congesImposes,
  ].filter((c) => anneeVisiblePourCommuns(Number(c.debut.slice(0, 4))));
  const djImposeesVisibles = [
    ...calendrierAnneePrecedente.djImposees,
    ...calendrierAnneeA.djImposees,
    ...calendrierAnneeB.djImposees,
  ].filter((d) => anneeVisiblePourCommuns(Number(d.date.slice(0, 4))));
  const typologies = compterTypologies({
    demandes,
    rangeActive,
    congesImposes: congesImposesVisibles,
    djImposees: djImposeesVisibles,
    joursFeries: joursFeriesToutesAnnees,
    joursFeriesPourDuree: joursFeriesToutesAnnees,
  });

  function demandeDuJour(iso: string): Demande | undefined {
    return demandes.find(
      (d) => d.statut !== "refusé" && d.statut !== "annulé" && iso >= d.debut && iso <= d.fin,
    );
  }

  function communDuJour(iso: string): PastilleJour | null {
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    if (cal.joursFeries.some((f) => f.date === iso)) {
      return { classeFond: classeFondTypeBadge("FERIE") };
    }
    if (!anneeVisiblePourCommuns(annee)) return null;
    if (cal.congesImposes.some((c) => iso >= c.debut && iso <= c.fin)) {
      return { classeFond: classeFondTypeBadge("CPI") };
    }
    const dji = cal.djImposees.find((d) => d.date === iso);
    if (dji) {
      return {
        moitie: {
          couleur: "var(--color-cpi)",
          cote: dji.demiJournee === "matin" ? "gauche" : "droite",
        },
      };
    }
    return null;
  }

  // Demi-journée rendue comme telle, pas un fond plein — même fix que
  // DashboardPage.tsx (25/08/2026, bug signalé par Vincent).
  function tipoDuJour(iso: string): PastilleJour | null {
    const demande = demandeDuJour(iso);
    if (demande) {
      const code = codeBadgeDemande(demande);
      const matinCouvert = !(iso === demande.debut && demande.demiDebut === "apres_midi");
      const apresMidiCouvert = !(iso === demande.fin && demande.demiFin === "matin");

      if (matinCouvert && apresMidiCouvert) {
        const classeFond =
          demande.statut === "en attente"
            ? classeFondAttenueTypeBadge(code)
            : classeFondTypeBadge(code);
        return { classeFond };
      }

      const couleurBase = `var(${VAR_COULEUR_TYPE[code]})`;
      const couleur =
        demande.statut === "en attente"
          ? `color-mix(in srgb, ${couleurBase} 50%, white)`
          : couleurBase;
      return { moitie: { couleur, cote: matinCouvert ? "gauche" : "droite" } };
    }
    return communDuJour(iso);
  }

  function estEnGroupe(isoA: string, isoB: string): boolean {
    const demandeA = demandeDuJour(isoA);
    const demandeB = demandeDuJour(isoB);
    if (demandeA || demandeB) return Boolean(demandeA && demandeB && demandeA.id === demandeB.id);

    const annee = Number(isoA.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    const cpiA = cal.congesImposes.find((c) => isoA >= c.debut && isoA <= c.fin);
    const cpiB = cal.congesImposes.find((c) => isoB >= c.debut && isoB <= c.fin);
    return Boolean(cpiA && cpiB && cpiA.id === cpiB.id);
  }

  // Ce qui occupe un jour cliqué, dans l'ordre de priorité d'affichage —
  // demande perso > férié > CPI > DJI, même priorité que `communDuJour`
  // (24/08/2026 : les fériés ouvrent désormais aussi l'overlay, avec leur
  // nom — `SnippetJourCalendrier`). Même gating que `communDuJour` pour
  // CPI/DJI (`anneeVisiblePourCommuns`, les fériés y échappent).
  function occupantDuJour(iso: string): JourCalendrierClique | null {
    const demande = demandeDuJour(iso);
    if (demande) return { kind: "demande", demande };
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    const ferie = cal.joursFeries.find((f) => f.date === iso);
    if (ferie) return { kind: "ferie", ferie };
    if (!anneeVisiblePourCommuns(annee)) return null;
    const cpi = cal.congesImposes.find((c) => iso >= c.debut && iso <= c.fin);
    if (cpi) return { kind: "cpi", cpi };
    const dji = cal.djImposees.find((d) => d.date === iso);
    if (dji) return { kind: "dji", dji };
    return null;
  }

  function handleJourClick(iso: string, ancre: DOMRect) {
    const jour = occupantDuJour(iso);
    if (jour) setSnippet({ jour, ancre });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        {/* Compteur par typologie (24/08/2026, demande explicite) — sur la
            même ligne que les onglets de sélection de période, poussé à
            droite (`justify-between`) : un total par typologie de "day off"
            réellement présente sur la période active. */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnglet("en_cours")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                onglet === "en_cours"
                  ? "bg-slate/90 hover:bg-slate text-white"
                  : "border-slate text-slate hover:bg-slate/10 border bg-transparent"
              }`}
            >
              {anneeActuelle}
            </button>
            {onglet === "en_cours" && (
              <SelectAffichage
                actif={vueCompleteEnCours}
                onChange={setVueCompleteEnCours}
                labelMoisEnCours={formatMoisAnneeCourt(todayIso)}
                labelDebut={formatMoisAnneeCourt(debutAnneeActuelle)}
              />
            )}
            <button
              type="button"
              onClick={() => setOnglet("periode_cp")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                onglet === "periode_cp"
                  ? "bg-slate/90 hover:bg-slate text-white"
                  : "border-slate text-slate hover:bg-slate/10 border bg-transparent"
              }`}
            >
              {`${formatMoisAnneeCourt(debutPeriodeCp)} → ${formatMoisAnneeCourt(finPeriodeCp)}`}
            </button>
            {onglet === "periode_cp" && (
              <SelectAffichage
                actif={vueCompletePeriodeCp}
                onChange={setVueCompletePeriodeCp}
                labelMoisEnCours={formatMoisAnneeCourt(todayIso)}
                labelDebut={formatMoisAnneeCourt(debutPeriodeCp)}
              />
            )}
            <button
              type="button"
              onClick={() => setOnglet("annee_suivante")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                onglet === "annee_suivante"
                  ? "bg-slate/90 hover:bg-slate text-white"
                  : "border-slate text-slate hover:bg-slate/10 border bg-transparent"
              }`}
            >
              {anneeSuivante}
            </button>
          </div>

          <CompteurTypologies typologies={typologies} />
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="p-2 md:h-[604px] md:w-72 md:shrink-0">
          <ProchainsJoursOffCard
            utilisateurId={utilisateurId}
            debutPeriode={rangeActive.debut}
            finPeriode={rangeActive.fin}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-6">
            {onglet === "annee_suivante" && !anneeSuivanteParametree && (
              <p className="text-sm font-normal">
                <span className="text-ink-900 rounded-sm bg-yellow-200 px-1">
                  {`Le calendrier ${anneeSuivante} n’est pas encore paramétré par l’administrateur.`}
                </span>
              </p>
            )}

            <div className="flex max-w-[798px] flex-wrap gap-6">
              {moisActifs.map(({ annee, moisIndex }) => (
                <MiniCalendrier
                  key={`${annee}-${moisIndex}`}
                  annee={annee}
                  moisIndex={moisIndex}
                  tipoDuJour={tipoDuJour}
                  estEnGroupe={estEnGroupe}
                  onJourClick={handleJourClick}
                  estAujourdhui={(iso) => iso === todayIso}
                  className="h-[290px] w-full sm:w-[calc(50%-12px)] lg:w-[calc((100%-48px)/3)]"
                  texteJour="text-base"
                  paddingClassName="p-6"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {snippet && (
        <SnippetJourCalendrier
          jour={snippet.jour}
          ancre={snippet.ancre}
          joursFeries={joursFeriesToutesAnnees}
          onFermer={() => setSnippet(null)}
        />
      )}
    </div>
  );
}
