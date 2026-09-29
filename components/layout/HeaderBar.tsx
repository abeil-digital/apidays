"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { getNiveau1Items, isNiveau1Actif } from "@/components/layout/niveau1";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { logout } from "@/app/connexion/actions";

/**
 * Menu profil (22/09/2026, demande de Vincent — "le log out sera accessible
 * en cliquant sur le profil") : remplace l'icône `LogOut` isolée par un menu
 * déclenché en cliquant sur avatar+nom, pour l'instant un seul item
 * ("Se déconnecter") mais ouvre la voie à d'autres entrées plus tard (ex.
 * "Mon profil"). Portail + position `fixed` calée sur `ancre` (même pattern
 * que `SnippetConge`/`DatePicker`) — le header a `overflow-x-auto`, un menu
 * `absolute` risquerait d'y être rogné.
 */
function MenuProfil({
  prenom,
  nom,
  initiales,
}: {
  prenom: string;
  nom: string;
  initiales: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const declencheurRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [ancre, setAncre] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!ouvert) return;
    function handleClicExterieur(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !declencheurRef.current?.contains(e.target as Node)
      ) {
        setOuvert(false);
      }
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [ouvert]);

  function toggle() {
    if (!ouvert) setAncre(declencheurRef.current?.getBoundingClientRect() ?? null);
    setOuvert((v) => !v);
  }

  return (
    <>
      <button
        ref={declencheurRef}
        type="button"
        onClick={toggle}
        className="flex shrink-0 items-center gap-3 rounded-full py-1 pr-1 pl-2 hover:bg-white/10"
      >
        <span className="hidden text-right lg:block">
          <span className="block text-xs font-semibold whitespace-nowrap text-white">
            {prenom} {nom}
          </span>
        </span>
        <Avatar initiales={initiales} />
      </button>

      {ouvert &&
        ancre &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: ancre.bottom + 8,
              right: window.innerWidth - ancre.right,
            }}
            className="bg-surface-card border-ink-300/60 z-50 w-48 rounded-xl border py-1.5 shadow-lg"
          >
            <form action={logout}>
              <button
                type="submit"
                className="text-ink-900 hover:bg-surface-app flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-semibold"
              >
                <LogOut size={16} className="text-ink-500" />
                Se déconnecter
              </button>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}

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
 *
 * Deux lignes sur mobile, une seule à partir de `md:` (29/09/2026, essai
 * suite à une maquette Claude Design jugée bonne sur le placement — "le
 * positionnement logo et nav est pas mal") : logo + profil sur la première
 * ligne, nav de niveau 1 sur la seconde, plutôt que tout sur une ligne qui
 * défile horizontalement. Obtenu via `md:contents` sur les deux groupes
 * mobile (logo+profil / nav) — ce display fait disparaître leur propre boîte
 * à partir de `md:`, si bien que leurs enfants rejoignent directement le flex
 * du `<header>` et retrouvent la ligne unique d'origine, inchangée. Seul le
 * profil est dupliqué (une instance par ligne, visible selon le point de
 * rupture) plutôt que déplacé via `contents` — plus simple qu'un troisième
 * groupe `contents` juste pour lui. N'inclut PAS le traitement visuel de la
 * maquette (coins arrondis, carte flottante) — décision volontairement
 * limitée au placement, à revoir une fois la direction graphique validée.
 */
interface HeaderBarProps {
  // Logo du tenant (09/09/2026, phase logo) — `null`/absent ⇒ fallback sur
  // le logo Abeil en dur, voir lib/data/branding.repository.ts.
  logoUrl?: string | null;
}

export function HeaderBar({ logoUrl }: HeaderBarProps = {}) {
  const { utilisateur } = useUtilisateur();
  const pathname = usePathname();
  const niveau1Items = getNiveau1Items(utilisateur?.role, utilisateur?.sansSolde);

  return (
    <header className="bg-brand-primary relative z-50 mx-auto flex w-full shrink-0 flex-col shadow-sm md:h-14 md:max-w-[1180px] md:flex-row md:items-center md:gap-6 md:overflow-x-auto md:pr-8 md:pl-0 print:hidden">
      {/* Ligne 1 mobile (logo + profil) — `md:contents` la fait disparaître à
          partir de `md:`, ses deux enfants rejoignent alors directement la
          ligne unique du `<header>`, comme avant ce changement. */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4 md:contents">
        <Link href="/" className="shrink-0 md:ml-[25px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique,
              l'optimisation next/image n'apporte rien ici */}
          <img
            src={logoUrl ?? "/logo-abeil.svg"}
            alt="Abeil"
            className="h-[22px] w-auto md:h-[25.6px] md:origin-left md:scale-x-[1.21]"
          />
        </Link>
        {utilisateur && (
          <div className="md:hidden">
            <MenuProfil
              prenom={utilisateur.prenom}
              nom={utilisateur.nom}
              initiales={utilisateur.initiales}
            />
          </div>
        )}
      </div>

      {/* Ligne 2 mobile (nav niveau 1) — même principe `md:contents` : les
          `<Link>` rejoignent la ligne unique du header à partir de `md:`. */}
      <nav className="flex shrink-0 items-stretch gap-1 overflow-x-auto px-4 pb-2 md:contents md:h-full md:px-0 md:pb-0">
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

      {/* Profil desktop uniquement — dupliqué plutôt que déplacé via
          `contents` (voir doc du composant), même position qu'avant. */}
      <div className="hidden shrink-0 items-center gap-3 md:ml-auto md:flex">
        {utilisateur && (
          <MenuProfil
            prenom={utilisateur.prenom}
            nom={utilisateur.nom}
            initiales={utilisateur.initiales}
          />
        )}
      </div>
      {/* Espaceur explicite (22/09/2026, badge utilisateur collé au bord sur
          mobile réel — Safari iOS) : le `padding-right` d'un conteneur flex
          en scroll horizontal (`overflow-x-auto`) n'est pas respecté en fin
          de scroll dans Safari — `md:pr-8` seul ne suffit pas. Un vrai
          élément de contenu, lui, est toujours honoré. Ne concerne plus que
          `md:` : le profil mobile a sa propre ligne, non scrollable. */}
      <div className="hidden w-4 shrink-0 md:block md:w-8" />
    </header>
  );
}
