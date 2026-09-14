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
import { ArrowRight, Check } from "lucide-react";
import {
  classeBordureTypeBadge,
  classeTexteTypeBadge,
  LABEL_LONG,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";

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
  onCloseDetail,
}: {
  code: TypeBadgeCode;
  categorie: SoldeComparaisonCategorie;
  periode: { debut: string; fin: string };
  demandes: Demande[];
  lignesParDemande: Record<string, LigneExportPaie[]>;
  selectedId: string | null;
  onDateClick: (id: string) => void;
  onCloseDetail: () => void;
}) {
  const libelleMoisPrecedent = nomMois(moisPrecedentIso(periode.debut));
  const libelleMoisEnCours = nomMois(periode.debut);
  // "Solde" = écart réellement observé entre les 2 pills (14/09/2026, bug
  // remonté par Vincent sur RTT/CPA — "les chiffres sont incohérents au
  // niveau du solde") : `categorie.mouvement` ne reflète QUE l'effet de cet
  // export, alors que RTT/CPA (accrual progressif) grandissent aussi
  // naturellement d'un mois sur l'autre indépendamment de tout export — un
  // "Solde 0j" à côté de deux pills qui diffèrent était trompeur. On affiche
  // donc l'écart réel plutôt que le seul mouvement de l'export.
  const ecart = categorie.moisEnCours - categorie.moisPrecedent;

  // Le congé sélectionné appartient-il à CE TYPE (14/09/2026, demande
  // explicite de Vincent — une card par type de congé désormais, plus par
  // collaborateur) : `demandes` est déjà filtré sur ce type par l'appelant,
  // donc cette recherche scope naturellement le détail au bon type.
  const selection = demandes.find((d) => d.id === selectedId) ?? null;
  const lignesTransmissionSelection = selectedId ? (lignesParDemande[selectedId] ?? []) : [];

  return (
    // Card par type de congé (14/09/2026, demande explicite de Vincent —
    // "on sort le nom du collaborateur des cards... on crée des cards par
    // type de congés", après un premier essai en une seule card par
    // collaborateur). Le nom du type est sorti de la card et placé au-dessus
    // (14/09/2026, "on sort Congé Payé de la card") ; les pills restent
    // dans la card mais calées à gauche, alignées sur le tableau (même
    // conteneur flex-col, sans inset supplémentaire — même point de départ
    // horizontal que le tableau juste en-dessous).
    <div className="flex flex-col gap-2">
      <span className={`px-1 text-sm font-bold ${classeTexteTypeBadge(code)}`}>
        {LABEL_LONG[code]}
      </span>
      {/* Card — même charte que les autres cards de cet écran
          (`bg-surface-card` + `shadow-sm`, coins carrés). Grille interne
          (`xl:grid-cols-[1fr_16rem]`, même principe que "Suivre les demandes")
          TOUJOURS appliquée, même sans détail ouvert (14/09/2026, "la largeur
          du tableau est contrainte pour ne pas changer" — la 2e colonne reste
          réservée à 16rem que son contenu soit présent ou non, la 1ère
          (`1fr`, le tableau) garde donc une largeur constante plutôt que de
          s'élargir quand aucun détail n'est affiché). */}
      <div className="bg-surface-card p-4 shadow-sm">
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1fr_16rem] xl:gap-x-4">
          <div className="flex min-w-0 flex-col gap-2">
            {/* 2 pills mois précédent/mois en cours + flèche entre les deux,
                balance en +/-j (ou 0) à la suite (14/09/2026, demande
                explicite de Vincent) — même charte que la pill de dates de
                `HistoriqueTable` (rounded-full, bordure/texte couleur du
                type). Intitulés des mois sortis des pills (14/09/2026,
                "on sort les intitulés des mois en dehors des pills") : la
                pill ne porte plus que la valeur, le nom du mois est un
                libellé texte juste avant. */}
            <span className="inline-flex w-fit items-center gap-1.5">
              <span className="text-ink-500 text-xs font-bold whitespace-nowrap uppercase">
                {libelleMoisPrecedent}
              </span>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${classeBordureTypeBadge(code)} bg-surface-app text-ink-900`}
              >
                {formatJours(categorie.moisPrecedent)}j
              </span>
              <ArrowRight size={24} className={classeTexteTypeBadge(code)} />
              <span className="text-ink-500 text-xs font-bold whitespace-nowrap uppercase">
                {libelleMoisEnCours}
              </span>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${classeBordureTypeBadge(code)} bg-surface-app text-ink-900`}
              >
                {formatJours(categorie.moisEnCours)}j
              </span>
              <span className="ml-4 inline-flex items-center gap-1.5">
                <span className="text-ink-500 text-xs font-bold whitespace-nowrap uppercase">
                  Solde
                </span>
                <span
                  className={`text-xs font-bold whitespace-nowrap ${ecart === 0 ? "text-ink-500" : classeTexteTypeBadge(code)}`}
                >
                  {formatMouvement(ecart)}j
                </span>
              </span>
            </span>
            <div className="bg-surface-app overflow-hidden">
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

  return (
    // Plus de card englobante (14/09/2026, demande explicite de Vincent) —
    // le nom du collaborateur s'affiche directement sur le fond de page,
    // chaque type de congé (CP/RTT/CPA) a sa propre card en dessous (voir
    // `SectionType`).
    <div className="flex flex-col gap-3">
      <span className="text-ink-900 px-1 text-base font-semibold">
        {c.utilisateur.prenom} {c.utilisateur.nom}
      </span>
      <div className="flex flex-col gap-5">
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
            onCloseDetail={onCloseDetail}
          />
        ))}
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
      fetchComparaisonSoldes(periode, exportId, prisEnCompte),
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
  }, [periode, exportId, prisEnCompte]);

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
      // `prisEnCompte: true` en dur (14/09/2026) : `validerExportPaie` vient
      // de réussir juste au-dessus, l'export EST validé à cet instant, même
      // si la prop `prisEnCompte` (contrôlée par le parent) n'a pas encore
      // eu le temps de se rafraîchir — sinon `moisEnCours` ajoutait encore
      // le mouvement de cet export à un solde réel qui le contient déjà.
      const [comps, collabs] = await Promise.all([
        fetchComparaisonSoldes(periode, exportId, true),
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
