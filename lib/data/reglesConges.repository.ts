import type {
  AttributionBonusAnciennete,
  HistoriqueAttributionBonus,
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
 * RTT) — `regles_acquisition` (une ligne par type d'absence, upsert),
 * `regles_anciennete` (plusieurs lignes, rattachées aux CP uniquement pour
 * l'instant) et `historique_bonus_anciennete_attribution` (historisé, voir
 * `HistoriqueAttributionBonus`). RLS : lecture large authentifiée, écriture
 * manager/admin, comme `parametrage_periode` — voir BASE-DE-DONNEES.md.
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
 * `unique (entreprise_id, type_absence_id)` côté base depuis le passage
 * multi-tenant, 09/09/2026 → upsert plutôt qu'insert/update). `onConflict`
 * doit correspondre EXACTEMENT à cette contrainte composite (même bug que
 * celui trouvé sur `parametrage_periode` : un `onConflict` resté sur
 * `type_absence_id` seul ne correspond plus à aucune contrainte, PostgREST
 * rejette l'upsert avec 42P10 — cassait 100% des sauvegardes CP/RTT).
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
      { onConflict: "entreprise_id,type_absence_id" },
    )
    .select(SELECT_REGLE_ACQUISITION)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer la règle d'acquisition.");
  }

  return mapRegleAcquisitionDepuisDb(data);
}

interface HistoriqueAttributionBonusRow {
  id: string;
  valeur: AttributionBonusAnciennete;
  effective_depuis: string;
}

const SELECT_HISTORIQUE_ATTRIBUTION_BONUS = "id, valeur, effective_depuis";

function mapHistoriqueAttributionBonusDepuisDb(
  row: HistoriqueAttributionBonusRow,
): HistoriqueAttributionBonus {
  return { id: row.id, valeur: row.valeur, effectiveDepuis: row.effective_depuis };
}

/** Historique complet, trié du plus ancien au plus récent — le moteur de
 * calcul (`soldes.repository.ts`) a besoin de TOUTES les lignes pour
 * résoudre la valeur effective à une date donnée, pas seulement la plus
 * récente. */
export async function fetchHistoriqueAttributionBonus(): Promise<HistoriqueAttributionBonus[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("historique_bonus_anciennete_attribution")
    .select(SELECT_HISTORIQUE_ATTRIBUTION_BONUS)
    .order("effective_depuis", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger l'historique du bonus d'ancienneté.");
  }

  return (data ?? []).map(mapHistoriqueAttributionBonusDepuisDb);
}

/** Met en attente un changement de mode d'attribution — `effectiveDepuis`
 * doit être la date de début de la PROCHAINE bascule de période (calculée
 * par l'appelant, jamais aujourd'hui), sauf pour la toute première
 * configuration du tenant (aucun historique) qui peut s'appliquer
 * immédiatement. Upsert sur `(entreprise_id, effective_depuis)` : changer
 * d'avis avant la bascule met à jour la même ligne en attente plutôt que
 * d'en créer une seconde. */
export async function enregistrerAttributionBonus(
  valeur: AttributionBonusAnciennete,
  effectiveDepuis: string,
): Promise<HistoriqueAttributionBonus> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("historique_bonus_anciennete_attribution")
    .upsert(
      { valeur, effective_depuis: effectiveDepuis },
      { onConflict: "entreprise_id,effective_depuis" },
    )
    .select(SELECT_HISTORIQUE_ATTRIBUTION_BONUS)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer ce changement.");
  }

  return mapHistoriqueAttributionBonusDepuisDb(data);
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
