import "server-only";
import { headers } from "next/headers";

/**
 * Origine du site déduite de la requête en cours (08/09/2026) — remplace
 * `NEXT_PUBLIC_SITE_URL`, qui obligeait à changer une variable d'env à la
 * main entre localhost et la prod. `x-forwarded-host`/`x-forwarded-proto`
 * sont posés par la plupart des plateformes de déploiement (Vercel compris)
 * derrière un proxy ; `host` seul suffit en local (`http`, pas de proxy).
 * Server-only (Server Actions/Route Handlers) : `headers()` n'existe pas
 * côté navigateur.
 */
export async function getSiteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocole = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocole}://${host}`;
}
