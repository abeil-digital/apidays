"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { NIVEAU1_ITEMS } from "@/components/layout/niveau1";
import { useUtilisateur } from "@/hooks/useUtilisateur";

/**
 * Header général de l'application — fond slate. Porte le logo, la navigation
 * de niveau 1 (Poser / Suivre / Paramétrer) et le profil. La sous-navigation
 * actuelle (Accueil / Nouvelle demande / Historique, dans SideNav/BottomNav)
 * reste rattachée à "Poser".
 */
export function HeaderBar() {
  const { utilisateur } = useUtilisateur();

  return (
    <header className="bg-slate mx-auto flex h-14 w-full shrink-0 items-center gap-4 overflow-x-auto px-4 shadow-sm md:max-w-[1440px] md:gap-6 md:px-8 print:hidden">
      <span className="text-base font-semibold whitespace-nowrap text-white">Apidays</span>

      <nav className="flex shrink-0 items-center gap-1">
        {NIVEAU1_ITEMS.map(({ key, label, href }) =>
          href ? (
            <Link
              key={key}
              href={href}
              className="border-b-2 border-white px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white"
            >
              {label}
            </Link>
          ) : (
            <span
              key={key}
              title="Bientôt disponible"
              className="hidden cursor-not-allowed border-b-2 border-transparent px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white/60 md:inline-block"
            >
              {label}
            </span>
          ),
        )}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        {utilisateur && (
          <>
            <div className="hidden text-right lg:block">
              <div className="text-xs font-semibold whitespace-nowrap text-white">
                {utilisateur.prenom} {utilisateur.nom}
              </div>
            </div>
            <Avatar initiales={utilisateur.initiales} />
          </>
        )}
      </div>
    </header>
  );
}
