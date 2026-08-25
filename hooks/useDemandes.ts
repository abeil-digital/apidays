"use client";

import { useCallback, useEffect, useState } from "react";
import type { Demande, NouvelleDemandeInput } from "@/lib/types";
import { creerDemande, fetchDemandes, marquerDemandeVue } from "@/lib/data/demandes.repository";

// Clés de stockage pour le principe "vu depuis votre dernière connexion" —
// voir le commentaire sur l'effet correspondant plus bas.
const SESSION_FLAG = "apidays_journal_session_started";
const CARRYOVER_KEY = "apidays_journal_non_vues";

interface UseDemandesResult {
  demandes: Demande[];
  loading: boolean;
  error: string | null;
  ajouterDemande: (input: NouvelleDemandeInput) => Promise<Demande>;
  marquerVue: (id: string) => Promise<void>;
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
 * collaborateur (`/suivre/calendrier`, manager/admin). Dans ce cas, tout le
 * mécanisme "vu"/journal ci-dessous est désactivé — il est scopé par des
 * clés `sessionStorage`/`localStorage` globales au NAVIGATEUR, pas par
 * utilisateur consulté : le laisser tourner marquerait les demandes du
 * collaborateur regardé comme "vues" en se basant sur l'état de session du
 * manager, corrompant son propre journal.
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

  // "Vu" des décisions (validée/refusée/annulée) — "depuis votre dernière connexion"
  // plutôt que "tant que le tiroir journal est fermé" (18/08/2026, retour de
  // Vincent : perturbant que la mise en avant disparaisse dès qu'on
  // ouvre/ferme le volet). Principe : une décision reste mise en avant toute
  // la session en cours (l'onglet reste ouvert), quel que soit le nombre
  // d'ouvertures/fermetures du journal, et n'est marquée "vu" qu'au tout
  // début de la session SUIVANTE — pas à la fin de celle-ci (rien ne se
  // déclenche fiablement à la fermeture d'un onglet).
  //
  // Implémentation : la liste des décisions encore non vues est recopiée en
  // continu dans `localStorage` (survit à la fermeture de l'onglet) ; au tout
  // premier montage d'une nouvelle session (`sessionStorage`, vidé à la
  // fermeture de l'onglet — sert de marqueur "déjà traité cette session"),
  // cette liste précédente est marquée "vu" d'un coup — elle représente ce
  // qui était déjà resté affiché toute la session précédente.
  useEffect(() => {
    if (utilisateurId) return;
    if (loading) return;
    if (sessionStorage.getItem(SESSION_FLAG)) return;
    sessionStorage.setItem(SESSION_FLAG, "1");

    let precedentes: string[] = [];
    try {
      precedentes = JSON.parse(localStorage.getItem(CARRYOVER_KEY) ?? "[]");
    } catch {
      precedentes = [];
    }
    precedentes.forEach((id) => {
      setDemandes((prev) => prev.map((d) => (d.id === id ? { ...d, vu: true } : d)));
      marquerDemandeVue(id).catch(() => {});
    });
  }, [loading, utilisateurId]);

  // Garde `loading` : sans elle, ce `useEffect` s'exécute dès le tout premier
  // rendu (`demandes` encore à `[]`, avant la résolution du fetch initial) et
  // écrase la liste persistée avec un tableau vide — juste avant que l'effet
  // ci-dessus n'ait la chance de la lire (bug constaté le 18/08/2026 : la
  // mise en avant ne survivait jamais à un changement de session).
  useEffect(() => {
    if (utilisateurId) return;
    if (loading) return;
    const nonVues = demandes
      .filter(
        (d) => (d.statut === "validé" || d.statut === "refusé" || d.statut === "annulé") && !d.vu,
      )
      .map((d) => d.id);
    localStorage.setItem(CARRYOVER_KEY, JSON.stringify(nonVues));
  }, [loading, demandes, utilisateurId]);

  const ajouterDemande = useCallback(async (input: NouvelleDemandeInput) => {
    const demande = await creerDemande(input);
    setDemandes((prev) => [demande, ...prev]);
    return demande;
  }, []);

  // Marque localement `vu: true` en optimiste — évite un refetch complet
  // juste pour ce champ, comme `ajouterDemande` met déjà à jour l'état local
  // sans repasser par le serveur.
  const marquerVue = useCallback(async (id: string) => {
    setDemandes((prev) => prev.map((d) => (d.id === id ? { ...d, vu: true } : d)));
    await marquerDemandeVue(id);
  }, []);

  return {
    demandes,
    loading,
    error,
    ajouterDemande,
    marquerVue,
    refetch: () => setVersion((v) => v + 1),
  };
}
