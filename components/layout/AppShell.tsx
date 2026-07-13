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

      <div className="mx-auto flex w-full flex-1 md:max-w-[1440px]">
        <SideNav />

        <div className="min-w-0 flex-1">
          <div className="px-4 pb-24 md:px-8 md:py-8 md:pb-8">{children}</div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
