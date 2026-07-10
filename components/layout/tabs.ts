import { History, Home, PlusCircle, type LucideIcon } from "lucide-react";

export interface NavTab {
  href: string;
  label: string;
  Icon: LucideIcon;
}

export const NAV_TABS: NavTab[] = [
  { href: "/", label: "Accueil", Icon: Home },
  { href: "/nouvelle-demande", label: "Nouvelle demande", Icon: PlusCircle },
  { href: "/historique", label: "Historique", Icon: History },
];
