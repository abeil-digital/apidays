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
 * Bandeau de confirmation (08/09/2026, refonte — pleine largeur sous la nav
 * principale, remplace l'ancienne pastille flottante centrée) — pour les
 * confirmations "a posteriori" (ex. "Vous avez validé le congé de...") qui
 * doivent survivre à la fermeture du panneau qui a déclenché l'action.
 * Possédé par la page appelante (pas par `DetailCongePanel`, qui se démonte
 * à la fermeture) : `CongesPaiePage`/`SuivreDemandesPage` gèrent leur propre
 * état de toast et rendent ce composant. `top-14` = hauteur de `HeaderBar`
 * (`h-14`), non sticky — le bandeau reste fixe au scroll, pas la nav.
 */
export function Toast({
  message,
  actionLabel,
  onAction,
  onClose,
  duree = 8000,
  tone = "success",
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duree);
    return () => clearTimeout(timer);
  }, [onClose, duree]);

  const couleurs =
    tone === "error" ? "bg-status-danger-bg text-status-danger-fg" : "bg-mint-tint text-mint";

  return (
    <div
      className={`fixed inset-x-0 top-14 z-50 flex items-center justify-center gap-3 px-4 py-3 shadow-sm ${couleurs}`}
    >
      {tone === "error" ? (
        <TriangleAlert size={16} className="shrink-0" />
      ) : (
        <Check size={16} className="shrink-0" />
      )}
      <span className="text-sm font-semibold">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-sm font-bold underline underline-offset-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
