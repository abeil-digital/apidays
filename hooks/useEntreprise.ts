"use client";

import { useEffect, useState } from "react";
import { fetchEntrepriseCourante } from "@/lib/data/entreprise.repository";

interface UseEntrepriseResult {
  /** `null` tant que non chargé OU si le tenant n'a pas ce champ renseigné
   * (tenants créés avant le 11/09/2026) — dans les deux cas, aucune borne à
   * appliquer côté appelant. */
  dateDebutUtilisation: string | null;
  loading: boolean;
}

/**
 * Point d'accès unique aux données de l'entreprise courante côté client
 * (11/09/2026) — même principe que `useReglesConges`. Pour l'instant, ne
 * sert que le plafond "date de début d'utilisation de l'outil" (Transmissions
 * paie, Calendrier) ; à étendre ici si d'autres écrans clients ont besoin
 * d'autres colonnes de `entreprises`, plutôt que de dupliquer le fetch.
 */
export function useEntreprise(): UseEntrepriseResult {
  const [dateDebutUtilisation, setDateDebutUtilisation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchEntrepriseCourante()
      .then((entreprise) => {
        if (!cancelled) setDateDebutUtilisation(entreprise.dateDebutUtilisation);
      })
      .catch(() => {
        if (!cancelled) setDateDebutUtilisation(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { dateDebutUtilisation, loading };
}
