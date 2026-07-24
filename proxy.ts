import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 : ce fichier remplace l'ancien middleware.ts (renommé "Proxy").
 * Rôle : rafraîchir la session Supabase à chaque requête (cookies), protéger
 * les routes de l'Espace Salarié tant qu'aucune session n'existe, et bloquer
 * /parametrer/* pour les salariés (Gestion des utilisateurs — manager/admin
 * uniquement, voir niveau1.ts). La RLS reste la protection de fond côté
 * données ; ceci n'est qu'une redirection optimiste côté route.
 */
const ROUTE_CONNEXION = "/connexion";
const PREFIXE_PARAMETRER = "/parametrer";

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

  if (!user && !isRouteConnexion) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ROUTE_CONNEXION;
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isRouteConnexion) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && request.nextUrl.pathname.startsWith(PREFIXE_PARAMETRER)) {
    const { data } = await supabase
      .from("utilisateurs")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (data?.role === "salarie") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
