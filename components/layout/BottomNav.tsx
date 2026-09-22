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
              className={`flex flex-col items-center gap-1 px-1 py-2.5 transition-colors duration-150 ${
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
              {/* `text-[11px]`/`leading-tight` (22/09/2026, demande explicite
                  de Vincent — "caler la nav secondaire") : à 4-5 onglets
                  répartis en largeur égale, un libellé comme "Suivre les
                  demandes"/"Transmissions paie" passe sur 2 lignes quelle que
                  soit la taille (colonne ~90-100px) — resserré et centré
                  pour que ça reste propre plutôt que juste réduit au hasard,
                  cohérent que le libellé tienne sur 1 ou 2 lignes. */}
              <span className="text-center text-[11px] leading-tight font-semibold">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
