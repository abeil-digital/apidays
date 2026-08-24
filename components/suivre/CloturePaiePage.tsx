"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Send, UserPlus } from "lucide-react";
import { useCongesATransmettre } from "@/hooks/useCongesATransmettre";
import type { CongeATransmettre } from "@/lib/types";
import {
  refuserDemande,
  regulariserDemande,
  remettreEnAttenteDemande,
  validerDemande,
} from "@/lib/data/demandes.repository";
import { fetchExportPaie, genererExportPaie } from "@/lib/data/exportsPaie.repository";
import { formatJours } from "@/lib/format";
import { InputFiltrePill } from "@/components/ui/FiltrePill";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { HistoriqueTable } from "@/components/historique/HistoriqueTable";
import { CongesPaiePage } from "@/components/suivre/CongesPaiePage";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";
import { PoserCongePourCollaborateurModal } from "@/components/suivre/PoserCongePourCollaborateurModal";
import { VerifierFichesPaiePage } from "@/components/suivre/VerifierFichesPaiePage";

type Onglet = "transmettre" | "export" | "verifier";

// "X/Y j" quand une partie a déjà été transmise lors d'un export précédent
// (congé à cheval sur deux périodes de paie), sinon juste "Y j" — notation
// de Vincent (24/08/2026). Une correction (demande annulée après avoir été
// transmise) affiche le solde déjà transmis à corriger.
function renderDureeATransmettre(demande: CongeATransmettre) {
  if (demande.statut === "annulé") {
    return `-${formatJours(demande.joursDejaTransmis)} j (correction)`;
  }
  const total = demande.nbDemiJournees / 2;
  return demande.joursDejaTransmis > 0
    ? `${formatJours(demande.joursDejaTransmis)}/${formatJours(total)} j`
    : `${formatJours(total)} j`;
}

/**
 * Onglet "Quels congés transmettre" (renommé depuis "Récap congé",
 * 24/08/2026) — branché sur `fetchCongesATransmettre` (validés non
 * totalement transmis + annulés à corriger + en attente chevauchant la
 * période), pas `useCongesConsommes` : plus de filtre de date sur les
 * validés/annulés, un congé jamais transmis remonte quel que soit son mois
 * d'origine (bug "congés de période précédente"/"à cheval" corrigé par la
 * notion de solde de transmission, voir BASE-DE-DONNEES.md). Les lignes
 * donnent accès au détail complet (`DetailCongePanel`, actions Valider/
 * Refuser/Régulariser) — largeur du tableau verrouillée via CSS Grid.
 */
function QuelsCongesTransmettre({ periode }: { periode: { debut: string; fin: string } }) {
  const [debut, setDebut] = useState(periode.debut);
  const [fin, setFin] = useState(periode.fin);
  const { demandes, loading, error, refetch } = useCongesATransmettre(debut, fin);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);
  const [modalOuverte, setModalOuverte] = useState(false);

  const selection = demandes.find((d) => d.id === selectionId) ?? null;

  async function valider(commentaire: string) {
    if (!selection) return;
    await validerDemande(selection.id, commentaire);
    refetch();
  }

  async function refuser(commentaire: string) {
    if (!selection) return;
    await refuserDemande(selection.id, commentaire);
    refetch();
  }

  async function regulariser(commentaire: string) {
    if (!selection) return;
    await regulariserDemande(selection.id, commentaire);
    refetch();
  }

  async function annulerValidation(id: string) {
    await remettreEnAttenteDemande(id);
    refetch();
  }

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,900px)_16rem] xl:gap-x-2.5">
      <div className="bg-surface-card w-full min-w-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <InputFiltrePill
              type="date"
              aria-label="Du"
              value={debut}
              onChange={(e) => setDebut(e.target.value)}
            />
            <InputFiltrePill
              type="date"
              aria-label="Au"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => setModalOuverte(true)}
            className="rounded-full px-4 py-2 text-sm"
          >
            <UserPlus size={16} />
            Poser pour un collaborateur
          </Button>
        </div>

        {error && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 mb-3 px-3 py-2.5 text-sm">
            {error}
          </div>
        )}

        <div className="border-ink-300/60 border-t">
          {loading ? (
            <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
          ) : (
            <HistoriqueTable
              demandes={demandes}
              avecCollaborateur
              compact
              onDateClick={setSelectionId}
              selectedId={selectionId}
              renderDuree={(d) => renderDureeATransmettre(d as CongeATransmettre)}
              emptyText="Rien à transmettre sur cette période."
            />
          )}
        </div>
      </div>

      {selection && (
        <DetailCongePanel
          key={selection.id}
          selection={selection}
          onClose={() => setSelectionId(null)}
          onValider={valider}
          onRefuser={refuser}
          onRegulariser={regulariser}
          onValiderSucces={(id, message) => setToast({ id, message })}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          actionLabel="Annuler"
          onAction={() => {
            annulerValidation(toast.id);
            setToast(null);
          }}
          onClose={() => setToast(null)}
        />
      )}

      {modalOuverte && (
        <PoserCongePourCollaborateurModal
          onClose={() => setModalOuverte(false)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}

/**
 * Onglet "Générer l'export" — l'export CSV existant (`CongesPaiePage`)
 * complété par l'action réelle "Transmettre" (`genererExportPaie`), qui crée
 * les lignes `export_paie_lignes` correspondantes. Les deux coexistent : le
 * CSV documente ce qui vient d'être transmis, "Transmettre" met à jour le
 * statut interne — décision provisoire, à confirmer avec Vincent (voir plan).
 * Le bouton se désactive une fois la période déjà transmise (contrainte
 * unique `exports_paie_periode_unique` côté base).
 */
function GenererExport({
  periode,
  exportPaie,
  onTransmis,
}: {
  periode: { debut: string; fin: string };
  exportPaie: { id: string; genereLe: string } | null;
  onTransmis: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function transmettre() {
    setEnCours(true);
    setErreur(null);
    try {
      await genererExportPaie(periode);
      onTransmis();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de transmettre cette période.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-sm">
        <div className="text-sm">
          {exportPaie ? (
            <span className="text-status-success-fg font-semibold">
              Période transmise le {new Date(exportPaie.genereLe).toLocaleDateString("fr-FR")}
            </span>
          ) : (
            <span className="text-ink-500">Pas encore transmise.</span>
          )}
        </div>
        <Button
          onClick={transmettre}
          disabled={enCours || Boolean(exportPaie)}
          className="rounded-full px-4 py-2 text-sm"
        >
          <Send size={16} />
          Transmettre
        </Button>
      </div>
      {erreur && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {erreur}
        </div>
      )}
      <CongesPaiePage masquerTitre periodeInitiale={periode} />
    </div>
  );
}

/**
 * "Clôture paie" (`/suivre/cloture-paie/[debut]`, 24/08/2026, restructuré en
 * 3 onglets le même jour) — nouvelle section Suivre, coexiste avec "Export
 * paie" (`/suivre/paie`) sans le remplacer. Toujours ouverte sur une période
 * précise (`periode`, choisie sur la page liste `/suivre/cloture-paie`).
 * - **Quels congés transmettre** : revue avant transmission.
 * - **Générer l'export** : export CSV + action "Transmettre".
 * - **Vérifier les fiches de paie** : check du retour comptable, désactivé
 *   tant qu'aucun export n'existe pour cette période.
 */
export function CloturePaiePage({
  periode,
  titre,
}: {
  periode: { debut: string; fin: string };
  titre: string;
}) {
  const [onglet, setOnglet] = useState<Onglet>("transmettre");
  const [exportPaie, setExportPaie] = useState<{ id: string; genereLe: string } | null>(null);
  const [chargementExport, setChargementExport] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchExportPaie(periode)
      .then((data) => {
        if (!cancelled) setExportPaie(data);
      })
      .finally(() => {
        if (!cancelled) setChargementExport(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periode]);

  function rafraichirExport() {
    fetchExportPaie(periode).then(setExportPaie);
  }

  const onglets: { id: Onglet; label: string }[] = [
    { id: "transmettre", label: "Quels congés transmettre" },
    { id: "export", label: "Générer l'export" },
    { id: "verifier", label: "Vérifier les fiches de paie" },
  ];

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0">
      <Link
        href="/suivre/cloture-paie"
        className="text-ink-500 hover:text-ink-900 flex w-fit items-center gap-1 px-1 text-sm font-semibold"
      >
        <ChevronLeft size={16} />
        Clôture paie
      </Link>

      <h1 className="text-ink-900 px-1 text-2xl font-semibold">{titre}</h1>

      <div className="flex flex-wrap items-center gap-2 px-1">
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOnglet(o.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              onglet === o.id
                ? "bg-mint/90 hover:bg-mint-hover text-white"
                : "border-mint text-mint hover:bg-mint-tint border bg-transparent"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "transmettre" && <QuelsCongesTransmettre periode={periode} />}
      {onglet === "export" && !chargementExport && (
        <GenererExport periode={periode} exportPaie={exportPaie} onTransmis={rafraichirExport} />
      )}
      {onglet === "verifier" && !chargementExport && (
        <VerifierFichesPaiePage exportId={exportPaie?.id ?? null} />
      )}
    </div>
  );
}
