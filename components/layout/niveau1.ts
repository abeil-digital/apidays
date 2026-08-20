import type { RoleUtilisateur } from "@/lib/types";

export interface Niveau1Item {
  key: string;
  label: string;
  href: string | null;
}

/**
 * Navigation de niveau 1 (header général). "Poser" (Espace Salarié) est
 * fonctionnel pour tous. "Suivre" (Espace Manager, validation des demandes)
 * et "Paramétrer" (Espace Delphine) ne sont cliquables que pour
 * manager/admin — la RLS limite ensuite ce que chacun peut réellement
 * voir/modifier une fois sur l'écran.
 */
export function getNiveau1Items(role: RoleUtilisateur | undefined): Niveau1Item[] {
  const peutParametrer = role === "manager" || role === "admin";

  return [
    { key: "poser", label: "Poser", href: "/" },
    { key: "suivre", label: "Suivre", href: peutParametrer ? "/suivre/demandes" : null },
    {
      key: "parametrer",
      label: "Paramétrer",
      href: peutParametrer ? "/parametrer/utilisateurs" : null,
    },
  ];
}

export function isNiveau1Actif(key: string, pathname: string): boolean {
  if (key === "parametrer") return pathname.startsWith("/parametrer");
  if (key === "suivre") return pathname.startsWith("/suivre");
  if (key === "poser")
    return !pathname.startsWith("/parametrer") && !pathname.startsWith("/suivre");
  return false;
}
