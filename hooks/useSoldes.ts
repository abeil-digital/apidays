"use client";

import { useEffect, useState } from "react";
import type { Soldes } from "@/lib/types";
import { fetchSoldes } from "@/lib/data/soldes.repository";

interface UseSoldesResult {
  soldes: Soldes | null;
  loading: boolean;
  error: string | null;
}

/**
 * Point d'accès unique au solde de congés/RTT de l'utilisateur courant.
 */
export function useSoldes(): UseSoldesResult {
  const [soldes, setSoldes] = useState<Soldes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchSoldes()
      .then((data) => {
        if (!cancelled) {
          setSoldes(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger le solde.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { soldes, loading, error };
}
