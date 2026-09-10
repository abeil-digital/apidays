import type { CSSProperties, ReactNode } from "react";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { SideNav } from "@/components/layout/SideNav";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { DateOverrideBanner } from "@/components/layout/DateOverrideBanner";
import type { Branding } from "@/lib/data/branding.repository";

interface AppShellProps {
  children: ReactNode;
  branding: Branding;
}

/** `branding` (09/09/2026, phase branding du chantier multi-tenant) —
 * surcharge `--color-brand-primary`/`--color-brand-accent` (défaut charte
 * Abeil, `app/globals.css`) en variables CSS inline sur le conteneur
 * racine ; la cascade CSS fait le reste, tous les descendants (HeaderBar,
 * SideNav, BottomNav, le contenu de page) héritent de la couleur de
 * l'entreprise de l'utilisateur connecté sans changement de leur côté.
 * Même convention `as CSSProperties` que `SoldeCard.tsx`/`DatePicker.tsx`. */
export function AppShell({ children, branding }: AppShellProps) {
  return (
    <div
      className="flex min-h-full flex-col"
      style={
        {
          "--color-brand-primary": branding.couleurNavy,
          "--color-brand-accent": branding.couleurJaune,
        } as CSSProperties
      }
    >
      <DateOverrideBanner />
      <HeaderBar logoUrl={branding.logoUrl} />

      {/* `bg-surface-app` portée ici (pas sur `body`) — le canvas gris
          n'occupe que la largeur de travail (1180px), le corps de la page
          reste blanc au-delà sur grand écran (18/08/2026, demande
          explicite). */}
      <div
        data-app-content
        className="bg-surface-app relative mx-auto flex w-full flex-1 md:max-w-[1180px]"
      >
        <SideNav logoUrlSigne={branding.logoUrlSigne} />

        <div className="min-w-0 flex-1">
          {/* `px-3` (12px) — chaque page ajoute déjà `px-1` (4px) sur son
              titre/premières lignes pour s'aligner avec le padding interne
              des cartes en dessous (voir Backlog.md) ; ces deux paddings se
              cumulent pour une goutière totale de 16px entre le rail et le
              début du contenu (18/08/2026, demande explicite : 16px total). */}
          <div className="px-3 pb-24 md:py-8 md:pb-8">{children}</div>
        </div>
      </div>

      <Footer />
      <BottomNav />
    </div>
  );
}
