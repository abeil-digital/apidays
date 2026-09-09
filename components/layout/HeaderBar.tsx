"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { getNiveau1Items, isNiveau1Actif } from "@/components/layout/niveau1";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { logout } from "@/app/connexion/actions";

/**
 * Header général de l'application — fond bleu nuit (vraie charte Abeil,
 * `--color-brand-primary`, 02/09/2026 — pas encore généralisé au reste de
 * l'app, qui reste sur le slate provisoire). Porte le logo, la navigation
 * de niveau 1 (Poser / Suivre / Paramétrer) et le profil. "Suivre"/"Paramétrer"
 * n'existent dans cette nav QUE pour manager/admin (07/09/2026, demande
 * explicite — pas de lien grisé pour un rôle sans droit, absence pure et
 * simple, voir niveau1.ts). La sous-navigation
 * (SideNav/BottomNav) dépend de la section active — voir tabs.ts.
 *
 * Pas sticky (28/08/2026, refusé explicitement par Vincent) — `relative z-50`
 * sert uniquement à passer au-dessus du rail `SideNav` (`fixed inset-0
 * z-40`, remonté jusqu'en haut de l'écran) tant que ce header est visible à
 * l'écran (page non défilée) ; une fois défilé hors du viewport, le rail
 * n'a plus rien à recouvrir et occupe le haut de l'écran.
 */
interface HeaderBarProps {
  // Logo du tenant (09/09/2026, phase logo) — `null`/absent ⇒ fallback sur
  // le logo Abeil en dur, voir lib/data/branding.repository.ts.
  logoUrl?: string | null;
}

export function HeaderBar({ logoUrl }: HeaderBarProps = {}) {
  const { utilisateur } = useUtilisateur();
  const pathname = usePathname();
  const niveau1Items = getNiveau1Items(utilisateur?.role);

  return (
    <header className="bg-brand-primary relative z-50 mx-auto flex h-14 w-full shrink-0 items-center gap-4 overflow-x-auto pr-4 pl-0 shadow-sm md:max-w-[1180px] md:gap-6 md:pr-8 print:hidden">
      <Link href="/" className="ml-[25px] shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique,
            l'optimisation next/image n'apporte rien ici */}
        <img
          src={logoUrl ?? "/logo-abeil.svg"}
          alt="Abeil"
          className="h-[25.6px] w-auto origin-left scale-x-[1.21]"
        />
      </Link>

      <nav className="flex h-full shrink-0 items-stretch gap-1">
        {niveau1Items
          .filter(({ href }) => href !== null)
          .map(({ key, label, href }) => (
            <Link
              key={key}
              href={href!}
              className={`flex items-center border-b-2 px-3 pt-[10px] text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
                isNiveau1Actif(key, pathname)
                  ? "border-brand-accent text-brand-accent hover:bg-brand-accent/10"
                  : "border-transparent text-white hover:bg-white/10"
              }`}
            >
              {label}
            </Link>
          ))}
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
