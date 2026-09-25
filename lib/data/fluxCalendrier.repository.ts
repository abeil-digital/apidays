import { createClient } from "@/lib/supabase/client";

/**
 * Réglages du flux ICS des absences (25/09/2026) — deux colonnes de
 * `parametrage_notifications` (une ligne par entreprise, RLS manager/admin),
 * lues/écrites côté navigateur. Le flux lui-même est servi par
 * `app/api/flux-calendrier/[token]/route.ts`.
 */
export interface FluxCalendrier {
  actif: boolean;
  token: string | null;
}

/** 32 octets aléatoires en base64url (43 caractères) — le token est le seul
 * secret de l'URL publique, `crypto.getRandomValues` est cryptographique. */
function genererToken(): string {
  const octets = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...octets))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function fetchFluxCalendrier(): Promise<FluxCalendrier> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("parametrage_notifications")
    .select("flux_calendrier_actif, flux_calendrier_token")
    .single();

  if (error || !data) {
    throw new Error("Impossible de charger les réglages du flux calendrier.");
  }
  return { actif: data.flux_calendrier_actif, token: data.flux_calendrier_token };
}

async function enregistrer(actif: boolean, token: string | null): Promise<FluxCalendrier> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("parametrage_notifications")
    .update({ flux_calendrier_actif: actif, flux_calendrier_token: token })
    .not("entreprise_id", "is", null)
    .select("flux_calendrier_actif, flux_calendrier_token")
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer les réglages du flux calendrier.");
  }
  return { actif: data.flux_calendrier_actif, token: data.flux_calendrier_token };
}

/** Active le flux, en créant le token à la première activation. */
export function activerFluxCalendrier(courant: FluxCalendrier): Promise<FluxCalendrier> {
  return enregistrer(true, courant.token ?? genererToken());
}

/** Désactive le flux — le token est conservé (la même adresse fonctionne à
 * nouveau à la réactivation) ; seule la régénération invalide l'adresse. */
export function desactiverFluxCalendrier(courant: FluxCalendrier): Promise<FluxCalendrier> {
  return enregistrer(false, courant.token);
}

/** Nouveau token : l'ancienne adresse cesse immédiatement de fonctionner. */
export function regenererFluxCalendrier(courant: FluxCalendrier): Promise<FluxCalendrier> {
  return enregistrer(courant.actif, genererToken());
}
