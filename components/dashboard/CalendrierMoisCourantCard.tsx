"use client";

import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import {
  classeFondAttenueTypeBadge,
  classeFondTypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import type { Demande } from "@/lib/types";

interface DonneesCalendrier {
  joursFeries: { date: string }[];
  congesImposes: { debut: string; fin: string; id: string }[];
  djImposees: { date: string; demiJournee: "matin" | "apres_midi" }[];
}

function isoDuJour(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function codeBadgeDemande(demande: Demande): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

/**
 * Card "Calendrier" (16/08/2026, Accueil2) — même carte (en-tête titré +
 * séparateur) et même largeur 1/3 que `ActiviteRecenteListe`. Réutilise
 * `MiniCalendrier` (DS, `sansCarte`) pour le mois en cours PUIS le mois
 * suivant (16/08/2026, léger séparateur entre les deux), avec les vraies
 * pastilles de congés/fériés/imposés de l'utilisateur — même priorité
 * d'affichage que `MonCalendrierPage` (demande perso > férié > CPI > DJI).
 * Le mois suivant peut chevaucher l'année suivante (décembre → janvier),
 * d'où les deux `useCalendrier` (un par année potentiellement distincte).
 * "Aujourd'hui" est marqué d'un simple contour (`estAujourdhui`), jamais
 * d'un remplissage coloré, pour ne pas se confondre avec une pastille de
 * congé.
 */
export function CalendrierMoisCourantCard() {
  const { demandes, loading: loadingDemandes } = useDemandes();
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const moisIndex = maintenant.getMonth();
  const moisSuivantIndex = (moisIndex + 1) % 12;
  const anneeMoisSuivant = moisIndex === 11 ? annee + 1 : annee;
  const isoAujourdhui = isoDuJour(maintenant);

  const calActuel = useCalendrier(annee);
  const calSuivant = useCalendrier(anneeMoisSuivant);

  const entete = (
    <div className="px-4 py-3">
      <h2 className="text-ink-900 text-lg font-bold">Calendrier</h2>
    </div>
  );

  if (loadingDemandes || calActuel.loading || calSuivant.loading) {
    return (
      <div className="bg-surface-card w-full md:max-w-sm">
        {entete}
        <div className="border-ink-300/60 border-t p-4">
          <div className="text-ink-500 py-8 text-center text-sm">Chargement…</div>
        </div>
      </div>
    );
  }

  function demandeDuJour(iso: string): Demande | undefined {
    return demandes.find((d) => d.statut !== "refusé" && iso >= d.debut && iso <= d.fin);
  }

  function communDuJour(iso: string, cal: DonneesCalendrier): PastilleJour | null {
    if (cal.joursFeries.some((f) => f.date === iso)) {
      return { classeFond: classeFondTypeBadge("FERIE") };
    }
    if (cal.congesImposes.some((c) => iso >= c.debut && iso <= c.fin)) {
      return { classeFond: classeFondTypeBadge("CPI") };
    }
    const dji = cal.djImposees.find((d) => d.date === iso);
    if (dji) {
      return {
        moitie: {
          couleur: "var(--color-dji)",
          cote: dji.demiJournee === "matin" ? "gauche" : "droite",
        },
      };
    }
    return null;
  }

  function creerTipoDuJour(cal: DonneesCalendrier) {
    return function tipoDuJour(iso: string): PastilleJour | null {
      const demande = demandeDuJour(iso);
      if (demande) {
        const code = codeBadgeDemande(demande);
        const classeFond =
          demande.statut === "en attente"
            ? classeFondAttenueTypeBadge(code)
            : classeFondTypeBadge(code);
        return { classeFond };
      }
      return communDuJour(iso, cal);
    };
  }

  function creerEstEnGroupe(cal: DonneesCalendrier) {
    return function estEnGroupe(isoA: string, isoB: string): boolean {
      const demandeA = demandeDuJour(isoA);
      const demandeB = demandeDuJour(isoB);
      if (demandeA || demandeB) {
        return Boolean(demandeA && demandeB && demandeA.id === demandeB.id);
      }
      const cpiA = cal.congesImposes.find((c) => isoA >= c.debut && isoA <= c.fin);
      const cpiB = cal.congesImposes.find((c) => isoB >= c.debut && isoB <= c.fin);
      return Boolean(cpiA && cpiB && cpiA.id === cpiB.id);
    };
  }

  return (
    <div className="bg-surface-card w-full md:max-w-sm">
      {entete}
      <div className="border-ink-300/60 border-t p-4">
        <div className="mx-auto w-[80%]">
          <MiniCalendrier
            annee={annee}
            moisIndex={moisIndex}
            tipoDuJour={creerTipoDuJour(calActuel)}
            estEnGroupe={creerEstEnGroupe(calActuel)}
            estAujourdhui={(iso) => iso === isoAujourdhui}
            sansCarte
            agrandi
          />
        </div>
      </div>

      <div className="border-ink-300/60 border-t p-4">
        <div className="mx-auto w-[80%]">
          <MiniCalendrier
            annee={anneeMoisSuivant}
            moisIndex={moisSuivantIndex}
            tipoDuJour={creerTipoDuJour(calSuivant)}
            estEnGroupe={creerEstEnGroupe(calSuivant)}
            estAujourdhui={(iso) => iso === isoAujourdhui}
            sansCarte
            agrandi
          />
        </div>
      </div>
    </div>
  );
}
