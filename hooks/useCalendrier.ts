"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DjImposee,
  DjImposeeInput,
  JourFerie,
  JourFerieInput,
  ParametragePeriode,
  ParametragePeriodeInput,
} from "@/lib/types";
import {
  ajouterJourFerie,
  enregistrerParametragePeriode,
  fetchDjImposees,
  fetchJoursFeries,
  fetchParametragePeriode,
  modifierDjImposee,
  preRemplirJoursFeriesLegaux,
  remplacerDjImposees,
  supprimerDjImposee,
  supprimerJourFerie,
} from "@/lib/data/calendrier.repository";
import { joursFeriesLegaux } from "@/lib/joursFeries";

interface UseCalendrierResult {
  parametrage: ParametragePeriode | null;
  djImposees: DjImposee[];
  joursFeries: JourFerie[];
  loading: boolean;
  error: string | null;
  validerParametrage: (
    input: ParametragePeriodeInput,
    djs: DjImposeeInput[],
  ) => Promise<ParametragePeriode>;
  modifierDj: (id: string, input: DjImposeeInput) => Promise<DjImposee>;
  supprimerDj: (id: string) => Promise<void>;
  ajouterFerie: (input: JourFerieInput) => Promise<JourFerie>;
  supprimerFerie: (id: string) => Promise<void>;
  preRemplirFeries: () => Promise<JourFerie[]>;
}

/** Charge et pilote le calendrier (paramétrage, DJ imposées, jours fériés) d'une année donnée. */
export function useCalendrier(annee: number): UseCalendrierResult {
  const [parametrage, setParametrage] = useState<ParametragePeriode | null>(null);
  const [djImposees, setDjImposees] = useState<DjImposee[]>([]);
  const [joursFeries, setJoursFeries] = useState<JourFerie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [p, feries] = await Promise.all([
          fetchParametragePeriode(annee),
          fetchJoursFeries(annee),
        ]);
        const djs = p ? await fetchDjImposees(p.id) : [];
        if (cancelled) return;
        setParametrage(p);
        setJoursFeries(feries);
        setDjImposees(djs);
        setError(null);
      } catch {
        if (!cancelled) setError("Impossible de charger le calendrier.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [annee]);

  const validerParametrage = useCallback(
    async (input: ParametragePeriodeInput, djs: DjImposeeInput[]) => {
      const p = await enregistrerParametragePeriode(input);
      const nouvellesDj = await remplacerDjImposees(p.id, djs);
      setParametrage(p);
      setDjImposees(nouvellesDj);
      return p;
    },
    [],
  );

  const modifierDj = useCallback(async (id: string, input: DjImposeeInput) => {
    const dj = await modifierDjImposee(id, input);
    setDjImposees((prev) =>
      prev.map((d) => (d.id === id ? dj : d)).sort((a, b) => a.date.localeCompare(b.date)),
    );
    return dj;
  }, []);

  const supprimerDj = useCallback(async (id: string) => {
    await supprimerDjImposee(id);
    setDjImposees((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const ajouterFerie = useCallback(async (input: JourFerieInput) => {
    const ferie = await ajouterJourFerie(input);
    setJoursFeries((prev) => [...prev, ferie].sort((a, b) => a.date.localeCompare(b.date)));
    return ferie;
  }, []);

  const supprimerFerie = useCallback(async (id: string) => {
    await supprimerJourFerie(id);
    setJoursFeries((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const preRemplirFeries = useCallback(async () => {
    const tous = await preRemplirJoursFeriesLegaux(annee, joursFeriesLegaux(annee));
    setJoursFeries(tous);
    return tous;
  }, [annee]);

  return {
    parametrage,
    djImposees,
    joursFeries,
    loading,
    error,
    validerParametrage,
    modifierDj,
    supprimerDj,
    ajouterFerie,
    supprimerFerie,
    preRemplirFeries,
  };
}
