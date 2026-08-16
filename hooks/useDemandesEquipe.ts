"use client";

import { useCallback, useEffect, useState } from "react";
import type { DemandeEquipe } from "@/lib/types";
import {
  fetchDemandesEquipe,
  refuserDemande,
  regulariserDemande,
  remettreEnAttenteDemande,
  validerDemande,
} from "@/lib/data/demandes.repository";

interface UseDemandesEquipeResult {
  demandes: DemandeEquipe[];
  loading: boolean;
  error: string | null;
  valider: (id: string, commentaire?: string) => Promise<void>;
  refuser: (id: string, commentaire?: string) => Promise<void>;
  regulariser: (id: string, commentaire?: string) => Promise<void>;
  remettreEnAttente: (id: string) => Promise<void>;
}

/**
 * Demandes de l'équipe pour l'Espace Suivre (manager).
 *
 * Valider/refuser/régulariser/remettre en attente re-fetchent la liste
 * entière après succès (`version`, même pattern que `useCongesConsommes`)
 * plutôt que de patcher l'état local en optimiste — l'ancienne version
 * optimiste oubliait `dateDecision`/`validateur` (pas connus côté client
 * sans dupliquer la logique de `useUtilisateur`), ce qui laissait le feed du
 * panneau ("Validé le/Refusé le") vide tant que la page n'était pas
 * rechargée.
 */
export function useDemandesEquipe(): UseDemandesEquipeResult {
  const [demandes, setDemandes] = useState<DemandeEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

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
  }, [version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  const valider = useCallback(
    async (id: string, commentaire = "") => {
      await validerDemande(id, commentaire);
      refetch();
    },
    [refetch],
  );

  const refuser = useCallback(
    async (id: string, commentaire = "") => {
      await refuserDemande(id, commentaire);
      refetch();
    },
    [refetch],
  );

  const regulariser = useCallback(
    async (id: string, commentaire = "") => {
      await regulariserDemande(id, commentaire);
      refetch();
    },
    [refetch],
  );

  const remettreEnAttente = useCallback(
    async (id: string) => {
      await remettreEnAttenteDemande(id);
      refetch();
    },
    [refetch],
  );

  return { demandes, loading, error, valider, refuser, regulariser, remettreEnAttente };
}
