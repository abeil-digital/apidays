"use client";

import { useState } from "react";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { formatJours, formatPeriodeDemande } from "@/lib/format";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { SoldeCard } from "@/components/ui/SoldeCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RequestList } from "@/components/demandes/RequestList";
import {
  TypeBadge,
  classeFondAttenueTypeBadge,
  classeFondTypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { ReglesCongesModal } from "@/components/dashboard/ReglesCongesModal";
import type { Demande } from "@/lib/types";

/** Les 12 mois de l'année, réordonnés pour commencer par le mois en cours. */
function moisAffiches(): { annee: number; moisIndex: number }[] {
  const maintenant = new Date();
  const anneeDepart = maintenant.getFullYear();
  const moisDepart = maintenant.getMonth();
  return Array.from({ length: 12 }, (_, i) => {
    const moisIndex = (moisDepart + i) % 12;
    const annee = anneeDepart + Math.floor((moisDepart + i) / 12);
    return { annee, moisIndex };
  });
}

function codeBadgeDemande(demande: Demande): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

function SnippetDemande({
  demande,
  ancre,
  onFermer,
}: {
  demande: Demande;
  ancre: DOMRect;
  onFermer: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onFermer} />
      <div
        style={{ position: "fixed", top: ancre.bottom + 8, left: ancre.left }}
        className="bg-surface-card z-30 flex w-56 flex-col gap-2 rounded-xl p-3 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <TypeBadge code={codeBadgeDemande(demande)} />
          <div className="text-ink-900 text-sm font-bold">
            {formatPeriodeDemande(demande.debut, demande.fin)}
          </div>
        </div>
        <div className="text-ink-500 text-xs">
          {formatJours(demande.nbDemiJournees / 2)} jour{demande.nbDemiJournees / 2 > 1 ? "s" : ""}
        </div>
        <StatusBadge statut={demande.statut} />
      </div>
    </>
  );
}

/**
 * Accueil 2 (scénarisation) — duplicata de `DashboardPage` pour itérer sur
 * l'évolution de l'accueil collaborateur sans toucher à l'écran en
 * production. Route `/accueil2`, à retravailler/retirer une fois la
 * direction validée (voir Backlog.md).
 *
 * "Demandes en cours"/"Prochains congés" remplacés par une vue calendrier
 * annuelle (12 `MiniCalendrier`, 3 colonnes) qui affiche directement les
 * demandes du collaborateur (validées en couleur pleine, en attente en
 * couleur atténuée) + une colonne latérale "En attente de validation".
 */
export function Dashboard2Page() {
  const { utilisateur, loading: loadingUtilisateur } = useUtilisateur();
  const { soldes, loading: loadingSoldes } = useSoldes();
  const { demandes, loading: loadingDemandes } = useDemandes();
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [snippet, setSnippet] = useState<{ demande: Demande; ancre: DOMRect } | null>(null);

  const mois = moisAffiches();
  const anneeDepart = mois[0].annee;
  const anneeSuivante = anneeDepart + 1;
  // Jours "communs" (Fériés/CPI/DJI) — la grille de 12 mois démarre au mois en
  // cours et peut donc chevaucher deux années civiles, jamais plus.
  const calendrierAnneeA = useCalendrier(anneeDepart);
  const calendrierAnneeB = useCalendrier(anneeSuivante);

  const loading =
    loadingUtilisateur ||
    loadingSoldes ||
    loadingDemandes ||
    calendrierAnneeA.loading ||
    calendrierAnneeB.loading;

  if (loading || !utilisateur || !soldes) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  const enCours = demandes
    .filter((d) => d.statut === "en attente")
    .sort((a, b) => a.debut.localeCompare(b.debut));

  function calendrierPourAnnee(annee: number) {
    return annee === anneeDepart ? calendrierAnneeA : calendrierAnneeB;
  }

  function demandeDuJour(iso: string): Demande | undefined {
    return demandes.find((d) => d.statut !== "refusé" && iso >= d.debut && iso <= d.fin);
  }

  // Jours communs, tous types confondus : les Fériés sont montrés même sur
  // une année pas encore publiée (fixes, connus à l'avance). CPI/DJI de
  // l'année EN COURS sont toujours affichés (déjà réels/en vigueur — cette
  // année n'a d'ailleurs jamais de bouton "Publier" côté Calendrier, voir
  // `estAnneeLive` dans CalendrierPage.tsx) ; ceux de l'année À VENIR ne le
  // sont que si le paramétrage a été publié par Delphine — pas encore
  // garantis/définitifs avant ça. Une DJI est une demi-journée (variante
  // `moitie`, matin=gauche/après-midi=droite) — jamais un fond plein, sinon
  // on perd l'info du créneau.
  function communDuJour(iso: string): PastilleJour | null {
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    if (cal.joursFeries.some((f) => f.date === iso)) {
      return { classeFond: classeFondTypeBadge("FERIE") };
    }
    const estAnneeLive = annee === new Date().getFullYear();
    if (!estAnneeLive && !cal.parametrage?.valideLe) return null;
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

  // Priorité d'affichage : demande personnelle du collaborateur > férié > CPI
  // > DJI. Un chevauchement demande/CPI-DJI reste un cas marginal (voir
  // Backlog.md — scan de chevauchement dédié), la demande perso l'emporte
  // visuellement ici plutôt que de le masquer.
  function tipoDuJour(iso: string): PastilleJour | null {
    const demande = demandeDuJour(iso);
    if (demande) {
      const code = codeBadgeDemande(demande);
      const classeFond =
        demande.statut === "en attente"
          ? classeFondAttenueTypeBadge(code)
          : classeFondTypeBadge(code);
      return { classeFond };
    }
    return communDuJour(iso);
  }

  function estEnGroupe(isoA: string, isoB: string): boolean {
    const demandeA = demandeDuJour(isoA);
    const demandeB = demandeDuJour(isoB);
    if (demandeA || demandeB) return Boolean(demandeA && demandeB && demandeA.id === demandeB.id);

    // Continuité d'une période CPI à cheval sur plusieurs jours — Fériés/DJI
    // restent toujours des pastilles isolées (jamais de période multi-jours).
    const annee = Number(isoA.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    const cpiA = cal.congesImposes.find((c) => isoA >= c.debut && isoA <= c.fin);
    const cpiB = cal.congesImposes.find((c) => isoB >= c.debut && isoB <= c.fin);
    return Boolean(cpiA && cpiB && cpiA.id === cpiB.id);
  }

  function handleJourClick(iso: string, ancre: DOMRect) {
    const demande = demandeDuJour(iso);
    if (demande) setSnippet({ demande, ancre });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-4 md:max-w-6xl md:pt-0">
      <div className="px-1 pt-5 md:pt-0">
        <h1 className="text-ink-900 text-2xl font-semibold">Bonjour, {utilisateur.prenom}</h1>
      </div>

      <div className="flex flex-col gap-2">
        <div className="bg-mint-tint flex flex-col gap-4 rounded-2xl p-4 md:flex-row md:items-center md:gap-6 md:p-5">
          <div className="flex shrink-0 flex-col gap-1 md:w-44">
            <h2 className="text-ink-900 text-lg font-bold">Soldes</h2>
            <p className="text-ink-500 text-xs leading-snug">Quels congés imposés cette année ?</p>
            <button
              type="button"
              onClick={() => setReglesOuvertes(true)}
              className="text-ink-900 w-fit text-xs font-semibold underline"
            >
              découvrir
            </button>
          </div>

          <div className="grid max-w-2xl flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <SoldeCard
              valeur={soldes.cp.valeur}
              conditionPrefixe={soldes.cp.conditionPrefixe}
              conditionAccent={soldes.cp.conditionAccent}
              tone="cp"
            />
            <SoldeCard
              valeur={soldes.rtt.valeur}
              conditionPrefixe={soldes.rtt.conditionPrefixe}
              conditionAccent={soldes.rtt.conditionAccent}
              tone="rtt"
            />
            <SoldeCard
              valeur={soldes.cpa.valeur}
              conditionPrefixe={soldes.cpa.conditionPrefixe}
              conditionAccent={soldes.cpa.conditionAccent}
              tone="cpa"
            />
            <Link
              href="/nouvelle-demande"
              className="bg-mint flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl p-4 text-white shadow-sm"
            >
              <span className="text-sm font-semibold">Poser un congé</span>
              <PlusCircle size={20} />
            </Link>
          </div>
        </div>
        <p className="text-ink-500 px-1 text-xs">
          Données de démonstration — le calcul réel sera défini avec Abeil.
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="grid max-w-[900px] flex-1 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))] gap-4">
          {mois.map(({ annee, moisIndex }) => (
            <MiniCalendrier
              key={`${annee}-${moisIndex}`}
              annee={annee}
              moisIndex={moisIndex}
              tipoDuJour={tipoDuJour}
              estEnGroupe={estEnGroupe}
              onJourClick={handleJourClick}
            />
          ))}
        </div>

        <div className="flex w-full flex-col gap-3 md:w-72 md:shrink-0">
          <SectionLabel>En attente de validation</SectionLabel>
          <RequestList demandes={enCours} emptyText="Aucune demande en attente." />
        </div>
      </div>

      {snippet && (
        <SnippetDemande
          demande={snippet.demande}
          ancre={snippet.ancre}
          onFermer={() => setSnippet(null)}
        />
      )}

      {reglesOuvertes && (
        <ReglesCongesModal soldes={soldes} onClose={() => setReglesOuvertes(false)} />
      )}
    </div>
  );
}
