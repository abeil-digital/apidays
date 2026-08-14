"use client";

import { useState } from "react";
import { formatJours } from "@/lib/format";
import { useHistoriqueSoldeCp } from "@/hooks/useHistoriqueSoldeCp";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SoldeMoisBloc } from "@/components/ui/SoldeMoisBloc";
import { Textarea } from "@/components/ui/Textarea";
import { TypeBadge, TypeBadgePillEnhanced } from "@/components/demandes/TypeBadge";

function nomMois(cle: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date(`${cle}-01T00:00:00`));
}

interface HistoriqueSoldeModalProps {
  utilisateurId: string;
  nomComplet: string;
  peutReguler: boolean;
  onClose: () => void;
}

export function HistoriqueSoldeModal({
  utilisateurId,
  nomComplet,
  peutReguler,
  onClose,
}: HistoriqueSoldeModalProps) {
  const { historique, loading, error, ajouterAjustement } = useHistoriqueSoldeCp(utilisateurId);

  const [delta, setDelta] = useState("");
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreurForm, setErreurForm] = useState("");
  const [moisOuverts, setMoisOuverts] = useState<Set<string>>(new Set());

  function toggleMois(cle: string) {
    setMoisOuverts((prev) => {
      const next = new Set(prev);
      if (next.has(cle)) {
        next.delete(cle);
      } else {
        next.add(cle);
      }
      return next;
    });
  }

  async function handleReguler() {
    const deltaJours = Number(delta.replace(",", "."));
    if (!delta || Number.isNaN(deltaJours) || deltaJours === 0) {
      setErreurForm("Indique un nombre de jours (positif ou négatif).");
      return;
    }
    if (!motif.trim()) {
      setErreurForm("Le motif est obligatoire.");
      return;
    }
    setErreurForm("");
    setEnCours(true);
    try {
      await ajouterAjustement({ deltaJours, motif: motif.trim() });
      setDelta("");
      setMotif("");
    } catch {
      setErreurForm("Impossible d'enregistrer l'ajustement.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modal title={`Historique CP — ${nomComplet}`} onClose={onClose} className="max-w-lg">
      {loading || !historique ? (
        <div className="text-ink-500 py-8 text-center text-sm">Chargement…</div>
      ) : error ? (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-surface-app text-cp rounded-full px-2.5 py-0.5 text-xs font-semibold">
                Solde N-1
              </span>
              <span className="text-ink-500 text-xs">Pas d&rsquo;événement</span>
            </div>
            <div className="flex items-center justify-between pl-2.5 text-sm">
              <span className="text-ink-500">
                {`Acquis en ${Number(historique.periodeDebut.slice(0, 4)) - 1}-${historique.periodeDebut.slice(0, 4)}`}
              </span>
              <TypeBadge
                code="CP"
                variant="pill"
                label={`${formatJours(historique.soldeDepart)} j`}
              />
            </div>
          </div>
          <hr className="border-ink-300 -mt-2" />

          <div className="flex flex-col gap-4">
            {historique.mois.map((bloc, i) => (
              <div key={bloc.mois} className="flex flex-col gap-2">
                {i > 0 && <hr className="border-ink-500/20 -mt-2 mb-2" />}
                <SoldeMoisBloc
                  code="CP"
                  libelleMois={nomMois(bloc.mois)}
                  mouvements={bloc.mouvements}
                  soldeLibelle={`Solde paie ${nomMois(bloc.mois)}`}
                  soldeValeur={bloc.soldeFinMois}
                  ouvert={moisOuverts.has(bloc.mois)}
                  onToggle={() => toggleMois(bloc.mois)}
                />
              </div>
            ))}
          </div>

          <hr className="border-ink-300" />
          <div className="flex items-center justify-between">
            <span className="text-ink-900 font-semibold">Solde actuel</span>
            <TypeBadgePillEnhanced code="CP" label={`${formatJours(historique.soldeActuel)} j`} />
          </div>

          {peutReguler && (
            <div className="border-ink-300/60 flex flex-col gap-3 border-t pt-4">
              <h3 className="text-ink-900 text-sm font-bold">Réguler le solde</h3>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.5"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="Ex. -2 ou +1,5"
                  className="w-32"
                />
                <Textarea
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={1}
                  placeholder="Motif de la régulation…"
                  className="flex-1"
                />
              </div>
              {erreurForm && <p className="text-status-danger-fg text-xs">{erreurForm}</p>}
              <Button
                variant="secondary"
                disabled={enCours}
                onClick={handleReguler}
                className="w-fit self-end rounded-full px-4 py-2"
              >
                Enregistrer
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
