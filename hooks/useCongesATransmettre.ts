"use client";

import { useEffect, useState } from "react";
import type { CongeATransmettre } from "@/lib/types";
import { fetchCongesATransmettre } from "@/lib/data/exportsPaie.repository";

interface UseCongesATransmettreResult {
  demandes: CongeATransmettre[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Congés à transmettre (validés non totalement transmis, annulés à
 * corriger, en attente chevauchant la période) — Transmissions paie > "Quels
 * congés transmettre". Même pattern que `useCongesConsommes`. */
export function useCongesATransmettre(debut: string, fin: string): UseCongesATransmettreResult {
  const [demandes, setDemandes] = useState<CongeATransmettre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchCongesATransmettre({ debut, fin })
      .then((data) => {
        if (!cancelled) {
          setDemandes(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les congés à transmettre.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debut, fin, version]);

  return { demandes, loading, error, refetch: () => setVersion((v) => v + 1) };
}
