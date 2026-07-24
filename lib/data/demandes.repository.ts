import type { SupabaseClient } from "@supabase/supabase-js";
import type { Demande, NouvelleDemandeInput, StatutDemande, TypeDemande } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Repository des demandes de congés/RTT.
 *
 * Branché sur Supabase (`demandes_conges`). La RLS limite déjà la lecture et
 * l'écriture aux demandes de l'utilisateur connecté — voir
 * BASE-DE-DONNEES.md. Le contrat (fonctions async retournant des `Demande[]`)
 * ne change pas, donc aucun hook ni composant n'est touché.
 */

interface DemandeRow {
  id: string;
  date_debut: string;
  date_fin: string;
  created_at: string;
  statut: string;
  commentaire_salarie: string | null;
  commentaire_decision: string | null;
  types_absences: { code: TypeDemande } | { code: TypeDemande }[] | null;
}

const SELECT_DEMANDE =
  "id, date_debut, date_fin, created_at, statut, commentaire_salarie, commentaire_decision, types_absences(code)";

// Aucune demande créée par l'app ne passe par "annulee" (pas de flux
// d'annulation côté salarié à ce stade) — voir projet.md.
const STATUT_DEPUIS_DB: Record<string, StatutDemande> = {
  en_attente: "en attente",
  validee: "validé",
  refusee: "refusé",
};

function mapDemandeDepuisDb(row: DemandeRow): Demande {
  const typeAbsence = Array.isArray(row.types_absences)
    ? row.types_absences[0]
    : row.types_absences;

  return {
    id: row.id,
    type: typeAbsence?.code ?? "CP",
    debut: row.date_debut,
    fin: row.date_fin,
    datePose: row.created_at.slice(0, 10),
    statut: STATUT_DEPUIS_DB[row.statut] ?? "en attente",
    note: row.commentaire_salarie ?? "",
    commentaireManager: row.commentaire_decision ?? "",
  };
}

async function getUtilisateurId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("my_utilisateur_id");
  if (error || !data) {
    throw new Error("Utilisateur non identifié.");
  }
  return data;
}

// Table de référence (2 lignes, CP/RTT) — mise en cache en mémoire, elle ne
// change pas en cours de session.
let typesAbsenceCache: Partial<Record<TypeDemande, string>> | null = null;

async function getTypeAbsenceId(supabase: SupabaseClient, type: TypeDemande): Promise<string> {
  if (!typesAbsenceCache) {
    const { data, error } = await supabase.from("types_absences").select("id, code");
    if (error || !data) {
      throw new Error("Impossible de charger les types d'absence.");
    }
    typesAbsenceCache = Object.fromEntries(data.map((t) => [t.code, t.id]));
  }

  const id = typesAbsenceCache![type];
  if (!id) {
    throw new Error(`Type d'absence inconnu : ${type}`);
  }
  return id;
}

/**
 * Nombre de demi-journées entre deux dates (incluses), jours fériés et
 * weekends exclus — voir BASE-DE-DONNEES.md. Demi-journées de début/fin non
 * gérées côté UI pour l'instant : chaque jour ouvré compte pour 2 demi-journées.
 */
async function calculerNbDemiJournees(
  supabase: SupabaseClient,
  debut: string,
  fin: string,
): Promise<number> {
  const { data: feries } = await supabase
    .from("jours_feries")
    .select("date")
    .gte("date", debut)
    .lte("date", fin);
  const joursFeries = new Set((feries ?? []).map((f: { date: string }) => f.date));

  let nbJoursOuvres = 0;
  const cursor = new Date(`${debut}T00:00:00`);
  const finDate = new Date(`${fin}T00:00:00`);

  while (cursor <= finDate) {
    const jourSemaine = cursor.getDay();
    const iso = cursor.toISOString().slice(0, 10);
    if (jourSemaine !== 0 && jourSemaine !== 6 && !joursFeries.has(iso)) {
      nbJoursOuvres += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return nbJoursOuvres * 2;
}

export async function fetchDemandes(): Promise<Demande[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("demandes_conges")
    .select(SELECT_DEMANDE)
    .neq("statut", "annulee")
    .order("date_debut", { ascending: false });

  if (error) {
    throw new Error("Impossible de charger les demandes.");
  }

  return (data ?? []).map(mapDemandeDepuisDb);
}

export async function creerDemande(input: NouvelleDemandeInput): Promise<Demande> {
  const supabase = createClient();

  const [utilisateurId, typeAbsenceId, nbDemiJournees] = await Promise.all([
    getUtilisateurId(supabase),
    getTypeAbsenceId(supabase, input.type),
    calculerNbDemiJournees(supabase, input.debut, input.fin),
  ]);

  const { data, error } = await supabase
    .from("demandes_conges")
    .insert({
      utilisateur_id: utilisateurId,
      type_absence_id: typeAbsenceId,
      date_debut: input.debut,
      date_fin: input.fin,
      nb_demi_journees: nbDemiJournees,
      commentaire_salarie: input.note || null,
    })
    .select(SELECT_DEMANDE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer la demande.");
  }

  return mapDemandeDepuisDb(data);
}

/**
 * Annule une demande en attente (retrait par le salarié lui-même). La policy
 * RLS "demandes: salarié modifie une demande en attente" n'autorise déjà que
 * ça — pas de vérification de statut à refaire ici. `.select().single()`
 * force une erreur si la ligne n'a pas été affectée (déjà traitée par un
 * manager, id inconnu...), au lieu du succès silencieux à 0 ligne que
 * renverrait un `update()` filtré par la RLS.
 *
 * Pas encore appelée par un hook/composant (aucune UI d'annulation pour
 * l'instant) — prête pour quand cette fonctionnalité sera spécifiée.
 */
export async function annulerDemande(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("demandes_conges")
    .update({ statut: "annulee" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error("Impossible d'annuler la demande (déjà traitée, ou introuvable).");
  }
}
