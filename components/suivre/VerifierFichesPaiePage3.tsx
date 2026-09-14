"use client";

import { useEffect, useState } from "react";
import {
  fetchCheckFichesPaie,
  fetchComparaisonSoldes,
  validerExportPaie,
  type CheckFichePaieCollaborateur,
  type ComparaisonSoldeCollaborateur,
  type SoldeComparaisonCategorie,
} from "@/lib/data/exportsPaie.repository";
import { formatJours } from "@/lib/format";
import type { Demande, DemandeEquipe, LigneExportPaie } from "@/lib/types";
import { HistoriqueTable } from "@/components/historique/HistoriqueTable";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";
import { Button } from "@/components/ui/Button";
import { Check } from "lucide-react";
import { classeTexteTypeBadge, LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

const TYPES_SOLDE: TypeBadgeCode[] = ["CP", "RTT", "CPA"];

function categorieSolde(
  c: ComparaisonSoldeCollaborateur,
  code: TypeBadgeCode,
): SoldeComparaisonCategorie {
  if (code === "RTT") return c.rtt;
  if (code === "CPA") return c.cpa;
  return c.cp;
}

function typeBadgeDeDemande(demande: DemandeEquipe): TypeBadgeCode {
  if (demande.type === "CP" && demande.congeImposeId) return "CPI";
  if (demande.type === "CP" && demande.isAnticipation) return "CPA";
  return demande.type as TypeBadgeCode;
}

function formatMouvement(valeur: number): string {
  if (valeur === 0) return "0";
  return `${valeur > 0 ? "+" : ""}${formatJours(valeur)}`;
}

// Abrégés (repris de VerifierFichesPaiePage2.tsx) — seuls les mois dont le
// nom complet déborde le sont.
const MOIS_ABREGES: Record<number, string> = {
  8: "sept.",
  9: "oct.",
  10: "nov.",
  11: "déc.",
};

function nomMois(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const abrege = MOIS_ABREGES[date.getUTCMonth()];
  if (abrege) return abrege;
  return new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(date);
}

function moisPrecedentIso(periodeDebutIso: string): string {
  const d = new Date(`${periodeDebutIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Section d'un type (CP/RTT/CPA) pour un collaborateur — l'indicateur de
 * solde (mois précédent/mois en cours/mouvement) reste affiché, mais en
 * en-tête compact plutôt qu'en tableau principal (11/09/2026, demande
 * explicite de Vincent : "ce n'est pas les soldes qui sont transmis ou pris
 * en compte, mais les jours" — l'unité vérifiable est le congé, le solde
 * n'est qu'un indicateur "ok ou pas"). Le tableau lui-même reprend
 * `HistoriqueTable`, même composant que "Quels congés transmettre"
 * (`TransmissionsPaiePage.tsx`), colonne "Paie" incluse
 * (`lignesTransmissionParDemande`).
 */
function SectionType({
  code,
  categorie,
  periode,
  demandes,
  lignesParDemande,
  selectedId,
  onDateClick,
}: {
  code: TypeBadgeCode;
  categorie: SoldeComparaisonCategorie;
  periode: { debut: string; fin: string };
  demandes: Demande[];
  lignesParDemande: Record<string, LigneExportPaie[]>;
  selectedId: string | null;
  onDateClick: (id: string) => void;
}) {
  const libelleMoisPrecedent = nomMois(moisPrecedentIso(periode.debut));
  const libelleMoisEnCours = nomMois(periode.debut);

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1">
        <span className={`text-sm font-bold ${classeTexteTypeBadge(code)}`}>
          {LABEL_LONG[code]}
        </span>
        <span className="text-ink-500 text-xs">
          Solde {libelleMoisPrecedent} : <b className="text-ink-900">{formatJours(categorie.moisPrecedent)} j</b>
          {" · "}
          Solde {libelleMoisEnCours} : <b className="text-ink-900">{formatJours(categorie.moisEnCours)} j</b>
          {" · "}
          Différence :{" "}
          <b className={categorie.mouvement === 0 ? "text-ink-900" : classeTexteTypeBadge(code)}>
            {formatMouvement(categorie.mouvement)} j
          </b>
        </span>
      </div>
      <div className="bg-surface-card overflow-hidden shadow-sm">
        <HistoriqueTable
          demandes={demandes}
          compact
          onDateClick={onDateClick}
          selectedId={selectedId}
          lignesTransmissionParDemande={lignesParDemande}
          emptyText={`Aucun congé ${code} sur cette période.`}
        />
      </div>
    </div>
  );
}

function CardCollaborateurV3({
  c,
  periode,
  lignes,
  selectedId,
  onDateClick,
  onCloseDetail,
}: {
  c: ComparaisonSoldeCollaborateur;
  periode: { debut: string; fin: string };
  lignes: { ligne: LigneExportPaie; demande: DemandeEquipe }[];
  selectedId: string | null;
  onDateClick: (id: string) => void;
  onCloseDetail: () => void;
}) {
  const lignesParDemande: Record<string, LigneExportPaie[]> = {};
  for (const { ligne, demande } of lignes) {
    (lignesParDemande[demande.id] ??= []).push(ligne);
  }

  // Le congé sélectionné appartient-il à CE collaborateur ? (14/09/2026,
  // demande explicite de Vincent — "la card détail doit être englobée dans
  // la card collaborateur") : `DetailCongePanel` ne s'affiche plus dans une
  // colonne à part au niveau de la page, mais À L'INTÉRIEUR de la card du
  // collaborateur concerné, aucune autre card n'affiche rien.
  const selection = lignes.find(({ demande }) => demande.id === selectedId)?.demande ?? null;
  const lignesTransmissionSelection = lignes
    .filter(({ demande }) => demande.id === selectedId)
    .map(({ ligne }) => ligne);

  return (
    // Card englobant tout le collaborateur (14/09/2026, demande explicite de
    // Vincent) — même charte que les autres cards de cet écran (`bg-surface-
    // card` + `shadow-sm`, coins carrés) : nom + les 3 tableaux CP/RTT/CPA
    // dans un seul bloc visuel plutôt que des sections flottant librement
    // sur le fond de page. Grille interne (`xl:grid-cols-[1fr_16rem]`, même
    // principe que "Suivre les demandes") quand le détail d'un congé DE CE
    // collaborateur est ouvert, pour l'afficher à droite sans sortir de
    // cette card.
    <div className="bg-surface-card p-4 shadow-sm">
      <div
        className={
          selection
            ? "grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_16rem] xl:gap-x-4"
            : undefined
        }
      >
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-ink-900 text-base font-semibold">
              {c.utilisateur.prenom} {c.utilisateur.nom}
            </span>
          </div>
          {TYPES_SOLDE.map((code) => (
            <SectionType
              key={code}
              code={code}
              categorie={categorieSolde(c, code)}
              periode={periode}
              demandes={lignes
                .filter(({ demande }) => typeBadgeDeDemande(demande) === code)
                .map(({ demande }) => demande)}
              lignesParDemande={lignesParDemande}
              selectedId={selectedId}
              onDateClick={onDateClick}
            />
          ))}
        </div>
        {selection && (
          <DetailCongePanel
            key={selection.id}
            selection={selection}
            onClose={onCloseDetail}
            lignesTransmission={lignesTransmissionSelection}
          />
        )}
      </div>
    </div>
  );
}

/**
 * "Vérifier les fiches de paie 3" (11/09/2026, demande explicite de
 * Vincent — proto rapide, itération sur `VerifierFichesPaiePage2.tsx`
 * conservée telle quelle à côté, même principe que la 2 dupliquée depuis
 * l'originale) : recentre l'écran sur les CONGÉS individuels (ce qui est
 * réellement transmis/pris en compte), le solde ne restant qu'un
 * indicateur de cohérence en en-tête de section, pas l'unité principale.
 *
 * Volontairement en LECTURE SEULE pour cette itération (pas de
 * "Annuler ce congé" depuis `DetailCongePanel`) — le scope demandé porte
 * sur la lisibilité de la liste, pas sur de nouvelles actions ; à étendre
 * si besoin une fois la maquette validée.
 */
export function VerifierFichesPaiePage3({
  exportId,
  prisEnCompte,
  onValide,
  periode,
}: {
  exportId: string | null;
  prisEnCompte: boolean;
  onValide: () => void;
  periode: { debut: string; fin: string };
}) {
  const [comparaisons, setComparaisons] = useState<ComparaisonSoldeCollaborateur[]>([]);
  const [collaborateurs, setCollaborateurs] = useState<CheckFichePaieCollaborateur[]>([]);
  // `loading` ne se réinitialise qu'au montage (pas de `setLoading(true)`
  // dans l'effet, interdit par la règle de lint `set-state-in-effect` — même
  // convention que `useHistoriqueSolde.ts`) : si `periode`/`exportId`
  // changent sur une instance déjà montée, l'appelant doit forcer un
  // remontage (`key`) pour éviter d'afficher brièvement les anciennes
  // données sous un `loading` resté à `false`.
  const [loading, setLoading] = useState(true);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [enCoursValidation, setEnCoursValidation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchComparaisonSoldes(periode, exportId),
      exportId ? fetchCheckFichesPaie(exportId) : Promise.resolve([]),
    ]).then(([comps, collabs]) => {
      if (cancelled) return;
      setComparaisons(comps);
      setCollaborateurs(collabs);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [periode, exportId]);

  async function handleValider() {
    if (!exportId) return;
    setEnCoursValidation(true);
    try {
      await validerExportPaie(exportId);
      onValide();
      // Rafraîchit `comparaisons`/`collaborateurs` (11/09/2026, "il faut un
      // rafraîchissement" — même correctif que `VerifierFichesPaiePage2`) :
      // `onValide()` ne rafraîchit que l'export côté parent, pas les badges
      // "Pris en compte" affichés ici, restés sur l'ancien état sinon.
      const [comps, collabs] = await Promise.all([
        fetchComparaisonSoldes(periode, exportId),
        fetchCheckFichesPaie(exportId),
      ]);
      setComparaisons(comps);
      setCollaborateurs(collabs);
    } finally {
      setEnCoursValidation(false);
    }
  }

  const lignesParUtilisateur = new Map(collaborateurs.map((c) => [c.utilisateur.id, c.lignes]));

  const toutesLesLignes = collaborateurs.flatMap((c) => c.lignes);
  const toutesLesDemandes = toutesLesLignes.map(({ demande }) => demande);

  return (
    <div className="flex flex-col gap-6">
      {loading ? (
        <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
      ) : comparaisons.length === 0 ? (
        <div className="text-ink-500 py-20 text-center text-sm">Aucun collaborateur actif.</div>
      ) : (
        // Suite de cards collaborateur (14/09/2026) — chacune gère désormais
        // elle-même l'affichage du détail congé EN SON SEIN quand la
        // sélection lui appartient (voir `CardCollaborateurV3`), plus de
        // grille/colonne de détail au niveau de la page.
        <div className="flex w-full min-w-0 flex-col gap-5">
          {comparaisons.map((c) => (
            <CardCollaborateurV3
              key={c.utilisateur.id}
              c={c}
              periode={periode}
              lignes={lignesParUtilisateur.get(c.utilisateur.id) ?? []}
              selectedId={selectionId}
              onDateClick={setSelectionId}
              onCloseDetail={() => setSelectionId(null)}
            />
          ))}
        </div>
      )}

      <div className="bg-surface-card border-ink-300/60 sticky bottom-0 z-10 flex items-center justify-between gap-4 rounded-xl border-t px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <span className="text-ink-500 text-sm">
          {prisEnCompte ? "Pris en compte" : `${toutesLesDemandes.length} congé${toutesLesDemandes.length > 1 ? "s" : ""} transmis`}
        </span>
        <Button
          className="rounded-full px-5 py-2.5 text-sm"
          onClick={handleValider}
          disabled={!exportId || prisEnCompte || enCoursValidation}
        >
          <Check size={16} />
          {enCoursValidation ? "Validation…" : "Valider"}
        </Button>
      </div>
    </div>
  );
}
