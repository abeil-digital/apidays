"use client";

import { useCallback, useEffect, useState } from "react";
import type { Demande, NouvelleDemandeInput } from "@/lib/types";
import { creerDemande, fetchDemandes } from "@/lib/data/demandes.repository";

interface UseDemandesResult {
  demandes: Demande[];
  loading: boolean;
  error: string | null;
  ajouterDemande: (input: NouvelleDemandeInput) => Promise<Demande>;
  refetch: () => void;
}

/**
 * Point d'accès unique aux demandes de congés/RTT pour l'UI.
 * Aucun composant ne doit importer `lib/data/demandes.repository` directement.
 *
 * Rafraîchit aussi automatiquement au retour sur l'onglet (`visibilitychange`,
 * 18/08/2026) — sans ça, une décision prise ailleurs (un manager qui valide
 * depuis un autre onglet/session pendant que Accueil reste ouvert) ne
 * remontait jamais : le fetch initial ne s'exécute qu'au montage, rien ne le
 * redéclenchait. Pas de polling continu (pas d'infra temps réel ici), juste
 * ce déclencheur ponctuel au moment le plus probable où l'utilisateur
 * s'attend à voir du nouveau.
 */
export function useDemandes(): UseDemandesResult {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

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
  }, [version]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        setVersion((v) => v + 1);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const ajouterDemande = useCallback(async (input: NouvelleDemandeInput) => {
    const demande = await creerDemande(input);
    setDemandes((prev) => [demande, ...prev]);
    return demande;
  }, []);

  return { demandes, loading, error, ajouterDemande, refetch: () => setVersion((v) => v + 1) };
}
