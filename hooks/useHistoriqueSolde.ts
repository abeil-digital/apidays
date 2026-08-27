"use client";

import { useEffect, useState } from "react";
import type { HistoriqueSolde } from "@/lib/types";
import {
  fetchHistoriqueCp,
  fetchHistoriqueCpa,
  fetchHistoriqueRtt,
} from "@/lib/data/soldes.repository";

interface UseHistoriqueSoldeResult {
  historique: HistoriqueSolde | null;
  loading: boolean;
  error: string | null;
  /** Force un rechargement (27/08/2026, "Ajuster le solde" — `SoldeDetailPanel`)
   * sans remonter le composant : incrémente une clé interne dont dépend
   * l'effet de fetch. */
  refetch: () => void;
}

/**
 * Feed d'historique de solde générique (popin "Suivre les soldes") — CP, RTT
 * ou CPA selon `code`. Distinct de `useHistoriqueSoldeCp` (qui expose en plus
 * `ajouterAjustement`, réservé à la popin de régulation admin) : ce hook-ci
 * est lecture seule, utilisé par `SoldeDetailPanel` pour les deux types.
 *
 * `loading` ne se réinitialise qu'au montage (pas de `setLoading(true)` dans
 * l'effet, interdit par la règle de lint `set-state-in-effect`) : si
 * `utilisateurId`/`code` changent sur une instance déjà montée, l'appelant
 * doit forcer un remontage (`key`) pour éviter d'afficher brièvement
 * l'ancien solde sous le nouveau libellé — voir `SoldeDetailPanel` / son
 * usage dans `SuivreSoldesPage`.
 */
export function useHistoriqueSolde(
  utilisateurId: string,
  code: "CP" | "RTT" | "CPA",
): UseHistoriqueSoldeResult {
  const [historique, setHistorique] = useState<HistoriqueSolde | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetcher =
      code === "CP" ? fetchHistoriqueCp : code === "RTT" ? fetchHistoriqueRtt : fetchHistoriqueCpa;

    fetcher(utilisateurId)
      .then((data) => {
        if (!cancelled) {
          setHistorique(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger l'historique du solde.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [utilisateurId, code, refreshKey]);

  return { historique, loading, error, refetch: () => setRefreshKey((k) => k + 1) };
}
