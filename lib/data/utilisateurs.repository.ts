import type { UtilisateurAdmin, UtilisateurAdminInput } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Repository d'administration des utilisateurs (écran Paramétrer > Gestion
 * des utilisateurs) — à ne pas confondre avec utilisateur.repository.ts
 * (l'utilisateur de la session courante). La RLS fait déjà tout le travail
 * de restriction par rôle : un admin voit/gère tout le monde, un manager ne
 * voit que son équipe et ne peut ni créer ni modifier (policies "admin
 * uniquement" sur insert/update), un salarié ne verrait que sa propre ligne
 * — voir BASE-DE-DONNEES.md.
 */

interface UtilisateurRow {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  date_entree: string;
  type_contrat: UtilisateurAdmin["typeContrat"];
  taux_temps_partiel: number | string | null;
  anciennete_date_reference: string | null;
  role: UtilisateurAdmin["role"];
  statut: UtilisateurAdmin["statut"];
  date_archivage: string | null;
}

const SELECT_UTILISATEUR =
  "id, prenom, nom, email, date_entree, type_contrat, taux_temps_partiel, anciennete_date_reference, role, statut, date_archivage";

function mapUtilisateurDepuisDb(row: UtilisateurRow): UtilisateurAdmin {
  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    email: row.email,
    dateEntree: row.date_entree,
    typeContrat: row.type_contrat,
    tauxTempsPartiel: row.taux_temps_partiel !== null ? Number(row.taux_temps_partiel) : null,
    ancienneteDateReference: row.anciennete_date_reference,
    role: row.role,
    statut: row.statut,
    dateArchivage: row.date_archivage,
  };
}

function paramsDepuisInput(input: UtilisateurAdminInput) {
  return {
    prenom: input.prenom,
    nom: input.nom,
    email: input.email,
    date_entree: input.dateEntree,
    type_contrat: input.typeContrat,
    taux_temps_partiel: input.typeContrat === "temps_partiel" ? input.tauxTempsPartiel : null,
    anciennete_date_reference: input.ancienneteDateReference || null,
    role: input.role,
  };
}

export async function fetchUtilisateursAdmin(): Promise<UtilisateurAdmin[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("utilisateurs")
    .select(SELECT_UTILISATEUR)
    .order("nom", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les utilisateurs.");
  }

  return (data ?? []).map(mapUtilisateurDepuisDb);
}

export async function fetchUtilisateurAdmin(id: string): Promise<UtilisateurAdmin> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("utilisateurs")
    .select(SELECT_UTILISATEUR)
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error("Utilisateur introuvable.");
  }

  return mapUtilisateurDepuisDb(data);
}

export async function creerUtilisateurAdmin(
  input: UtilisateurAdminInput,
): Promise<UtilisateurAdmin> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("utilisateurs")
    .insert(paramsDepuisInput(input))
    .select(SELECT_UTILISATEUR)
    .single();

  if (error || !data) {
    throw new Error("Impossible de créer ce profil (email déjà utilisé ?).");
  }

  return mapUtilisateurDepuisDb(data);
}

export async function modifierUtilisateurAdmin(
  id: string,
  input: UtilisateurAdminInput,
): Promise<UtilisateurAdmin> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("utilisateurs")
    .update(paramsDepuisInput(input))
    .eq("id", id)
    .select(SELECT_UTILISATEUR)
    .single();

  if (error || !data) {
    throw new Error("Impossible de modifier ce profil.");
  }

  return mapUtilisateurDepuisDb(data);
}

export async function archiverUtilisateurAdmin(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("utilisateurs")
    .update({ statut: "archive", date_archivage: new Date().toISOString().slice(0, 10) })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error("Impossible d'archiver ce profil.");
  }
}
