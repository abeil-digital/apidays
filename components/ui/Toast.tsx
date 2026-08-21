"use client";

import { useEffect } from "react";
import { Check, TriangleAlert } from "lucide-react";

interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  /** Durée d'affichage avant fermeture automatique, en ms. */
  duree?: number;
  /** Icône/couleur (22/08/2026) — "error" pour une confirmation a posteriori
   * d'échec (ex. suppression qui échoue côté serveur), sans bloquer l'UI par
   * une popup. Défaut inchangé : succès (check vert). */
  tone?: "success" | "error";
}

/**
 * Bandeau de confirmation flottant, ancré en haut de la page — pour les
 * confirmations "a posteriori" (ex. "Vous avez validé le congé de...") qui
 * doivent survivre à la fermeture du panneau qui a déclenché l'action.
 * Possédé par la page appelante (pas par `DetailCongePanel`, qui se démonte
 * à la fermeture) : `CongesPaiePage`/`SuivreDemandesPage` gèrent leur propre
 * état de toast et rendent ce composant.
 */
export function Toast({
  message,
  actionLabel,
  onAction,
  onClose,
  duree = 5000,
  tone = "success",
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duree);
    return () => clearTimeout(timer);
  }, [onClose, duree]);

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="bg-ink-900 flex items-center gap-3 rounded-full py-2.5 pr-3 pl-4 text-white shadow-lg">
        {tone === "error" ? (
          <TriangleAlert size={16} className="text-status-danger-fg shrink-0" />
        ) : (
          <Check size={16} className="text-status-success-fg shrink-0" />
        )}
        <span className="text-xs font-semibold">{message}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 text-xs font-bold underline underline-offset-2"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
