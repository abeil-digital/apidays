import type {
  RegleAcquisition,
  RegleAcquisitionInput,
  RegleAnciennete,
  RegleAncienneteInput,
  TypeDemande,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { getTypeAbsenceId } from "@/lib/data/typesAbsences";

/**
 * Repository du moteur de calcul des soldes (écran Paramétrer > Congés &
 * RTT) — `regles_acquisition` (une ligne par type d'absence, upsert) et
 * `regles_anciennete` (plusieurs lignes, rattachées aux CP uniquement pour
 * l'instant). RLS : lecture large authentifiée, écriture manager/admin,
 * comme `parametrage_periode` — voir BASE-DE-DONNEES.md.
 */

interface RegleAcquisitionRow {
  id: string;
  periode_debut_mois: number;
  periode_debut_jour: number;
  taux_acquisition_mensuel: number | string;
  report_autorise: boolean;
  anticipation_autorisee: boolean;
  types_absences: { code: TypeDemande } | { code: TypeDemande }[] | null;
}

const SELECT_REGLE_ACQUISITION =
  "id, periode_debut_mois, periode_debut_jour, taux_acquisition_mensuel, report_autorise, anticipation_autorisee, types_absences(code)";

function mapRegleAcquisitionDepuisDb(row: RegleAcquisitionRow): RegleAcquisition {
  const typeAbsence = Array.isArray(row.types_absences)
    ? row.types_absences[0]
    : row.types_absences;

  return {
    id: row.id,
    typeAbsence: typeAbsence?.code ?? "CP",
    periodeDebutMois: row.periode_debut_mois,
    periodeDebutJour: row.periode_debut_jour,
    tauxAcquisitionMensuel: Number(row.taux_acquisition_mensuel),
    reportAutorise: row.report_autorise,
    anticipationAutorisee: row.anticipation_autorisee,
  };
}

export async function fetchReglesAcquisition(): Promise<RegleAcquisition[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("regles_acquisition")
    .select(SELECT_REGLE_ACQUISITION);

  if (error) {
    throw new Error("Impossible de charger les règles d'acquisition.");
  }

  return (data ?? []).map(mapRegleAcquisitionDepuisDb);
}

/**
 * Crée ou remplace la règle d'acquisition d'un type d'absence (contrainte
 * `unique (type_absence_id)` côté base → upsert plutôt qu'insert/update).
 */
export async function enregistrerRegleAcquisition(
  type: TypeDemande,
  input: RegleAcquisitionInput,
): Promise<RegleAcquisition> {
  const supabase = createClient();
  const typeAbsenceId = await getTypeAbsenceId(supabase, type);

  const { data, error } = await supabase
    .from("regles_acquisition")
    .upsert(
      {
        type_absence_id: typeAbsenceId,
        periode_debut_mois: input.periodeDebutMois,
        periode_debut_jour: input.periodeDebutJour,
        taux_acquisition_mensuel: input.tauxAcquisitionMensuel,
        report_autorise: input.reportAutorise,
        anticipation_autorisee: input.anticipationAutorisee,
      },
      { onConflict: "type_absence_id" },
    )
    .select(SELECT_REGLE_ACQUISITION)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer la règle d'acquisition.");
  }

  return mapRegleAcquisitionDepuisDb(data);
}

interface RegleAncienneteRow {
  id: string;
  seuil_annees: number;
  jours_supplementaires: number | string;
}

const SELECT_REGLE_ANCIENNETE = "id, seuil_annees, jours_supplementaires";

function mapRegleAncienneteDepuisDb(row: RegleAncienneteRow): RegleAnciennete {
  return {
    id: row.id,
    seuilAnnees: row.seuil_annees,
    joursSupplementaires: Number(row.jours_supplementaires),
  };
}

// Ancienneté rattachée aux CP uniquement (voir brief) — RTT non concerné.
export async function fetchReglesAnciennete(): Promise<RegleAnciennete[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("regles_anciennete")
    .select(SELECT_REGLE_ANCIENNETE)
    .order("seuil_annees", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les règles d'ancienneté.");
  }

  return (data ?? []).map(mapRegleAncienneteDepuisDb);
}

export async function creerRegleAnciennete(input: RegleAncienneteInput): Promise<RegleAnciennete> {
  const supabase = createClient();
  const typeAbsenceId = await getTypeAbsenceId(supabase, "CP");

  const { data, error } = await supabase
    .from("regles_anciennete")
    .insert({
      type_absence_id: typeAbsenceId,
      seuil_annees: input.seuilAnnees,
      jours_supplementaires: input.joursSupplementaires,
    })
    .select(SELECT_REGLE_ANCIENNETE)
    .single();

  if (error || !data) {
    throw new Error("Impossible de créer cette règle.");
  }

  return mapRegleAncienneteDepuisDb(data);
}

export async function modifierRegleAnciennete(
  id: string,
  input: RegleAncienneteInput,
): Promise<RegleAnciennete> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("regles_anciennete")
    .update({
      seuil_annees: input.seuilAnnees,
      jours_supplementaires: input.joursSupplementaires,
    })
    .eq("id", id)
    .select(SELECT_REGLE_ANCIENNETE)
    .single();

  if (error || !data) {
    throw new Error("Impossible de modifier cette règle.");
  }

  return mapRegleAncienneteDepuisDb(data);
}

export async function supprimerRegleAnciennete(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("regles_anciennete").delete().eq("id", id);

  if (error) {
    throw new Error("Impossible de supprimer cette règle.");
  }
}
