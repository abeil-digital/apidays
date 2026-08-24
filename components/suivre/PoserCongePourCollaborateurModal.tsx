"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import type { DemiJournee, TypeDemande } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { estJourOuvre } from "@/lib/joursFeries";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { poserCongePourCollaborateur } from "@/lib/data/exportsPaie.repository";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Modal } from "@/components/ui/Modal";
import { SelectFiltrePill } from "@/components/ui/FiltrePill";
import { SelectPille } from "@/components/ui/SelectPille";
import { Textarea } from "@/components/ui/Textarea";
import {
  TypeBadge,
  classeBordureTypeBadge,
  classeFondTypeBadge,
  classeTexteTypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import {
  DetailPeriodeConges,
  creerResolveurOccupant,
  demiCouvertePeriode,
} from "@/components/demandes/DetailPeriodeConges";

interface OptionType {
  key: string;
  label: string;
  type: TypeDemande;
  isAnticipation: boolean;
  code: TypeBadgeCode;
}

// Mêmes options que `PoserDemandeModal` — pas de "Maladie" (hors scope,
// décision actée avec Vincent le 24/08/2026).
const OPTIONS: OptionType[] = [
  { key: "CP", label: "Congés Payés", type: "CP", isAnticipation: false, code: "CP" },
  { key: "RTT", label: "RTT", type: "RTT", isAnticipation: false, code: "RTT" },
  { key: "CP_ANTICIPE", label: "Congés anticipés", type: "CP", isAnticipation: true, code: "CPA" },
  { key: "CSS", label: "Congé sans solde", type: "CSS", isAnticipation: false, code: "CSS" },
  { key: "CE", label: "Congé exceptionnel", type: "CE", isAnticipation: false, code: "CE" },
  { key: "RECUP", label: "Récupération", type: "RECUP", isAnticipation: false, code: "RECUP" },
  {
    key: "EVT_FAM",
    label: "Événement Familial",
    type: "EVT_FAM",
    isAnticipation: false,
    code: "EVT_FAM",
  },
];

type DureeUnJour = "entiere" | "matin" | "apres_midi";

const VAR_COULEUR_TYPE: Record<string, string> = {
  CP: "--color-cp",
  RTT: "--color-rtt",
  CPA: "--color-cpa",
  CSS: "--color-css",
  CE: "--color-ce",
  RECUP: "--color-recup",
  EVT_FAM: "--color-evtfam",
};

const TEXTE_TYPE_IMPORTANT: Record<string, string> = {
  CP: "text-[color:#3b5c9b]!",
  RTT: "text-[color:var(--color-status-success-fg)]!",
  CPA: "text-[color:#66757f]!",
  CSS: "text-[color:#6d6762]!",
  CE: "text-[color:#8d6a3c]!",
  RECUP: "text-recup!",
  EVT_FAM: "text-evtfam!",
};

const HOVER_TEINTE_TYPE: Record<string, string> = {
  CP: "enabled:hover:bg-[color-mix(in_srgb,var(--color-cp)_10%,white)]",
  RTT: "enabled:hover:bg-[color-mix(in_srgb,var(--color-rtt)_10%,white)]",
  CPA: "enabled:hover:bg-[color-mix(in_srgb,var(--color-cpa)_10%,white)]",
  CSS: "enabled:hover:bg-[color-mix(in_srgb,var(--color-css)_10%,white)]",
  CE: "enabled:hover:bg-[color-mix(in_srgb,var(--color-ce)_10%,white)]",
  RECUP: "enabled:hover:bg-[color-mix(in_srgb,var(--color-recup)_10%,white)]",
  EVT_FAM: "enabled:hover:bg-[color-mix(in_srgb,var(--color-evtfam)_10%,white)]",
};

function dateVersIsoLocal(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/**
 * "Poser pour un collaborateur" (Clôture paie, 24/08/2026) — Delphine crée
 * une demande déjà validée au nom d'un collaborateur (oubli du salarié,
 * correction ponctuelle — maladie hors scope, décision actée). Dérivé de
 * `PoserDemandeModal`, mêmes mécaniques de sélection de période (`DatePicker`
 * bornés, demi-journées/DJI) — voir ce fichier pour le détail des règles.
 * Différences :
 * - Sélecteur de collaborateur en tête (`SelectFiltrePill`, même liste que
 *   `SuivreCalendrierPage`/`SuivreSoldesPage`) — tout le formulaire reste
 *   désactivé tant qu'aucun collaborateur n'est choisi.
 * - `useDemandes`/`useSoldes` pointés sur ce collaborateur, pas l'utilisateur
 *   connecté.
 * - Pas de "solde à la date de la demande" (RTT/CPA anticipé) : simplifié à
 *   Actuel/Après, la projection n'a pas de sens pour un ajout rétroactif.
 * - Appelle `poserCongePourCollaborateur` (déjà `statut: "validee"`), pas
 *   `useDemandes().ajouterDemande` — visible dans l'historique du
 *   collaborateur concerné (transparence totale, décision actée).
 */
export function PoserCongePourCollaborateurModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { utilisateurs, loading: loadingUtilisateurs } = useUtilisateursAdmin();
  const [collaborateurId, setCollaborateurId] = useState("");

  const actifs = utilisateurs.filter((u) => u.statut === "actif");
  const collaborateurs = [...actifs]
    .map((u) => [u.id, `${u.prenom} ${u.nom}`] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));

  const { demandes } = useDemandes(collaborateurId || undefined);
  const { soldes } = useSoldes(collaborateurId || undefined);

  const anneeActuelle = new Date().getFullYear();
  const calActuel = useCalendrier(anneeActuelle);
  const calSuivant = useCalendrier(anneeActuelle + 1);

  const [optionKey, setOptionKey] = useState("CP");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [demiDebut, setDemiDebut] = useState<DemiJournee>("matin");
  const [demiFin, setDemiFin] = useState<DemiJournee>("apres_midi");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [voirDetail, setVoirDetail] = useState(false);

  const option = OPTIONS.find((o) => o.key === optionKey)!;
  const joursFeries = [...calActuel.joursFeries, ...calSuivant.joursFeries];
  const congesImposes = [...calActuel.congesImposes, ...calSuivant.congesImposes];
  const djImposees = [...calActuel.djImposees, ...calSuivant.djImposees];

  const collaborateurChoisi = Boolean(collaborateurId);

  function jourDejaOccupe(iso: string): boolean {
    return (
      congesImposes.some((c) => iso >= c.debut && iso <= c.fin) ||
      demandes.some((d) => d.statut !== "refusé" && d.statut !== "annulé" && iso >= d.debut && iso <= d.fin)
    );
  }

  function djiSurDate(iso: string): DemiJournee | null {
    const dj = djImposees.find((d) => d.date === iso);
    return dj ? dj.demiJournee : null;
  }

  function demiParDefautDebut(iso: string): DemiJournee {
    return djiSurDate(iso) === "matin" ? "apres_midi" : "matin";
  }
  function demiParDefautFin(iso: string): DemiJournee {
    return djiSurDate(iso) === "apres_midi" ? "matin" : "apres_midi";
  }

  const occupant = creerResolveurOccupant({ joursFeries, congesImposes, djImposees, demandes });

  function jourIndisponible(date: Date): boolean {
    if (!collaborateurChoisi) return true;
    const iso = dateVersIsoLocal(date);
    return !estJourOuvre(iso, joursFeries) || jourDejaOccupe(iso);
  }

  function jourIndisponiblePourFin(date: Date): boolean {
    const iso = dateVersIsoLocal(date);
    if (debut && iso < debut) return true;
    return jourIndisponible(date);
  }

  function handleDebutChange(valeur: string) {
    setError("");
    setDebut(valeur);
    const finEffective = fin && fin >= valeur ? fin : valeur;
    if (fin && fin < valeur) setFin("");
    setDemiDebut(demiParDefautDebut(valeur));
    setDemiFin(demiParDefautFin(finEffective));
  }

  function handleFinChange(valeur: string) {
    setError("");
    setFin(valeur);
    setDemiDebut(debut ? demiParDefautDebut(debut) : "matin");
    setDemiFin(demiParDefautFin(valeur));
  }

  const unSeulJour = Boolean(debut) && (!fin || fin === debut);
  const dureeUnJour: DureeUnJour =
    demiDebut === "matin" && demiFin === "apres_midi"
      ? "entiere"
      : demiDebut === "matin"
        ? "matin"
        : "apres_midi";

  const djiJourUnique = debut ? djiSurDate(debut) : null;
  const dureeUnJourOptions: { value: DureeUnJour; label: string }[] =
    djiJourUnique === "matin"
      ? [{ value: "apres_midi", label: "A. midi" }]
      : djiJourUnique === "apres_midi"
        ? [{ value: "matin", label: "Matin" }]
        : [
            { value: "entiere", label: "Journée" },
            { value: "matin", label: "Matin" },
            { value: "apres_midi", label: "A. midi" },
          ];

  const djiDebutJour = debut ? djiSurDate(debut) : null;
  const demiDebutOptions: { value: DemiJournee; label: string }[] =
    djiDebutJour === "matin"
      ? [{ value: "apres_midi", label: "A. midi" }]
      : djiDebutJour === "apres_midi"
        ? [{ value: "matin", label: "Journée" }]
        : [
            { value: "matin", label: "Journée" },
            { value: "apres_midi", label: "A. midi" },
          ];

  const djiFinJour = fin ? djiSurDate(fin) : null;
  const demiFinOptions: { value: DemiJournee; label: string }[] =
    djiFinJour === "apres_midi"
      ? [{ value: "matin", label: "Matin" }]
      : djiFinJour === "matin"
        ? [{ value: "apres_midi", label: "Journée" }]
        : [
            { value: "apres_midi", label: "Journée" },
            { value: "matin", label: "Matin" },
          ];

  function handleDureeUnJourChange(valeur: DureeUnJour) {
    if (valeur === "entiere") {
      setDemiDebut("matin");
      setDemiFin("apres_midi");
    } else if (valeur === "matin") {
      setDemiDebut("matin");
      setDemiFin("matin");
    } else {
      setDemiDebut("apres_midi");
      setDemiFin("apres_midi");
    }
  }

  const finPourCalcul = fin && fin >= debut ? fin : debut;
  let joursDemandes: number | null = null;
  if (debut) {
    let total = 0;
    const curseurJours = new Date(`${debut}T00:00:00Z`);
    const finJours = new Date(`${finPourCalcul}T00:00:00Z`);
    while (curseurJours <= finJours) {
      const iso = curseurJours.toISOString().slice(0, 10);
      const jourSemaine = curseurJours.getUTCDay();
      if (jourSemaine !== 0 && jourSemaine !== 6) {
        const okMatin =
          !occupant(iso, "matin") &&
          demiCouvertePeriode(iso, "matin", debut, finPourCalcul, demiDebut, demiFin);
        const okApresMidi =
          !occupant(iso, "apres_midi") &&
          demiCouvertePeriode(iso, "apres_midi", debut, finPourCalcul, demiDebut, demiFin);
        if (okMatin) total += 0.5;
        if (okApresMidi) total += 0.5;
      }
      curseurJours.setUTCDate(curseurJours.getUTCDate() + 1);
    }
    joursDemandes = total;
  }

  const soldeActuel = soldes
    ? optionKey === "CP"
      ? soldes.cp.valeur
      : optionKey === "RTT"
        ? soldes.rtt.valeur
        : optionKey === "CP_ANTICIPE"
          ? soldes.cpa.valeur
          : null
    : null;

  const soldeApres =
    soldeActuel !== null && joursDemandes !== null ? soldeActuel - joursDemandes : null;

  async function handleSubmit() {
    if (!collaborateurId) {
      setError("Merci de sélectionner un collaborateur.");
      return;
    }
    if (!debut) {
      setError("Merci d'indiquer une date de début.");
      return;
    }
    setError("");
    setEnvoiEnCours(true);
    try {
      await poserCongePourCollaborateur({
        utilisateurId: collaborateurId,
        type: option.type,
        isAnticipation: option.isAnticipation,
        debut,
        fin: finPourCalcul,
        demiDebut,
        demiFin,
        note,
      });
      onSuccess?.();
      onClose();
    } catch {
      setError("Impossible d'enregistrer ce congé.");
      setEnvoiEnCours(false);
    }
  }

  function pillSolde(valeur: number | null, attenue = false) {
    const negatif = valeur !== null && valeur < 0;
    const couleur = negatif
      ? `text-status-danger-fg border ${classeBordureTypeBadge(option.code)} bg-white`
      : attenue
        ? `${TEXTE_TYPE_IMPORTANT[option.code]} border ${classeBordureTypeBadge(option.code)} bg-white`
        : `text-white ${classeFondTypeBadge(option.code)}`;
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${couleur}`}>
        {valeur === null ? "…" : `${formatJours(valeur)} j`}
      </span>
    );
  }

  return (
    <Modal
      onClose={onClose}
      className="max-w-md"
      separateur={false}
      align="top"
      header={
        <div
          className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(option.code)}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="rounded-full ring-2 ring-white">
              <TypeBadge code={option.code} />
            </div>
            <h2 className="text-lg font-semibold text-white">Poser pour un collaborateur</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 text-white/70 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="text-ink-900 px-1 text-sm font-semibold">Collaborateur</h3>
          <div className="mt-1">
            <SelectFiltrePill
              value={collaborateurId}
              onChange={(e) => setCollaborateurId(e.target.value)}
              disabled={loadingUtilisateurs}
            >
              <option value="">
                {loadingUtilisateurs ? "Chargement…" : "Sélectionner un collaborateur"}
              </option>
              {collaborateurs.map(([id, nom]) => (
                <option key={id} value={id}>
                  {nom}
                </option>
              ))}
            </SelectFiltrePill>
          </div>
        </div>

        <div>
          <h3 className="text-ink-900 px-1 text-sm font-semibold">Type d&rsquo;absence</h3>
          <div className="mt-1 self-start">
            <SelectPille
              value={optionKey}
              onChange={(e) => setOptionKey(e.target.value)}
              disabled={!collaborateurChoisi}
              className={`py-2 pr-8 pl-4 text-sm font-semibold ${TEXTE_TYPE_IMPORTANT[option.code]}`}
              borderClassName={classeBordureTypeBadge(option.code)}
              chevronClassName={classeTexteTypeBadge(option.code)}
              hoverClassName={HOVER_TEINTE_TYPE[option.code]}
              sansAnneauFocus
            >
              {OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </SelectPille>
          </div>
        </div>

        <div>
          <h3 className="text-ink-900 px-1 text-sm font-semibold">Période</h3>

          <div className="mt-1 grid grid-cols-2 gap-0.5">
            <div
              className="flex flex-col rounded-l-xl p-3"
              style={{
                backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_TYPE[option.code]}) 12%, white)`,
              }}
            >
              <FieldLabel htmlFor="date-debut">Du</FieldLabel>
              <div className="mt-0.5">
                <DatePicker
                  id="date-debut"
                  value={debut}
                  onChange={handleDebutChange}
                  disabled={jourIndisponible}
                  className="border-b-0!"
                  iconClassName="text-ink-900"
                  accentColor={`var(${VAR_COULEUR_TYPE[option.code]})`}
                  compact
                />
              </div>
              {debut && (
                <div className="mt-2 self-start">
                  {unSeulJour ? (
                    <SelectPille
                      value={dureeUnJour}
                      onChange={(e) => handleDureeUnJourChange(e.target.value as DureeUnJour)}
                      disabled={dureeUnJourOptions.length === 1}
                      className={TEXTE_TYPE_IMPORTANT[option.code]}
                      borderClassName={classeBordureTypeBadge(option.code)}
                      chevronClassName={classeTexteTypeBadge(option.code)}
                      hoverClassName={HOVER_TEINTE_TYPE[option.code]}
                      sansAnneauFocus
                    >
                      {dureeUnJourOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectPille>
                  ) : (
                    <SelectPille
                      value={demiDebut}
                      onChange={(e) => setDemiDebut(e.target.value as DemiJournee)}
                      disabled={demiDebutOptions.length === 1}
                      className={TEXTE_TYPE_IMPORTANT[option.code]}
                      borderClassName={classeBordureTypeBadge(option.code)}
                      chevronClassName={classeTexteTypeBadge(option.code)}
                      hoverClassName={HOVER_TEINTE_TYPE[option.code]}
                      sansAnneauFocus
                    >
                      {demiDebutOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectPille>
                  )}
                </div>
              )}
            </div>

            <div
              className="flex flex-col rounded-r-xl p-3"
              style={{
                backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_TYPE[option.code]}) 12%, white)`,
              }}
            >
              <FieldLabel htmlFor="date-fin">Au</FieldLabel>
              <div className="mt-0.5">
                <DatePicker
                  id="date-fin"
                  value={fin}
                  onChange={handleFinChange}
                  disabled={jourIndisponiblePourFin}
                  className="border-b-0!"
                  iconClassName="text-ink-900"
                  accentColor={`var(${VAR_COULEUR_TYPE[option.code]})`}
                  compact
                  dateMarquee={debut || undefined}
                  moisInitial={debut || undefined}
                />
              </div>
              {debut && fin && !unSeulJour && (
                <div className="mt-2 self-start">
                  <SelectPille
                    value={demiFin}
                    onChange={(e) => setDemiFin(e.target.value as DemiJournee)}
                    disabled={demiFinOptions.length === 1}
                    className={TEXTE_TYPE_IMPORTANT[option.code]}
                    borderClassName={classeBordureTypeBadge(option.code)}
                    chevronClassName={classeTexteTypeBadge(option.code)}
                    hoverClassName={HOVER_TEINTE_TYPE[option.code]}
                    sansAnneauFocus
                  >
                    {demiFinOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SelectPille>
                </div>
              )}
            </div>
          </div>

          {joursDemandes !== null && (
            <p className="text-ink-500 mt-2 px-1 text-xs">
              Soit{" "}
              <span
                className="text-ink-900 rounded px-1 font-bold"
                style={{
                  backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_TYPE[option.code]}) 30%, white)`,
                }}
              >
                {formatJours(joursDemandes)} {joursDemandes === 1 ? "jour" : "jours"}
              </span>{" "}
              <button
                type="button"
                onClick={() => setVoirDetail((v) => !v)}
                className="text-ink-500 underline"
              >
                {voirDetail ? "masquer" : "voir"}
              </button>
            </p>
          )}

          {voirDetail && debut && (
            <div className="mt-2">
              <DetailPeriodeConges
                debut={debut}
                fin={finPourCalcul}
                demiDebut={demiDebut}
                demiFin={demiFin}
                codeParDefaut={option.code}
                occupant={occupant}
              />
            </div>
          )}
        </div>

        <div>
          <h3 className="text-ink-900 px-1 text-sm font-semibold">Solde</h3>

          {soldeActuel !== null ? (
            <div className="mt-1 overflow-hidden rounded-xl">
              <div className="bg-surface-app flex items-center justify-between px-4 py-3">
                <span className="text-ink-500 text-sm">Actuel</span>
                {pillSolde(soldeActuel, true)}
              </div>
              {soldeApres !== null && (
                <div
                  className="border-ink-300/60 flex items-center justify-between border-t px-4 py-3"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_TYPE[option.code]}) 12%, white)`,
                  }}
                >
                  <span className="text-ink-500 text-sm font-semibold">Après ce congé</span>
                  {pillSolde(soldeApres)}
                </div>
              )}
            </div>
          ) : (
            <p className="text-ink-500 mt-1 px-1 text-xs">
              {collaborateurChoisi
                ? "Aucun solde associé à ce type d'absence."
                : "Sélectionnez un collaborateur pour voir son solde."}
            </p>
          )}
        </div>

        <div className="mb-16">
          <label htmlFor="note" className="text-ink-900 px-1 text-sm font-semibold">
            Message (facultatif)
          </label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Ex. oubli de saisie signalé par le salarié…"
            className="mt-1 w-full rounded-none!"
          />
        </div>

        {error && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="bg-surface-card border-ink-300/60 sticky bottom-0 -mx-6 border-t px-6 py-3">
        <Button
          onClick={handleSubmit}
          disabled={envoiEnCours || !collaborateurChoisi || !debut}
          className="rounded-card w-fit px-6 py-3.5"
        >
          <Send size={16} />
          Ajouter ce congé
        </Button>
      </div>
    </Modal>
  );
}
