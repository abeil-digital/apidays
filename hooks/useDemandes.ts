"use client";

import { useCallback, useEffect, useState } from "react";
import type { Demande, NouvelleDemandeInput } from "@/lib/types";
import {
  creerDemande,
  fetchDemandes,
  marquerDemandeVue,
  retirerDemande,
} from "@/lib/data/demandes.repository";
import { notifierNouvelleDemande } from "@/lib/data/notificationsDemandes.actions";

interface UseDemandesResult {
  demandes: Demande[];
  loading: boolean;
  error: string | null;
  ajouterDemande: (input: NouvelleDemandeInput) => Promise<Demande>;
  marquerVue: (id: string) => Promise<void>;
  retirer: (id: string, commentaire: string) => Promise<void>;
  refetch: () => void;
}

/**
 * Point d'accès unique aux demandes de congés/RTT pour l'UI.
 * Aucun composant ne doit importer `lib/data/demandes.repository` directement.
 *
 * Rafraîchit aussi automatiquement au retour sur l'onglet (`visibilitychange`,
 * 18/08/2026) — sans ça, une décision prise ailleurs (un manager qui valide
 * depuis un autre onglet/session pendant que Accueil reste ouvert) ne
 * remontait jamais : le fetch initial ne s'exécute qu'au montage, rien ne le
 * redéclenchait. Pas de polling continu (pas d'infra temps réel ici), juste
 * ce déclencheur ponctuel au moment le plus probable où l'utilisateur
 * s'attend à voir du nouveau.
 *
 * `utilisateurId` optionnel (24/08/2026, même principe que `useSoldes`) :
 * sans argument, l'utilisateur connecté ; avec, les demandes d'un autre
 * collaborateur (`/suivre/calendrier`, manager/admin).
 *
 * "Vu" des décisions (validée/refusée/annulée) — `marquerVue` est exposée
 * mais jamais appelée automatiquement ici : à l'appelant de décider quand
 * une décision devient "vue" (10/09/2026, simplifié à la demande de
 * Vincent — une décision est vue dès l'ouverture du tiroir "Mon journal",
 * voir `ActiviteRecenteFeed`/`DashboardPage.tsx`). Ancien principe "vu
 * depuis votre dernière connexion" (persistance `sessionStorage`/
 * `localStorage`, 18/08/2026) retiré le 10/09/2026 : reposait sur des clés
 * globales au NAVIGATEUR (pas une vraie session d'authentification, pas
 * scopées par utilisateur — voir SUIVI-DECISIONS.md, "Limites connues").
 */
export function useDemandes(utilisateurId?: string): UseDemandesResult {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchDemandes(utilisateurId)
      .then((data) => {
        if (!cancelled) {
          setDemandes(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les demandes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [version, utilisateurId]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        setVersion((v) => v + 1);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const ajouterDemande = useCallback(async (input: NouvelleDemandeInput) => {
    const demande = await creerDemande(input);
    setDemandes((prev) => [demande, ...prev]);
    notifierNouvelleDemande(demande.id).catch(() => {});
    return demande;
  }, []);

  // Marque localement `vu: true` en optimiste — évite un refetch complet
  // juste pour ce champ, comme `ajouterDemande` met déjà à jour l'état local
  // sans repasser par le serveur.
  const marquerVue = useCallback(async (id: string) => {
    setDemandes((prev) => prev.map((d) => (d.id === id ? { ...d, vu: true } : d)));
    await marquerDemandeVue(id);
  }, []);

  // Retrait d'une demande "en attente" par le collaborateur lui-même
  // (28/08/2026, `DetailCongePanel` — "Retirer cette demande") — refetch
  // plutôt qu'une mise à jour optimiste : `validateur`/`dateDecision`
  // (nécessaires pour le feed, voir `retireeParSoiMeme`) viennent du serveur,
  // pas reconstructibles proprement côté client.
  const retirer = useCallback(async (id: string, commentaire: string) => {
    await retirerDemande(id, commentaire);
    setVersion((v) => v + 1);
  }, []);

  return {
    demandes,
    loading,
    error,
    ajouterDemande,
    marquerVue,
    retirer,
    refetch: () => setVersion((v) => v + 1),
  };
}
