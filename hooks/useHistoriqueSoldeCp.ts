"use client";

import { useCallback, useEffect, useState } from "react";
import type { AjustementSoldeInput, HistoriqueSolde } from "@/lib/types";
import { ajouterAjustementSolde, fetchHistoriqueCp } from "@/lib/data/soldes.repository";

interface UseHistoriqueSoldeCpResult {
  historique: HistoriqueSolde | null;
  loading: boolean;
  error: string | null;
  ajouterAjustement: (input: AjustementSoldeInput) => Promise<void>;
}

/** Feed d'historique du solde CP d'un salarié (popin Espace Suivre, montée à l'ouverture). */
export function useHistoriqueSoldeCp(utilisateurId: string): UseHistoriqueSoldeCpResult {
  const [historique, setHistorique] = useState<HistoriqueSolde | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchHistoriqueCp(utilisateurId)
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
  }, [utilisateurId]);

  const ajouterAjustement = useCallback(
    async (input: AjustementSoldeInput) => {
      await ajouterAjustementSolde(utilisateurId, input);
      const data = await fetchHistoriqueCp(utilisateurId);
      setHistorique(data);
    },
    [utilisateurId],
  );

  return { historique, loading, error, ajouterAjustement };
}
