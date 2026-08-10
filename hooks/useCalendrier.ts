"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  CongeImpose,
  CongeImposeInput,
  DjImposee,
  DjImposeeInput,
  JourFerie,
  JourFerieInput,
  ParametragePeriode,
} from "@/lib/types";
import {
  ajouterCongeImpose,
  ajouterDjImposee,
  ajouterJourFerie,
  enregistrerParametragePeriode,
  fetchCongesImposes,
  fetchDjImposees,
  fetchJoursFeries,
  depublierParametragePeriode,
  fetchParametragePeriode,
  preRemplirJoursFeriesLegaux,
  publierParametragePeriode,
  supprimerCongeImpose,
  supprimerDjImposee,
  supprimerJourFerie,
} from "@/lib/data/calendrier.repository";
import { joursFeriesLegaux, lundiSemaineDu15Aout } from "@/lib/joursFeries";

interface UseCalendrierResult {
  parametrage: ParametragePeriode | null;
  djImposees: DjImposee[];
  joursFeries: JourFerie[];
  congesImposes: CongeImpose[];
  loading: boolean;
  error: string | null;
  ajouterDj: (input: DjImposeeInput) => Promise<DjImposee>;
  supprimerDj: (id: string) => Promise<void>;
  ajouterFerie: (input: JourFerieInput) => Promise<JourFerie>;
  supprimerFerie: (id: string) => Promise<void>;
  preRemplirFeries: () => Promise<JourFerie[]>;
  ajouterConge: (input: CongeImposeInput) => Promise<CongeImpose>;
  supprimerConge: (id: string) => Promise<void>;
  publierParametrage: () => Promise<ParametragePeriode>;
  depublierParametrage: () => Promise<ParametragePeriode>;
}

/** Charge et pilote le calendrier (paramétrage, DJ imposées, jours fériés) d'une année donnée. */
export function useCalendrier(annee: number): UseCalendrierResult {
  const [parametrage, setParametrage] = useState<ParametragePeriode | null>(null);
  const [djImposees, setDjImposees] = useState<DjImposee[]>([]);
  const [joursFeries, setJoursFeries] = useState<JourFerie[]>([]);
  const [congesImposes, setCongesImposes] = useState<CongeImpose[]>([]);
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
        const [djs, conges] = p
          ? await Promise.all([fetchDjImposees(p.id), fetchCongesImposes(p.id)])
          : [[], []];
        if (cancelled) return;
        setParametrage(p);
        setJoursFeries(feries);
        setDjImposees(djs);
        setCongesImposes(conges);
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

  /** Récupère le paramétrage de l'année, ou le crée avec les valeurs par défaut s'il n'existe pas encore. */
  const assurerParametrage = useCallback(async () => {
    if (parametrage) return parametrage;
    const p = await enregistrerParametragePeriode({
      annee,
      semaineAoutImposee: lundiSemaineDu15Aout(annee),
      nbDemiJourneesCible: 16,
      jourSemaineDefaut: 5,
    });
    setParametrage(p);
    return p;
  }, [annee, parametrage]);

  const ajouterDj = useCallback(
    async (input: DjImposeeInput) => {
      const p = await assurerParametrage();
      const dj = await ajouterDjImposee(p.id, input);
      setDjImposees((prev) => [...prev, dj].sort((a, b) => a.date.localeCompare(b.date)));
      return dj;
    },
    [assurerParametrage],
  );

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

  const ajouterConge = useCallback(
    async (input: CongeImposeInput) => {
      const p = await assurerParametrage();
      const conge = await ajouterCongeImpose(p.id, input);
      setCongesImposes((prev) => [...prev, conge].sort((a, b) => a.debut.localeCompare(b.debut)));
      return conge;
    },
    [assurerParametrage],
  );

  const supprimerConge = useCallback(async (id: string) => {
    await supprimerCongeImpose(id);
    setCongesImposes((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const publierParametrageAction = useCallback(async () => {
    const p = await assurerParametrage();
    const publie = await publierParametragePeriode(p.id);
    setParametrage(publie);
    return publie;
  }, [assurerParametrage]);

  const depublierParametrageAction = useCallback(async () => {
    if (!parametrage) throw new Error("Aucun paramétrage à dépublier.");
    const brouillon = await depublierParametragePeriode(parametrage.id);
    setParametrage(brouillon);
    return brouillon;
  }, [parametrage]);

  return {
    parametrage,
    djImposees,
    joursFeries,
    congesImposes,
    loading,
    error,
    ajouterDj,
    supprimerDj,
    ajouterFerie,
    supprimerFerie,
    preRemplirFeries,
    ajouterConge,
    supprimerConge,
    publierParametrage: publierParametrageAction,
    depublierParametrage: depublierParametrageAction,
  };
}
