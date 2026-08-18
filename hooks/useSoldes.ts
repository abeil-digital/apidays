"use client";

import { useEffect, useState } from "react";
import type { Soldes } from "@/lib/types";
import { fetchSoldes } from "@/lib/data/soldes.repository";

interface UseSoldesResult {
  soldes: Soldes | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Point d'accès unique au solde de congés/RTT. Sans argument : l'utilisateur
 * connecté (Accueil). Avec un `utilisateurId` : le solde d'un salarié donné
 * (Espace Suivre, manager/admin uniquement — la RLS sous-jacente l'autorise).
 *
 * `refetch` (18/08/2026) : pour rafraîchir juste après une action locale (ex.
 * une demande RTT/CPA posée depuis "Poser un jour" en popin sur Accueil, qui
 * consomme immédiatement du solde) sans dépendre du refresh automatique au
 * retour d'onglet (`useDemandes`) — l'onglet ne change pas ici, l'action a
 * lieu sur la même page.
 */
export function useSoldes(utilisateurId?: string): UseSoldesResult {
  const [soldes, setSoldes] = useState<Soldes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchSoldes(utilisateurId)
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
  }, [utilisateurId, version]);

  return { soldes, loading, error, refetch: () => setVersion((v) => v + 1) };
}
