"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import type {
  CongeImpose,
  Demande,
  DemandeEquipe,
  DjImposee,
  JourFerie,
  LigneExportPaie,
  StatutDemande,
  StatutTransmission,
} from "@/lib/types";
import { useSoldes } from "@/hooks/useSoldes";
import { fetchHistoriqueDecisions, type DecisionHistorique } from "@/lib/data/demandes.repository";
import { formatDateAction, formatJours, formatPeriodeDemande } from "@/lib/format";
import {
  classeBordureTypeBadge,
  classeFondTypeBadge,
  classeTexteTypeBadge,
  LABEL_LONG,
  TypeBadge,
} from "@/components/demandes/TypeBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PeriodeAvecPastilles } from "@/components/ui/PeriodeAvecPastilles";
import { STATUT_CONFIG } from "@/components/ui/StatusBadge";
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
  /** Masque le bandeau coloré du haut (TypeBadge + nom/type + fermer) — opt-in,
   * ajouté le 18/08/2026 pour un tiroir "En validation" d'Accueil depuis
   * retiré — plus aucun appelant actuel, gardé disponible pour un futur
   * panneau étroit qui n'aurait pas besoin du bandeau pleine largeur. */
  masquerBandeau?: boolean;
  /** Masque uniquement le bouton "Fermer" (croix) du bandeau coloré — opt-in,
   * bandeau lui-même conservé. Utilisé par le tiroir "Listing" d'Accueil
   * (`ListingTiroir`, 18/08/2026), qui empile plusieurs cartes sans fermeture
   * individuelle (le tiroir n'a lui-même pas de croix pour l'instant). */
  masquerFermer?: boolean;
  /** Masque uniquement le `TypeBadge` (cercle) du bandeau coloré — opt-in,
   * reste du bandeau conservé (fond coloré, nom/type). Utilisé par le tiroir
   * "Listing" d'Accueil (`ListingTiroir`, 18/08/2026) : le fond coloré + le
   * texte suffisent déjà à identifier le type sur ces cartes empilées. */
  masquerTypeBadgeBandeau?: boolean;
  /** Lignes de transmission paie de cette demande (`export_paie_lignes`,
   * 24/08/2026) — optionnel, absent partout sauf depuis "Transmissions paie".
   * Ajoute une entrée "Transmis le"/"En paye le"/"Écart" au feed pour
   * chaque ligne (une demande à cheval sur deux périodes peut en avoir
   * plusieurs). */
  lignesTransmission?: LigneExportPaie[];
  /** Prévision "si je transmets maintenant" (25/08/2026) — optionnel, absent
   * partout sauf depuis "Quels congés transmettre"/"Générer l'export"
   * (Transmissions paie). Ajoute une entrée "Transmis paie le {aujourd'hui} -
   * X j/Y j" en fin de feed (orange, `X j` en gras — 25/08/2026, demande
   * explicite), distincte visuellement des lignes réelles
   * (`lignesTransmission`, `export_paie_lignes` déjà créées) — c'est une
   * projection, rien n'a encore été transmis. Sert à clarifier, congé par
   * congé, ce que contiendrait l'export si Delphine cliquait "Transmettre"
   * maintenant (répond à la confusion notée sur l'aperçu global de "Générer
   * l'export", qui n'affiche pas ce détail par congé). */
  previsionTransmission?: { jours: number; total: number };
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

const LIBELLE_TRANSMISSION: Record<StatutTransmission, string> = {
  transmis: "Transmis",
  en_paye: "En paye",
  ecart: "Écart signalé",
};

const TEXTE_TRANSMISSION: Record<StatutTransmission, string> = {
  transmis: "text-status-warning-fg",
  en_paye: "text-status-success-fg",
  ecart: "text-status-danger-fg",
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
  masquerBandeau = false,
  masquerFermer = false,
  masquerTypeBadgeBandeau = false,
  lignesTransmission,
  previsionTransmission,
}: DetailCongePanelProps) {
  const [commentaire, setCommentaire] = useState("");
  const [regularisationOuverte, setRegularisationOuverte] = useState(false);
  const [voirDetail, setVoirDetail] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ question: string; action: () => void } | null>(
    null,
  );
  const [historiqueDecisions, setHistoriqueDecisions] = useState<DecisionHistorique[]>([]);

  // Journal complet des décisions (`decisions_demande`, 25/08/2026) — sans
  // ça, une régularisation écrasait la trace de la validation d'origine
  // (mêmes colonnes `demandes_conges.date_decision`/`validateur_id`
  // réutilisées pour chaque décision). Vide pour une demande décidée avant
  // l'introduction de cette table — repli plus bas sur `selection.dateDecision`.
  useEffect(() => {
    let cancelled = false;
    fetchHistoriqueDecisions(selection.id).then((data) => {
      if (!cancelled) setHistoriqueDecisions(data);
    });
    return () => {
      cancelled = true;
    };
  }, [selection.id]);

  const code = selection.type === "CP" && selection.isAnticipation ? "CPA" : selection.type;
  const jours = selection.nbDemiJournees / 2;
  // Solde avant/après (17/08/2026 → 24/08/2026, ajout demandé) — uniquement
  // pour les 3 types suivis par `useSoldes` (mêmes que "Suivre les soldes"),
  // pas de notion de solde pour CSS/CE/RECUP/EVT_FAM. `valeurApresAttente`
  // (déjà calculé par `fetchSoldes`) tient compte de TOUTES les demandes en
  // attente de ce type, pas seulement celle-ci — approximation acceptée,
  // cohérente avec son usage existant (`Dashboard2Page`).
  const codeSolde = code === "CP" || code === "RTT" || code === "CPA" ? code : null;
  const { soldes: soldesDemandeur } = useSoldes(selection.demandeur?.id);
  const { tone: toneStatut, Icon: IconStatut } = STATUT_CONFIG[selection.statut];
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

  // Feed unifié, trié chronologiquement (25/08/2026, "c'est pas dans
  // l'ordre" — Vincent) : décisions (`decisions_demande`) et transmissions
  // paie réelles (`lignesTransmission`) mélangées, triées par date effective
  // (`decideLe`/`genereLe`/`verifieLe`, tous des timestamptz ISO comparables
  // tels quels), plutôt que deux blocs distincts l'un après l'autre — sans
  // ça, "Annulé le 25/08" pouvait apparaître avant "En paye le 30/07",
  // pourtant antérieur. Une ligne de correction (`joursInclus < 0`, congé
  // déjà passé en paye puis régularisé) porte le suffixe "(retro)" — la
  // même transmission normale ("Transmis"/"En paye") appliquée à une
  // correction plutôt qu'à l'envoi d'origine.
  const entreesFeed: {
    key: string;
    date: string;
    node: ReactNode;
    note?: ReactNode;
    previsionnel?: boolean;
  }[] = [];

  if (historiqueDecisions.length > 0) {
    for (const decision of historiqueDecisions) {
      entreesFeed.push({
        key: `decision-${decision.id}`,
        date: decision.decideLe,
        node: (
          <>
            <span className={`font-semibold ${TEXTE_DECISION[decision.statut]}`}>
              {LIBELLE_DECISION[decision.statut]} le {formatJjMmAa(decision.decideLe.slice(0, 10))}
            </span>
            {decision.decidePar && (
              <span className="text-ink-500"> par {decision.decidePar.prenom}</span>
            )}
          </>
        ),
        // Commentaire propre à CETTE décision (25/08/2026, "le commentaire
        // est associé à annulé" — Vincent) — `decisions_demande.commentaire`,
        // pas `selection.commentaireManager` (colonne unique côté
        // `demandes_conges`, réécrite à chaque décision, qui ne peut porter
        // que le commentaire du DERNIER événement, mal placé une fois le
        // feed trié chronologiquement).
        note: decision.commentaire || undefined,
      });
    }
  } else if (selection.dateDecision) {
    // Repli : demande décidée avant l'introduction de `decisions_demande`,
    // aucune ligne de journal pour elle — seule la décision courante (mêmes
    // colonnes que ci-dessus) est connue.
    entreesFeed.push({
      key: "decision-fallback",
      date: selection.dateDecision,
      node: (
        <>
          <span className={`font-semibold ${TEXTE_DECISION[selection.statut]}`}>
            {LIBELLE_DECISION[selection.statut]} le {formatJjMmAa(selection.dateDecision)}
          </span>
          {selection.validateur && <span className="text-ink-500"> par {selection.validateur.prenom}</span>}
        </>
      ),
      note: selection.commentaireManager || undefined,
    });
  }

  for (const ligne of lignesTransmission ?? []) {
    const retro = ligne.joursInclus < 0;
    entreesFeed.push({
      key: `transmis-${ligne.id}`,
      date: ligne.genereLe,
      node: (
        <>
          <span className="font-semibold text-status-warning-fg">
            {retro ? "Transmis (retro)" : "Transmis"} le {formatJjMmAa(ligne.genereLe.slice(0, 10))}
          </span>
          <span className="text-ink-500">
            {" "}
            : {retro ? "-" : ""}
            {formatJours(Math.abs(ligne.joursInclus))} j
          </span>
        </>
      ),
    });
    if (ligne.statut !== "transmis" && ligne.verifieLe) {
      entreesFeed.push({
        key: `verifie-${ligne.id}`,
        date: ligne.verifieLe,
        node: (
          <span className={`font-semibold ${TEXTE_TRANSMISSION[ligne.statut]}`}>
            {ligne.statut === "en_paye" && retro ? "En paye (retro)" : LIBELLE_TRANSMISSION[ligne.statut]}{" "}
            le {formatJjMmAa(ligne.verifieLe.slice(0, 10))}
          </span>
        ),
        note: ligne.statut === "ecart" && ligne.motifEcart ? ligne.motifEcart : undefined,
      });
    }
  }

  if (previsionTransmission) {
    const retro = previsionTransmission.jours < 0;
    entreesFeed.push({
      key: "prevision",
      date: new Date().toISOString(),
      // Orange, avec emphase sur le nombre de jours transmis (25/08/2026,
      // demande explicite : "Transmis paie le jj/mm/AA - 1J/NNj en orange
      // avec une emphase sur le nombre de jours transmis") — distingue cette
      // ligne, purement prévisionnelle (rien n'est encore réellement
      // transmis), des lignes réelles ci-dessus (`lignesTransmission`, en
      // orange atténué "warning" également, mais sans le gras).
      node: (
        <span className="text-status-warning-fg italic">
          {retro ? "Transmis (retro)" : "Transmis paie"} le{" "}
          {formatJjMmAa(new Date().toISOString().slice(0, 10))} -{" "}
          <span className="font-bold not-italic">
            {retro ? "-" : ""}
            {formatJours(Math.abs(previsionTransmission.jours))} j
          </span>
          /{formatJours(previsionTransmission.total)} j
        </span>
      ),
      previsionnel: true,
    });
  }

  entreesFeed.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div
      className={`flex w-full flex-col gap-[3px] ${
        masquerBandeau || masquerTypeBadgeBandeau ? "" : "xl:sticky xl:top-4 xl:w-64 xl:shrink-0"
      }`}
    >
      <div
        className={`bg-surface-card w-full shadow-sm ${
          masquerTypeBadgeBandeau ? "pb-[12.5px]" : "pb-[25px]"
        }`}
      >
        {!masquerBandeau && (
          <div
            className={`flex items-center justify-between px-4 ${
              masquerTypeBadgeBandeau ? "pt-3 pb-1.5" : `py-3 ${classeFondTypeBadge(code)}`
            }`}
          >
            <div className="flex items-center gap-2.5">
              {masquerTypeBadgeBandeau ? (
                <span className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(code)}`} />
              ) : (
                <div className="rounded-full ring-2 ring-white">
                  <TypeBadge code={code} />
                </div>
              )}
              <div>
                <div
                  className={`font-bold ${
                    masquerTypeBadgeBandeau
                      ? `text-xs ${classeTexteTypeBadge(code)}`
                      : "text-sm text-white"
                  }`}
                >
                  {selection.demandeur
                    ? `${selection.demandeur.prenom} ${selection.demandeur.nom}`
                    : LABEL_LONG[code]}
                </div>
                {selection.demandeur && (
                  <div className="text-xs font-semibold text-white/80">{LABEL_LONG[code]}</div>
                )}
              </div>
            </div>
            {!masquerFermer && (
              <button
                type="button"
                onClick={onClose}
                disabled={enCours}
                className="shrink-0 text-white/70 hover:text-white disabled:opacity-40"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {masquerBandeau ? (
          <div className="flex items-center gap-3 px-4 pt-3">
            <TypeBadge code={code} />
            <div className="min-w-0 flex-1">
              <PeriodeAvecPastilles
                debut={selection.debut}
                fin={selection.fin}
                demiDebut={selection.demiDebut}
                demiFin={selection.demiFin}
              />
            </div>
            <span className="origin-right scale-90">
              <Badge tone={toneStatut}>
                <IconStatut size={12} strokeWidth={2.5} />
                <span className="text-[14.4px]">{formatJours(jours)} j</span>
              </Badge>
            </span>
          </div>
        ) : (
          <div className={masquerTypeBadgeBandeau ? "-mt-1.5" : "border-ink-300/60 border-t"}>
            <SuiviDemandeRow demande={selection} isLast masquerType masquerPoseLe />
          </div>
        )}

        <div
          className={`flex flex-col border-t px-4 pt-3 ${
            masquerTypeBadgeBandeau ? classeBordureTypeBadge(code) : "border-ink-300/60"
          }`}
        >
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
          {entreesFeed.map((entree) => (
            <div key={entree.key}>
              <div className="flex gap-2">
                <div className="flex w-1.5 shrink-0 justify-center">
                  <span className={`h-2 w-px ${classeFondTypeBadge(code)}`} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    entree.previsionnel
                      ? "h-1.5 w-1.5 shrink-0 rounded-full border border-dashed border-ink-500"
                      : `h-1.5 w-1.5 shrink-0 rounded-full ${classeFondTypeBadge(code)}`
                  }
                />
                <span className="text-[10px]">{entree.node}</span>
              </div>
              {entree.note && (
                <div className="text-ink-500 pt-1 pb-2 pl-[0.875rem] text-[10px] italic">
                  {entree.note}
                </div>
              )}
            </div>
          ))}
        </div>

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
              className="text-status-danger-fg border-status-danger-fg enabled:hover:bg-status-danger-bg! justify-center rounded-full bg-white px-4 py-2 text-xs"
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
              {codeSolde && soldesDemandeur && (
                <div className="mt-3 mb-3 flex items-center justify-center gap-3 text-xs">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-ink-500">Actuel</span>
                    <TypeBadge
                      variant="pill"
                      code={codeSolde}
                      label={`${formatJours(soldesDemandeur[codeSolde.toLowerCase() as "cp" | "rtt" | "cpa"].valeur)} j`}
                    />
                  </div>
                  <span className="text-ink-500">→</span>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-ink-500">Après</span>
                    <TypeBadge
                      variant="pill"
                      code={codeSolde}
                      label={`${formatJours(soldesDemandeur[codeSolde.toLowerCase() as "cp" | "rtt" | "cpa"].valeurApresAttente)} j`}
                    />
                  </div>
                </div>
              )}
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
