"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useDemandesEquipe } from "@/hooks/useDemandesEquipe";

/**
 * Encart alerte "Demandes à étudier" (22/08/2026, Accueil) — visible manager
 * uniquement (rendu conditionnel côté `Dashboard2Page`), signale les
 * demandes de congés de l'équipe en attente de décision. Largeur ciblée aux
 * 2/3 de la grille "Suivre mes soldes" (3 `SoldeCard` de 200px = 600px, sur
 * les 900px de la grille avec le bouton "Poser un congé" inclus). Même
 * transition/hover que `SoldeCard` (`hover:scale-105 hover:shadow-md`,
 * 200ms) pour rester cohérent avec le reste de l'Accueil.
 *
 * **État "0" (24/08/2026)** : ne masque plus l'encart (comportement d'origine
 * du 22/08/2026) — reste affiché avec les mêmes teintes `status-success`
 * (vert) que le reste de l'app pour un état "tout est traité", plutôt que de
 * disparaître silencieusement.
 */
export function DemandesAEtudierCard() {
  const { demandes } = useDemandesEquipe();
  const nbEnAttente = demandes.filter((d) => d.statut === "en attente").length;
  const aJour = nbEnAttente === 0;

  return (
    <Link
      href="/suivre/demandes?statut=en_attente&periode=toutes_dates"
      className={`group flex w-full origin-left items-center gap-3 rounded-xl px-5 py-4 shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:scale-[1.02] hover:shadow md:max-w-[160px] ${
        aJour
          ? "bg-status-success-bg text-status-success-fg"
          : "bg-status-warning-bg text-status-warning-fg"
      }`}
    >
      <span className="origin-left text-[1.725rem] font-bold transition-transform duration-200 group-hover:scale-[1.1]">
        {nbEnAttente}
      </span>
      <span className="flex-1 text-xs leading-snug font-bold">
        {nbEnAttente > 1 ? "Demandes" : "Demande"}
        <br />à étudier
      </span>
      <ChevronRight size={20} className="shrink-0" />
    </Link>
  );
}
