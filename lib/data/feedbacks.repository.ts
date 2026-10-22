import type { Feedback } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Repository des feedbacks (22/10/2026) — formulaire du pied de page et page
 * « Feedback » des managers. RLS : un utilisateur connecté n'écrit que ses
 * propres messages ; seuls manager/admin du tenant les lisent (voir
 * `feedbacks` dans schema.sql).
 */

export const LONGUEUR_MAX_NOM = 120;
export const LONGUEUR_MAX_COMMENTAIRE = 1000;

interface FeedbackRow {
  id: string;
  nom: string;
  commentaire: string;
  created_at: string;
}

export const NOM_ANONYME = "Anonyme";

export async function envoyerFeedback(input: {
  nom: string;
  commentaire: string;
  anonyme: boolean;
}): Promise<void> {
  const nom = input.anonyme ? NOM_ANONYME : input.nom.trim();
  const commentaire = input.commentaire.trim();
  if (!nom || !commentaire) {
    throw new Error("Merci d'indiquer votre nom et un commentaire.");
  }
  if (nom.length > LONGUEUR_MAX_NOM || commentaire.length > LONGUEUR_MAX_COMMENTAIRE) {
    throw new Error("Le message est trop long.");
  }

  const supabase = createClient();
  // `entreprise_id` : valeur par défaut posée côté base (`my_entreprise_id()`).
  // `utilisateur_id` : défaut `my_utilisateur_id()` ; en mode anonyme on envoie
  // explicitement `null` pour ne laisser aucune trace de l'auteur.
  const { error } = await supabase
    .from("feedbacks")
    .insert(input.anonyme ? { nom, commentaire, utilisateur_id: null } : { nom, commentaire });
  if (error) {
    throw new Error("Impossible d'envoyer votre message pour le moment.");
  }
}

export async function fetchFeedbacks(): Promise<Feedback[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("feedbacks")
    .select("id, nom, commentaire, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Impossible de charger les feedbacks.");
  }

  return ((data ?? []) as FeedbackRow[]).map((row) => ({
    id: row.id,
    nom: row.nom,
    commentaire: row.commentaire,
    creeLe: row.created_at,
  }));
}
