import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Filet de sécurité — mêmes valeurs que le défaut `entreprises` en base
// (`supabase/schema.sql`) et que `app/globals.css`. `logoUrlFondClair` à
// `null` : fallback sur le fichier Abeil en dur côté page de connexion.
const DEFAULT_BRANDING = {
  nom: "Abeil",
  couleurNavy: "#001e32",
  couleurJaune: "#ebc850",
  logoUrlFondClair: null as string | null,
};

/**
 * Résolution publique du branding (nom + couleurs) d'UNE SEULE entreprise,
 * par sous-domaine — appelée depuis `app/connexion/page.tsx` (avant
 * authentification, donc la RLS de `entreprises` — restreinte à sa propre
 * entreprise une fois connecté — n'est d'aucun secours ici).
 *
 * `service_role` en dur pour l'appel `entreprises`, mais volontairement
 * cantonné à répondre pour LE seul sous-domaine demandé — jamais une
 * policy RLS ouverte à tous, qui exposerait nom/couleurs de tous les
 * clients à n'importe quel visiteur non connecté (09/09/2026, phase
 * routing du chantier multi-tenant).
 *
 * Sous-domaine dérivé du premier label de l'en-tête `Host` (ex. `abeil`
 * dans `abeil.mondomaine.fr`) — retombe sur `abeil` pour localhost/le
 * domaine Vercel nu (pas de sous-domaine réel encore, Phase 0). `?slug=`
 * en query param : uniquement pour les tests manuels en local, pas un
 * mécanisme de prod — un sous-domaine réel n'a jamais besoin de le passer,
 * l'en-tête `Host` suffit.
 */
export async function GET(request: NextRequest) {
  const slugTest = request.nextUrl.searchParams.get("slug");
  const host = request.headers.get("host") ?? "";
  const premierLabel = host.split(".")[0]?.split(":")[0] ?? "";
  const slug = slugTest || (host.split(".").length >= 3 ? premierLabel : "abeil");

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("entreprises")
      .select("nom, couleur_navy, couleur_yellow, logo_url_fond_clair")
      .eq("slug", slug)
      .single();

    if (!data) {
      return NextResponse.json(DEFAULT_BRANDING);
    }

    return NextResponse.json({
      nom: data.nom,
      couleurNavy: data.couleur_navy,
      couleurJaune: data.couleur_yellow,
      logoUrlFondClair: data.logo_url_fond_clair,
    });
  } catch {
    return NextResponse.json(DEFAULT_BRANDING);
  }
}
