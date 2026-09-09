import type { ReactNode } from "react";

/**
 * Layout minimal (09/09/2026, flux d'onboarding d'un tenant) — pas
 * d'`AppShell` : le branding/la nav de niveau 1 sont propres à une
 * entreprise (`fetchBrandingCourant()`, `app/(app)/layout.tsx`), cet écran
 * est platform-level, pas rattaché à un tenant en particulier. Couleurs de
 * charte par défaut (`app/globals.css`, `:root`) sans surcharge.
 * Autorisation vérifiée par `proxy.ts` (redirection) ET par
 * `assertSuperAdmin()` dans chaque page/action (voir
 * `lib/supabase/superAdmin.ts`).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-app min-h-screen">
      <header className="bg-brand-primary flex h-14 items-center px-6">
        <span className="text-sm font-semibold text-white">Administration — Apidays</span>
      </header>
      <div className="mx-auto max-w-[900px] px-6 py-8">{children}</div>
    </div>
  );
}
