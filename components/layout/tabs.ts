import {
  Bell,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  HelpCircle,
  History,
  Home,
  ListChecks,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavTab {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const POSER_TABS: NavTab[] = [
  { href: "/", label: "Accueil", Icon: Home },
  { href: "/historique", label: "Historique", Icon: History },
];

const PARAMETRER_TABS: NavTab[] = [
  { href: "/parametrer/utilisateurs", label: "Utilisateurs", Icon: Users },
  { href: "/parametrer/conges-rtt", label: "Congés & RTT", Icon: CalendarClock },
  { href: "/parametrer/calendrier2", label: "Calendrier", Icon: CalendarDays },
  { href: "/parametrer/faq", label: "FAQ", Icon: HelpCircle },
  { href: "/parametrer/notifications", label: "Notifications", Icon: Bell },
];

const SUIVRE_TABS: NavTab[] = [
  { href: "/suivre/calendrier", label: "Calendriers absences", Icon: CalendarDays },
  { href: "/suivre/demandes", label: "Suivre les demandes", Icon: ListChecks },
  // Ex-duplication expérimentale (27/08/2026) devenue l'unique écran
  // (28/08/2026, "Suivre les soldes" V1 supprimé). Libellé renommé le
  // 29/08/2026 ("Suivre les soldes 2" n'avait plus de sens une fois le V1
  // disparu) — l'URL `/suivre/soldes2` reste inchangée (pas de renommage de
  // route pour un simple intitulé).
  { href: "/suivre/soldes2", label: "Suivre les soldes", Icon: Wallet },
  { href: "/suivre/transmissions-paie", label: "Transmissions paie", Icon: ClipboardCheck },
];

/**
 * Sous-navigation (SideNav/BottomNav) dépendante de la section niveau 1
 * active — déduite du chemin courant, pas d'un état séparé à synchroniser.
 *
 * `utilisateurCourant` (24/09/2026, demande explicite de Vincent) : pour un
 * manager/admin "sans suivi de solde", `/suivre/calendrier` EST son accueil
 * (voir `SuivreCalendrierPage.tsx`) — l'onglet reprend le libellé de son H1
 * ("Accueil Manager"/"Accueil Administrateur").
 */
export function getNavTabs(
  pathname: string,
  utilisateurCourant?: { role?: string; sansSolde?: boolean } | null,
): NavTab[] {
  if (pathname.startsWith("/parametrer")) return PARAMETRER_TABS;
  if (pathname.startsWith("/suivre")) {
    const estSansSolde =
      utilisateurCourant?.sansSolde &&
      (utilisateurCourant.role === "manager" || utilisateurCourant.role === "admin");
    if (!estSansSolde) return SUIVRE_TABS;
    const label =
      utilisateurCourant.role === "admin" ? "Accueil Administrateur" : "Accueil Manager";
    return SUIVRE_TABS.map((tab) => (tab.href === "/suivre/calendrier" ? { ...tab, label } : tab));
  }
  return POSER_TABS;
}

/**
 * Onglet actif parmi `tabs` pour `pathname` — le href le plus long/spécifique
 * gagne (ex. sur `/suivre/transmissions-paie`, cet onglet l'emporte sur
 * `/suivre`, qui serait sinon aussi "actif" par préfixe).
 */
export function getActiveHref(pathname: string, tabs: NavTab[]): string | null {
  const correspondances = tabs.filter(
    (t) => pathname === t.href || pathname.startsWith(`${t.href}/`),
  );
  if (correspondances.length === 0) return null;
  return correspondances.reduce((a, b) => (b.href.length > a.href.length ? b : a)).href;
}
