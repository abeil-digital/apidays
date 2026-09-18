"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AttributionBonusAnciennete,
  HistoriqueAttributionBonus,
  RegleAcquisition,
  RegleAcquisitionInput,
  RegleAnciennete,
  RegleAncienneteInput,
  TypeDemande,
} from "@/lib/types";
import {
  creerRegleAnciennete,
  enregistrerRegleAcquisition,
  fetchHistoriqueAttributionBonus,
  fetchReglesAcquisition,
  fetchReglesAnciennete,
  modifierRegleAnciennete as modifierRegleAncienneteApi,
  supprimerRegleAnciennete,
} from "@/lib/data/reglesConges.repository";
import { enregistrerAttributionBonusAnciennete } from "@/lib/data/soldes.repository";

interface UseReglesCongesResult {
  reglesAcquisition: RegleAcquisition[];
  reglesAnciennete: RegleAnciennete[];
  historiqueAttributionBonus: HistoriqueAttributionBonus[];
  loading: boolean;
  error: string | null;
  enregistrerAcquisition: (
    type: TypeDemande,
    input: RegleAcquisitionInput,
  ) => Promise<RegleAcquisition>;
  ajouterRegleAnciennete: (input: RegleAncienneteInput) => Promise<RegleAnciennete>;
  modifierRegleAnciennete: (id: string, input: RegleAncienneteInput) => Promise<RegleAnciennete>;
  retirerRegleAnciennete: (id: string) => Promise<void>;
  enregistrerAttributionBonus: (
    valeur: AttributionBonusAnciennete,
  ) => Promise<HistoriqueAttributionBonus>;
}

/**
 * Point d'accès unique aux règles de calcul des soldes (Paramétrer > Congés
 * & RTT). Un seul hook pour les deux tables : la page qui les consomme est
 * un seul écran cohérent, pas deux fonctionnalités séparées.
 */
export function useReglesConges(): UseReglesCongesResult {
  const [reglesAcquisition, setReglesAcquisition] = useState<RegleAcquisition[]>([]);
  const [reglesAnciennete, setReglesAnciennete] = useState<RegleAnciennete[]>([]);
  const [historiqueAttributionBonus, setHistoriqueAttributionBonus] = useState<
    HistoriqueAttributionBonus[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchReglesAcquisition(),
      fetchReglesAnciennete(),
      fetchHistoriqueAttributionBonus(),
    ])
      .then(([acquisition, anciennete, attributionBonus]) => {
        if (!cancelled) {
          setReglesAcquisition(acquisition);
          setReglesAnciennete(anciennete);
          setHistoriqueAttributionBonus(attributionBonus);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les règles de congés/RTT.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const enregistrerAcquisition = useCallback(
    async (type: TypeDemande, input: RegleAcquisitionInput) => {
      const regle = await enregistrerRegleAcquisition(type, input);
      setReglesAcquisition((prev) => [...prev.filter((r) => r.typeAbsence !== type), regle]);
      return regle;
    },
    [],
  );

  const ajouterRegleAnciennete = useCallback(async (input: RegleAncienneteInput) => {
    const regle = await creerRegleAnciennete(input);
    setReglesAnciennete((prev) => [...prev, regle].sort((a, b) => a.seuilAnnees - b.seuilAnnees));
    return regle;
  }, []);

  const modifierRegleAnciennete = useCallback(async (id: string, input: RegleAncienneteInput) => {
    const regle = await modifierRegleAncienneteApi(id, input);
    setReglesAnciennete((prev) =>
      prev.map((r) => (r.id === id ? regle : r)).sort((a, b) => a.seuilAnnees - b.seuilAnnees),
    );
    return regle;
  }, []);

  const retirerRegleAnciennete = useCallback(async (id: string) => {
    await supprimerRegleAnciennete(id);
    setReglesAnciennete((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Met à jour la même ligne en attente si elle existe déjà (même
  // `effectiveDepuis`, contrainte `unique` côté base) plutôt que d'ajouter un
  // doublon — voir `enregistrerAttributionBonusAnciennete`.
  const enregistrerAttributionBonusCb = useCallback(async (valeur: AttributionBonusAnciennete) => {
    const ligne = await enregistrerAttributionBonusAnciennete(valeur);
    setHistoriqueAttributionBonus((prev) => [
      ...prev.filter((h) => h.effectiveDepuis !== ligne.effectiveDepuis),
      ligne,
    ]);
    return ligne;
  }, []);

  return {
    reglesAcquisition,
    reglesAnciennete,
    historiqueAttributionBonus,
    loading,
    error,
    enregistrerAcquisition,
    ajouterRegleAnciennete,
    modifierRegleAnciennete,
    retirerRegleAnciennete,
    enregistrerAttributionBonus: enregistrerAttributionBonusCb,
  };
}
