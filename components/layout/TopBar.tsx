"use client";

import { Avatar } from "@/components/ui/Avatar";
import { useUtilisateur } from "@/hooks/useUtilisateur";

export function TopBar() {
  const { utilisateur } = useUtilisateur();

  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-3 md:hidden print:hidden">
      <span className="text-ink-900 text-[1.15rem] font-bold">Apidays</span>
      <div className="flex items-center gap-2">
        <span className="bg-ink-300 text-ink-900 rounded-full px-2 py-1 text-[10px] font-bold tracking-wide uppercase">
          Démo
        </span>
        {utilisateur && <Avatar initiales={utilisateur.initiales} bordered />}
      </div>
    </div>
  );
}
