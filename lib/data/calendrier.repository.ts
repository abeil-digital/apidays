import type {
  DemiJournee,
  DjImposee,
  DjImposeeInput,
  JourFerie,
  JourFerieInput,
  ParametragePeriode,
  ParametragePeriodeInput,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { getTypeAbsenceId } from "@/lib/data/typesAbsences";

/**
 * Repository de l'écran Paramétrer > Calendrier (`parametrage_periode`,
 * `demi_journees_imposees`, `jours_feries`). Les demi-journées imposées sont
 * un mécanisme indépendant du moteur de calcul de solde RTT paramétré dans
 * Congés & RTT (`regles_acquisition`) — catégorisées sous le code technique
 * `DJ_IMPOSEE` dans `types_absences`, jamais choisi par le salarié.
 */

interface ParametragePeriodeRow {
  id: string;
  annee: number;
  semaine_aout_imposee: string;
  nb_demi_journees_cible: number;
  jour_semaine_defaut: number;
}

const SELECT_PARAMETRAGE_PERIODE =
  "id, annee, semaine_aout_imposee, nb_demi_journees_cible, jour_semaine_defaut";

function mapParametragePeriodeDepuisDb(row: ParametragePeriodeRow): ParametragePeriode {
  return {
    id: row.id,
    annee: row.annee,
    semaineAoutImposee: row.semaine_aout_imposee,
    nbDemiJourneesCible: row.nb_demi_journees_cible,
    jourSemaineDefaut: row.jour_semaine_defaut,
  };
}

export async function fetchParametragePeriode(annee: number): Promise<ParametragePeriode | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("parametrage_periode")
    .select(SELECT_PARAMETRAGE_PERIODE)
    .eq("annee", annee)
    .maybeSingle();

  if (error) {
    throw new Error("Impossible de charger le paramétrage de l'année.");
  }

  return data ? mapParametragePeriodeDepuisDb(data) : null;
}

export async function enregistrerParametragePeriode(
  input: ParametragePeriodeInput,
): Promise<ParametragePeriode> {
  const supabase = createClient();

  const { data: utilisateurId } = await supabase.rpc("my_utilisateur_id");

  const { data, error } = await supabase
    .from("parametrage_periode")
    .upsert(
      {
        annee: input.annee,
        semaine_aout_imposee: input.semaineAoutImposee,
        nb_demi_journees_cible: input.nbDemiJourneesCible,
        jour_semaine_defaut: input.jourSemaineDefaut,
        defini_par: utilisateurId ?? null,
      },
      { onConflict: "annee" },
    )
    .select(SELECT_PARAMETRAGE_PERIODE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer le paramétrage de l'année.");
  }

  return mapParametragePeriodeDepuisDb(data);
}

interface DjImposeeRow {
  id: string;
  date: string;
  demi_journee: DemiJournee;
}

const SELECT_DJ_IMPOSEE = "id, date, demi_journee";

function mapDjImposeeDepuisDb(row: DjImposeeRow): DjImposee {
  return { id: row.id, date: row.date, demiJournee: row.demi_journee };
}

export async function fetchDjImposees(parametragePeriodeId: string): Promise<DjImposee[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("demi_journees_imposees")
    .select(SELECT_DJ_IMPOSEE)
    .eq("parametrage_periode_id", parametragePeriodeId)
    .order("date", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les demi-journées imposées.");
  }

  return (data ?? []).map(mapDjImposeeDepuisDb);
}

/**
 * Fige la liste des DJ imposées d'une période (bouton "Valider" de la vue
 * "Paramétrage année à venir") — remplace intégralement les lignes
 * existantes plutôt qu'un ajout incrémental, pour éviter tout doublon si le
 * manager reparamètre la même année plusieurs fois.
 */
export async function remplacerDjImposees(
  parametragePeriodeId: string,
  djs: DjImposeeInput[],
): Promise<DjImposee[]> {
  const supabase = createClient();
  const typeAbsenceId = await getTypeAbsenceId(supabase, "DJ_IMPOSEE");

  const { error: erreurSuppression } = await supabase
    .from("demi_journees_imposees")
    .delete()
    .eq("parametrage_periode_id", parametragePeriodeId);

  if (erreurSuppression) {
    throw new Error("Impossible de réinitialiser les demi-journées imposées.");
  }

  if (djs.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("demi_journees_imposees")
    .insert(
      djs.map((dj) => ({
        parametrage_periode_id: parametragePeriodeId,
        type_absence_id: typeAbsenceId,
        date: dj.date,
        demi_journee: dj.demiJournee,
      })),
    )
    .select(SELECT_DJ_IMPOSEE);

  if (error || !data) {
    throw new Error("Impossible d'enregistrer les demi-journées imposées.");
  }

  return data.map(mapDjImposeeDepuisDb);
}

/** Correction ponctuelle d'une DJ mal saisie (vue "Année en cours"). */
export async function modifierDjImposee(id: string, input: DjImposeeInput): Promise<DjImposee> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("demi_journees_imposees")
    .update({ date: input.date, demi_journee: input.demiJournee })
    .eq("id", id)
    .select(SELECT_DJ_IMPOSEE)
    .single();

  if (error || !data) {
    throw new Error("Impossible de modifier cette demi-journée imposée.");
  }

  return mapDjImposeeDepuisDb(data);
}

export async function supprimerDjImposee(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("demi_journees_imposees")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error("Impossible de supprimer cette demi-journée imposée.");
  }
}

interface JourFerieRow {
  id: string;
  date: string;
  libelle: string;
}

const SELECT_JOUR_FERIE = "id, date, libelle";

function mapJourFerieDepuisDb(row: JourFerieRow): JourFerie {
  return { id: row.id, date: row.date, libelle: row.libelle };
}

export async function fetchJoursFeries(annee: number): Promise<JourFerie[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("jours_feries")
    .select(SELECT_JOUR_FERIE)
    .gte("date", `${annee}-01-01`)
    .lte("date", `${annee}-12-31`)
    .order("date", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les jours fériés.");
  }

  return (data ?? []).map(mapJourFerieDepuisDb);
}

export async function ajouterJourFerie(input: JourFerieInput): Promise<JourFerie> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("jours_feries")
    .insert({ date: input.date, libelle: input.libelle })
    .select(SELECT_JOUR_FERIE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'ajouter ce jour férié (déjà existant ?).");
  }

  return mapJourFerieDepuisDb(data);
}

export async function supprimerJourFerie(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("jours_feries").delete().eq("id", id).select().single();

  if (error) {
    throw new Error("Impossible de supprimer ce jour férié.");
  }
}

/**
 * Pré-remplit les jours fériés légaux manquants pour une année (calcul
 * incluant Pâques mobile, voir `lib/joursFeries.ts`) — insertion silencieuse
 * des seules dates absentes, sans écraser un libellé personnalisé existant.
 */
export async function preRemplirJoursFeriesLegaux(
  annee: number,
  legaux: { date: string; libelle: string }[],
): Promise<JourFerie[]> {
  const supabase = createClient();
  const existants = await fetchJoursFeries(annee);
  const datesExistantes = new Set(existants.map((j) => j.date));
  const manquants = legaux.filter((j) => !datesExistantes.has(j.date));

  if (manquants.length === 0) {
    return existants;
  }

  const { data, error } = await supabase
    .from("jours_feries")
    .insert(manquants)
    .select(SELECT_JOUR_FERIE);

  if (error || !data) {
    throw new Error("Impossible de pré-remplir les jours fériés.");
  }

  return [...existants, ...data.map(mapJourFerieDepuisDb)].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
