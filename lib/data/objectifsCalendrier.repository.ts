import type { ObjectifsCalendrier, ObjectifsCalendrierInput } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Repository des objectifs annuels CPI/DJI (`objectifs_calendrier`) — table
 * singleton (une seule ligne, id fixe), réglée depuis Paramétrer > Congés &
 * RTT et consommée par l'écran Calendrier. RLS : lecture large authentifiée,
 * écriture manager/admin, comme `regles_acquisition`.
 */

const ID_SINGLETON = "00000000-0000-0000-0000-000000000001";

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
    .eq("id", ID_SINGLETON)
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
    .eq("id", ID_SINGLETON)
    .select(SELECT_OBJECTIFS_CALENDRIER)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer les objectifs CPI/DJI.");
  }

  return mapObjectifsCalendrierDepuisDb(data);
}
