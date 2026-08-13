import {
  CalendarClock,
  CalendarDays,
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

/**
 * Sous-navigation (SideNav/BottomNav) dépendante de la section niveau 1
 * active — déduite du chemin courant, pas d'un état séparé à synchroniser.
 */
export function getNavTabs(pathname: string): NavTab[] {
  return pathname.startsWith("/parametrer") ? PARAMETRER_TABS : POSER_TABS;
}
