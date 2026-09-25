"use client";

import { useEffect, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { ListCard } from "@/components/ui/ListCard";
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
            onClick={() => {
              if (
                window.confirm(
                  "Générer une nouvelle adresse ? L'ancienne cessera immédiatement de fonctionner : les calendriers déjà abonnés devront être mis à jour.",
                )
              ) {
                executer(regenererFluxCalendrier);
              }
            }}
            className="text-ink-500 hover:text-ink-900 flex w-fit items-center gap-1.5 text-xs font-semibold underline decoration-dotted underline-offset-2 disabled:opacity-50"
          >
            <RefreshCw size={13} />
            Générer une nouvelle adresse
          </button>
        </div>
      )}

      {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}
    </ListCard>
  );
}
