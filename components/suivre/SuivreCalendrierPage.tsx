"use client";

import { useState } from "react";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { SelectPille } from "@/components/ui/SelectPille";
import { DemandesAEtudierCard } from "@/components/dashboard/DemandesAEtudierCard";
import { CalendrierCollaborateur } from "@/components/suivre/CalendrierCollaborateur";
import { CalendrierGlobal } from "@/components/suivre/CalendrierGlobal";
import { SelectPeriodeAdmin, type ModePeriode } from "@/components/suivre/SelectPeriodeAdmin";

/**
 * "Calendriers des absences" (`/suivre/calendrier`, 24/08/2026, refonte du
 * 28/08/2026 — Backlog "Calendrier des employés : vue globale", priorité
 * Urgente ; titre de page/section renommé le 24/09/2026, demande explicite
 * de Vincent — "Calendrier" seul prêtait à confusion avec le calendrier
 * personnel du collaborateur) permet au manager/admin de consulter soit une
 * heatmap globale de l'équipe (`CalendrierGlobal`, vue par défaut), soit le
 * calendrier détaillé d'un collaborateur précis (`CalendrierCollaborateur`,
 * sur sélection explicite — mêmes conventions que
 * `SuivreSoldesPage`/`SuivreDemandesPage`, liste dérivée des utilisateurs
 * actifs, triée alphabétiquement). Pas d'état vide invitant à choisir : la
 * heatmap est toujours affichable, avec ou sans collaborateur sélectionné.
 * Titre de page statique (avant : dynamique "Calendrier consolidé"/
 * "Calendrier de {prénom}") — l'information de sélection vit désormais dans
 * les pills elles-mêmes, pas doublée dans le titre.
 *
 * 2 sélecteurs visibles côte à côte sous le titre (24/09/2026, demande
 * explicite) : "Collaborateur :" (`SelectPille`, remplace le `<select>`
 * natif rendu invisible/superposé à un simple chevron — retour de Delphine,
 * pas assez visible/découvrable) et "Commence :" (`SelectPeriodeAdmin`,
 * remonté ici depuis `CalendrierGlobal`/`CalendrierCollaborateur` pour
 * cohabiter sur la même ligne — bonus : la période sélectionnée persiste
 * désormais en changeant de collaborateur, avant elle se réinitialisait à
 * chaque sélection).
 *
 * `DemandesAEtudierCard` intégrée sous le titre (24/09/2026, règle métier
 * "profils manager/admin sans suivi de solde" — ces profils n'ont pas accès
 * à "Poser"/Accueil, voir `proxy.ts`, et atterrissent ici : ce bloc leur
 * donne un accès direct aux demandes en attente sans repasser par
 * l'Accueil). Affichée inconditionnellement pour tout manager/admin visitant
 * cette page (déjà réservée à ces rôles par `proxy.ts`), pas seulement pour
 * les profils "sans suivi de solde" — composant autonome, aucune prop.
 *
 * Titre conditionnel (24/09/2026, demande explicite — "la page calendrier
 * devient la page d'accueil" pour un profil sans suivi de solde) : pour CE
 * profil précis (pas pour un manager/admin normal visitant cette page via
 * Suivre > Calendriers), le H1 devient "Accueil Manager"/"Accueil
 * Administrateur" plutôt que "Calendriers des absences" — avec un H2
 * "Calendriers des absences" réinséré juste après le bloc "Demandes à
 * étudier", pour ne pas perdre le repère visuel sur le contenu qui suit. H2
 * et son contenu (sélecteurs + calendrier) regroupés dans un conteneur
 * imbriqué à `gap-2` (au lieu du `gap-5` du conteneur racine) : interlignage
 * volontairement plus resserré APRÈS le H2 (vers son contenu) qu'AVANT
 * (entre "Demandes à étudier" et le H2, qui garde le `gap-5` standard).
 */
export function SuivreCalendrierPage() {
  const { utilisateur: utilisateurCourant } = useUtilisateur();
  const { utilisateurs, loading, error } = useUtilisateursAdmin();
  const [collaborateurId, setCollaborateurId] = useState("");
  const [modePeriode, setModePeriode] = useState<ModePeriode>("aujourdhui");

  const estSansSolde = Boolean(utilisateurCourant?.sansSolde);
  const titre = estSansSolde
    ? utilisateurCourant?.role === "admin"
      ? "Accueil Administrateur"
      : "Accueil Manager"
    : "Calendriers des absences";

  // `!u.sansSolde` (24/09/2026) : un manager/admin "sans suivi de solde"
  // n'a pas de calendrier de congés à consulter ici.
  const actifs = utilisateurs.filter((u) => u.statut === "actif" && !u.sansSolde);
  const collaborateurs = [...actifs]
    .map((u) => [u.id, `${u.prenom} ${u.nom}`] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const collaborateurSelectionne = actifs.find((u) => u.id === collaborateurId) ?? null;

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0">
      <h1 className="text-ink-900 animate-stagger-in px-1 text-2xl font-semibold">{titre}</h1>

      <div className="animate-stagger-in px-1">
        <DemandesAEtudierCard />
      </div>

      {(() => {
        const contenu = (
          <div className="flex flex-col gap-2">
            <div className="animate-stagger-in flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
              <SelectPille
                value={collaborateurId}
                onChange={(e) => setCollaborateurId(e.target.value)}
                disabled={loading}
                aria-label="Sélectionner un collaborateur"
              >
                <option value="">Vue consolidée</option>
                {collaborateurs.map(([id, nom]) => (
                  <option key={id} value={id}>
                    {nom}
                  </option>
                ))}
              </SelectPille>
              <SelectPeriodeAdmin mode={modePeriode} onChange={setModePeriode} />
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
                modePeriode={modePeriode}
              />
            ) : (
              !loading && <CalendrierGlobal modePeriode={modePeriode} />
            )}
          </div>
        );

        if (!estSansSolde) return contenu;

        return (
          <div className="flex flex-col gap-2">
            <h2 className="text-ink-900 animate-stagger-in px-1 text-lg font-semibold">
              Calendriers des absences
            </h2>
            {contenu}
          </div>
        );
      })()}
    </div>
  );
}
