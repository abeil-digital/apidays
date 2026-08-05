import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Demande,
  DemiJournee,
  NouvelleDemandeInput,
  StatutDemande,
  TypeDemande,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { getTypeAbsenceId } from "@/lib/data/typesAbsences";

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
  demi_debut: DemiJournee;
  demi_fin: DemiJournee;
  nb_demi_journees: number;
  created_at: string;
  statut: string;
  is_anticipation: boolean;
  commentaire_salarie: string | null;
  commentaire_decision: string | null;
  types_absences: { code: TypeDemande } | { code: TypeDemande }[] | null;
}

const SELECT_DEMANDE =
  "id, date_debut, date_fin, demi_debut, demi_fin, nb_demi_journees, created_at, statut, is_anticipation, commentaire_salarie, commentaire_decision, types_absences(code)";

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
    isAnticipation: row.is_anticipation,
    debut: row.date_debut,
    fin: row.date_fin,
    demiDebut: row.demi_debut,
    demiFin: row.demi_fin,
    nbDemiJournees: Number(row.nb_demi_journees),
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

/**
 * Nombre de demi-journées entre deux dates (incluses), jours fériés et
 * weekends exclus — voir BASE-DE-DONNEES.md. Chaque jour ouvré compte pour 2
 * demi-journées, sauf le premier jour si `demiDebut = "apres_midi"` (matin
 * non posé) et le dernier jour si `demiFin = "matin"` (après-midi non posé) —
 * l'ajustement ne s'applique que si ce jour est effectivement un jour ouvré
 * du décompte (sinon demande sur un jour férié/weekend n'a pas de sens).
 */
async function calculerNbDemiJournees(
  supabase: SupabaseClient,
  debut: string,
  fin: string,
  demiDebut: DemiJournee,
  demiFin: DemiJournee,
): Promise<number> {
  const { data: feries } = await supabase
    .from("jours_feries")
    .select("date")
    .gte("date", debut)
    .lte("date", fin);
  const joursFeries = new Set((feries ?? []).map((f: { date: string }) => f.date));

  // Dates manipulées en UTC (Date.UTC) pour éviter tout décalage de fuseau
  // horaire côté navigateur — un `new Date(iso + "T00:00:00")` en UTC+1/+2
  // décale silencieusement le curseur d'un jour (minuit local = veille en UTC).
  const joursOuvres: string[] = [];
  const cursor = new Date(`${debut}T00:00:00Z`);
  const finDate = new Date(`${fin}T00:00:00Z`);

  while (cursor <= finDate) {
    const jourSemaine = cursor.getUTCDay();
    const iso = cursor.toISOString().slice(0, 10);
    if (jourSemaine !== 0 && jourSemaine !== 6 && !joursFeries.has(iso)) {
      joursOuvres.push(iso);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  let total = joursOuvres.length * 2;
  if (joursOuvres[0] === debut && demiDebut === "apres_midi") total -= 1;
  if (joursOuvres[joursOuvres.length - 1] === fin && demiFin === "matin") total -= 1;

  return total;
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
    calculerNbDemiJournees(supabase, input.debut, input.fin, input.demiDebut, input.demiFin),
  ]);

  const { data, error } = await supabase
    .from("demandes_conges")
    .insert({
      utilisateur_id: utilisateurId,
      type_absence_id: typeAbsenceId,
      date_debut: input.debut,
      date_fin: input.fin,
      demi_debut: input.demiDebut,
      demi_fin: input.demiFin,
      nb_demi_journees: nbDemiJournees,
      is_anticipation: input.isAnticipation,
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
