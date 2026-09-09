import type {
  NotifDecisionCollaborateur,
  ParametrageNotifications,
  ParametrageNotificationsInput,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Repository des réglages de notification email (`parametrage_notifications`)
 * — table singleton (une seule ligne PAR ENTREPRISE depuis le 09/09/2026, clé
 * primaire `entreprise_id`), même idiome que `objectifs_calendrier` — RLS
 * filtre déjà sur `entreprise_id = my_entreprise_id()`, plus besoin de
 * filtre explicite côté client.
 */

interface ParametrageNotificationsRow {
  frequence: "immediate" | "hebdomadaire";
  jour_recap: number;
  heure_recap: number;
  copie_administrateur: boolean;
  notif_decision_collaborateur: NotifDecisionCollaborateur;
}

const SELECT_PARAMETRAGE_NOTIFICATIONS =
  "frequence, jour_recap, heure_recap, copie_administrateur, notif_decision_collaborateur";

function mapParametrageNotificationsDepuisDb(
  row: ParametrageNotificationsRow,
): ParametrageNotifications {
  return {
    frequence: row.frequence,
    jourRecap: row.jour_recap,
    heureRecap: row.heure_recap,
    copieAdministrateur: row.copie_administrateur,
    notifDecisionCollaborateur: row.notif_decision_collaborateur,
  };
}

export async function fetchParametrageNotifications(): Promise<ParametrageNotifications> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("parametrage_notifications")
    .select(SELECT_PARAMETRAGE_NOTIFICATIONS)
    .single();

  if (error || !data) {
    throw new Error("Impossible de charger les réglages de notification.");
  }

  return mapParametrageNotificationsDepuisDb(data);
}

export async function mettreAJourParametrageNotifications(
  input: ParametrageNotificationsInput,
): Promise<ParametrageNotifications> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("parametrage_notifications")
    .update({
      frequence: input.frequence,
      jour_recap: input.jourRecap,
      heure_recap: input.heureRecap,
      copie_administrateur: input.copieAdministrateur,
      notif_decision_collaborateur: input.notifDecisionCollaborateur,
    })
    .select(SELECT_PARAMETRAGE_NOTIFICATIONS)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer les réglages de notification.");
  }

  return mapParametrageNotificationsDepuisDb(data);
}
