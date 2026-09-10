import Link from "next/link";

/**
 * Pied de page (10/09/2026) — même largeur/centrage que le header
 * (`mx-auto md:max-w-[1180px]`, `AppShell.tsx`), placé juste sous la zone
 * SideNav+contenu, avant `BottomNav`. Charté comme le header
 * (`bg-brand-primary`) plutôt que générique, contrairement au contenu de
 * page depuis le recentrage du branding du 09/09/2026 (voir
 * `MULTI-TENANT.md`, section "Couleurs") — un pied de page est un élément
 * de structure de l'app, pas du contenu.
 *
 * `mb-24 md:mb-0` : sur mobile, `BottomNav` est `fixed` en bas d'écran et
 * recouvrirait sinon le bas du footer une fois la page défilée jusqu'en bas.
 *
 * `relative z-50` (10/09/2026, correctif) — `SideNav` est un rail `fixed`
 * couvrant toute la hauteur de l'écran (`z-40`, voir `SideNav.tsx`) pour
 * rester visible au scroll ; sans ça, ce rail recouvrait visuellement la
 * portion gauche du footer (élément de flux normal, sans contexte
 * d'empilement) au lieu de laisser le footer passer par-dessus.
 */
export function Footer() {
  return (
    <footer className="bg-brand-primary relative z-50 mx-auto mb-24 flex w-full shrink-0 flex-col items-center justify-center gap-1 px-4 py-4 text-xs text-white/70 md:mb-0 md:max-w-[1180px] md:flex-row md:gap-4 print:hidden">
      <span>© {new Date().getFullYear()} Citizen D</span>
      <Link href="/mentions-legales" className="hover:text-white hover:underline">
        Mentions légales
      </Link>
    </footer>
  );
}
