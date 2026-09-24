import type { RoleUtilisateur } from "@/lib/types";

export interface Niveau1Item {
  key: string;
  label: string;
  href: string | null;
}

/**
 * Navigation de niveau 1 (header général). "Poser" (Espace Salarié) est
 * fonctionnel pour tous, SAUF un manager/admin "sans suivi de solde"
 * (24/09/2026) — pas de solde à consommer, pas d'accès à "Poser" (voir
 * `proxy.ts`, qui redirige déjà `/` vers `/suivre/calendrier` pour ce
 * profil ; masquer l'entrée ici évite un lien mort dans la nav). "Suivre"
 * (Espace Manager, validation des demandes) et "Paramétrer" (Espace
 * Delphine) ne sont cliquables que pour manager/admin — la RLS limite
 * ensuite ce que chacun peut réellement voir/modifier une fois sur l'écran.
 */
export function getNiveau1Items(
  role: RoleUtilisateur | undefined,
  sansSolde = false,
): Niveau1Item[] {
  const peutParametrer = role === "manager" || role === "admin";
  const items: Niveau1Item[] = [];

  if (!(sansSolde && peutParametrer)) {
    items.push({ key: "poser", label: "Poser", href: "/" });
  }

  items.push(
    { key: "suivre", label: "Suivre", href: peutParametrer ? "/suivre/calendrier" : null },
    {
      key: "parametrer",
      label: "Paramétrer",
      href: peutParametrer ? "/parametrer/utilisateurs" : null,
    },
  );

  return items;
}

export function isNiveau1Actif(key: string, pathname: string): boolean {
  if (key === "parametrer") return pathname.startsWith("/parametrer");
  if (key === "suivre") return pathname.startsWith("/suivre");
  if (key === "poser")
    return !pathname.startsWith("/parametrer") && !pathname.startsWith("/suivre");
  return false;
}
