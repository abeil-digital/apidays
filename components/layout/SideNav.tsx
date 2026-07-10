"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "@/components/layout/tabs";
import { Avatar } from "@/components/ui/Avatar";
import { useUtilisateur } from "@/hooks/useUtilisateur";

export function SideNav() {
  const pathname = usePathname();
  const { utilisateur } = useUtilisateur();

  return (
    <div className="border-ink-300 bg-surface-card hidden w-56 shrink-0 flex-col border-r px-4 py-6 md:flex print:hidden">
      <div className="text-ink-900 px-1 text-[1.1rem] font-bold">Apidays</div>

      <div className="mt-8 flex flex-col gap-1">
        {NAV_TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                active ? "bg-brand text-brand-foreground" : "text-ink-900"
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </div>

      {utilisateur && (
        <div className="mt-auto flex items-center gap-2.5 pt-6">
          <Avatar initiales={utilisateur.initiales} />
          <div>
            <div className="text-ink-900 text-xs font-semibold">
              {utilisateur.prenom} {utilisateur.nom}
            </div>
            <div className="text-ink-500 text-xs">{utilisateur.poste}</div>
          </div>
        </div>
      )}
    </div>
  );
}
