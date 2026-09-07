import type { Faq, FaqInput } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Repository des FAQ (Accueil > `FaqCard.tsx`, Paramétrer > FAQ, 07/09/2026).
 * RLS : un collaborateur ne lit que les FAQ publiées ; manager/admin lisent
 * et gèrent tout (publiées ou non) — une seule fonction de lecture suffit
 * pour les deux usages, le filtre se fait entièrement côté RLS (deux
 * policies SELECT combinées en OR, voir schema.sql).
 */

interface FaqRow {
  id: string;
  question: string;
  reponse: string;
  publie: boolean;
  ordre: number;
}

const SELECT_FAQ = "id, question, reponse, publie, ordre";

function mapFaqDepuisDb(row: FaqRow): Faq {
  return {
    id: row.id,
    question: row.question,
    reponse: row.reponse,
    publie: row.publie,
    ordre: row.ordre,
  };
}

export async function fetchFaqs(): Promise<Faq[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("faqs")
    .select(SELECT_FAQ)
    .order("ordre", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les FAQ.");
  }

  return (data ?? []).map(mapFaqDepuisDb);
}

/** `ordre` fourni par l'appelant (07/09/2026) — pas de séquence dédiée en
 * base, le hook calcule le prochain ordre à partir de la liste déjà
 * chargée (max + 1) pour ajouter la nouvelle FAQ en fin de liste. */
export async function creerFaq(input: FaqInput, ordre: number): Promise<Faq> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("faqs")
    .insert({
      question: input.question,
      reponse: input.reponse,
      publie: false,
      ordre,
    })
    .select(SELECT_FAQ)
    .single();

  if (error || !data) {
    throw new Error("Impossible de créer cette FAQ.");
  }

  return mapFaqDepuisDb(data);
}

export async function modifierFaq(
  id: string,
  input: Partial<FaqInput & { publie: boolean }>,
): Promise<Faq> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("faqs")
    .update(input)
    .eq("id", id)
    .select(SELECT_FAQ)
    .single();

  if (error || !data) {
    throw new Error("Impossible de modifier cette FAQ.");
  }

  return mapFaqDepuisDb(data);
}

export async function supprimerFaq(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("faqs").delete().eq("id", id);

  if (error) {
    throw new Error("Impossible de supprimer cette FAQ.");
  }
}

/** Persiste un nouvel ordre d'affichage après un drag and drop (07/09/2026)
 * — une mise à jour par ligne (pas d'upsert multi-valeurs simple côté
 * Supabase JS pour des lignes déjà existantes), acceptable pour une liste
 * de FAQ qui reste courte. */
export async function reordonnerFaqs(ordres: { id: string; ordre: number }[]): Promise<void> {
  const supabase = createClient();

  const resultats = await Promise.all(
    ordres.map(({ id, ordre }) => supabase.from("faqs").update({ ordre }).eq("id", id)),
  );

  if (resultats.some((r) => r.error)) {
    throw new Error("Impossible d'enregistrer le nouvel ordre des FAQ.");
  }
}
