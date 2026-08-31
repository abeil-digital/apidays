"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { getNiveau1Items, isNiveau1Actif } from "@/components/layout/niveau1";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { logout } from "@/app/connexion/actions";

/**
 * Header général de l'application — fond slate. Porte le logo, la navigation
 * de niveau 1 (Poser / Suivre / Paramétrer) et le profil. "Paramétrer" n'est
 * cliquable que pour manager/admin (voir niveau1.ts). La sous-navigation
 * (SideNav/BottomNav) dépend de la section active — voir tabs.ts.
 *
 * Pas sticky (28/08/2026, refusé explicitement par Vincent) — `relative z-50`
 * sert uniquement à passer au-dessus du rail `SideNav` (`fixed inset-0
 * z-40`, remonté jusqu'en haut de l'écran) tant que ce header est visible à
 * l'écran (page non défilée) ; une fois défilé hors du viewport, le rail
 * n'a plus rien à recouvrir et occupe le haut de l'écran.
 */
export function HeaderBar() {
  const { utilisateur } = useUtilisateur();
  const pathname = usePathname();
  const niveau1Items = getNiveau1Items(utilisateur?.role);

  return (
    <header className="bg-slate relative z-50 mx-auto flex h-14 w-full shrink-0 items-center gap-4 overflow-x-auto px-4 shadow-sm md:max-w-[1180px] md:gap-6 md:px-8 print:hidden">
      <span className="text-base font-semibold whitespace-nowrap text-white">Apidays</span>

      <nav className="flex shrink-0 items-center gap-1">
        {niveau1Items.map(({ key, label, href }) =>
          href ? (
            <Link
              key={key}
              href={href}
              className={`border-b-2 px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-white ${
                isNiveau1Actif(key, pathname) ? "border-white" : "border-transparent text-white/60"
              }`}
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
            <form action={logout}>
              <button
                type="submit"
                title="Se déconnecter"
                className="text-white/70 hover:text-white"
              >
                <LogOut size={16} />
              </button>
            </form>
          </>
        )}
      </div>
    </header>
  );
}
