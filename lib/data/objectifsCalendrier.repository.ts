import type { ObjectifsCalendrier, ObjectifsCalendrierInput } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Repository des objectifs annuels CPI/DJI (`objectifs_calendrier`) — table
 * singleton (une seule ligne PAR ENTREPRISE depuis le 09/09/2026, clé
 * primaire `entreprise_id`), réglée depuis Paramétrer > Congés & RTT et
 * consommée par l'écran Calendrier. RLS : lecture large authentifiée,
 * écriture manager/admin, comme `regles_acquisition` — filtre déjà sur
 * `entreprise_id = my_entreprise_id()`, donc `.single()` résout directement
 * la ligne de l'entreprise courante sans filtre explicite côté client. Sauf
 * pour l'`UPDATE` : PostgREST exige une clause `WHERE` explicite dans la
 * requête indépendamment de la RLS, d'où le `.not("entreprise_id", "is",
 * null)` ci-dessous (toujours vrai, PK NOT NULL — sert uniquement à
 * satisfaire cette exigence syntaxique).
 */

interface ObjectifsCalendrierRow {
  cible_jours_cpi: number | string;
  cible_demi_journees_dji: number;
}

const SELECT_OBJECTIFS_CALENDRIER = "cible_jours_cpi, cible_demi_journees_dji";

function mapObjectifsCalendrierDepuisDb(row: ObjectifsCalendrierRow): ObjectifsCalendrier {
  return {
    cibleJoursCpi: Number(row.cible_jours_cpi),
    cibleDemiJourneesDji: row.cible_demi_journees_dji,
  };
}

export async function fetchObjectifsCalendrier(): Promise<ObjectifsCalendrier> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("objectifs_calendrier")
    .select(SELECT_OBJECTIFS_CALENDRIER)
    .single();

  if (error || !data) {
    throw new Error("Impossible de charger les objectifs CPI/DJI.");
  }

  return mapObjectifsCalendrierDepuisDb(data);
}

export async function enregistrerObjectifsCalendrier(
  input: ObjectifsCalendrierInput,
): Promise<ObjectifsCalendrier> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("objectifs_calendrier")
    .update({
      cible_jours_cpi: input.cibleJoursCpi,
      cible_demi_journees_dji: input.cibleDemiJourneesDji,
    })
    .not("entreprise_id", "is", null)
    .select(SELECT_OBJECTIFS_CALENDRIER)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer les objectifs CPI/DJI.");
  }

  return mapObjectifsCalendrierDepuisDb(data);
}
