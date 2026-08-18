"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import type {
  CongeImpose,
  Demande,
  DemandeEquipe,
  DjImposee,
  JourFerie,
  StatutDemande,
} from "@/lib/types";
import { formatDateAction, formatJours, formatPeriodeDemande } from "@/lib/format";
import {
  classeFondTypeBadge,
  classeTexteTypeBadge,
  LABEL_LONG,
  TypeBadge,
} from "@/components/demandes/TypeBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { SuiviDemandeRow } from "@/components/suivre/SuiviDemandeRow";
import {
  DetailPeriodeConges,
  creerResolveurOccupant,
} from "@/components/demandes/DetailPeriodeConges";

interface DetailCongePanelProps {
  // `demandeur`/`validateur` optionnels : un collaborateur consultant son
  // propre historique (`HistoriquePage`) n'a que des `Demande` simples, pas
  // de `DemandeEquipe` (pas de notion de "collaborateur" sur sa propre
  // demande). Les deux champs restent affichés quand présents (vue manager),
  // simplement omis sinon.
  selection: Demande & Partial<Pick<DemandeEquipe, "demandeur" | "validateur">>;
  onClose: () => void;
  /** Actions de décision — absentes en lecture seule (collaborateur sur son
   * propre historique) : les encarts Décision/Régularisation ne s'affichent
   * alors pas du tout, seul le feed (Posé le/Validé le/Refusé le) reste
   * visible. */
  onValider?: (commentaire: string) => Promise<void>;
  onRefuser?: (commentaire: string) => Promise<void>;
  onRegulariser?: (commentaire: string) => Promise<void>;
  /** Remonte l'état "action en cours" à l'appelant — `CongesPaiePage` verrouille
   * aussi ses propres contrôles (pills, champs Du/Au...) pendant ce temps, pour
   * éviter qu'une autre action ne parte en même temps (course déjà rencontrée
   * et corrigée une fois, voir CONTEXTE.md du 14/08/2026). */
  onEnCoursChange?: (enCours: boolean) => void;
  /** Appelé juste après une validation réussie (uniquement le bouton "Valider"
   * de la carte Décision, pas "Restaurer" qui appelle la même action pour un
   * autre sens) — l'appelant affiche un bandeau de confirmation qui doit
   * survivre à la fermeture de ce panneau, donc porté par lui, pas par nous. */
  onValiderSucces?: (id: string, message: string) => void;
  /** Données calendrier + autres demandes du même employé — uniquement pour
   * le lien "Voir" (demande "en attente", 18/08/2026), qui affiche le même
   * détail par semaine que la popin de dépôt. Optionnelles : absentes, le
   * lien "Voir" ne s'affiche simplement pas (ex. `CongesPaiePage`, qui ne
   * traite pas de demandes "en attente" par ce panneau). */
  joursFeries?: JourFerie[];
  congesImposes?: CongeImpose[];
  djImposees?: DjImposee[];
  autresDemandes?: Demande[];
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

// Nom de la variable CSS du token couleur du type — pour teinter un fond via
// `color-mix` (même procédé que `SoldeDetailPanel`/`MiniCalendrier`).
const VAR_COULEUR_TYPE: Record<string, string> = {
  CP: "--color-cp",
  RTT: "--color-rtt",
  CPA: "--color-cpa",
  CSS: "--color-css",
  CE: "--color-ce",
  RECUP: "--color-recup",
  EVT_FAM: "--color-evtfam",
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
  onValiderSucces,
  joursFeries,
  congesImposes,
  djImposees,
  autresDemandes,
}: DetailCongePanelProps) {
  const [commentaire, setCommentaire] = useState("");
  const [regularisationOuverte, setRegularisationOuverte] = useState(false);
  const [voirDetail, setVoirDetail] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ question: string; action: () => void } | null>(
    null,
  );

  const code = selection.type === "CP" && selection.isAnticipation ? "CPA" : selection.type;
  // Uniquement utile pour le toast/la modale de confirmation, tous deux
  // absents en lecture seule (pas de `demandeur` dans ce cas) — préfixe nom
  // omis plutôt qu'un risque d'accès à un champ absent.
  const periodeEtDuree = `${formatPeriodeDemande(selection.debut, selection.fin)} - ${formatJours(
    selection.nbDemiJournees / 2,
  )} j`;
  const resumeConge = selection.demandeur
    ? `${selection.demandeur.prenom} ${selection.demandeur.nom} - ${periodeEtDuree}`
    : periodeEtDuree;
  const peutDecider = Boolean(onValider && onRefuser && onRegulariser);
  const peutVoirDetail = Boolean(joursFeries && congesImposes && djImposees && autresDemandes);
  const occupant = peutVoirDetail
    ? creerResolveurOccupant({
        joursFeries: joursFeries!,
        congesImposes: congesImposes!,
        djImposees: djImposees!,
        demandes: autresDemandes!,
      })
    : null;

  // Refuser/Signaler comme non pris/Restaurer laissent le panneau ouvert
  // après succès (contrairement à Valider, qui ferme + bandeau — voir
  // `executerValidation`) : l'utilisateur voit tout de suite le changement
  // de statut dans le feed (ligne "Refusé le"/"Validé le" mise à jour) sans
  // avoir à rouvrir le panneau.
  async function executer(
    action: ((commentaire: string) => Promise<void>) | undefined,
    messageErreur: string,
  ) {
    if (!action) return;
    setEnCours(true);
    onEnCoursChange?.(true);
    setErreurAction(null);
    try {
      await action(commentaire.trim());
      setCommentaire("");
    } catch {
      setErreurAction(messageErreur);
    } finally {
      setEnCours(false);
      onEnCoursChange?.(false);
    }
  }

  async function executerValidation() {
    if (!onValider) return;
    setEnCours(true);
    onEnCoursChange?.(true);
    setErreurAction(null);
    try {
      await onValider(commentaire.trim());
      onValiderSucces?.(selection.id, `Vous avez validé le congé de ${resumeConge}`);
      onClose();
    } catch {
      setErreurAction("Impossible de valider cette demande.");
    } finally {
      setEnCours(false);
      onEnCoursChange?.(false);
    }
  }

  // Refuser/Régularisation demandent une confirmation avant d'agir
  // (contrairement à Valider, qui agit tout de suite puis affiche un
  // bandeau annulable — voir `executerValidation`) : ouvre la modale plutôt
  // que d'appeler `executer` directement, celui-ci n'étant déclenché qu'au
  // clic sur "Confirmer".
  function demanderConfirmation(verbe: string, action: () => void) {
    setConfirmation({
      question: `Êtes-vous certain de ${verbe} ce congé :`,
      action,
    });
  }

  return (
    <div className="flex w-full flex-col gap-[3px] xl:sticky xl:top-4 xl:w-64 xl:shrink-0">
      <div className="bg-surface-card w-full pb-[25px] shadow-sm">
        <div className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(code)}`}>
          <div className="flex items-center gap-2.5">
            <div className="rounded-full ring-2 ring-white">
              <TypeBadge code={code} />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                {selection.demandeur
                  ? `${selection.demandeur.prenom} ${selection.demandeur.nom}`
                  : LABEL_LONG[code]}
              </div>
              {selection.demandeur && (
                <div className="text-xs font-semibold text-white/80">{LABEL_LONG[code]}</div>
              )}
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

        <div className="border-ink-300/60 flex flex-col border-t px-4 pt-3">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${classeFondTypeBadge(code)}`} />
            <span className="text-ink-500 text-[10px]">
              Posé le {formatDateAction(selection.datePose)}
            </span>
          </div>
          {selection.note && (
            <div className="text-ink-500 pt-1 pb-2 pl-[0.875rem] text-[10px] italic">
              {selection.note}
            </div>
          )}
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
          <div className="text-ink-500 pr-4 pl-[1.875rem] text-[10px] italic">
            {selection.commentaireManager}
          </div>
        )}

        {
          // "refusé" est un état terminal ici — pas de bouton Refuser/Valider
          // (elle n'est plus "en attente") ni de Régularisation (ce mécanisme
          // corrige un congé qui avait été accordé, une demande refusée ne
          // l'a jamais été). Le commentaire de refus (s'il existe) est déjà
          // affiché juste au-dessus, rien d'autre à montrer ici. "en attente"
          // a son propre encart Décision, "validé"/"annulé" leur propre
          // encart Régularisation, juste en dessous.
          null
        }
      </div>

      {peutDecider && (selection.statut === "validé" || selection.statut === "annulé") && (
        <>
          <button
            type="button"
            onClick={() => setRegularisationOuverte((v) => !v)}
            className="text-ink-500 flex w-fit items-center gap-1 px-4 py-1 text-xs font-semibold"
          >
            Régularisation
            {regularisationOuverte ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {regularisationOuverte && (
            <div
              className="w-full shadow-sm"
              style={{
                backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_TYPE[code]}) 5%, white)`,
              }}
            >
              <div className={`px-4 pt-3 pb-1 text-sm font-bold ${classeTexteTypeBadge(code)}`}>
                Régularisation de congés
              </div>
              <div className="px-4 pt-1.5 pb-2">
                <label
                  htmlFor="commentaire-decision"
                  className="text-ink-500 mb-1.5 block text-[11px] font-bold"
                >
                  Commentaire (obligatoire)
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
                  className="w-full rounded-md text-xs placeholder:text-xs"
                />
              </div>

              {erreurAction && (
                <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 mb-3 px-3 py-2.5 text-xs">
                  {erreurAction}
                </div>
              )}

              <div className="px-4 pb-4">
                {selection.statut === "validé" ? (
                  <Button
                    variant={commentaire.trim() ? "primary" : "secondary"}
                    onClick={() =>
                      demanderConfirmation("signaler comme non pris", () =>
                        executer(onRegulariser, "Impossible de signaler ce congé comme non pris."),
                      )
                    }
                    disabled={enCours || !commentaire.trim()}
                    className="w-full justify-center rounded-full px-4 py-2 text-xs"
                  >
                    Signaler comme non pris
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      demanderConfirmation("restaurer", () =>
                        executer(onValider, "Impossible de restaurer cette demande."),
                      )
                    }
                    disabled={enCours || !commentaire.trim()}
                    className="w-full justify-center rounded-full px-4 py-2 text-xs"
                  >
                    <Check size={16} />
                    Restaurer
                    <Check size={16} className="invisible" aria-hidden />
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {peutDecider && selection.statut === "en attente" && (
        <div
          className="w-full shadow-sm"
          style={{
            backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_TYPE[code]}) 5%, white)`,
          }}
        >
          <div className={`px-4 pt-3 pb-1 text-sm font-bold ${classeTexteTypeBadge(code)}`}>
            Décision
          </div>

          <div className="px-4 pt-1.5 pb-2">
            <label
              htmlFor="commentaire-decision"
              className="text-ink-500 mb-1.5 block text-[11px] font-bold"
            >
              Commentaire
            </label>
            <Textarea
              id="commentaire-decision"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              placeholder="Ex. régularisation confirmée par le salarié…"
              className="w-full rounded-md text-xs placeholder:text-xs"
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
              onClick={() =>
                demanderConfirmation("refuser", () =>
                  executer(onRefuser, "Impossible de refuser cette demande."),
                )
              }
              disabled={enCours}
              className="text-status-danger-fg border-status-danger-fg justify-center rounded-full bg-white/50 px-4 py-2 text-xs"
            >
              Refuser
            </Button>
            <Button
              onClick={executerValidation}
              disabled={enCours}
              className="flex-1 justify-center rounded-full px-4 py-2 text-xs"
            >
              <Check size={16} />
              Valider
              <Check size={16} className="invisible" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      {peutDecider && selection.statut === "en attente" && peutVoirDetail && (
        <>
          <button
            type="button"
            onClick={() => setVoirDetail((v) => !v)}
            className="text-ink-500 flex w-fit items-center gap-1 px-4 py-1 text-xs font-semibold"
          >
            Informations complémentaires
            {voirDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {voirDetail && (
            <div className="bg-surface-card w-full px-4 pb-3">
              <DetailPeriodeConges
                debut={selection.debut}
                fin={selection.fin}
                demiDebut={selection.demiDebut}
                demiFin={selection.demiFin}
                codeParDefaut={code}
                occupant={occupant!}
              />
            </div>
          )}
        </>
      )}

      {confirmation && (
        <Modal onClose={() => setConfirmation(null)} className="max-w-sm">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-ink-900 text-sm font-semibold">{confirmation.question}</p>
              <p className="text-ink-500 mt-1 text-xs">{resumeConge}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmation(null)}
                className="rounded-full px-4 py-2 text-xs"
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  confirmation.action();
                  setConfirmation(null);
                }}
                className="rounded-full px-4 py-2 text-xs"
              >
                Confirmer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
