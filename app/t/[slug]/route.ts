import { NextRequest, NextResponse } from "next/server";

/**
 * Résolution du tenant par CHEMIN (09/09/2026) — alternative au sous-domaine
 * (`app/api/branding-public/route.ts`) utilisable dès aujourd'hui sans
 * DNS/domaine dédié : `/t/<slug>` redirige vers `/connexion?slug=<slug>`,
 * que `FormulaireConnexion` (`app/connexion/page.tsx`) utilise pour
 * résoudre le bon branding. Namespace `/t/` dédié (pas de slug à la racine,
 * ex. `/abeil`) pour ne jamais entrer en collision avec une route réelle de
 * l'app (`/suivre`, `/parametrer`, `/admin`...) — choix explicite avec
 * Vincent plutôt qu'une liste de slugs réservés à maintenir.
 *
 * Pas de vérification que le slug existe ici : simple redirection, la
 * résolution (et le fallback Abeil si le slug est inconnu) reste
 * entièrement dans `branding-public/route.ts`, pas dupliquée ici.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = request.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = "";
  url.searchParams.set("slug", slug);
  return NextResponse.redirect(url);
}
