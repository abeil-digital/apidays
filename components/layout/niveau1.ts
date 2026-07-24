import type { RoleUtilisateur } from "@/lib/types";

export interface Niveau1Item {
  key: string;
  label: string;
  href: string | null;
}

/**
 * Navigation de niveau 1 (header général). "Poser" (Espace Salarié) est
 * fonctionnel pour tous. "Paramétrer" (Espace Delphine, en construction)
 * n'est cliquable que pour manager/admin — la RLS limite ensuite ce que
 * chacun peut réellement voir/modifier une fois sur l'écran. "Suivre"
 * (Espace Manager) reste un emplacement réservé, sans route derrière.
 */
export function getNiveau1Items(role: RoleUtilisateur | undefined): Niveau1Item[] {
  const peutParametrer = role === "manager" || role === "admin";

  return [
    { key: "poser", label: "Poser", href: "/" },
    { key: "suivre", label: "Suivre", href: null },
    {
      key: "parametrer",
      label: "Paramétrer",
      href: peutParametrer ? "/parametrer/utilisateurs" : null,
    },
  ];
}

export function isNiveau1Actif(key: string, pathname: string): boolean {
  if (key === "parametrer") return pathname.startsWith("/parametrer");
  if (key === "poser") return !pathname.startsWith("/parametrer");
  return false;
}
