export interface Niveau1Item {
  key: string;
  label: string;
  href: string | null;
}

/**
 * Navigation de niveau 1 (header général). Seul "Poser" est fonctionnel
 * pour l'instant — "Suivre" et "Paramétrer" sont des emplacements réservés
 * pour les futurs espaces (Manager / Delphine), sans route ni page derrière.
 */
export const NIVEAU1_ITEMS: Niveau1Item[] = [
  { key: "poser", label: "Poser", href: "/" },
  { key: "suivre", label: "Suivre", href: null },
  { key: "parametrer", label: "Paramétrer", href: null },
];
