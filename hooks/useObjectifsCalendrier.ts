"use client";

import { useCallback, useEffect, useState } from "react";
import type { ObjectifsCalendrier, ObjectifsCalendrierInput } from "@/lib/types";
import {
  enregistrerObjectifsCalendrier,
  fetchObjectifsCalendrier,
} from "@/lib/data/objectifsCalendrier.repository";

interface UseObjectifsCalendrierResult {
  objectifs: ObjectifsCalendrier | null;
  loading: boolean;
  error: string | null;
  enregistrerObjectifs: (input: ObjectifsCalendrierInput) => Promise<ObjectifsCalendrier>;
}

/** Objectifs annuels CPI/DJI (réglés depuis Congés & RTT, consommés par le
 * Calendrier) — table singleton, un seul hook pour les deux écrans. */
export function useObjectifsCalendrier(): UseObjectifsCalendrierResult {
  const [objectifs, setObjectifs] = useState<ObjectifsCalendrier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchObjectifsCalendrier()
      .then((o) => {
        if (!cancelled) {
          setObjectifs(o);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les objectifs CPI/DJI.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const enregistrerObjectifs = useCallback(async (input: ObjectifsCalendrierInput) => {
    const o = await enregistrerObjectifsCalendrier(input);
    setObjectifs(o);
    return o;
  }, []);

  return { objectifs, loading, error, enregistrerObjectifs };
}
