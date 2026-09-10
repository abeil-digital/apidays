import Link from "next/link";

/**
 * Pied de page (10/09/2026) — pleine largeur de l'écran, contrairement au
 * header et au contenu (capés à 1180px, `AppShell.tsx`) : demande explicite
 * de Vincent. Charté comme le header (`bg-brand-primary`) plutôt que
 * générique, contrairement au contenu de page depuis le recentrage du
 * branding du 09/09/2026 (voir `MULTI-TENANT.md`, section "Couleurs") — un
 * pied de page est un élément de structure de l'app, pas du contenu.
 *
 * `mb-24 md:mb-0` : sur mobile, `BottomNav` est `fixed` en bas d'écran et
 * recouvrirait sinon le bas du footer une fois la page défilée jusqu'en bas.
 */
export function Footer() {
  return (
    <footer className="bg-brand-primary mb-24 flex w-full shrink-0 flex-col items-center justify-center gap-1 px-4 py-4 text-xs text-white/70 md:mb-0 md:flex-row md:gap-4 print:hidden">
      <span>© {new Date().getFullYear()} Citizen D</span>
      <Link href="/mentions-legales" className="hover:text-white hover:underline">
        Mentions légales
      </Link>
    </footer>
  );
}
