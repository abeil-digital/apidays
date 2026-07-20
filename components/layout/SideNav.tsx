"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "@/components/layout/tabs";

export function SideNav() {
  const pathname = usePathname();

  return (
    <div className="border-ink-300 bg-surface-card hidden w-56 shrink-0 flex-col border-r px-4 py-6 md:flex print:hidden">
      <div className="flex flex-col gap-1">
        {NAV_TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                active ? "bg-slate/10 text-slate" : "text-ink-900/60"
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
