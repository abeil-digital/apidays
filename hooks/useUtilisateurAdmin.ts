"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ChangerChampInput,
  HistoriqueUtilisateurEntry,
  SoldeInitial,
  UtilisateurAdmin,
  UtilisateurAdminInput,
} from "@/lib/types";
import {
  archiverUtilisateurAdmin,
  changerNatureContrat,
  changerTauxActivite,
  creerUtilisateurAdmin,
  enregistrerSoldeInitial,
  fetchHistoriqueUtilisateur,
  fetchSoldeInitial,
  fetchUtilisateurAdmin,
  modifierUtilisateurAdmin,
} from "@/lib/data/utilisateurs.repository";

interface UseUtilisateurAdminResult {
  utilisateur: UtilisateurAdmin | null;
  historique: HistoriqueUtilisateurEntry[];
  soldeInitial: SoldeInitial | null;
  loading: boolean;
  error: string | null;
  creer: (input: UtilisateurAdminInput, soldeInitial?: SoldeInitial) => Promise<UtilisateurAdmin>;
  modifier: (input: UtilisateurAdminInput) => Promise<UtilisateurAdmin>;
  archiver: () => Promise<void>;
  changerTauxActivite: (input: ChangerChampInput) => Promise<void>;
  changerNatureContrat: (input: ChangerChampInput) => Promise<void>;
  enregistrerSoldeInitial: (input: SoldeInitial) => Promise<void>;
}

/**
 * Fiche d'un utilisateur (écran Paramétrer > Gestion des utilisateurs).
 * Sans `id` : mode création, rien à charger, seul `creer` a du sens.
 */
export function useUtilisateurAdmin(id?: string): UseUtilisateurAdminResult {
  const [utilisateur, setUtilisateur] = useState<UtilisateurAdmin | null>(null);
  const [historique, setHistorique] = useState<HistoriqueUtilisateurEntry[]>([]);
  const [soldeInitial, setSoldeInitial] = useState<SoldeInitial | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    if (!id) return;
    const [utilisateurData, historiqueData, soldeInitialData] = await Promise.all([
      fetchUtilisateurAdmin(id),
      fetchHistoriqueUtilisateur(id),
      fetchSoldeInitial(id),
    ]);
    setUtilisateur(utilisateurData);
    setHistorique(historiqueData);
    setSoldeInitial(soldeInitialData);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    Promise.all([fetchUtilisateurAdmin(id), fetchHistoriqueUtilisateur(id), fetchSoldeInitial(id)])
      .then(([utilisateurData, historiqueData, soldeInitialData]) => {
        if (!cancelled) {
          setUtilisateur(utilisateurData);
          setHistorique(historiqueData);
          setSoldeInitial(soldeInitialData);
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

  const creer = useCallback(
    (input: UtilisateurAdminInput, soldeInitialInput?: SoldeInitial) =>
      creerUtilisateurAdmin(input, soldeInitialInput),
    [],
  );

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

  const changerTaux = useCallback(
    async (input: ChangerChampInput) => {
      if (!id) throw new Error("Identifiant manquant.");
      await changerTauxActivite(id, input);
      await recharger();
    },
    [id, recharger],
  );

  const changerNature = useCallback(
    async (input: ChangerChampInput) => {
      if (!id) throw new Error("Identifiant manquant.");
      await changerNatureContrat(id, input);
      await recharger();
    },
    [id, recharger],
  );

  const enregistrerSolde = useCallback(
    async (input: SoldeInitial) => {
      if (!id) throw new Error("Identifiant manquant.");
      await enregistrerSoldeInitial(id, input);
      await recharger();
    },
    [id, recharger],
  );

  return {
    utilisateur,
    historique,
    soldeInitial,
    loading,
    error,
    creer,
    modifier,
    archiver,
    changerTauxActivite: changerTaux,
    changerNatureContrat: changerNature,
    enregistrerSoldeInitial: enregistrerSolde,
  };
}
