"use client";

import { useCallback, useEffect, useState } from "react";
import type { Faq, FaqInput } from "@/lib/types";
import {
  creerFaq,
  fetchFaqs,
  modifierFaq,
  reordonnerFaqs,
  supprimerFaq,
} from "@/lib/data/faq.repository";

interface UseFaqsResult {
  faqs: Faq[];
  loading: boolean;
  error: string | null;
  ajouter: (input: FaqInput) => Promise<Faq>;
  modifier: (id: string, input: Partial<FaqInput & { publie: boolean }>) => Promise<Faq>;
  supprimer: (id: string) => Promise<void>;
  /** Réordonne localement (retour immédiat, drag and drop fluide) puis
   * persiste en base — voir `reordonnerFaqs`. */
  reordonner: (nouvelOrdre: Faq[]) => Promise<void>;
}

/** Point d'accès unique aux FAQ (Paramétrer > FAQ, 07/09/2026). */
export function useFaqs(): UseFaqsResult {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchFaqs()
      .then((data) => {
        if (!cancelled) {
          setFaqs(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les FAQ.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const ajouter = useCallback(
    async (input: FaqInput) => {
      const ordreMax = faqs.reduce((max, f) => Math.max(max, f.ordre), 0);
      const faq = await creerFaq(input, ordreMax + 1);
      setFaqs((prev) => [...prev, faq]);
      return faq;
    },
    [faqs],
  );

  const modifier = useCallback(
    async (id: string, input: Partial<FaqInput & { publie: boolean }>) => {
      const faq = await modifierFaq(id, input);
      setFaqs((prev) => prev.map((f) => (f.id === id ? faq : f)));
      return faq;
    },
    [],
  );

  const supprimer = useCallback(async (id: string) => {
    await supprimerFaq(id);
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const reordonner = useCallback(async (nouvelOrdre: Faq[]) => {
    setFaqs(nouvelOrdre);
    const ordres = nouvelOrdre.map((f, i) => ({ id: f.id, ordre: i + 1 }));
    await reordonnerFaqs(ordres);
    setFaqs((prev) =>
      prev.map((f) => ({ ...f, ordre: ordres.find((o) => o.id === f.id)?.ordre ?? f.ordre })),
    );
  }, []);

  return { faqs, loading, error, ajouter, modifier, supprimer, reordonner };
}
