"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Largeur du panneau (classe `max-w-*`) — élargir pour les modales à colonnes (défaut : `max-w-md`). */
  className?: string;
  /** Alignement vertical — `"top"` fixe le panneau à une position stable
   * (indépendante de la hauteur du contenu), utile pour des popins dont le
   * contenu varie (ex. listes) et qui doivent apparaître au même endroit
   * d'un ouverture à l'autre. Défaut : centré. */
  align?: "center" | "top";
}

export function Modal({
  title,
  onClose,
  children,
  className = "max-w-md",
  align = "center",
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={`bg-ink-900/50 fixed inset-0 z-50 flex justify-center px-4 ${
        align === "top" ? "items-start pt-24" : "items-center"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-surface-card w-full rounded-xl p-6 shadow-lg ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
