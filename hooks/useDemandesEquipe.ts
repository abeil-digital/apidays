"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemandeEquipe } from "@/lib/types";
import {
  fetchDemandesEquipe,
  refuserDemande,
  validerDemande,
} from "@/lib/data/demandes.repository";

interface UseDemandesEquipeResult {
  demandes: DemandeEquipe[];
  loading: boolean;
  error: string | null;
  valider: (id: string, commentaire?: string) => Promise<void>;
  refuser: (id: string, commentaire?: string) => Promise<void>;
}

/**
 * Demandes de l'équipe pour l'Espace Suivre (manager) — approuver/refuser
 * met à jour l'état local optimiste après succès de l'appel, plutôt que de
 * tout re-fetcher (la liste peut être longue).
 */
export function useDemandesEquipe(): UseDemandesEquipeResult {
  const [demandes, setDemandes] = useState<DemandeEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchDemandesEquipe()
      .then((data) => {
        if (!cancelled) {
          setDemandes(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les demandes de l'équipe.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const valider = useCallback(async (id: string, commentaire = "") => {
    await validerDemande(id, commentaire);
    setDemandes((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, statut: "validé", commentaireManager: commentaire } : d,
      ),
    );
  }, []);

  const refuser = useCallback(async (id: string, commentaire = "") => {
    await refuserDemande(id, commentaire);
    setDemandes((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, statut: "refusé", commentaireManager: commentaire } : d,
      ),
    );
  }, []);

  return { demandes, loading, error, valider, refuser };
}
