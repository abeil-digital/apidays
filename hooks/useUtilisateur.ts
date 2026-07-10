"use client";

import { useEffect, useState } from "react";
import type { Utilisateur } from "@/lib/types";
import { fetchUtilisateurCourant } from "@/lib/data/utilisateur.repository";

interface UseUtilisateurResult {
  utilisateur: Utilisateur | null;
  loading: boolean;
  error: string | null;
}

/**
 * Point d'accès unique à l'utilisateur courant.
 * Aujourd'hui : un seul compte mocké. Demain : session issue de l'auth réelle.
 */
export function useUtilisateur(): UseUtilisateurResult {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchUtilisateurCourant()
      .then((data) => {
        if (!cancelled) {
          setUtilisateur(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger l'utilisateur.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { utilisateur, loading, error };
}
