import type { ReactNode } from "react";
import { SideNav } from "@/components/layout/SideNav";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-full">
      <SideNav />

      <div className="min-w-0 flex-1">
        <TopBar />

        <div className="mx-auto max-w-md px-4 pb-24 md:max-w-2xl md:px-8 md:py-8 md:pb-8">
          {children}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
