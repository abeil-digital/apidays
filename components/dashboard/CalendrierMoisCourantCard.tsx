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
 * Card "Calendrier" (17/08/2026, Accueil2) — réintégrée à droite de
 * `ProchainsJoursOffCard`, même gabarit `MiniCalendrier` PAR DÉFAUT (pas
 * `agrandi`/`sansCarte`) que `MonCalendrierPage` ("les templates de Mon
 * calendrier", demande explicite) : mois en cours + suivant, côte à côte.
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
      <h2 className="text-ink-500 text-base font-bold">Calendrier</h2>
    </div>
  );

  if (loadingDemandes || calActuel.loading || calSuivant.loading) {
    return (
      <div className="w-full min-w-0 lg:flex-1">
        {entete}
        <div className="p-4">
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
    <div className="w-full min-w-0 lg:flex-1">
      {entete}
      {/* Grille `auto-fit`/`minmax(170px,1fr)` (17/08/2026) — même règle de
          responsive que `MonCalendrierPage` (corrigée le même jour : le
          `min-w-0` manquant sur l'élément flex y causait un débordement
          horizontal au lieu d'un repli en colonnes, cf. audit). Les colonnes
          s'étirent quand la place le permet, et se replient en dessous de
          170px plutôt que de rétrécir les cases (repli à 1 colonne ici, avec
          seulement 2 mois). */}
      <div className="grid max-w-[396px] [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))] gap-4 p-4">
        <MiniCalendrier
          annee={annee}
          moisIndex={moisIndex}
          tipoDuJour={creerTipoDuJour(calActuel)}
          estEnGroupe={creerEstEnGroupe(calActuel)}
          estAujourdhui={(iso) => iso === isoAujourdhui}
        />
        <MiniCalendrier
          annee={anneeMoisSuivant}
          moisIndex={moisSuivantIndex}
          tipoDuJour={creerTipoDuJour(calSuivant)}
          estEnGroupe={creerEstEnGroupe(calSuivant)}
          estAujourdhui={(iso) => iso === isoAujourdhui}
        />
      </div>
    </div>
  );
}
