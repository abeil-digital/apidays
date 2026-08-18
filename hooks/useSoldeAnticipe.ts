"use client";

import { useEffect, useState } from "react";
import { fetchSoldeAnticipe } from "@/lib/data/soldes.repository";

interface UseSoldeAnticipeResult {
  solde: number | null;
  loading: boolean;
}

/**
 * Solde RTT/CPA anticipé à une date donnée (typiquement la date de début
 * d'une demande en cours de saisie) — voir `fetchSoldeAnticipe`. `null` en
 * paramètre (type non concerné, ou date pas encore choisie) désactive le
 * hook plutôt que de fetcher inutilement.
 *
 * `loading` est dérivé (pas un état à part) en comparant la clé type+date
 * actuelle à la dernière clé résolue — évite tout appel `setState`
 * synchrone dans le corps de l'effet (interdit par la règle de lint
 * `react-hooks/set-state-in-effect`), seuls les callbacks `.then`/`.catch`
 * en appellent.
 */
export function useSoldeAnticipe(
  type: "RTT" | "CPA" | null,
  dateReference: string | null,
): UseSoldeAnticipeResult {
  const actif = Boolean(type && dateReference);
  const cle = actif ? `${type}-${dateReference}` : null;
  const [solde, setSolde] = useState<number | null>(null);
  const [cleResolue, setCleResolue] = useState<string | null>(null);

  useEffect(() => {
    if (!type || !dateReference) return;

    let cancelled = false;
    const cleCourante = `${type}-${dateReference}`;

    fetchSoldeAnticipe(type, dateReference)
      .then((data) => {
        if (cancelled) return;
        setSolde(data);
        setCleResolue(cleCourante);
      })
      .catch(() => {
        if (cancelled) return;
        setSolde(null);
        setCleResolue(cleCourante);
      });

    return () => {
      cancelled = true;
    };
  }, [type, dateReference]);

  return { solde: actif ? solde : null, loading: actif && cleResolue !== cle };
}
