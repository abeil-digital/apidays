"use client";

import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ListCard } from "@/components/ui/ListCard";
import { Modal } from "@/components/ui/Modal";
import {
  activerFluxCalendrier,
  desactiverFluxCalendrier,
  fetchFluxCalendrier,
  regenererFluxCalendrier,
  type FluxCalendrier,
} from "@/lib/data/fluxCalendrier.repository";

/**
 * Flux calendrier des absences (25/09/2026) — adresse ICS à coller dans
 * Proton/Google/Outlook ("S'abonner à un calendrier par URL"). Actions
 * immédiates (pas de bouton "Enregistrer" commun avec le reste de la page).
 */
export function FluxCalendrierCard() {
  const [flux, setFlux] = useState<FluxCalendrier | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [copie, setCopie] = useState(false);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    fetchFluxCalendrier()
      .then(setFlux)
      .catch(() => setErreur("Impossible de charger les réglages du flux calendrier."));
  }, []);

  async function executer(action: (courant: FluxCalendrier) => Promise<FluxCalendrier>) {
    if (!flux) return;
    setErreur("");
    setEnCours(true);
    try {
      setFlux(await action(flux));
    } catch {
      setErreur("L'opération a échoué, réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  async function copier(adresse: string) {
    try {
      await navigator.clipboard.writeText(adresse);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setErreur("Copie impossible : sélectionnez l'adresse et copiez-la manuellement.");
    }
  }

  const adresse =
    flux?.actif && flux.token
      ? `${window.location.origin}/api/flux-calendrier/${flux.token}.ics`
      : null;

  return (
    <ListCard className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-ink-900 mb-2 text-sm font-bold">Flux calendrier des absences</p>
        <p className="text-ink-500 text-xs">
          Affiche les absences validées et en attente de toute l&apos;équipe dans un calendrier
          externe (Proton, Google, Outlook…) via une adresse d&apos;abonnement. Le calendrier
          externe se met à jour de lui-même, mais pas instantanément (comptez quelques heures).
        </p>
      </div>

      <div className="bg-mint-tint flex items-center justify-between rounded-xl px-3 py-2">
        <span className="text-ink-900 text-xs font-semibold">Activer le flux</span>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(flux?.actif)}
          aria-label="Activer le flux calendrier"
          disabled={!flux || enCours}
          onClick={() => executer(flux?.actif ? desactiverFluxCalendrier : activerFluxCalendrier)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50 ${
            flux?.actif ? "bg-mint" : "bg-ink-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] duration-150 ${
              flux?.actif ? "left-4" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {adresse && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={adresse}
              aria-label="Adresse d'abonnement"
              onFocus={(e) => e.currentTarget.select()}
              className="text-ink-900 border-ink-300 rounded-control min-w-0 flex-1 border bg-white px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => copier(adresse)}
              className="text-ink-900 border-ink-300 hover:bg-surface-app flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
            >
              {copie ? <Check size={14} /> : <Copy size={14} />}
              {copie ? "Copié" : "Copier"}
            </button>
          </div>
          <p className="text-ink-500 text-xs">
            Cette adresse donne accès aux absences de toute l&apos;équipe : ne la partagez
            qu&apos;avec les personnes concernées.
          </p>
          <button
            type="button"
            disabled={enCours}
            onClick={() => setConfirmationOuverte(true)}
            className="text-ink-500 hover:text-ink-900 flex w-fit items-center gap-1.5 text-xs font-semibold underline decoration-dotted underline-offset-2 disabled:opacity-50"
          >
            <RefreshCw size={13} />
            Réinitialiser le flux
          </button>
        </div>
      )}

      {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}

      {confirmationOuverte && (
        <Modal
          onClose={() => setConfirmationOuverte(false)}
          header={
            <div className="bg-status-danger-bg flex items-center justify-between px-6 py-4">
              <h2 className="text-status-danger-fg text-lg font-semibold">
                Réinitialiser le flux du calendrier
              </h2>
              <button
                type="button"
                onClick={() => setConfirmationOuverte(false)}
                aria-label="Fermer"
                className="text-status-danger-fg/70 hover:text-status-danger-fg shrink-0"
              >
                <X size={18} />
              </button>
            </div>
          }
        >
          <div className="text-ink-900 flex flex-col gap-3 text-sm">
            <p className="font-bold">Le flux actuel cessera de fonctionner.</p>
            <p>
              Tous les calendriers qui y sont abonnés n&apos;afficheront plus les absences tant que
              la nouvelle adresse n&apos;aura pas été renseignée dans chacun d&apos;eux.
            </p>
            <p>
              À utiliser si l&apos;adresse a été partagée par erreur ou si quelqu&apos;un qui y
              avait accès ne doit plus voir les absences de l&apos;équipe.
            </p>
            <p className="font-bold">
              Cette action est irréversible : l&apos;ancienne adresse ne pourra pas être rétablie.
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmationOuverte(false)}
                className="rounded-card px-6 py-3"
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={enCours}
                onClick={async () => {
                  await executer(regenererFluxCalendrier);
                  setConfirmationOuverte(false);
                }}
                className="rounded-card !bg-status-danger-bg !text-status-danger-fg !border-transparent px-6 py-3 enabled:hover:opacity-90"
              >
                Réinitialiser le flux
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ListCard>
  );
}
