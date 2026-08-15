"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import type { DemandeEquipe, StatutDemande } from "@/lib/types";
import { formatDateAction } from "@/lib/format";
import { classeFondTypeBadge, LABEL_LONG, TypeBadge } from "@/components/demandes/TypeBadge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { SuiviDemandeRow } from "@/components/suivre/SuiviDemandeRow";

interface DetailCongePanelProps {
  selection: DemandeEquipe;
  onClose: () => void;
  onValider: (commentaire: string) => Promise<void>;
  onRefuser: (commentaire: string) => Promise<void>;
  onRegulariser: (commentaire: string) => Promise<void>;
  /** Remonte l'état "action en cours" à l'appelant — `CongesPaiePage` verrouille
   * aussi ses propres contrôles (pills, champs Du/Au...) pendant ce temps, pour
   * éviter qu'une autre action ne parte en même temps (course déjà rencontrée
   * et corrigée une fois, voir CONTEXTE.md du 14/08/2026). */
  onEnCoursChange?: (enCours: boolean) => void;
}

function formatJjMmAa(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(`${iso}T00:00:00`));
}

const LIBELLE_DECISION: Record<StatutDemande, string> = {
  "en attente": "Décidé",
  validé: "Validé",
  refusé: "Refusé",
  annulé: "Annulé",
};

// Couleur du texte "Validé le"/"Refusé le" — reprend le tone de
// `STATUT_CONFIG` (success/warning/danger) déjà utilisé par `StatusBadge`.
const TEXTE_DECISION: Record<StatutDemande, string> = {
  "en attente": "text-status-warning-fg",
  validé: "text-status-success-fg",
  refusé: "text-status-danger-fg",
  annulé: "text-status-danger-fg",
};

/**
 * "Détail du congé" — panneau latéral droit générique, extrait de
 * `CongesPaiePage.tsx` (Export paie) pour être réutilisé tel quel par
 * `SuivreDemandesPage.tsx` (Suivre les demandes), au clic sur la pill Dates —
 * même gabarit, mêmes actions, plutôt que dupliquer ~150 lignes une seconde
 * fois. État (commentaire, régularisation ouverte, en cours, erreur)
 * entièrement local : l'appelant doit remonter le composant via `key`
 * (`key={selection.id}`) à chaque changement de sélection pour repartir
 * d'un état propre.
 *
 * Actions reçues déjà "prêtes à l'emploi" (l'appelant décide s'il refetch
 * une liste entière ou met à jour son état en optimiste — `CongesPaiePage`
 * fait l'un, `SuivreDemandesPage`/`useDemandesEquipe` l'autre) ; ce
 * composant se contente de gérer le loading/erreur générique autour de
 * l'appel et de fermer le panneau au succès.
 *
 * Branche par statut, identique à l'original :
 * - **validé/annulé** : lien "Régularisation" replié par défaut → Supprimer
 *   (validé → annulé) ou Restaurer (annulé → validé, réutilise `onValider`).
 * - **refusé** : lecture seule, aucune action (jamais accordé, la
 *   régularisation n'a pas de sens ici).
 * - **en attente** : commentaire + Refuser/Valider.
 */
export function DetailCongePanel({
  selection,
  onClose,
  onValider,
  onRefuser,
  onRegulariser,
  onEnCoursChange,
}: DetailCongePanelProps) {
  const [commentaire, setCommentaire] = useState("");
  const [regularisationOuverte, setRegularisationOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  const code = selection.type === "CP" && selection.isAnticipation ? "CPA" : selection.type;

  async function executer(action: (commentaire: string) => Promise<void>, messageErreur: string) {
    setEnCours(true);
    onEnCoursChange?.(true);
    setErreurAction(null);
    try {
      await action(commentaire.trim());
      onClose();
    } catch {
      setErreurAction(messageErreur);
    } finally {
      setEnCours(false);
      onEnCoursChange?.(false);
    }
  }

  return (
    <div className="bg-surface-card w-full shadow-sm xl:sticky xl:top-4 xl:w-64 xl:shrink-0">
      <div className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(code)}`}>
        <div className="flex items-center gap-2.5">
          <div className="rounded-full ring-2 ring-white">
            <TypeBadge code={code} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">
              {selection.demandeur.prenom} {selection.demandeur.nom}
            </div>
            <div className="text-xs font-semibold text-white/80">{LABEL_LONG[code]}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={enCours}
          className="shrink-0 text-white/70 hover:text-white disabled:opacity-40"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="border-ink-300/60 border-t">
        <SuiviDemandeRow demande={selection} isLast masquerType masquerPoseLe />
      </div>

      <div className="border-ink-300/60 flex flex-col border-t px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${classeFondTypeBadge(code)}`} />
          <span className="text-ink-500 text-[10px]">
            Posé le {formatDateAction(selection.datePose)}
          </span>
        </div>
        {selection.dateDecision && (
          <div className="flex gap-2">
            <div className="flex w-1.5 shrink-0 justify-center">
              <span className={`h-2 w-px ${classeFondTypeBadge(code)}`} />
            </div>
          </div>
        )}
        {selection.dateDecision && (
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${classeFondTypeBadge(code)}`} />
            <span className="text-[10px]">
              <span className={`font-semibold ${TEXTE_DECISION[selection.statut]}`}>
                {LIBELLE_DECISION[selection.statut]} le {formatJjMmAa(selection.dateDecision)}
              </span>
              {selection.validateur && (
                <span className="text-ink-500"> par {selection.validateur.prenom}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {selection.commentaireManager && (
        <div className="text-ink-500 pr-4 pb-4 pl-[1.875rem] text-xs">
          {selection.commentaireManager}
        </div>
      )}

      {selection.statut === "validé" || selection.statut === "annulé" ? (
        <div className="pb-4">
          <button
            type="button"
            onClick={() => setRegularisationOuverte((v) => !v)}
            className="text-ink-500 flex items-center gap-1 px-4 pt-3 text-xs font-semibold"
          >
            Régularisation
            {regularisationOuverte ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {regularisationOuverte && (
            <div className="pt-2">
              <div className="px-4 pb-2">
                <label
                  htmlFor="commentaire-decision"
                  className="text-ink-500 mb-1.5 block text-[11px]"
                >
                  Commentaire (motif, traçabilité)
                </label>
                <Textarea
                  id="commentaire-decision"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  rows={2}
                  placeholder={
                    selection.statut === "validé"
                      ? "Ex. congé finalement non pris…"
                      : "Ex. annulation faite par erreur…"
                  }
                  className="w-full rounded-none text-xs placeholder:text-xs"
                />
              </div>

              {erreurAction && (
                <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 mb-3 px-3 py-2.5 text-xs">
                  {erreurAction}
                </div>
              )}

              <div className="px-4">
                {selection.statut === "validé" ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      executer(onRegulariser, "Impossible de supprimer cette demande.")
                    }
                    disabled={enCours}
                    className="text-status-danger-fg border-status-danger-fg w-full justify-center rounded-full px-4 py-2 text-xs"
                  >
                    Supprimer
                  </Button>
                ) : (
                  <Button
                    onClick={() => executer(onValider, "Impossible de restaurer cette demande.")}
                    disabled={enCours}
                    className="w-full justify-center rounded-full px-4 py-2 text-xs"
                  >
                    <Check size={16} />
                    Restaurer
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : selection.statut === "refusé" ? (
        // Une demande refusée est un état terminal ici — pas de bouton
        // Refuser/Valider (elle n'est plus "en attente") ni de
        // Régularisation (ce mécanisme corrige un congé qui avait été
        // accordé, une demande refusée ne l'a jamais été). Le commentaire de
        // refus (s'il existe) est déjà affiché juste au-dessus, rien d'autre
        // à montrer ici.
        null
      ) : (
        <>
          <div className="px-4 pt-3 pb-2">
            <label htmlFor="commentaire-decision" className="text-ink-500 mb-1.5 block text-[11px]">
              Commentaire (motif, traçabilité)
            </label>
            <Textarea
              id="commentaire-decision"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              placeholder="Ex. régularisation confirmée par le salarié…"
              className="w-full rounded-none text-xs placeholder:text-xs"
            />
          </div>

          {erreurAction && (
            <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 mb-3 px-3 py-2.5 text-xs">
              {erreurAction}
            </div>
          )}

          <div className="flex gap-2 px-4 pb-4">
            <Button
              variant="secondary"
              onClick={() => executer(onRefuser, "Impossible de refuser cette demande.")}
              disabled={enCours}
              className="text-status-danger-fg border-status-danger-fg flex-1 justify-center rounded-full px-4 py-2 text-xs"
            >
              Refuser
            </Button>
            <Button
              onClick={() => executer(onValider, "Impossible de valider cette demande.")}
              disabled={enCours}
              className="flex-1 justify-center rounded-full px-4 py-2 text-xs"
            >
              <Check size={16} />
              Valider
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
