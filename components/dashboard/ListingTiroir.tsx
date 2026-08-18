"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Demande } from "@/lib/types";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";

// Date de la dernière action sur une demande — Validé/Refusé (`dateDecision`)
// si décidée, sinon Posé (`datePose`, une demande "en attente" n'a eu que
// cette seule action pour l'instant).
function derniereAction(demande: Demande): string {
  return demande.dateDecision ?? demande.datePose;
}

/**
 * Tiroir "Listing" (18/08/2026) — pill grise après "Journal" sur Accueil.
 * Liste les demandes triées par date de dernière action (Posé/Validé/Refusé)
 * décroissante, avec le gabarit complet `DetailCongePanel` tel quel (bandeau
 * coloré conservé, contrairement au tiroir "En validation") mais sans la
 * croix de fermeture individuelle (`masquerFermer` — pas de fermeture prévue
 * pour l'instant sur ce tiroir non plus, juste le gabarit empilé tel quel).
 * Largeur du tiroir = celle de la colonne droite de "Suivre les demandes"
 * (`w-64`, la largeur normale de `DetailCongePanel` sur grand écran), élargie
 * de 15% (`294px`) à la demande de Vincent le 18/08/2026 — plutôt que
 * `max-w-sm` comme "Journal"/"En validation". En-tête ("Listing" + croix de
 * fermeture) repris tel quel du tiroir "Journal" (`ActiviteRecenteFeed`).
 */
export function ListingTiroir({
  demandes,
  tiroirOuvert,
  onFermerTiroir,
}: {
  demandes: Demande[];
  tiroirOuvert: boolean;
  onFermerTiroir: () => void;
}) {
  useEffect(() => {
    if (!tiroirOuvert) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onFermerTiroir();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tiroirOuvert, onFermerTiroir]);

  if (!tiroirOuvert) return null;

  const triees = [...demandes].sort((a, b) => derniereAction(b).localeCompare(derniereAction(a)));

  return (
    <div className="bg-ink-900/50 fixed inset-0 z-50 flex justify-end" onClick={onFermerTiroir}>
      <div
        className="bg-surface-card animate-drawer-in-right flex h-full w-[294px] flex-col shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-ink-300/60 flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="text-ink-900 text-base font-bold">Mes demandes</h2>
          <button
            type="button"
            onClick={onFermerTiroir}
            aria-label="Fermer"
            className="text-ink-500 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-surface-app flex-1 overflow-y-auto">
          {triees.length === 0 ? (
            <EmptyRow text="Aucune demande." />
          ) : (
            <div className="flex flex-col gap-3 p-3">
              {triees.map((demande) => (
                <DetailCongePanel
                  key={demande.id}
                  selection={demande}
                  onClose={onFermerTiroir}
                  masquerFermer
                  masquerTypeBadgeBandeau
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
