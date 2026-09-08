import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 : ce fichier remplace l'ancien middleware.ts (renommé "Proxy").
 * Rôle : rafraîchir la session Supabase à chaque requête (cookies), protéger
 * les routes de l'Espace Salarié tant qu'aucune session n'existe, bloquer
 * /parametrer/* et /suivre/* pour les salariés (manager/admin uniquement,
 * voir niveau1.ts), et déconnecter un profil dont le contrat est terminé
 * (04/09/2026, "Fin de contrat" — voir `definirFinContrat` dans
 * `utilisateurs.repository.ts`). La RLS reste la protection de fond côté
 * données ; ceci n'est qu'une redirection optimiste côté route.
 */
const ROUTE_CONNEXION = "/connexion";
const PREFIXES_MANAGER_ADMIN = ["/parametrer", "/suivre"];

// Routes accessibles sans session "réelle" (07/09/2026, parcours mot de
// passe) : toute la famille /connexion/* (login, mot de passe oublié,
// définition de mot de passe — cette dernière posée via une session
// temporaire par /auth/confirm, pas une vraie connexion) + /auth/confirm
// lui-même (pose justement cette session avant de rediriger).
function estRoutePublique(pathname: string): boolean {
  return (
    pathname === "/auth/confirm" ||
    pathname === ROUTE_CONNEXION ||
    pathname.startsWith(`${ROUTE_CONNEXION}/`)
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

  const isRouteConnexion = request.nextUrl.pathname === ROUTE_CONNEXION;
  const routePublique = estRoutePublique(request.nextUrl.pathname);

  if (!user && !routePublique) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ROUTE_CONNEXION;
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
      if (!isRouteConnexion) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = ROUTE_CONNEXION;
        return NextResponse.redirect(redirectUrl);
      }
      return response;
    }

    if (isRouteConnexion) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }

    if (
      PREFIXES_MANAGER_ADMIN.some((prefixe) => request.nextUrl.pathname.startsWith(prefixe)) &&
      data?.role === "salarie"
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
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
