import {
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  History,
  Home,
  LayoutDashboard,
  PlusCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavTab {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const POSER_TABS: NavTab[] = [
  { href: "/", label: "Accueil", Icon: Home },
  { href: "/accueil2", label: "Accueil 2", Icon: LayoutDashboard },
  { href: "/nouvelle-demande", label: "Nouvelle demande", Icon: PlusCircle },
  { href: "/historique", label: "Historique", Icon: History },
];

const PARAMETRER_TABS: NavTab[] = [
  { href: "/parametrer/utilisateurs", label: "Utilisateurs", Icon: Users },
  { href: "/parametrer/conges-rtt", label: "Congés & RTT", Icon: CalendarClock },
  { href: "/parametrer/calendrier2", label: "Calendrier", Icon: CalendarDays },
];

const SUIVRE_TABS: NavTab[] = [
  { href: "/suivre", label: "Demandes à traiter", Icon: ClipboardCheck },
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
