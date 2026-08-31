"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { CalendrierCollaborateur } from "@/components/suivre/CalendrierCollaborateur";
import { CalendrierGlobal } from "@/components/suivre/CalendrierGlobal";

/**
 * "Calendrier" (`/suivre/calendrier`, 24/08/2026, refonte du 28/08/2026 —
 * Backlog "Calendrier des employés : vue globale", priorité Urgente) permet
 * au manager/admin de consulter soit une heatmap globale de l'équipe
 * (`CalendrierGlobal`, vue par défaut), soit le calendrier détaillé d'un
 * collaborateur précis (`CalendrierCollaborateur`, sur sélection explicite —
 * mêmes conventions que `SuivreSoldesPage`/`SuivreDemandesPage`, liste
 * dérivée des utilisateurs actifs, triée alphabétiquement). Pas d'état vide
 * invitant à choisir : la heatmap est toujours affichable, avec ou sans
 * collaborateur sélectionné.
 *
 * Sélecteur intégré au titre (29/08/2026, demande explicite) — un simple
 * chevron à côté du `h1` plutôt qu'une pill séparée en dessous : le `<select>`
 * natif reste la seule interaction (accessible, pas de popover custom à
 * gérer), juste rendu invisible et superposé au chevron (même principe que
 * `SelectFiltrePill`). Le titre lui-même reflète la sélection ("Calendrier
 * consolidé" / "Calendrier de {prénom}").
 */
export function SuivreCalendrierPage() {
  const { utilisateurs, loading, error } = useUtilisateursAdmin();
  const [collaborateurId, setCollaborateurId] = useState("");

  const actifs = utilisateurs.filter((u) => u.statut === "actif");
  const collaborateurs = [...actifs]
    .map((u) => [u.id, `${u.prenom} ${u.nom}`] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const collaborateurSelectionne = actifs.find((u) => u.id === collaborateurId) ?? null;

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0">
      <div className="animate-stagger-in flex items-center gap-1 px-1">
        <h1 className="text-slate text-2xl font-semibold">
          {collaborateurSelectionne
            ? `Calendrier de ${collaborateurSelectionne.prenom} ${collaborateurSelectionne.nom.charAt(0)}.`
            : "Calendrier consolidé"}
        </h1>
        <div className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center">
          <select
            value={collaborateurId}
            onChange={(e) => setCollaborateurId(e.target.value)}
            disabled={loading}
            aria-label="Sélectionner un collaborateur"
            className="absolute inset-0 cursor-pointer appearance-none opacity-0"
          >
            <option value="">Vue consolidée</option>
            {collaborateurs.map(([id, nom]) => (
              <option key={id} value={id}>
                {nom}
              </option>
            ))}
          </select>
          <ChevronDown size={20} className="text-slate pointer-events-none" />
        </div>
      </div>

      {error && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error}
        </div>
      )}

      {collaborateurSelectionne ? (
        <CalendrierCollaborateur
          key={collaborateurSelectionne.id}
          utilisateurId={collaborateurSelectionne.id}
        />
      ) : (
        !loading && <CalendrierGlobal />
      )}
    </div>
  );
}
