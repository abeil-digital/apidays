"use client";

import { useEffect, useState } from "react";
import type { DemandeEquipe } from "@/lib/types";
import { fetchCongesConsommesPeriode } from "@/lib/data/demandes.repository";

interface UseCongesConsommesResult {
  demandes: DemandeEquipe[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Congés validés (CP/RTT/CSS) sur une période — Espace Suivre > récap paie.
 * `refetch` permet de rafraîchir après une action locale (ex. valider/
 * dévalider une demande depuis "Export paie") sans dépendre d'un changement
 * de `debut`/`fin`. */
export function useCongesConsommes(debut: string, fin: string): UseCongesConsommesResult {
  const [demandes, setDemandes] = useState<DemandeEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchCongesConsommesPeriode(debut, fin)
      .then((data) => {
        if (!cancelled) {
          setDemandes(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les congés de la période.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debut, fin, version]);

  return { demandes, loading, error, refetch: () => setVersion((v) => v + 1) };
}
