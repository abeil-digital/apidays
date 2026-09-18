"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { todayISO } from "@/lib/format";
import { couleurHeatmap } from "@/lib/heatmap";
import { useDemandesEquipe } from "@/hooks/useDemandesEquipe";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";

/** Poids en jours d'une demande pour un jour donné (0,5 si demi-journée de
 * début/fin ce jour-là) — même formule que `CalendrierGlobal.tsx`
 * (`poidsJourneeDemande`), dupliquée ici volontairement pour une première
 * version simple de la card (18/09/2026) : pas de prise en compte des
 * fériés/CPI/DJI communs, à affiner ensemble si besoin. */
function poidsJournee(debut: string, fin: string, demiDebut: string, demiFin: string, iso: string) {
  const matinCouvert = !(iso === debut && demiDebut === "apres_midi");
  const apresMidiCouvert = !(iso === fin && demiFin === "matin");
  return matinCouvert && apresMidiCouvert ? 1 : 0.5;
}

/**
 * Encart Accueil "Collaborateurs en congé aujourd'hui" (18/09/2026, en lien
 * avec le Backlog "Section what's up pour le dashboard manager et
 * administrateur") — visible manager/admin, même gabarit que
 * `DemandesAEtudierCard` (card cliquable, gros chiffre + libellé), mais
 * colorée avec le même dégradé que le heatmap de "Calendrier consolidé"
 * (`lib/heatmap.ts`) plutôt qu'un code couleur success/warning fixe.
 *
 * Version volontairement simple pour itérer : ratio basé sur le nombre de
 * jours-personnes occupés aujourd'hui / effectif actif, sans les fériés/
 * CPI/DJI communs (voir `CalendrierGlobal.tsx` pour la version complète).
 */
export function CollaborateursEnCongeCard() {
  const { demandes } = useDemandesEquipe();
  const { utilisateurs } = useUtilisateursAdmin();

  const aujourdhui = todayISO();
  const actifsIds = new Set(utilisateurs.filter((u) => u.statut === "actif").map((u) => u.id));
  const totalActifs = actifsIds.size;

  const vues = new Set<string>();
  const occupants = demandes.filter((d) => {
    if (d.statut !== "validé" && d.statut !== "en attente") return false;
    if (aujourdhui < d.debut || aujourdhui > d.fin) return false;
    if (!actifsIds.has(d.demandeur.id)) return false;
    if (vues.has(d.demandeur.id)) return false;
    vues.add(d.demandeur.id);
    return true;
  });

  const poidsTotal = occupants.reduce(
    (somme, d) => somme + poidsJournee(d.debut, d.fin, d.demiDebut, d.demiFin, aujourdhui),
    0,
  );
  const ratio = totalActifs === 0 ? 0 : poidsTotal / totalActifs;
  const couleur = ratio === 0 ? "#ffffff" : couleurHeatmap(Math.min(100, Math.max(15, Math.round(ratio * 100))));
  const texteSombre = ratio === 0 || Math.round(ratio * 100) < 55;

  return (
    <Link
      href="/suivre/calendrier"
      style={{ background: couleur }}
      className={`group flex w-full origin-left items-center gap-3 rounded-none px-5 py-4 shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:scale-[1.02] hover:shadow md:max-w-[180px] ${
        texteSombre ? "text-ink-900" : "text-white"
      }`}
    >
      <span className="origin-left text-[1.725rem] font-bold transition-transform duration-200 group-hover:scale-[1.1]">
        {occupants.length}
      </span>
      <span className="min-w-0 flex-1 text-[11px] leading-snug font-semibold break-words">
        {occupants.length === 1 ? "Employé" : "Employés"}
        <br />
        en congé{occupants.length === 1 ? "" : "s"}
      </span>
      <ChevronRight size={20} className="shrink-0" />
    </Link>
  );
}
