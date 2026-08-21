"use client";

import { useState } from "react";
import { todayISO } from "@/lib/format";
import { classeFondTypeBadge } from "@/components/demandes/TypeBadge";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { SelectFiltrePill } from "@/components/ui/FiltrePill";
import { useCalendrier } from "@/hooks/useCalendrier";
import { ModalPoserJourImpose, type Mode } from "@/components/parametrer/ModalPoserJourImpose";
import { ProchainsJoursOffCard } from "@/components/dashboard/ProchainsJoursOffCard";

const ANNEE = 2026;

type FiltreJour = "tous" | "CPI" | "DJI" | "FERIE";

/**
 * Prototype (21/08/2026) — reprend l'habillage de la home (grille de mois
 * `MiniCalendrier`, mêmes dimensions/`className` que `Dashboard2Page.tsx`)
 * côté admin, scopé à 2026, sans toucher à `/parametrer/calendrier2`
 * (l'existant) : pas d'onglets année/période de référence CP, pas de
 * publication — juste le nouvel habillage + la popin de création unifiée
 * CPI/DJI (`ModalPoserJourImpose`) à la place des deux modales maison
 * historiques. Colonne de droite = `ProchainsJoursOffCard` (repris tel quel
 * de la home, `separerCpiDji`/`masquerDemandesPerso` pour ce contexte) —
 * les cartes de légende CPI/DJI/Fériés cliquables (popin liste + "+") ont
 * été retirées (21/08/2026, demande explicite) : la liste + le clic direct
 * sur un jour du calendrier suffisent pour consulter et créer.
 * Voir le plan pour le chantier suivant (transparence sur les demandes
 * personnelles, déduplication du calendrier collaborateur) — hors scope ici.
 */
export function Calendrier3Page() {
  const {
    joursFeries,
    congesImposes,
    djImposees,
    ajouterConge,
    ajouterDj,
    supprimerConge,
    supprimerDj,
    loading,
  } = useCalendrier(ANNEE);
  const [modaleCreation, setModaleCreation] = useState<Mode | null>(null);
  const [dateInitiale, setDateInitiale] = useState<string | undefined>(undefined);
  const [filtre, setFiltre] = useState<FiltreJour>("tous");

  // Clic sur un jour vide du calendrier (21/08/2026) — même affordance que
  // "Mon Calendrier" (Accueil, `onJourVideClick`) : ouvre directement la
  // popin de création, date pré-remplie. Mode par défaut DJI (modifiable
  // dans la popin) : un clic sur un seul jour est statistiquement plus
  // souvent une demi-journée imposée qu'une période CPI multi-jours.
  function handleJourVideClick(iso: string) {
    setDateInitiale(iso);
    setModaleCreation("DJI");
  }

  function fermerModaleCreation() {
    setModaleCreation(null);
    setDateInitiale(undefined);
  }

  // Poubelle en sur-impression sur le calendrier (21/08/2026) — résout quel
  // CPI/DJI couvre le jour survolé et le supprime ; jamais appelé pour un
  // jour férié (voir `estJourSupprimable`, passé à `MiniCalendrier`).
  async function handleSupprimerJour(iso: string) {
    const cpi = congesImposes.find((c) => iso >= c.debut && iso <= c.fin);
    if (cpi) {
      await supprimerConge(cpi.id);
      return;
    }
    const dji = djImposees.find((d) => d.date === iso);
    if (dji) await supprimerDj(dji.id);
  }

  function estJourSupprimable(iso: string): boolean {
    return !joursFeries.some((f) => f.date === iso);
  }

  if (loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  const todayIso = todayISO();
  const moisActifs = Array.from({ length: 12 }, (_, moisIndex) => ({ annee: ANNEE, moisIndex }));

  function tipoDuJour(iso: string): PastilleJour | null {
    if ((filtre === "tous" || filtre === "FERIE") && joursFeries.some((f) => f.date === iso)) {
      return { classeFond: classeFondTypeBadge("FERIE") };
    }
    if (
      (filtre === "tous" || filtre === "CPI") &&
      congesImposes.some((c) => iso >= c.debut && iso <= c.fin)
    ) {
      return { classeFond: classeFondTypeBadge("CPI") };
    }
    if (filtre === "tous" || filtre === "DJI") {
      const dji = djImposees.find((d) => d.date === iso);
      if (dji) {
        return {
          moitie: {
            couleur: "var(--color-dji)",
            cote: dji.demiJournee === "matin" ? "gauche" : "droite",
          },
        };
      }
    }
    return null;
  }

  function estEnGroupe(isoA: string, isoB: string): boolean {
    const cpiA = congesImposes.find((c) => isoA >= c.debut && isoA <= c.fin);
    const cpiB = congesImposes.find((c) => isoB >= c.debut && isoB <= c.fin);
    return Boolean(cpiA && cpiB && cpiA.id === cpiB.id);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6 pb-4 md:max-w-none md:pt-0">
      <h1 className="text-ink-900 px-1 pt-5 text-2xl font-semibold md:pt-0">Calendrier {ANNEE}</h1>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="flex max-w-[798px] min-w-0 flex-1 flex-wrap gap-6">
          {moisActifs.map(({ annee, moisIndex }) => (
            <MiniCalendrier
              key={`${annee}-${moisIndex}`}
              annee={annee}
              moisIndex={moisIndex}
              tipoDuJour={tipoDuJour}
              estEnGroupe={estEnGroupe}
              estAujourdhui={(iso) => iso === todayIso}
              onJourVideClick={handleJourVideClick}
              onJourSupprimerClick={handleSupprimerJour}
              estJourSupprimable={estJourSupprimable}
              className="h-[290px] w-full sm:w-[calc(50%-12px)] lg:w-[calc((100%-48px)/3)]"
              texteJour="text-base"
              paddingClassName="p-6"
            />
          ))}
        </div>

        <div className="flex flex-col gap-3 p-2 md:h-[604px] md:w-72 md:shrink-0">
          <SelectFiltrePill
            value={filtre}
            onChange={(e) => setFiltre(e.target.value as FiltreJour)}
            className="self-start"
          >
            <option value="tous">DJI, CPI, Fériés</option>
            <option value="DJI">DJI</option>
            <option value="CPI">CPI</option>
            <option value="FERIE">Fériés</option>
          </SelectFiltrePill>
          <ProchainsJoursOffCard
            debutPeriode={`${ANNEE}-01-01`}
            finPeriode={`${ANNEE}-12-31`}
            masquerDemandesPerso
            separerCpiDji
            filtreCode={filtre === "tous" ? undefined : filtre}
            avecSuppression
          />
        </div>
      </div>

      {modaleCreation && (
        <ModalPoserJourImpose
          joursFeries={joursFeries}
          congesImposes={congesImposes}
          djImposees={djImposees}
          onAjouterCongeImpose={ajouterConge}
          onAjouterDj={ajouterDj}
          onClose={fermerModaleCreation}
          modeInitial={modaleCreation}
          dateInitiale={dateInitiale}
        />
      )}
    </div>
  );
}
