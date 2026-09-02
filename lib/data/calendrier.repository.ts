import type {
  CongeImpose,
  CongeImposeInput,
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
import {
  calculerNbDemiJournees,
  getUtilisateurId,
  retirerDemande,
} from "@/lib/data/demandes.repository";
import { fetchUtilisateursAdmin } from "@/lib/data/utilisateurs.repository";

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
  valide_le: string | null;
}

const SELECT_PARAMETRAGE_PERIODE =
  "id, annee, semaine_aout_imposee, nb_demi_journees_cible, jour_semaine_defaut, valide_le";

function mapParametragePeriodeDepuisDb(row: ParametragePeriodeRow): ParametragePeriode {
  return {
    id: row.id,
    annee: row.annee,
    semaineAoutImposee: row.semaine_aout_imposee,
    nbDemiJourneesCible: row.nb_demi_journees_cible,
    jourSemaineDefaut: row.jour_semaine_defaut,
    valideLe: row.valide_le,
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

/** Publie le paramétrage de l'année — le rend visible par les collaborateurs. */
export async function publierParametragePeriode(id: string): Promise<ParametragePeriode> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("parametrage_periode")
    .update({ valide_le: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_PARAMETRAGE_PERIODE)
    .single();

  if (error || !data) {
    throw new Error("Impossible de publier le paramétrage de l'année.");
  }

  return mapParametragePeriodeDepuisDb(data);
}

/** Annule la publication du paramétrage de l'année — repasse en brouillon. */
export async function depublierParametragePeriode(id: string): Promise<ParametragePeriode> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("parametrage_periode")
    .update({ valide_le: null })
    .eq("id", id)
    .select(SELECT_PARAMETRAGE_PERIODE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'annuler la publication du paramétrage de l'année.");
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

export async function ajouterDjImposee(
  parametragePeriodeId: string,
  input: DjImposeeInput,
): Promise<DjImposee> {
  const supabase = createClient();
  const typeAbsenceId = await getTypeAbsenceId(supabase, "DJ_IMPOSEE");

  const { data, error } = await supabase
    .from("demi_journees_imposees")
    .insert({
      parametrage_periode_id: parametragePeriodeId,
      type_absence_id: typeAbsenceId,
      date: input.date,
      demi_journee: input.demiJournee,
    })
    .select(SELECT_DJ_IMPOSEE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'ajouter cette demi-journée imposée.");
  }

  return mapDjImposeeDepuisDb(data);
}

export async function supprimerDjImposee(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("demi_journees_imposees").delete().eq("id", id);

  if (error) {
    throw new Error("Impossible de supprimer cette demi-journée imposée.");
  }
}

interface CongeImposeRow {
  id: string;
  date_debut: string;
  date_fin: string;
  demi_debut: DemiJournee;
  demi_fin: DemiJournee;
}

const SELECT_CONGE_IMPOSE = "id, date_debut, date_fin, demi_debut, demi_fin";

function mapCongeImposeDepuisDb(row: CongeImposeRow): CongeImpose {
  return {
    id: row.id,
    debut: row.date_debut,
    fin: row.date_fin,
    demiDebut: row.demi_debut,
    demiFin: row.demi_fin,
  };
}

export async function fetchCongesImposes(parametragePeriodeId: string): Promise<CongeImpose[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("conges_imposes")
    .select(SELECT_CONGE_IMPOSE)
    .eq("parametrage_periode_id", parametragePeriodeId)
    .order("date_debut", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les congés imposés.");
  }

  return (data ?? []).map(mapCongeImposeDepuisDb);
}

/**
 * Ajoute une période de congés imposés — et, depuis le 29/08/2026 ("mêmes
 * règles de gestion que des CP normaux"), une vraie ligne `demandes_conges`
 * (type CP, statut validée) par collaborateur actif, liée à la période via
 * `conge_impose_id`. Ces lignes traversent ensuite tout le pipeline
 * solde/export paie existant sans aucun changement de code ailleurs
 * (`fetchSoldes`, `fetchDemandesAvecSoldeTransmission`/`genererExportPaie`
 * ne filtrent ni sur l'origine ni sur l'utilisateur).
 *
 * `nbDemiJournees` est calculé AVANT l'insertion de la période elle-même :
 * `calculerNbDemiJournees` déduit déjà les CPI existants sur la plage — s'il
 * incluait la période en cours de création, il se soustrairait à lui-même et
 * renverrait 0. Fériés/DJI déjà en base restent correctement déduits, la
 * même valeur s'applique à tous (donnée d'entreprise, pas personnelle).
 */
export async function ajouterCongeImpose(
  parametragePeriodeId: string,
  input: CongeImposeInput,
): Promise<CongeImpose> {
  const supabase = createClient();
  const [typeAbsenceId, typeCpId, nbDemiJournees, auteurId, utilisateurs] = await Promise.all([
    getTypeAbsenceId(supabase, "CP_IMPOSE"),
    getTypeAbsenceId(supabase, "CP"),
    calculerNbDemiJournees(supabase, input.debut, input.fin, input.demiDebut, input.demiFin),
    getUtilisateurId(supabase),
    fetchUtilisateursAdmin(),
  ]);

  const { data, error } = await supabase
    .from("conges_imposes")
    .insert({
      parametrage_periode_id: parametragePeriodeId,
      type_absence_id: typeAbsenceId,
      date_debut: input.debut,
      date_fin: input.fin,
      demi_debut: input.demiDebut,
      demi_fin: input.demiFin,
    })
    .select(SELECT_CONGE_IMPOSE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'ajouter cette période de congés imposés.");
  }

  const congeImpose = mapCongeImposeDepuisDb(data);
  const actifs = utilisateurs.filter((u) => u.statut === "actif");
  const commentaire = `Congé imposé du ${input.debut} au ${input.fin}`;

  if (actifs.length > 0) {
    const { error: errorDemandes } = await supabase.from("demandes_conges").insert(
      actifs.map((u) => ({
        utilisateur_id: u.id,
        type_absence_id: typeCpId,
        date_debut: input.debut,
        date_fin: input.fin,
        demi_debut: input.demiDebut,
        demi_fin: input.demiFin,
        nb_demi_journees: nbDemiJournees,
        is_anticipation: false,
        statut: "validee",
        validateur_id: auteurId,
        commentaire_decision: commentaire,
        date_decision: new Date().toISOString(),
        conge_impose_id: congeImpose.id,
      })),
    );

    if (errorDemandes) {
      throw new Error(
        "Congé imposé créé mais impossible de générer les demandes associées aux collaborateurs.",
      );
    }
  }

  return congeImpose;
}

/**
 * Supprime une période de congés imposés — annule d'abord (statut →
 * `annulé`, via `retirerDemande`, jamais un hard delete) toutes les
 * demandes générées pour cette période qui sont encore validées ; la
 * correction est générée automatiquement au prochain export si l'une
 * d'elles était déjà transmise (même mécanisme que l'annulation d'un CP
 * normal déjà transmis, voir `DetailCongePanel`/`peutAnnulerDejaTransmis`).
 */
export async function supprimerCongeImpose(id: string): Promise<void> {
  const supabase = createClient();

  const { data: demandesLiees, error: errorSelect } = await supabase
    .from("demandes_conges")
    .select("id")
    .eq("conge_impose_id", id)
    .eq("statut", "validee");

  if (errorSelect) {
    throw new Error("Impossible de supprimer cette période de congés imposés.");
  }

  for (const demande of demandesLiees ?? []) {
    await retirerDemande(demande.id, "Congé imposé supprimé");
  }

  // Pas de `.select().single()` après le delete : ça exigerait exactement
  // une ligne renvoyée et lèverait une erreur si la période a déjà été
  // supprimée (double-clic, état local pas encore resynchronisé) — un delete
  // qui ne trouve rien n'est pas une erreur en soi.
  const { error } = await supabase.from("conges_imposes").delete().eq("id", id);

  if (error) {
    throw new Error("Impossible de supprimer cette période de congés imposés.");
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

  const { error } = await supabase.from("jours_feries").delete().eq("id", id);

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
