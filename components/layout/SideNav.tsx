"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveHref, getNavTabs } from "@/components/layout/tabs";

/**
 * Rail rétractable (18/08/2026) — remplace l'ancien SideNav pleine largeur
 * (`w-56` fixe) : seule la colonne d'icônes (`w-16`) est visible au repos,
 * le bandeau complet (icônes + libellés, `w-56`) s'étend au survol en
 * overlay par-dessus le corps de page (`absolute`, transition de largeur),
 * plutôt que de pousser le contenu — voir Backlog.md. Deux éléments :
 * - un espaceur `w-16 shrink-0` dans le flux flex du `AppShell` (réserve la
 *   largeur du rail replié — le corps de page ne recalcule sa largeur
 *   qu'une seule fois, pas à chaque survol) ;
 * - la nav elle-même, `absolute` (ancrée au conteneur `relative` de
 *   `AppShell`), qui grandit au survol sans affecter cet espaceur.
 * Les composants du corps de page ne sont pas retouchés dans ce chantier :
 * ils gardent leurs propres largeurs (`max-w-*`), indépendantes du SideNav.
 */
export function SideNav() {
  const pathname = usePathname();
  const navTabs = getNavTabs(pathname);
  const activeHref = getActiveHref(pathname, navTabs);

  return (
    <>
      <div className="hidden w-16 shrink-0 md:block print:hidden" aria-hidden="true" />

      <nav className="bg-surface-card group/nav absolute top-0 bottom-0 left-0 z-40 hidden w-16 flex-col overflow-hidden py-6 shadow-sm transition-[width] duration-200 ease-out hover:w-56 hover:shadow-lg md:flex print:hidden">
        <div className="flex flex-col gap-1 px-2">
          {navTabs.map(({ href, label, Icon }) => {
            const active = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold whitespace-nowrap ${
                  active ? "bg-slate/10 text-slate" : "text-ink-900/60"
                }`}
              >
                <Icon size={17} className="shrink-0" />
                <span className="opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
