/**
 * Résout un paramètre `next` (destination post-connexion, `proxy.ts` et
 * `app/connexion/actions.ts`) en une redirection sûre — jamais vers un autre
 * site (28/09/2026, revue de sécurité : redirection ouverte).
 *
 * L'ancien contrôle (`next.startsWith("/") && !next.startsWith("//")`) ne
 * suffit pas : `new URL("/\\evil.com", origine)` traite le backslash comme un
 * slash (spec WHATWG pour http/https) et résout vers `https://evil.com`, que
 * la chaîne d'origine ne laissait pourtant rien deviner. Plutôt que
 * d'énumérer les caractères à bannir (fragile, on en oubliera toujours un),
 * on laisse `URL` elle-même faire la résolution et on vérifie que le
 * résultat reste bien sur la même origine — la même logique que le
 * navigateur/les clients email appliqueront de toute façon à la chaîne
 * finale.
 *
 * Pure (pas d'I/O) : importable aussi bien depuis `proxy.ts` (middleware,
 * pas de `next/headers`) que depuis une Server Action.
 */
export function cibleRedirectSure(next: string | null | undefined, origine: string): string {
  if (!next || !next.startsWith("/")) return "/";
  try {
    const url = new URL(next, origine);
    return url.origin === origine ? next : "/";
  } catch {
    return "/";
  }
}
