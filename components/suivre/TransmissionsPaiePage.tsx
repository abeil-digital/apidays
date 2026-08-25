"use client";

import { useEffect, useState } from "react";
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
  genererExportPaie,
} from "@/lib/data/exportsPaie.repository";
import { formatJours } from "@/lib/format";
import { LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { InputFiltrePill } from "@/components/ui/FiltrePill";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { HistoriqueTable } from "@/components/historique/HistoriqueTable";
import { CongesPaiePage } from "@/components/suivre/CongesPaiePage";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";
import { PoserCongePourCollaborateurModal } from "@/components/suivre/PoserCongePourCollaborateurModal";
import { VerifierFichesPaiePage } from "@/components/suivre/VerifierFichesPaiePage";

type Onglet = "transmettre" | "export" | "verifier";

// "X/Y j" — X = jours qui partiraient réellement si on transmettait
// maintenant (`calculerJoursATransmettreMaintenant`, tient compte du
// découpage sur un congé à cheval), Y = durée totale de la demande
// (25/08/2026, demande explicite : "bricoler un truc" pour visualiser la
// répartition avant même de cliquer "Transmettre", plutôt que d'afficher le
// solde restant complet comme si tout partait ce mois-ci). Une correction
// (demande annulée après avoir été transmise) garde son propre format. Un
// congé "en attente" affiche "0/Y j" — `calculerJoursATransmettreMaintenant`
// renvoie toujours 0 pour ce statut (pas encore décidé, jamais transmis par
// `genererExportPaie` tant que ce n'est pas le cas) : le X/Y rend ça
// explicite plutôt que de le masquer.
function renderDureeATransmettre(demande: CongeATransmettre, joursMaintenant: number | undefined) {
  if (demande.statut === "annulé") {
    return `-${formatJours(demande.joursDejaTransmis)} j (correction)`;
  }
  const total = demande.nbDemiJournees / 2;
  const transmis = joursMaintenant ?? (demande.statut === "en attente" ? 0 : demande.joursRestants);
  return `${formatJours(transmis)}/${formatJours(total)} j`;
}

// Codes de type suivis par le récap (25/08/2026) — mêmes 7 codes que le
// sélecteur "Poser pour un collaborateur", CPA dérivé de CP + isAnticipation.
const TYPES_RECAP: TypeBadgeCode[] = ["CP", "RTT", "CPA", "CSS", "CE", "RECUP", "EVT_FAM"];

function codeRecap(demande: CongeATransmettre): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

/**
 * Récap "jours transmis par type" (25/08/2026, demande explicite) — occupe
 * la colonne droite de la grille tant qu'aucune ligne n'est sélectionnée
 * (place laissée vide jusque-là). Somme, par type, les jours qui partiraient
 * réellement maintenant (`joursParId`, même valeur que la colonne Durée) —
 * inclut les corrections négatives des congés annulés, pour un net qui
 * reflète ce que l'export contiendra effectivement.
 */
function RecapParType({
  demandes,
  joursParId,
}: {
  demandes: CongeATransmettre[];
  joursParId: Record<string, number>;
}) {
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
    totaux[codeRecap(d)] += joursParId[d.id] ?? 0;
  }
  const lignes = TYPES_RECAP.map((code) => [code, totaux[code]] as const).filter(
    ([, jours]) => jours !== 0,
  );

  return (
    <div className="bg-surface-card w-full shadow-sm xl:sticky xl:top-4">
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-ink-900 text-sm font-bold">Jours transmis par type</h2>
      </div>
      <div className="flex flex-col gap-2 px-4 pb-4">
        {lignes.length === 0 ? (
          <p className="text-ink-500 text-xs">Rien à transmettre pour l&rsquo;instant.</p>
        ) : (
          lignes.map(([code, jours]) => (
            <div key={code} className="flex items-center justify-between text-sm">
              <span className="text-ink-500">{LABEL_LONG[code]}</span>
              <span className="text-ink-900 font-semibold">{formatJours(jours)} j</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
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
function QuelsCongesTransmettre({ periode }: { periode: { debut: string; fin: string } }) {
  const [debut, setDebut] = useState(periode.debut);
  const [fin, setFin] = useState(periode.fin);
  const { demandes, loading, error, refetch } = useCongesATransmettre(debut, fin);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);
  const [modalOuverte, setModalOuverte] = useState(false);
  const [joursATransmettreParId, setJoursATransmettreParId] = useState<Record<string, number>>({});

  // Combien de jours partiraient réellement pour chaque ligne si on
  // transmettait maintenant (calcul async, tient compte du découpage sur un
  // congé à cheval) — alimente la colonne Durée (X/Y) et le récap par type.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      demandes.map(async (d) => [d.id, await calculerJoursATransmettreMaintenant(d, periode)] as const),
    ).then((entrees) => {
      if (!cancelled) setJoursATransmettreParId(Object.fromEntries(entrees));
    });
    return () => {
      cancelled = true;
    };
  }, [demandes, periode]);

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

  return (
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
              renderDuree={(d) => renderDureeATransmettre(d as CongeATransmettre, joursATransmettreParId[d.id])}
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
                renderDuree={(d) => renderDureeATransmettre(d as CongeATransmettre, joursATransmettreParId[d.id])}
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
                renderDuree={(d) => renderDureeATransmettre(d as CongeATransmettre, joursATransmettreParId[d.id])}
                emptyText="Aucune correction à transmettre."
                libelleColonneDuree="Transmis"
              />
            )}
          </div>
        </div>
      </div>

      {selection ? (
        <DetailCongePanel
          key={selection.id}
          selection={selection}
          onClose={() => setSelectionId(null)}
          onValider={valider}
          onRefuser={refuser}
          onRegulariser={regulariser}
          onValiderSucces={(id, message) => setToast({ id, message })}
          previsionTransmission={{
            jours: joursATransmettreParId[selection.id] ?? 0,
            total: selection.nbDemiJournees / 2,
          }}
        />
      ) : (
        <RecapParType demandes={demandes} joursParId={joursATransmettreParId} />
      )}

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
 * Onglet "Générer l'export" — l'export CSV existant (`CongesPaiePage`)
 * complété par l'action réelle "Transmettre" (`genererExportPaie`), qui crée
 * les lignes `export_paie_lignes` correspondantes. Les deux coexistent : le
 * CSV documente ce qui vient d'être transmis, "Transmettre" met à jour le
 * statut interne — décision provisoire, à confirmer avec Vincent (voir plan).
 * Le bouton se désactive une fois la période déjà transmise (contrainte
 * unique `exports_paie_periode_unique` côté base).
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

  async function transmettre() {
    setEnCours(true);
    setErreur(null);
    try {
      await genererExportPaie(periode);
      onTransmis();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de transmettre cette période.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-sm">
        <div className="text-sm">
          {exportPaie ? (
            <span className="text-status-success-fg font-semibold">
              Période transmise le {new Date(exportPaie.genereLe).toLocaleDateString("fr-FR")}
            </span>
          ) : (
            <span className="text-ink-500">Pas encore transmise.</span>
          )}
        </div>
        <Button
          onClick={transmettre}
          disabled={enCours || Boolean(exportPaie)}
          className="rounded-full px-4 py-2 text-sm"
        >
          <Send size={16} />
          Transmettre
        </Button>
      </div>
      {erreur && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {erreur}
        </div>
      )}
      <CongesPaiePage
        masquerTitre
        periodeInitiale={periode}
        validesUniquement
        sourceTransmission
      />
    </div>
  );
}

/**
 * "Transmissions paie" (`/suivre/transmissions-paie/[debut]`, 24/08/2026, restructuré en
 * 3 onglets le même jour) — nouvelle section Suivre, coexiste avec "Export
 * paie" (`/suivre/paie`) sans le remplacer. Toujours ouverte sur une période
 * précise (`periode`, choisie sur la page liste `/suivre/transmissions-paie`).
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

      {onglet === "transmettre" && <QuelsCongesTransmettre periode={periode} />}
      {onglet === "export" && !chargementExport && (
        <GenererExport periode={periode} exportPaie={exportPaie} onTransmis={rafraichirExport} />
      )}
      {onglet === "verifier" && !chargementExport && (
        <VerifierFichesPaiePage exportId={exportPaie?.id ?? null} />
      )}
    </div>
  );
}
