import {
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
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
];

const SUIVRE_TABS: NavTab[] = [
  { href: "/suivre/demandes", label: "Suivre les demandes", Icon: ListChecks },
  // Ex-duplication expérimentale (27/08/2026) devenue l'unique écran
  // (28/08/2026, "Suivre les soldes" V1 supprimé) — garde son nom/URL "2"
  // historique, jamais renommé en pratique (même situation que
  // `DashboardPage`, voir Backlog.md).
  { href: "/suivre/soldes2", label: "Suivre les soldes 2", Icon: Wallet },
  { href: "/suivre/calendrier", label: "Calendrier", Icon: CalendarDays },
  { href: "/suivre/transmissions-paie", label: "Transmissions paie", Icon: ClipboardCheck },
];

/**
 * Sous-navigation (SideNav/BottomNav) dépendante de la section niveau 1
 * active — déduite du chemin courant, pas d'un état séparé à synchroniser.
 */
export function getNavTabs(pathname: string): NavTab[] {
  if (pathname.startsWith("/parametrer")) return PARAMETRER_TABS;
  if (pathname.startsWith("/suivre")) return SUIVRE_TABS;
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
