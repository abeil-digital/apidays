"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getActiveHref, getNavTabs } from "@/components/layout/tabs";

/**
 * Rail rétractable (18/08/2026) — remplace l'ancien SideNav pleine largeur
 * (`w-56` fixe) : seule la colonne d'icônes (`w-16`) est visible au repos,
 * le bandeau complet (icônes + libellés, `w-56`) s'étend au survol en
 * overlay par-dessus le corps de page (transition de largeur), plutôt que
 * de pousser le contenu.
 *
 * `fixed` (28/08/2026, "SideNav en sticky au scroll" — item Backlog) —
 * remplace l'ancien `absolute top-0 bottom-0` : ancré à un conteneur
 * `relative` qui scrolle AVEC la page (pas de conteneur de scroll interne
 * dans cet `AppShell`), un `absolute` défilait donc lui aussi avec la page
 * au lieu de rester visible — c'était le bug signalé. `fixed` échappe
 * complètement au flux/scroll de la page, mais perd du même coup son
 * ancrage automatique au conteneur centré `max-w-[1180px]` de l'app — d'où
 * l'enveloppe `fixed inset-0` qui rejoue ce centrage via
 * `mx-auto max-w-[1180px]`, sans JS. Les deux calques d'enveloppe sont
 * `pointer-events-none` (ils couvrent toute la largeur de l'écran) — seule
 * la nav elle-même (`pointer-events-auto`) intercepte les clics, le reste
 * du calque laisse passer les interactions vers le contenu en dessous.
 * L'espaceur `w-16 shrink-0` dans le flux flex de `AppShell` réserve
 * toujours la largeur du rail replié (le corps de page ne recalcule sa
 * largeur qu'une seule fois, pas à chaque survol) — un `fixed` ne participe
 * de toute façon plus au flux, cet espaceur reste donc nécessaire.
 *
 * Remonte jusqu'à `top: 0` — pas seulement sous le `HeaderBar` — pour
 * combler l'espace qu'il laisse une fois défilé hors du viewport (28/08/2026,
 * "faudrait qu'il reste sticky en haut... pour compenser la disparition du
 * header général" — Vincent a explicitement refusé de fixer le header
 * lui-même). `z-40` reste sous le `z-50` du `HeaderBar` (`HeaderBar.tsx`,
 * `position: relative` ajouté juste pour ce classement d'empilement) : au
 * repos (page non défilée), le header non-sticky recouvre visuellement le
 * haut du rail ; une fois défilé hors du viewport, plus rien ne le recouvre,
 * le rail apparaît alors jusqu'en haut de l'écran.
 *
 * `pt-20` (28/08/2026, bug signalé juste après le point ci-dessus : "sans
 * scroll, les premiers items de la nav latérale sont masqués par le
 * header") — sans ce padding, le premier item démarrait dès `py-6` (24px),
 * en plein dans la zone recouverte par le `HeaderBar` (56px) au repos,
 * invisible tant qu'on n'a pas scrollé. `pt-20` (80px = 56px de header +
 * 24px de marge d'origine) pousse tout le contenu sous le header, que la
 * page soit scrollée ou non — le padding bas (`pb-6`) reste inchangé.
 */
export function SideNav() {
  const pathname = usePathname();
  const navTabs = getNavTabs(pathname);
  const activeHref = getActiveHref(pathname, navTabs);

  return (
    <>
      <div
        data-sidenav-spacer
        className="hidden w-16 shrink-0 md:block print:hidden"
        aria-hidden="true"
      />

      <div className="pointer-events-none fixed inset-0 z-40 hidden md:block print:hidden">
        <div className="pointer-events-none mx-auto flex h-full w-full md:max-w-[1180px]">
          <nav className="bg-surface-card group/nav pointer-events-auto flex h-full w-16 flex-col overflow-hidden pt-20 pb-6 shadow-sm transition-[width] duration-200 ease-out hover:w-56 hover:shadow-lg">
            <div className="flex flex-col gap-1 px-2">
              {navTabs.map(({ href, label, Icon }) => {
                const active = href === activeHref;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
                      active
                        ? "bg-abeil-yellow/8 text-abeil-yellow hover:bg-abeil-yellow/15"
                        : "text-abeil-navy hover:bg-abeil-navy/5"
                    }`}
                  >
                    <Icon
                      size={17}
                      className={`shrink-0 ${active ? "text-abeil-yellow" : "text-abeil-navy"}`}
                    />
                    <span className="opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
