"use client";

import { useEffect, useState } from "react";
import type { DemandeEquipe } from "@/lib/types";
import { fetchCongesConsommesPeriode } from "@/lib/data/demandes.repository";
import { fetchCongesATransmettre } from "@/lib/data/exportsPaie.repository";

interface UseCongesConsommesResult {
  demandes: DemandeEquipe[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Congés validés (CP/RTT/CSS) sur une période — consommé par `CongesPaiePage`
 * (onglet "Générer l'export" de `TransmissionsPaiePage`). `refetch` permet de
 * rafraîchir après une action locale (ex. valider/dévalider une demande)
 * sans dépendre d'un changement de `debut`/`fin`.
 *
 * `sourceTransmission` (25/08/2026) — opt-in : bascule sur
 * `fetchCongesATransmettre` (backlog inclus, sans borne basse de date) au
 * lieu de `fetchCongesConsommesPeriode` (strictement `date_debut` dans la
 * période) — sans ça, un congé du backlog (jamais transmis, démarré avant la
 * période) était bien transmis au clic sur "Transmettre" (qui utilise déjà
 * `fetchCongesATransmettre`) mais invisible dans cet aperçu/le CSV, un
 * décalage trompeur entre ce qui est prévisualisé et ce qui part réellement.
 */
export function useCongesConsommes(
  debut: string,
  fin: string,
  sourceTransmission = false,
): UseCongesConsommesResult {
  const [demandes, setDemandes] = useState<DemandeEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const promise = sourceTransmission
      ? fetchCongesATransmettre({ debut, fin })
      : fetchCongesConsommesPeriode(debut, fin);

    promise
      .then((data) => {
        if (!cancelled) {
          setDemandes(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les congés de la période.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debut, fin, sourceTransmission, version]);

  return { demandes, loading, error, refetch: () => setVersion((v) => v + 1) };
}
