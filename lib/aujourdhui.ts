/**
 * Date simulée pour les tests en local (10/09/2026) — `useAujourdhui()`
 * évoqué dans CONTEXTE.md ("Zones grises à trancher — système temporel du
 * Calendrier"). Remplace les `new Date()` des calculs métier centraux
 * (moteur de soldes, bandeau/année du Calendrier) par cette date simulée
 * quand elle est réglée via le bandeau de test — voir `DateOverrideBanner.tsx`.
 *
 * JAMAIS actif en production (`process.env.NODE_ENV !== "production"`,
 * inlinée au build par Next.js — s'élimine du bundle prod, aucun risque
 * qu'un client réel voie ou déclenche ce mécanisme). Persisté en
 * `localStorage` (survit à la navigation/aux rechargements), jamais envoyé
 * au serveur — les Server Actions (ex. `app/admin/actions.ts`) continuent
 * d'utiliser la vraie date système, ce mécanisme est strictement côté
 * navigateur.
 *
 * Portée volontairement limitée au premier passage : le moteur de soldes
 * (`lib/data/soldes.repository.ts`) et le Calendrier (bandeau de décembre,
 * année "live"), pas les dizaines d'autres `new Date()` de l'app (filtres
 * "année en cours" de Suivre/Poser, essentiellement cosmétiques) — à
 * étendre au cas par cas si le besoin se confirme.
 */

const STORAGE_KEY = "apidays_dev_date_override";

export function dateSimuleeActive(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Date ISO (`AAAA-MM-JJ`) actuellement simulée, ou `null` si aucune (date
 * réelle). `null` aussi en dehors du navigateur (SSR) ou en production. */
export function getDateSimuleeIso(): string | null {
  if (!dateSimuleeActive() || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** "Aujourd'hui" pour les calculs métier — date simulée si réglée, sinon la
 * vraie date système. Toujours à minuit UTC (même convention que
 * `soldes.repository.ts`, évite tout décalage de fuseau horaire). */
export function getAujourdhui(): Date {
  const iso = getDateSimuleeIso();
  if (iso) return new Date(`${iso}T00:00:00Z`);
  return new Date();
}

/** Règle (ou efface, avec `null`) la date simulée puis recharge la page —
 * le plus simple pour que TOUT (soldes, calendrier, hooks déjà montés)
 * reparte d'un état frais avec la nouvelle date, sans mécanisme de
 * réactivité dédié à maintenir. */
export function setDateSimulee(iso: string | null): void {
  if (!dateSimuleeActive() || typeof window === "undefined") return;
  try {
    if (iso) window.localStorage.setItem(STORAGE_KEY, iso);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Stockage indisponible (navigation privée...) — tant pis, pas bloquant
    // pour un outil de dev.
  }
  window.location.reload();
}
