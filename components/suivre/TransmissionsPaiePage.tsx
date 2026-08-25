"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Send, UserPlus } from "lucide-react";
import { useCongesATransmettre } from "@/hooks/useCongesATransmettre";
import type { CongeATransmettre } from "@/lib/types";
import {
  refuserDemande,
  regulariserDemande,
  remettreEnAttenteDemande,
  validerDemande,
} from "@/lib/data/demandes.repository";
import {
  calculerJoursATransmettreMaintenant,
  fetchExportPaie,
  fetchLignesTransmissionParDemande,
  genererExportPaie,
} from "@/lib/data/exportsPaie.repository";
import type { LigneExportPaie } from "@/lib/types";
import { formatJours, renderDureeATransmettre } from "@/lib/format";
import {
  LABEL_COURT,
  LABEL_LONG,
  TypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { InputFiltrePill } from "@/components/ui/FiltrePill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { HistoriqueTable } from "@/components/historique/HistoriqueTable";
import { CongesPaiePage, type CongesPaiePageHandle } from "@/components/suivre/CongesPaiePage";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";
import { PoserCongePourCollaborateurModal } from "@/components/suivre/PoserCongePourCollaborateurModal";
import { VerifierFichesPaiePage } from "@/components/suivre/VerifierFichesPaiePage";

type Onglet = "transmettre" | "export" | "verifier";

// Codes de type suivis par le récap (25/08/2026) — mêmes 7 codes que le
// sélecteur "Poser pour un collaborateur", CPA dérivé de CP + isAnticipation.
const TYPES_RECAP: TypeBadgeCode[] = ["CP", "RTT", "CPA", "CSS", "CE", "RECUP", "EVT_FAM"];

// Les 3 types "officiels" transmis à la paie (25/08/2026, demande explicite :
// "le 0 est une donnée importante") — toujours affichés dans le bandeau
// sticky sous forme de pastille colorée, même à 0 (contrairement aux autres
// types de `TYPES_RECAP`, qui restent masqués quand ils sont nuls).
const TYPES_PRINCIPAUX: TypeBadgeCode[] = ["CP", "RTT", "CPA"];

function codeRecap(demande: CongeATransmettre): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

/**
 * Totaux "jours transmis par type" — somme, par type, les jours qui
 * partiraient réellement maintenant (`joursParId`, même valeur que la
 * colonne "Transmis"). Alimente les pastilles/le récap du bandeau sticky de
 * "Quels congés transmettre" (25/08/2026, déplacé depuis une carte de la
 * colonne droite — demande explicite : ce récap doit rester visible en
 * permanence, aux côtés du bouton de validation, pas seulement quand rien
 * n'est sélectionné).
 *
 * Exclut les corrections (congés déjà passés en paye puis annulés,
 * 25/08/2026, demande explicite : "on va pas les compter dans le solde
 * CP/RTT/CPA ou autre") — un congé déjà transmis à la paie ne doit plus
 * bouger le total "à transmettre" une fois annulé, ce n'est plus la même
 * opération (une régularisation comptable, pas un envoi normal). Ces
 * corrections ont leur propre total, `totauxCorrectionsParType`.
 */
function totauxParType(
  demandes: CongeATransmettre[],
  joursParId: Record<string, number>,
): Record<TypeBadgeCode, number> {
  const totaux: Record<TypeBadgeCode, number> = {
    CP: 0,
    RTT: 0,
    CPA: 0,
    CSS: 0,
    CE: 0,
    RECUP: 0,
    EVT_FAM: 0,
    DJI: 0,
    CPI: 0,
    FERIE: 0,
  };
  for (const d of demandes) {
    if (d.statut === "annulé") continue;
    totaux[codeRecap(d)] += joursParId[d.id] ?? 0;
  }
  return totaux;
}

/**
 * Totaux "à régulariser" par type — jours déjà transmis à la paie pour des
 * congés annulés depuis (`joursDejaTransmis`, positif), à part des totaux
 * "à transmettre" ci-dessus (25/08/2026, voir doc de `totauxParType`).
 * Affiché en simple phrase sous les pastilles plutôt que mêlé au récap
 * chiffré, pour ne pas laisser croire que ces jours partiraient à nouveau.
 */
function totauxCorrectionsParType(demandes: CongeATransmettre[]): [TypeBadgeCode, number][] {
  const totaux: Partial<Record<TypeBadgeCode, number>> = {};
  for (const d of demandes) {
    if (d.statut !== "annulé") continue;
    const code = codeRecap(d);
    totaux[code] = (totaux[code] ?? 0) + d.joursDejaTransmis;
  }
  return Object.entries(totaux).filter(([, jours]) => jours !== 0) as [TypeBadgeCode, number][];
}

/**
 * Onglet "Quels congés transmettre" (renommé depuis "Récap congé",
 * 24/08/2026) — branché sur `fetchCongesATransmettre` (validés non
 * totalement transmis + annulés à corriger + en attente chevauchant la
 * période), pas `useCongesConsommes` : plus de filtre de date sur les
 * validés/annulés, un congé jamais transmis remonte quel que soit son mois
 * d'origine (bug "congés de période précédente"/"à cheval" corrigé par la
 * notion de solde de transmission, voir BASE-DE-DONNEES.md). Les lignes
 * donnent accès au détail complet (`DetailCongePanel`, actions Valider/
 * Refuser/Régulariser) — largeur du tableau verrouillée via CSS Grid.
 */
function QuelsCongesTransmettre({
  periode,
  onValiderEtGenererExport,
}: {
  periode: { debut: string; fin: string };
  onValiderEtGenererExport: () => void;
}) {
  const [debut, setDebut] = useState(periode.debut);
  const [fin, setFin] = useState(periode.fin);
  const { demandes, loading, error, refetch } = useCongesATransmettre(debut, fin);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);
  const [modalOuverte, setModalOuverte] = useState(false);
  const [joursATransmettreParId, setJoursATransmettreParId] = useState<Record<string, number>>({});
  const [lignesTransmissionParId, setLignesTransmissionParId] = useState<
    Record<string, LigneExportPaie[]>
  >({});

  // Combien de jours partiraient réellement pour chaque ligne si on
  // transmettait maintenant (calcul async, tient compte du découpage sur un
  // congé à cheval) — alimente la colonne Durée (X/Y) et le récap par type.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      demandes.map(
        async (d) => [d.id, await calculerJoursATransmettreMaintenant(d, periode)] as const,
      ),
    ).then((entrees) => {
      if (!cancelled) setJoursATransmettreParId(Object.fromEntries(entrees));
    });
    return () => {
      cancelled = true;
    };
  }, [demandes, periode]);

  // Lignes de transmission RÉELLES (`export_paie_lignes`, déjà persistées)
  // pour chaque demande — alimente le feed du `DetailCongePanel` ("Transmis
  // le"/"En paye le"/"Écart signalé le", 25/08/2026 : matérialise le passage
  // en paie effectif, distinct de la simple prévision `previsionTransmission`
  // ci-dessous, qui reste toujours affichée en plus, à la fin du feed).
  useEffect(() => {
    let cancelled = false;
    fetchLignesTransmissionParDemande(demandes.map((d) => d.id)).then((data) => {
      if (!cancelled) setLignesTransmissionParId(data);
    });
    return () => {
      cancelled = true;
    };
  }, [demandes]);

  const selection = demandes.find((d) => d.id === selectionId) ?? null;

  async function valider(commentaire: string) {
    if (!selection) return;
    await validerDemande(selection.id, commentaire);
    refetch();
  }

  async function refuser(commentaire: string) {
    if (!selection) return;
    await refuserDemande(selection.id, commentaire);
    refetch();
  }

  async function regulariser(commentaire: string) {
    if (!selection) return;
    await regulariserDemande(selection.id, commentaire);
    refetch();
  }

  async function annulerValidation(id: string) {
    await remettreEnAttenteDemande(id);
    refetch();
  }

  // Trois tableaux distincts (25/08/2026, demande explicite) :
  // - "Congés consommés sur la période" : validés/en attente touchant
  //   l'intervalle Du/Au sélectionné.
  // - "Congés consommés non passés sur des périodes précédentes" : validés/
  //   en attente entièrement avant `Du` — le repêchage (jamais transmis,
  //   jamais tranchés).
  // - "Congés passés en paye mais annulés" : demandes annulées après avoir
  //   déjà été transmises (solde de transmission > 0, correction à venir),
  //   à part des deux tableaux ci-dessus plutôt que mélangées dedans.
  // `fetchCongesATransmettre` ne filtre déjà que sur `Au` (pas de borne
  // basse côté requête, c'est tout l'intérêt du repêchage) — `Du` ne sert
  // donc qu'à cette séparation d'affichage, pas à la requête elle-même.
  const corrections = demandes.filter((d) => d.statut === "annulé");
  const aTrancher = demandes.filter((d) => d.statut !== "annulé");
  const moisEnCours = aTrancher.filter((d) => d.fin >= debut);
  const repechage = aTrancher.filter((d) => d.fin < debut);
  const totaux = totauxParType(demandes, joursATransmettreParId);
  const pillsPrincipales = TYPES_PRINCIPAUX.map(
    (code) => [code, totaux[code]] as [TypeBadgeCode, number],
  );
  const pillsAutres = TYPES_RECAP.filter((code) => !TYPES_PRINCIPAUX.includes(code))
    .map((code) => [code, totaux[code]] as [TypeBadgeCode, number])
    .filter(([, jours]) => jours !== 0);
  const correctionsARegulariser = totauxCorrectionsParType(demandes);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,900px)_16rem] xl:gap-x-2.5">
        <div className="flex w-full min-w-0 flex-col gap-5">
          <div className="bg-surface-card w-full min-w-0 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <InputFiltrePill
                  type="date"
                  aria-label="Du"
                  value={debut}
                  onChange={(e) => setDebut(e.target.value)}
                />
                <InputFiltrePill
                  type="date"
                  aria-label="Au"
                  value={fin}
                  onChange={(e) => setFin(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => setModalOuverte(true)}
                className="rounded-full px-4 py-2 text-sm"
              >
                <UserPlus size={16} />
                Poser pour un collaborateur
              </Button>
            </div>

            {error && (
              <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 mb-3 px-3 py-2.5 text-sm">
                {error}
              </div>
            )}

            <div className="border-ink-300/60 border-t px-4 pt-3 pb-1">
              <h2 className="text-ink-900 text-sm font-bold">Congés consommés sur la période</h2>
            </div>
            {loading ? (
              <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
            ) : (
              <HistoriqueTable
                demandes={moisEnCours}
                avecCollaborateur
                compact
                onDateClick={setSelectionId}
                selectedId={selectionId}
                renderDuree={(d) =>
                  renderDureeATransmettre(d as CongeATransmettre, joursATransmettreParId[d.id])
                }
                emptyText="Rien à transmettre sur cette période."
                triParDefaut="collaborateur"
                libelleColonneDuree="Transmis"
              />
            )}
          </div>

          <div className="bg-surface-card w-full min-w-0 shadow-sm">
            <div className="px-4 pt-3 pb-1">
              <h2 className="text-ink-900 text-sm font-bold">
                Congés consommés non passés sur des périodes précédentes
              </h2>
            </div>
            <div className="border-ink-300/60 border-t">
              {loading ? (
                <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
              ) : (
                <HistoriqueTable
                  demandes={repechage}
                  avecCollaborateur
                  compact
                  onDateClick={setSelectionId}
                  selectedId={selectionId}
                  renderDuree={(d) =>
                    renderDureeATransmettre(d as CongeATransmettre, joursATransmettreParId[d.id])
                  }
                  emptyText="Aucun congé en repêchage."
                  triParDefaut="collaborateur"
                  libelleColonneDuree="Transmis"
                />
              )}
            </div>
          </div>

          <div className="bg-surface-card w-full min-w-0 shadow-sm">
            <div className="px-4 pt-3 pb-1">
              <h2 className="text-ink-900 text-sm font-bold">Congés passés en paye mais annulés</h2>
            </div>
            <div className="border-ink-300/60 border-t">
              {loading ? (
                <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
              ) : (
                <HistoriqueTable
                  demandes={corrections}
                  avecCollaborateur
                  compact
                  onDateClick={setSelectionId}
                  selectedId={selectionId}
                  renderDuree={(d) =>
                    renderDureeATransmettre(d as CongeATransmettre, joursATransmettreParId[d.id])
                  }
                  emptyText="Aucune correction à transmettre."
                  libelleColonneDuree="Transmis"
                />
              )}
            </div>
          </div>
        </div>

        {selection && (
          <DetailCongePanel
            key={selection.id}
            selection={selection}
            onClose={() => setSelectionId(null)}
            onValider={valider}
            onRefuser={refuser}
            onRegulariser={regulariser}
            onValiderSucces={(id, message) => setToast({ id, message })}
            lignesTransmission={lignesTransmissionParId[selection.id]}
            previsionTransmission={{
              jours: joursATransmettreParId[selection.id] ?? 0,
              total: selection.nbDemiJournees / 2,
            }}
          />
        )}
      </div>

      {/* Bandeau sticky (25/08/2026, demande explicite) — porte le récap
          "jours transmis par type" (toujours visible, plus seulement quand
          rien n'est sélectionné) et le bouton de validation, qui bascule sur
          l'onglet "Générer l'export" plutôt que de transmettre directement
          depuis cet onglet (décision actée : garder l'action réelle
          "Transmettre" à un seul endroit). Les 3 types officiels (CP/RTT/CPA,
          25/08/2026) s'affichent en pastille colorée (`TypeBadge` variant
          "pill", même format que la colonne Solde de "Suivre les soldes")
          et restent visibles même à 0 — "le 0 est une donnée importante"
          (Vincent). Les autres types (CSS/CE/RECUP/EVT_FAM) gardent le rendu
          texte existant, masqués quand nuls (cas plus rares). Les corrections
          (congés déjà passés en paye puis annulés) n'entrent plus dans ces
          totaux (25/08/2026, demande explicite) — une simple phrase dédiée
          ("X j de {type} à régulariser") apparaît sous les pastilles quand
          il y en a, pour ne pas laisser croire que ces jours repartiraient
          normalement. */}
      <div className="bg-surface-card border-ink-300/60 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border-t px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-end gap-4">
            {pillsPrincipales.map(([code, jours]) => (
              <div key={code} className="flex flex-col items-center gap-1">
                <span className="text-ink-500 text-[10px] font-semibold">{LABEL_COURT[code]}</span>
                <TypeBadge code={code} variant="pill" label={`${formatJours(jours)} j`} />
              </div>
            ))}
            {pillsAutres.map(([code, jours]) => (
              <span key={code} className="flex items-center gap-1.5 text-sm">
                <span className="text-ink-500">{LABEL_LONG[code]}</span>
                <span className="text-ink-900 font-semibold">{formatJours(jours)} j</span>
              </span>
            ))}
          </div>
          {correctionsARegulariser.length > 0 && (
            <p className="text-ink-500 text-xs">
              {correctionsARegulariser.map(([code, jours], i) => (
                <span key={code}>
                  {i > 0 && " · "}
                  <span className="text-ink-900 font-semibold">{formatJours(jours)} j</span> de{" "}
                  {LABEL_LONG[code]} à régulariser
                </span>
              ))}
            </p>
          )}
        </div>
        <Button onClick={onValiderEtGenererExport} className="rounded-full px-5 py-2.5 text-sm">
          <Send size={16} />
          Valider et générer l&rsquo;export
        </Button>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          actionLabel="Annuler"
          onAction={() => {
            annulerValidation(toast.id);
            setToast(null);
          }}
          onClose={() => setToast(null)}
        />
      )}

      {modalOuverte && (
        <PoserCongePourCollaborateurModal
          onClose={() => setModalOuverte(false)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}

/**
 * Onglet "Générer l'export" — même continuité que "Quels congés transmettre"
 * (25/08/2026, demande explicite) : `CongesPaiePage` y est rendu avec une
 * période figée (plus de champs Du/Au éditables, `sourceTransmission`) et les
 * mêmes 3 tableaux (récap collaborateur × type limité à la période en cours,
 * + "Congés consommés non passés sur des périodes précédentes" +
 * "Congés passés en paye mais annulés"), pour que cette vue montre exactement
 * ce que "Transmettre" enverra. Le bandeau sticky du bas porte le statut
 * ("Brouillon - non transmis" / "Période transmise le..."), un lien texte
 * "Exporter (CSV)" (délégué à `CongesPaiePage` via `ref`/
 * `useImperativeHandle`, pour ne pas dupliquer sa génération) juste avant le
 * bouton "Transmettre", qui ouvre une modale de confirmation plutôt que
 * d'agir directement — Confirmer y déclenche `transmettre()`. Se désactive
 * une fois la période déjà transmise (contrainte unique
 * `exports_paie_periode_unique` côté base).
 */
function GenererExport({
  periode,
  exportPaie,
  onTransmis,
}: {
  periode: { debut: string; fin: string };
  exportPaie: { id: string; genereLe: string } | null;
  onTransmis: () => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modalOuverte, setModalOuverte] = useState(false);
  const congesPaieRef = useRef<CongesPaiePageHandle>(null);

  async function transmettre() {
    setEnCours(true);
    setErreur(null);
    try {
      await genererExportPaie(periode);
      setModalOuverte(false);
      onTransmis();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de transmettre cette période.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <CongesPaiePage
        // Remonte (donc refetch) une fois la période transmise (25/08/2026,
        // repasse technique) — sans ça, les tableaux et le feed du panneau de
        // détail restaient figés sur l'état "avant transmission" après un
        // "Transmettre" réussi (aucun mécanisme ne redéclenchait le fetch
        // interne de `CongesPaiePage`, `onTransmis` ne rafraîchissant que
        // `exportPaie` côté parent).
        key={exportPaie ? exportPaie.id : "brouillon"}
        ref={congesPaieRef}
        masquerTitre
        periodeInitiale={periode}
        validesUniquement
        sourceTransmission
        exportId={exportPaie?.id ?? null}
      />

      <div className="bg-surface-card border-ink-300/60 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border-t px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <div className="text-sm">
          {exportPaie ? (
            <span className="text-status-success-fg font-semibold">
              Période transmise le {new Date(exportPaie.genereLe).toLocaleDateString("fr-FR")}
            </span>
          ) : (
            <span className="text-ink-500">Brouillon - non transmis</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => congesPaieRef.current?.exporter()}
            className="text-mint hover:text-mint-hover text-sm font-semibold underline"
          >
            Exporter (CSV)
          </button>
          <Button
            onClick={() => setModalOuverte(true)}
            disabled={Boolean(exportPaie)}
            className="rounded-full px-5 py-2.5 text-sm"
          >
            <Send size={16} />
            Transmettre
          </Button>
        </div>
      </div>

      {modalOuverte && (
        <Modal title="Transmettre la période" onClose={() => setModalOuverte(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-ink-700 text-sm">
              Confirmez-vous la transmission de cette période à la paie ? Cette action crée les
              lignes de suivi correspondantes.
            </p>
            {erreur && (
              <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
                {erreur}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setModalOuverte(false)}
                className="rounded-full px-4 py-2 text-sm"
              >
                Annuler
              </Button>
              <Button
                onClick={transmettre}
                disabled={enCours}
                className="rounded-full px-4 py-2 text-sm"
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

/**
 * "Transmissions paie" (`/suivre/transmissions-paie/[debut]`, 24/08/2026, restructuré en
 * 3 onglets le même jour) — nouvelle section Suivre, remplace l'ancien écran
 * "Export paie" (`/suivre/paie`, supprimé le 25/08/2026 une fois ce parcours
 * jugé complet). Toujours ouverte sur une période précise (`periode`, choisie
 * sur la page liste `/suivre/transmissions-paie`).
 * - **Quels congés transmettre** : revue avant transmission.
 * - **Générer l'export** : export CSV + action "Transmettre".
 * - **Vérifier les fiches de paie** : check du retour comptable, désactivé
 *   tant qu'aucun export n'existe pour cette période.
 */
export function TransmissionsPaiePage({
  periode,
  titre,
}: {
  periode: { debut: string; fin: string };
  titre: string;
}) {
  const [onglet, setOnglet] = useState<Onglet>("transmettre");
  const [exportPaie, setExportPaie] = useState<{ id: string; genereLe: string } | null>(null);
  const [chargementExport, setChargementExport] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchExportPaie(periode)
      .then((data) => {
        if (!cancelled) setExportPaie(data);
      })
      .finally(() => {
        if (!cancelled) setChargementExport(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periode]);

  function rafraichirExport() {
    fetchExportPaie(periode).then(setExportPaie);
  }

  const onglets: { id: Onglet; label: string }[] = [
    { id: "transmettre", label: "Quels congés transmettre" },
    { id: "export", label: "Générer l'export" },
    { id: "verifier", label: "Vérifier les fiches de paie" },
  ];

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0">
      <Link
        href="/suivre/transmissions-paie"
        className="text-ink-500 hover:text-ink-900 flex w-fit items-center gap-1 px-1 text-sm font-semibold"
      >
        <ChevronLeft size={16} />
        Transmissions paie
      </Link>

      <h1 className="text-ink-900 px-1 text-2xl font-semibold">{titre}</h1>

      <div className="flex flex-wrap items-center gap-2 px-1">
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOnglet(o.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              onglet === o.id
                ? "bg-mint/90 hover:bg-mint-hover text-white"
                : "border-mint text-mint hover:bg-mint-tint border bg-transparent"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "transmettre" && (
        <QuelsCongesTransmettre
          periode={periode}
          onValiderEtGenererExport={() => setOnglet("export")}
        />
      )}
      {onglet === "export" && !chargementExport && (
        <GenererExport periode={periode} exportPaie={exportPaie} onTransmis={rafraichirExport} />
      )}
      {onglet === "verifier" && !chargementExport && (
        <VerifierFichesPaiePage exportId={exportPaie?.id ?? null} periode={periode} />
      )}
    </div>
  );
}
