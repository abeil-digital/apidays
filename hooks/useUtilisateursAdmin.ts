"use client";

import { useEffect, useState } from "react";
import type { UtilisateurAdmin } from "@/lib/types";
import { fetchUtilisateursAdmin } from "@/lib/data/utilisateurs.repository";

interface UseUtilisateursAdminResult {
  utilisateurs: UtilisateurAdmin[];
  loading: boolean;
  error: string | null;
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

  return { utilisateurs, loading, error };
}
