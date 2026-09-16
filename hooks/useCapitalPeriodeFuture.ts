"use client";

import { useEffect, useState } from "react";
import { fetchCapitalPeriodeFuture } from "@/lib/data/soldes.repository";

interface UseCapitalPeriodeFutureResult {
  capital: number | null;
  loading: boolean;
}

/**
 * Capital projeté d'une période CP future à une date donnée — "Parcours B"
 * (16/09/2026, voir `fetchCapitalPeriodeFuture`). Même gabarit que
 * `useSoldeAnticipe` (clé dérivée, pas de `setState` synchrone dans l'effet)
 * mais hook séparé plutôt que type supplémentaire sur celui-ci : le
 * Parcours A (`useSoldeAnticipe`) ne doit prendre aucun risque de régression.
 * `null` en paramètre (date pas encore choisie, ou date dans la période en
 * cours) désactive le hook.
 */
export function useCapitalPeriodeFuture(dateReference: string | null): UseCapitalPeriodeFutureResult {
  const actif = Boolean(dateReference);
  const [capital, setCapital] = useState<number | null>(null);
  const [cleResolue, setCleResolue] = useState<string | null>(null);

  useEffect(() => {
    if (!dateReference) return;

    let cancelled = false;
    const cleCourante = dateReference;

    fetchCapitalPeriodeFuture(dateReference)
      .then((data) => {
        if (cancelled) return;
        setCapital(data);
        setCleResolue(cleCourante);
      })
      .catch(() => {
        if (cancelled) return;
        setCapital(null);
        setCleResolue(cleCourante);
      });

    return () => {
      cancelled = true;
    };
  }, [dateReference]);

  return { capital: actif ? capital : null, loading: actif && cleResolue !== dateReference };
}
