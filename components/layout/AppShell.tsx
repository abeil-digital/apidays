import type { ReactNode } from "react";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { SideNav } from "@/components/layout/SideNav";
import { BottomNav } from "@/components/layout/BottomNav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-col">
      <HeaderBar />

      {/* `bg-surface-app` portée ici (pas sur `body`) — le canvas gris
          n'occupe que la largeur de travail (1180px), le corps de la page
          reste blanc au-delà sur grand écran (18/08/2026, demande
          explicite). */}
      <div className="bg-surface-app relative mx-auto flex w-full flex-1 md:max-w-[1180px]">
        <SideNav />

        <div className="min-w-0 flex-1">
          {/* `px-3` (12px) — chaque page ajoute déjà `px-1` (4px) sur son
              titre/premières lignes pour s'aligner avec le padding interne
              des cartes en dessous (voir Backlog.md) ; ces deux paddings se
              cumulent pour une goutière totale de 16px entre le rail et le
              début du contenu (18/08/2026, demande explicite : 16px total). */}
          <div className="px-3 pb-24 md:py-8 md:pb-8">{children}</div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
