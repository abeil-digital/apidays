import { NextRequest, NextResponse } from "next/server";
import { fetchBrandingParSlug } from "@/lib/data/brandingPublic";

/**
 * Résolution publique du branding par sous-domaine ou par chemin — appelée
 * depuis `app/connexion/page.tsx` et `app/connexion/definir-mot-de-passe/page.tsx`
 * (avant authentification, donc la RLS de `entreprises` — restreinte à sa
 * propre entreprise une fois connecté — n'est d'aucun secours ici). Thin
 * wrapper HTTP autour de `fetchBrandingParSlug` (`lib/data/brandingPublic.ts`,
 * 09/09/2026, extrait pour être aussi appelable directement depuis un Server
 * Component sans aller-retour HTTP — voir
 * `app/connexion/confirmer/[type]/page.tsx`).
 *
 * Sous-domaine dérivé du premier label de l'en-tête `Host` (ex. `abeil`
 * dans `abeil.mondomaine.fr`) — retombe sur `abeil` pour localhost/le
 * domaine Vercel nu (pas de sous-domaine réel encore, Phase 0). `?slug=`
 * en query param : résolution par CHEMIN (09/09/2026, `app/t/[slug]/route.ts`
 * redirige vers `/connexion?slug=...`) — utilisable dès aujourd'hui sans
 * DNS/domaine dédié, contrairement au sous-domaine ; les deux mécanismes
 * coexistent, `?slug=` est prioritaire sur `Host` quand les deux sont
 * présents.
 */
export async function GET(request: NextRequest) {
  const slugTest = request.nextUrl.searchParams.get("slug");
  const host = request.headers.get("host") ?? "";
  const premierLabel = host.split(".")[0]?.split(":")[0] ?? "";
  const slug = slugTest || (host.split(".").length >= 3 ? premierLabel : "abeil");

  const branding = await fetchBrandingParSlug(slug);
  return NextResponse.json(branding);
}
