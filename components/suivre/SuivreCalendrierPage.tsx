"use client";

import { useState } from "react";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { SelectFiltrePill } from "@/components/ui/FiltrePill";
import { CalendrierCollaborateur } from "@/components/suivre/CalendrierCollaborateur";
import { CalendrierGlobal } from "@/components/suivre/CalendrierGlobal";

/**
 * "Calendrier" (`/suivre/calendrier`, 24/08/2026, refonte du 28/08/2026 —
 * Backlog "Calendrier des employés : vue globale", priorité Urgente) permet
 * au manager/admin de consulter soit une heatmap globale de l'équipe
 * (`CalendrierGlobal`, vue par défaut), soit le calendrier détaillé d'un
 * collaborateur précis (`CalendrierCollaborateur`, sur sélection explicite
 * via le menu déroulant — mêmes conventions que `SuivreSoldesPage`/
 * `SuivreDemandesPage`, liste dérivée des utilisateurs actifs, triée
 * alphabétiquement). Pas d'état vide invitant à choisir : la heatmap est
 * toujours affichable, avec ou sans collaborateur sélectionné.
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
      <h1 className="text-ink-900 animate-stagger-in px-1 text-2xl font-semibold">
        Calendrier consolidé
      </h1>

      {error && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error}
        </div>
      )}

      <div className="animate-stagger-in px-1" style={{ animationDelay: "90ms" }}>
        <SelectFiltrePill
          value={collaborateurId}
          onChange={(e) => setCollaborateurId(e.target.value)}
          disabled={loading}
        >
          <option value="">{loading ? "Chargement…" : "Sélectionner un collaborateur"}</option>
          {collaborateurs.map(([id, nom]) => (
            <option key={id} value={id}>
              {nom}
            </option>
          ))}
        </SelectFiltrePill>
      </div>

      {collaborateurSelectionne ? (
        <CalendrierCollaborateur
          key={collaborateurSelectionne.id}
          utilisateurId={collaborateurSelectionne.id}
          nomComplet={`${collaborateurSelectionne.prenom} ${collaborateurSelectionne.nom}`}
        />
      ) : (
        !loading && <CalendrierGlobal />
      )}
    </div>
  );
}
