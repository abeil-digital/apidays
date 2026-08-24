"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { SelectFiltrePill } from "@/components/ui/FiltrePill";
import { CalendrierCollaborateur } from "@/components/suivre/CalendrierCollaborateur";

/**
 * "Calendrier" (`/suivre/calendrier`, 24/08/2026) — permet au manager/admin
 * de consulter le calendrier d'un collaborateur. Reprend le gabarit du
 * calendrier "nouvelle version" d'Accueil (`Dashboard2Page`, section "Mon
 * Calendrier") via `CalendrierCollaborateur` — PAS l'ancienne page dédiée
 * `/mon-calendrier` (gabarit différent, retenu dans un premier temps puis
 * explicitement écarté par Vincent). Un simple menu déroulant sélectionne le
 * collaborateur (mêmes conventions que `SuivreSoldesPage`/
 * `SuivreDemandesPage` — `SelectFiltrePill`, liste dérivée des utilisateurs
 * actifs chargés, triée alphabétiquement).
 *
 * Aucune sélection par défaut : le calendrier d'un collaborateur en
 * particulier n'a pas de choix "évident" à pré-sélectionner (contrairement à
 * `SuivreDemandesPage`/`SuivreSoldesPage`, qui affichent d'emblée toute
 * l'équipe) — un état vide invite explicitement à choisir.
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
      <h1 className="text-ink-900 px-1 text-2xl font-semibold">Calendrier</h1>

      {error && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error}
        </div>
      )}

      <div className="px-1">
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
        !loading && (
          <div className="text-ink-500 flex flex-col items-center gap-3 py-20 text-center text-sm">
            <CalendarDays size={32} className="text-ink-300" />
            Sélectionnez un collaborateur pour afficher son calendrier.
          </div>
        )
      )}
    </div>
  );
}
