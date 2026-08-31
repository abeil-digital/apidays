"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  title?: ReactNode;
  /** En-tête custom pleine largeur (ex. bandeau coloré type `SoldeDetailPanel`)
   * — remplace entièrement la barre titre/croix par défaut, croix de
   * fermeture y compris (à la charge de l'appelant). Si fourni, `title` est
   * ignoré. */
  header?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Largeur du panneau (classe `max-w-*`) — élargir pour les modales à colonnes (défaut : `max-w-md`). */
  className?: string;
  /** Alignement vertical — `"top"` fixe le panneau à une position stable
   * (indépendante de la hauteur du contenu), utile pour des popins dont le
   * contenu varie (ex. listes) et qui doivent apparaître au même endroit
   * d'un ouverture à l'autre. Défaut : centré. */
  align?: "center" | "top";
  /** Liseré + espacement entre `header` et `children` — n'a d'effet qu'avec
   * `header` (le rendu par défaut n'a jamais ce liseré). Désactivable
   * (18/08/2026, "Poser un jour") pour un en-tête discret qui n'a pas besoin
   * de se démarquer visuellement du corps. Défaut : activé (comportement
   * historique inchangé pour les appelants existants). */
  separateur?: boolean;
}

export function Modal({
  title,
  header,
  onClose,
  children,
  className = "max-w-md",
  align = "center",
  separateur = true,
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // `document.body` n'existe pas côté serveur (SSR/prerendering) — sans
  // conséquence pour l'hydratation : le contenu part de toute façon dans un
  // portail hors de la position de ce composant dans l'arbre, rien n'est
  // rendu ICI ni côté serveur ni côté client.
  if (typeof document === "undefined") return null;

  // Portail vers `document.body` (28/08/2026, même pattern que le popover de
  // `DatePicker.tsx`) — sans ça, une modale ouverte depuis un ancêtre
  // `position: sticky` (ex. `DetailCongePanel` non `pleineLargeur`) reste
  // piégée dans le contexte d'empilement local de cet ancêtre : son `z-50`
  // ne compte alors que localement, et un élément `fixed` sans z-index élevé
  // ailleurs dans la page (ex. le rail de navigation `SideNav`, `z-40`) peut
  // rester visible/cliquable par-dessus l'overlay censé tout bloquer.
  return createPortal(
    <div
      className={`bg-ink-900/50 fixed inset-0 z-50 flex justify-center px-4 ${
        align === "top" ? "items-start pt-12" : "items-center"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-surface-card flex max-h-[90vh] w-full flex-col shadow-lg ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={header ? "shrink-0" : "shrink-0 px-6 pt-6"}>
          {header ?? (
            <div className="relative flex items-center justify-center">
              <h2 className="text-ink-900 text-lg font-bold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="text-ink-500 absolute top-0 right-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>
        <div
          className={`overflow-y-auto ${
            header
              ? separateur
                ? "border-ink-300/60 border-t px-6 py-4"
                : "px-6 py-4"
              : "px-6 pt-8 pb-6"
          }`}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
