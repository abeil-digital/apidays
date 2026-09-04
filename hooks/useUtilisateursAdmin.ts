"use client";

import { useCallback, useEffect, useState } from "react";
import type { UtilisateurAdmin } from "@/lib/types";
import { fetchUtilisateursAdmin } from "@/lib/data/utilisateurs.repository";

interface UseUtilisateursAdminResult {
  utilisateurs: UtilisateurAdmin[];
  loading: boolean;
  error: string | null;
  /** Recharge la liste (04/09/2026, popin "Créer un profil" sur la page
   * Utilisateurs) — après création via la popin, pas de navigation qui
   * remonterait naturellement cette page, il faut redemander la liste
   * explicitement pour que le nouveau profil apparaisse. */
  recharger: () => Promise<void>;
}

/**
 * Liste des utilisateurs pour l'écran Paramétrer > Gestion des utilisateurs.
 * La RLS restreint déjà le contenu selon le rôle du compte connecté (admin
 * et manager — directeur, autorité globale — voient tout le monde, salarié
 * ne voit que lui-même).
 */
export function useUtilisateursAdmin(): UseUtilisateursAdminResult {
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    try {
      const data = await fetchUtilisateursAdmin();
      setUtilisateurs(data);
      setError(null);
    } catch {
      setError("Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchUtilisateursAdmin()
      .then((data) => {
        if (!cancelled) {
          setUtilisateurs(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les utilisateurs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { utilisateurs, loading, error, recharger };
}
