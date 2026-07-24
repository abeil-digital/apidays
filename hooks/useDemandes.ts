"use client";

import { useCallback, useEffect, useState } from "react";
import type { Demande, NouvelleDemandeInput } from "@/lib/types";
import { creerDemande, fetchDemandes } from "@/lib/data/demandes.repository";

interface UseDemandesResult {
  demandes: Demande[];
  loading: boolean;
  error: string | null;
  ajouterDemande: (input: NouvelleDemandeInput) => Promise<Demande>;
}

/**
 * Point d'accès unique aux demandes de congés/RTT pour l'UI.
 * Aucun composant ne doit importer `lib/data/demandes.repository` directement.
 */
export function useDemandes(): UseDemandesResult {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchDemandes()
      .then((data) => {
        if (!cancelled) {
          setDemandes(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les demandes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const ajouterDemande = useCallback(async (input: NouvelleDemandeInput) => {
    const demande = await creerDemande(input);
    setDemandes((prev) => [demande, ...prev]);
    return demande;
  }, []);

  return { demandes, loading, error, ajouterDemande };
}
