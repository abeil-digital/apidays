"use client";

import { useCallback, useEffect, useState } from "react";
import type { UtilisateurAdmin, UtilisateurAdminInput } from "@/lib/types";
import {
  archiverUtilisateurAdmin,
  creerUtilisateurAdmin,
  fetchUtilisateurAdmin,
  modifierUtilisateurAdmin,
} from "@/lib/data/utilisateurs.repository";

interface UseUtilisateurAdminResult {
  utilisateur: UtilisateurAdmin | null;
  loading: boolean;
  error: string | null;
  creer: (input: UtilisateurAdminInput) => Promise<UtilisateurAdmin>;
  modifier: (input: UtilisateurAdminInput) => Promise<UtilisateurAdmin>;
  archiver: () => Promise<void>;
}

/**
 * Fiche d'un utilisateur (écran Paramétrer > Gestion des utilisateurs).
 * Sans `id` : mode création, rien à charger, seul `creer` a du sens.
 */
export function useUtilisateurAdmin(id?: string): UseUtilisateurAdminResult {
  const [utilisateur, setUtilisateur] = useState<UtilisateurAdmin | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    fetchUtilisateurAdmin(id)
      .then((data) => {
        if (!cancelled) {
          setUtilisateur(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger ce profil.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const creer = useCallback((input: UtilisateurAdminInput) => creerUtilisateurAdmin(input), []);

  const modifier = useCallback(
    async (input: UtilisateurAdminInput) => {
      if (!id) throw new Error("Identifiant manquant.");
      const data = await modifierUtilisateurAdmin(id, input);
      setUtilisateur(data);
      return data;
    },
    [id],
  );

  const archiver = useCallback(async () => {
    if (!id) throw new Error("Identifiant manquant.");
    await archiverUtilisateurAdmin(id);
    setUtilisateur((prev) =>
      prev
        ? { ...prev, statut: "archive", dateArchivage: new Date().toISOString().slice(0, 10) }
        : prev,
    );
  }, [id]);

  return { utilisateur, loading, error, creer, modifier, archiver };
}
