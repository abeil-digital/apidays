"use client";

import { useCallback, useEffect, useState } from "react";
import type { ParametrageNotifications, ParametrageNotificationsInput } from "@/lib/types";
import {
  fetchParametrageNotifications,
  mettreAJourParametrageNotifications,
} from "@/lib/data/parametrageNotifications.repository";

interface UseParametrageNotificationsResult {
  parametrage: ParametrageNotifications | null;
  loading: boolean;
  error: string | null;
  enregistrer: (input: ParametrageNotificationsInput) => Promise<ParametrageNotifications>;
}

/** Réglages des notifications email de nouvelle demande — table singleton. */
export function useParametrageNotifications(): UseParametrageNotificationsResult {
  const [parametrage, setParametrage] = useState<ParametrageNotifications | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchParametrageNotifications()
      .then((p) => {
        if (!cancelled) {
          setParametrage(p);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les réglages de notification.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const enregistrer = useCallback(async (input: ParametrageNotificationsInput) => {
    const p = await mettreAJourParametrageNotifications(input);
    setParametrage(p);
    return p;
  }, []);

  return { parametrage, loading, error, enregistrer };
}
