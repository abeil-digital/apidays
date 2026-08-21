import type {
  ChampHistoriqueUtilisateur,
  ChangerChampInput,
  HistoriqueUtilisateurEntry,
  SoldeInitial,
  UtilisateurAdmin,
  UtilisateurAdminInput,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

async function getUtilisateurIdCourant(
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data } = await supabase.rpc("my_utilisateur_id");
  return data ?? null;
}

/**
 * Repository d'administration des utilisateurs (écran Paramétrer > Gestion
 * des utilisateurs) — à ne pas confondre avec utilisateur.repository.ts
 * (l'utilisateur de la session courante). La RLS fait déjà tout le travail
 * de restriction par rôle : un admin voit/gère tout le monde, un manager
 * (= directeur, autorité globale) voit tout le monde mais ne peut ni créer
 * ni modifier (policies "admin uniquement" sur insert/update), un salarié ne
 * verrait que sa propre ligne — voir BASE-DE-DONNEES.md.
 */

interface UtilisateurRow {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  date_entree: string;
  nature_contrat: UtilisateurAdmin["natureContrat"];
  taux_activite: number | string;
  anciennete_date_reference: string | null;
  role: UtilisateurAdmin["role"];
  statut: UtilisateurAdmin["statut"];
  date_archivage: string | null;
  cree_par_id: string | null;
  created_at: string;
}

/**
 * Pas d'embed `cree_par:utilisateurs!cree_par_id(...)` (21/08/2026,
 * correctif) — `utilisateurs` s'auto-référence via `cree_par_id`, et
 * PostgREST a résolu ce hint dans le mauvais sens en pratique (la ligne qui
 * RÉFÉRENCE celle-ci plutôt que celle qu'elle référence : la fiche de
 * Delphine affichait "Test SoldeInit" comme créatrice, l'inverse de la
 * réalité), et le hint nommant explicitement la contrainte FK
 * (`utilisateurs_cree_par_id_fkey`, confirmée existante en base) échoue lui
 * avec "relationship not found" — cache de schéma PostgREST qui ne
 * l'associe pas correctement pour ce cas d'auto-référence. Plus simple et
 * plus robuste : `creeParNom` résolu par une requête séparée
 * (`fetchNomUtilisateur`), uniquement là où affiché (fiche détail).
 */
const SELECT_UTILISATEUR =
  "id, prenom, nom, email, date_entree, nature_contrat, taux_activite, anciennete_date_reference, role, statut, date_archivage, cree_par_id, created_at";

function mapUtilisateurDepuisDb(row: UtilisateurRow): UtilisateurAdmin {
  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    email: row.email,
    dateEntree: row.date_entree,
    natureContrat: row.nature_contrat,
    tauxActivite: Number(row.taux_activite),
    ancienneteDateReference: row.anciennete_date_reference,
    role: row.role,
    statut: row.statut,
    dateArchivage: row.date_archivage,
    creeParId: row.cree_par_id,
    creeParNom: undefined,
    createdAt: row.created_at,
  };
}

async function fetchNomUtilisateur(
  supabase: ReturnType<typeof createClient>,
  utilisateurId: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from("utilisateurs")
    .select("prenom, nom")
    .eq("id", utilisateurId)
    .maybeSingle();
  return data ? `${data.prenom} ${data.nom}` : undefined;
}

/**
 * `tauxActivite`/`natureContrat` sont exclus des params de modification
 * (21/08/2026) — ces deux champs ne se changent plus via une mise à jour
 * directe du profil mais via `changerTauxActivite`/`changerNatureContrat`
 * (popin dédiée + date d'effet, voir `historique_utilisateur`), pour éviter
 * un recalcul rétroactif du solde. Ils restent transmis à la création
 * (`creerUtilisateurAdmin`), où il n'y a par définition pas encore
 * d'historique.
 */
function paramsDepuisInput(input: UtilisateurAdminInput) {
  return {
    prenom: input.prenom,
    nom: input.nom,
    email: input.email,
    date_entree: input.dateEntree,
    nature_contrat: input.natureContrat,
    taux_activite: input.tauxActivite,
    anciennete_date_reference: input.ancienneteDateReference || null,
    role: input.role,
  };
}

function paramsModificationDepuisInput(input: UtilisateurAdminInput) {
  return {
    prenom: input.prenom,
    nom: input.nom,
    email: input.email,
    date_entree: input.dateEntree,
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

  const utilisateur = mapUtilisateurDepuisDb(data);
  if (utilisateur.creeParId) {
    utilisateur.creeParNom = await fetchNomUtilisateur(supabase, utilisateur.creeParId);
  }
  return utilisateur;
}

export async function creerUtilisateurAdmin(
  input: UtilisateurAdminInput,
  soldeInitial?: SoldeInitial,
): Promise<UtilisateurAdmin> {
  const supabase = createClient();
  const auteurId = await getUtilisateurIdCourant(supabase);

  const { data, error } = await supabase
    .from("utilisateurs")
    .insert({ ...paramsDepuisInput(input), cree_par_id: auteurId })
    .select(SELECT_UTILISATEUR)
    .single();

  if (error || !data) {
    throw new Error("Impossible de créer ce profil (email déjà utilisé ?).");
  }

  if (soldeInitial) {
    await enregistrerSoldeInitial(data.id, soldeInitial);
  }

  return mapUtilisateurDepuisDb(data);
}

interface SoldeInitialRow {
  date_reference: string;
  cp: number | string;
  rtt: number | string;
  cpa: number | string;
}

/** Report de la dernière fiche de paie (21/08/2026, lancement en prod) — une
 * seule ligne par utilisateur, `null` si jamais saisie. */
export async function fetchSoldeInitial(utilisateurId: string): Promise<SoldeInitial | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("soldes_initiaux")
    .select("date_reference, cp, rtt, cpa")
    .eq("utilisateur_id", utilisateurId)
    .maybeSingle();

  if (error) {
    throw new Error("Impossible de charger le solde initial de ce profil.");
  }
  if (!data) return null;

  const row = data as SoldeInitialRow;
  return {
    dateReference: row.date_reference,
    cp: Number(row.cp),
    rtt: Number(row.rtt),
    cpa: Number(row.cpa),
  };
}

/** Enregistre (création ou correction — upsert sur `utilisateur_id`, unique)
 * le solde initial d'un profil. Pas d'historique ni de date d'effet ici : une
 * correction écrase simplement la valeur précédente. */
export async function enregistrerSoldeInitial(
  utilisateurId: string,
  input: SoldeInitial,
): Promise<void> {
  const supabase = createClient();
  const auteurId = await getUtilisateurIdCourant(supabase);

  const { error } = await supabase.from("soldes_initiaux").upsert(
    {
      utilisateur_id: utilisateurId,
      date_reference: input.dateReference,
      cp: input.cp,
      rtt: input.rtt,
      cpa: input.cpa,
      auteur_id: auteurId,
    },
    { onConflict: "utilisateur_id" },
  );

  if (error) {
    throw new Error("Impossible d'enregistrer le solde initial.");
  }
}

export async function modifierUtilisateurAdmin(
  id: string,
  input: UtilisateurAdminInput,
): Promise<UtilisateurAdmin> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("utilisateurs")
    .update(paramsModificationDepuisInput(input))
    .eq("id", id)
    .select(SELECT_UTILISATEUR)
    .single();

  if (error || !data) {
    throw new Error("Impossible de modifier ce profil.");
  }

  return mapUtilisateurDepuisDb(data);
}

interface HistoriqueUtilisateurRow {
  id: string;
  champ: ChampHistoriqueUtilisateur;
  ancienne_valeur: string | null;
  nouvelle_valeur: string;
  date_effet: string;
  auteur_id: string | null;
  created_at: string;
  auteur: { prenom: string; nom: string } | { prenom: string; nom: string }[] | null;
}

function mapHistoriqueDepuisDb(row: HistoriqueUtilisateurRow): HistoriqueUtilisateurEntry {
  const auteurRow = Array.isArray(row.auteur) ? row.auteur[0] : row.auteur;

  return {
    id: row.id,
    champ: row.champ,
    ancienneValeur: row.ancienne_valeur,
    nouvelleValeur: row.nouvelle_valeur,
    dateEffet: row.date_effet,
    auteurId: row.auteur_id,
    auteurNom: auteurRow ? `${auteurRow.prenom} ${auteurRow.nom}` : undefined,
    createdAt: row.created_at,
  };
}

/** Historique des changements de durée de travail / nature de contrat d'un
 * profil, les deux champs mélangés (voir "Suivi des modifications" sur la
 * fiche utilisateur) — trié `date_effet` décroissant (le plus récent en
 * premier). */
export async function fetchHistoriqueUtilisateur(
  utilisateurId: string,
): Promise<HistoriqueUtilisateurEntry[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("historique_utilisateur")
    .select(
      "id, champ, ancienne_valeur, nouvelle_valeur, date_effet, auteur_id, created_at, auteur:utilisateurs!auteur_id(prenom, nom)",
    )
    .eq("utilisateur_id", utilisateurId)
    .order("date_effet", { ascending: false });

  if (error) {
    throw new Error("Impossible de charger l'historique de ce profil.");
  }

  return (data ?? []).map(mapHistoriqueDepuisDb);
}

async function changerChamp(
  utilisateurId: string,
  champ: ChampHistoriqueUtilisateur,
  colonne: "taux_activite" | "nature_contrat",
  input: ChangerChampInput,
): Promise<void> {
  const supabase = createClient();
  const auteurId = await getUtilisateurIdCourant(supabase);

  const { data: utilisateurRow, error: erreurLecture } = await supabase
    .from("utilisateurs")
    .select(colonne)
    .eq("id", utilisateurId)
    .single();

  if (erreurLecture || !utilisateurRow) {
    throw new Error("Utilisateur introuvable.");
  }

  const { error: erreurHistorique } = await supabase.from("historique_utilisateur").insert({
    utilisateur_id: utilisateurId,
    champ,
    ancienne_valeur: String(utilisateurRow[colonne as keyof typeof utilisateurRow]),
    nouvelle_valeur: input.valeur,
    date_effet: input.dateEffet,
    auteur_id: auteurId,
  });

  if (erreurHistorique) {
    throw new Error("Impossible d'enregistrer ce changement.");
  }

  const valeurColonne = colonne === "taux_activite" ? Number(input.valeur) : input.valeur;
  const { error: erreurMaj } = await supabase
    .from("utilisateurs")
    .update({ [colonne]: valeurColonne })
    .eq("id", utilisateurId);

  if (erreurMaj) {
    throw new Error("Impossible d'enregistrer ce changement.");
  }
}

export async function changerTauxActivite(
  utilisateurId: string,
  input: ChangerChampInput,
): Promise<void> {
  return changerChamp(utilisateurId, "taux_activite", "taux_activite", input);
}

export async function changerNatureContrat(
  utilisateurId: string,
  input: ChangerChampInput,
): Promise<void> {
  return changerChamp(utilisateurId, "nature_contrat", "nature_contrat", input);
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
