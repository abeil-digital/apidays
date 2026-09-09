import { createClient } from "@/lib/supabase/server";

export interface Branding {
  couleurNavy: string;
  couleurJaune: string;
  logoUrl: string | null;
  logoUrlFondClair: string | null;
  logoUrlSigne: string | null;
}

/** Défaut = charte Abeil actuelle (`app/globals.css`) — filet de sécurité,
 * ne devrait normalement jamais servir : `proxy.ts` garantit déjà une
 * session pour toute route de l'app connectée. Logos à `null` : fallback
 * sur les fichiers Abeil en dur côté composant (HeaderBar.tsx/SideNav.tsx). */
const DEFAULT_BRANDING: Branding = {
  couleurNavy: "#001e32",
  couleurJaune: "#ebc850",
  logoUrl: null,
  logoUrlFondClair: null,
  logoUrlSigne: null,
};

/**
 * Couleurs de la charte de l'entreprise de l'utilisateur connecté
 * (09/09/2026, phase branding du chantier multi-tenant) — server-only
 * (`lib/supabase/server.ts`, pas le client navigateur), appelé depuis
 * `app/(app)/layout.tsx`.
 *
 * Pas de `.eq()` nécessaire : même principe singleton que
 * `objectifs_calendrier`/`parametrage_notifications` — la policy RLS sur
 * `entreprises` (`using (id = my_entreprise_id())`) restreint déjà
 * `.single()` à la ligne de l'entreprise de l'utilisateur connecté.
 */
export async function fetchBrandingCourant(): Promise<Branding> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("entreprises")
    .select("couleur_navy, couleur_yellow, logo_url, logo_url_fond_clair, logo_url_signe")
    .single();

  if (!data) return DEFAULT_BRANDING;

  return {
    couleurNavy: data.couleur_navy,
    couleurJaune: data.couleur_yellow,
    logoUrl: data.logo_url,
    logoUrlFondClair: data.logo_url_fond_clair,
    logoUrlSigne: data.logo_url_signe,
  };
}
