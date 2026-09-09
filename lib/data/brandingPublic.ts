import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PublicBranding {
  nom: string;
  couleurNavy: string;
  couleurJaune: string;
  logoUrlFondClair: string | null;
}

// Filet de sécurité — mêmes valeurs que le défaut `entreprises` en base
// (`supabase/schema.sql`) et que `app/globals.css`. `logoUrlFondClair` à
// `null` : fallback sur le fichier Abeil en dur côté page consommatrice.
export const DEFAULT_PUBLIC_BRANDING: PublicBranding = {
  nom: "Abeil",
  couleurNavy: "#001e32",
  couleurJaune: "#ebc850",
  logoUrlFondClair: null,
};

/**
 * Résolution publique du branding (nom + couleurs + logo fond clair) d'UNE
 * SEULE entreprise, par `slug` (09/09/2026, extrait de
 * `app/api/branding-public/route.ts` pour être aussi appelable directement
 * depuis un Server Component — `app/connexion/confirmer/[type]/page.tsx` —
 * sans aller-retour HTTP).
 *
 * `service_role` en dur, mais volontairement cantonné à répondre pour LE
 * seul slug demandé — jamais une policy RLS ouverte à tous, qui
 * exposerait nom/couleurs de tous les clients à n'importe quel visiteur
 * non connecté. `slug` absent/vide ⇒ défaut Abeil sans requête DB.
 */
export async function fetchBrandingParSlug(
  slug: string | null | undefined,
): Promise<PublicBranding> {
  if (!slug) return DEFAULT_PUBLIC_BRANDING;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("entreprises")
      .select("nom, couleur_navy, couleur_yellow, logo_url_fond_clair")
      .eq("slug", slug)
      .single();

    if (!data) return DEFAULT_PUBLIC_BRANDING;

    return {
      nom: data.nom,
      couleurNavy: data.couleur_navy,
      couleurJaune: data.couleur_yellow,
      logoUrlFondClair: data.logo_url_fond_clair,
    };
  } catch {
    return DEFAULT_PUBLIC_BRANDING;
  }
}
