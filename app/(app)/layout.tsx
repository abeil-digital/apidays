import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { fetchBrandingCourant } from "@/lib/data/branding.repository";

/** Async (09/09/2026, phase branding du chantier multi-tenant) — charge les
 * couleurs de l'entreprise de l'utilisateur connecté pour les passer à
 * `AppShell`, qui les applique en variables CSS sur toute l'app connectée. */
export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const branding = await fetchBrandingCourant();
  return <AppShell branding={branding}>{children}</AppShell>;
}
