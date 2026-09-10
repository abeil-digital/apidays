"use client";

import { useState } from "react";
import { dateSimuleeActive, getDateSimuleeIso, setDateSimulee } from "@/lib/aujourdhui";

/**
 * Bandeau de test (10/09/2026) — au-dessus de la nav (`AppShell.tsx`),
 * uniquement en local (`dateSimuleeActive()`, jamais en prod). Permet de
 * régler une date simulée pour tester l'évolution des soldes/le
 * comportement du Calendrier à une date donnée, sans bidouiller l'horloge
 * de la machine — voir `lib/aujourdhui.ts`.
 */
export function DateOverrideBanner() {
  const [valeur, setValeur] = useState(() => getDateSimuleeIso() ?? "");

  if (!dateSimuleeActive()) return null;

  const simulee = getDateSimuleeIso();

  return (
    <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2 bg-amber-200 px-3 py-1.5 text-xs text-amber-900">
      <span className="font-semibold">🧪 Date simulée (local uniquement)</span>
      <input
        type="date"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        className="rounded border border-amber-400 bg-white px-1.5 py-0.5 text-amber-900"
      />
      <button
        type="button"
        onClick={() => setDateSimulee(valeur || null)}
        disabled={!valeur}
        className="rounded bg-amber-900 px-2 py-0.5 font-semibold text-amber-50 disabled:opacity-40"
      >
        Appliquer
      </button>
      {simulee && (
        <button
          type="button"
          onClick={() => setDateSimulee(null)}
          className="rounded border border-amber-900/40 px-2 py-0.5 font-semibold underline"
        >
          Revenir à aujourd&apos;hui ({simulee})
        </button>
      )}
    </div>
  );
}
