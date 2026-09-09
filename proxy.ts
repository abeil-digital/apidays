import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 : ce fichier remplace l'ancien middleware.ts (renommé "Proxy").
 * Rôle : rafraîchir la session Supabase à chaque requête (cookies), protéger
 * les routes de l'Espace Salarié tant qu'aucune session n'existe, bloquer
 * /parametrer/* et /suivre/* pour les salariés (manager/admin uniquement,
 * voir niveau1.ts), /admin/* pour tout le monde sauf les super-admins
 * (09/09/2026, flux d'onboarding d'un tenant — voir `super_admins` dans
 * `supabase/schema.sql`, statut orthogonal à `role`/`entreprise_id`, donc
 * vérifié séparément), et déconnecter un profil dont le contrat est terminé
 * (04/09/2026, "Fin de contrat" — voir `definirFinContrat` dans
 * `utilisateurs.repository.ts`). La RLS reste la protection de fond côté
 * données ; ceci n'est qu'une redirection optimiste côté route.
 *
 * `/admin/connexion` (09/09/2026) : page de login dédiée, neutre — pas la
 * charte du tenant résolu par sous-domaine, pour éviter la confusion
 * relevée par Vincent en testant ("problème logique de se connecter à
 * l'admin via un espace de login estampillé Abeil"). Un visiteur non
 * connecté sur /admin/* est redirigé ici plutôt que vers /connexion.
 */
const ROUTE_CONNEXION = "/connexion";
const ROUTE_ADMIN_CONNEXION = "/admin/connexion";
const PREFIXES_MANAGER_ADMIN = ["/parametrer", "/suivre"];
const PREFIXE_SUPER_ADMIN = "/admin";

// Routes accessibles sans session "réelle" (07/09/2026, parcours mot de
// passe) : toute la famille /connexion/* (login, mot de passe oublié,
// définition de mot de passe — cette dernière posée via une session
// temporaire par /auth/confirm, pas une vraie connexion) + /auth/confirm
// lui-même (pose justement cette session avant de rediriger).
// /api/cron/* (08/09/2026) : appelé par le cron Vercel, sans cookie de
// session — l'authentification s'y fait via `CRON_SECRET`, pas Supabase.
// /api/branding-public (09/09/2026) : appelé depuis la page de connexion
// elle-même, avant toute session — voir
// `app/api/branding-public/route.ts`.
// /t/<slug> (09/09/2026) : résolution du tenant par chemin, redirige vers
// /connexion avant toute session — voir `app/t/[slug]/route.ts`.
function estRoutePublique(pathname: string): boolean {
  return (
    pathname === "/auth/confirm" ||
    pathname === ROUTE_CONNEXION ||
    pathname.startsWith(`${ROUTE_CONNEXION}/`) ||
    pathname === ROUTE_ADMIN_CONNEXION ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/branding-public" ||
    pathname.startsWith("/t/")
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes (voir .env.local).",
    );
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPageDeConnexion =
    request.nextUrl.pathname === ROUTE_CONNEXION ||
    request.nextUrl.pathname === ROUTE_ADMIN_CONNEXION;
  const routePublique = estRoutePublique(request.nextUrl.pathname);

  if (!user && !routePublique) {
    // `next` (08/09/2026) : conserve la destination d'origine (ex. lien de
    // notification email vers `/suivre/demandes?statut=en_attente`) pour y
    // renvoyer une fois connecté, plutôt que de perdre le contexte et
    // atterrir sur l'Accueil — voir `app/connexion/actions.ts`. Un visiteur
    // non connecté sur /admin/* atterrit sur la page de login dédiée
    // (09/09/2026), pas la page de connexion tenant.
    const next = request.nextUrl.pathname + request.nextUrl.search;
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = request.nextUrl.pathname.startsWith(PREFIXE_SUPER_ADMIN)
      ? ROUTE_ADMIN_CONNEXION
      : ROUTE_CONNEXION;
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", next);
    return NextResponse.redirect(redirectUrl);
  }

  if (user) {
    // Une seule requête `utilisateurs`, réutilisée pour le blocage "fin de
    // contrat" ci-dessous ET la protection manager/admin existante — pas
    // deux allers-retours par requête.
    const { data } = await supabase
      .from("utilisateurs")
      .select("role, statut, date_fin_contrat")
      .eq("auth_id", user.id)
      .single();

    const aujourdhui = new Date().toISOString().slice(0, 10);
    const contratTermine =
      data?.statut === "archive" ||
      (!!data?.date_fin_contrat && data.date_fin_contrat <= aujourdhui);

    if (contratTermine) {
      await supabase.auth.signOut();
      if (!isPageDeConnexion) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = ROUTE_CONNEXION;
        return NextResponse.redirect(redirectUrl);
      }
      return response;
    }

    if (isPageDeConnexion) {
      // Honore `next` si présent et sûr (chemin relatif, pas de
      // `//host-externe` — un utilisateur authentifié peut arriver ici via
      // un lien avec `?next=...` déjà consommé par la page de connexion,
      // ou en visitant directement l'URL).
      const next = request.nextUrl.searchParams.get("next");
      const cible = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return NextResponse.redirect(new URL(cible, request.nextUrl.origin));
    }

    if (
      PREFIXES_MANAGER_ADMIN.some((prefixe) => request.nextUrl.pathname.startsWith(prefixe)) &&
      data?.role === "salarie"
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    if (request.nextUrl.pathname.startsWith(PREFIXE_SUPER_ADMIN)) {
      const { data: superAdmin } = await supabase
        .from("super_admins")
        .select("auth_id")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!superAdmin) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/";
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return response;
}

export const config = {
  // Exclusion générique des fichiers statiques de `public/` par extension
  // (07/09/2026, corrige un bug latent — le logo sur la page de connexion
  // était redirigé vers /connexion comme n'importe quelle route protégée,
  // faute d'être authentifié) plutôt que de lister chaque fichier un par un.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpe?g|gif|webp|ico)$).*)",
  ],
};
