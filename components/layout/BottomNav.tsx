"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveHref, getNavTabs } from "@/components/layout/tabs";

export function BottomNav() {
  const pathname = usePathname();
  const navTabs = getNavTabs(pathname);
  const activeHref = getActiveHref(pathname, navTabs);

  return (
    <div className="border-ink-300 bg-surface-card fixed right-0 bottom-0 left-0 border-t md:hidden print:hidden">
      <div
        className="mx-auto grid max-w-md"
        style={{ gridTemplateColumns: `repeat(${navTabs.length}, minmax(0, 1fr))` }}
      >
        {navTabs.map(({ href, label, Icon }) => {
          const active = href === activeHref;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 py-2.5 transition-colors duration-150 ${
                active
                  ? "bg-brand-accent/8 text-brand-accent hover:bg-brand-accent/15"
                  : "text-brand-primary hover:bg-brand-primary/5"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.4 : 2}
                className={active ? "text-brand-accent" : "text-brand-primary"}
              />
              <span className="text-xs font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
