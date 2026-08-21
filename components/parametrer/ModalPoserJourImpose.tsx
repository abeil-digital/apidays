"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import type {
  CongeImpose,
  CongeImposeInput,
  DemiJournee,
  DjImposee,
  DjImposeeInput,
  JourFerie,
} from "@/lib/types";
import { formatJours } from "@/lib/format";
import { estJourOuvre } from "@/lib/joursFeries";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Modal } from "@/components/ui/Modal";
import { SelectPille } from "@/components/ui/SelectPille";
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

export type Mode = "CPI" | "DJI";

const LABEL_MODE: Record<Mode, string> = {
  CPI: "Congés payés imposés",
  DJI: "Demi-journée",
};

// Même mécanique que `PoserDemandeModal.tsx` (teinte du sélecteur de type
// selon le code choisi) — CPI/DJI ajoutés, mêmes tokens couleur que
// `TypeBadge.tsx`/`app/globals.css`.
const VAR_COULEUR_MODE: Record<Mode, string> = {
  CPI: "--color-cpi",
  DJI: "--color-dji",
};
const TEXTE_MODE_IMPORTANT: Record<Mode, string> = {
  CPI: "text-cpi!",
  DJI: "text-dji!",
};
const HOVER_TEINTE_MODE: Record<Mode, string> = {
  CPI: "enabled:hover:bg-[color-mix(in_srgb,var(--color-cpi)_10%,white)]",
  DJI: "enabled:hover:bg-[color-mix(in_srgb,var(--color-dji)_10%,white)]",
};

type DureeUnJour = "entiere" | "matin" | "apres_midi";

function dateVersIsoLocal(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

interface ModalPoserJourImposeProps {
  joursFeries: JourFerie[];
  congesImposes: CongeImpose[];
  djImposees: DjImposee[];
  onAjouterCongeImpose: (input: CongeImposeInput) => Promise<CongeImpose>;
  onAjouterDj: (input: DjImposeeInput) => Promise<DjImposee>;
  onClose: () => void;
  /** Mode pré-sélectionné à l'ouverture (ex. "+" sur la carte DJI de la
   * légende) — reste modifiable via le sélecteur, défaut CPI. */
  modeInitial?: Mode;
  /** Pré-remplit la date de début (21/08/2026) — clic sur un jour vide du
   * calendrier. Reste modifiable, sans effet sur les appelants qui ne le
   * passent pas (ouverture "vierge" via le "+" des cartes de légende). */
  dateInitiale?: string;
}

/**
 * Popin unifiée de création CPI/DJI (21/08/2026, `/parametrer/calendrier3`) —
 * reprend le gabarit de `PoserDemandeModal.tsx` (Du/Au, verrouillage du
 * sélecteur de demi-journée sur une DJI existante, lien "Voir") plutôt que
 * les deux modales maison historiques (`ModalCongesImposes`/
 * `ModalDjImposees`, `CalendrierPage.tsx`) qui divergaient dans leur UX.
 * Ironie assumée : `PoserDemandeModal` avait elle-même à l'origine repris le
 * gabarit de `ModalCongesImposes` (voir son JSDoc) — c'est la version
 * affinée depuis (transparence, verrouillage DJI) qu'on réinjecte ici.
 *
 * Pas de fetch des demandes personnelles ici (hors scope, voir le plan) :
 * l'occupant ne connaît que férié/CPI/DJI, la conso perso est un chantier
 * séparé. En repos direct : on ne peut pas poser un CPI/DJI sur un jour déjà
 * couvert par un CPI/DJI/férié existant — `jourIndisponible` bloque le
 * `DatePicker` sur ces jours (comportement hérité de `PoserDemandeModal`,
 * juste sans la branche "demande personnelle").
 */
export function ModalPoserJourImpose({
  joursFeries,
  congesImposes,
  djImposees,
  onAjouterCongeImpose,
  onAjouterDj,
  onClose,
  modeInitial = "CPI",
  dateInitiale,
}: ModalPoserJourImposeProps) {
  const [mode, setMode] = useState<Mode>(modeInitial);
  const [debut, setDebut] = useState(dateInitiale ?? "");
  const [fin, setFin] = useState("");
  const [demiDebut, setDemiDebut] = useState<DemiJournee>(() =>
    dateInitiale ? demiParDefautDebut(dateInitiale) : "matin",
  );
  const [demiFin, setDemiFin] = useState<DemiJournee>(() =>
    dateInitiale ? demiParDefautFin(dateInitiale) : "apres_midi",
  );
  const [creneauDji, setCreneauDji] = useState<DemiJournee>(() => {
    if (!dateInitiale) return "apres_midi";
    const dj = djiSurDate(dateInitiale);
    return dj === "apres_midi" ? "matin" : "apres_midi";
  });
  const [error, setError] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [voirDetail, setVoirDetail] = useState(false);

  const code: TypeBadgeCode = mode;

  // Une journée déjà couverte par un CPI existant est bloquée (période qui ne
  // peut pas se chevaucher avec une autre) ; les jours fériés/non ouvrés le
  // sont aussi (`estJourOuvre`). Une DJI existante ne bloque PAS le jour
  // entier — elle ne verrouille que le créneau (voir `djiSurDate` plus bas),
  // même principe que côté collaborateur.
  function jourDejaOccupe(iso: string): boolean {
    return congesImposes.some((c) => iso >= c.debut && iso <= c.fin);
  }

  function jourIndisponible(date: Date): boolean {
    const iso = dateVersIsoLocal(date);
    return !estJourOuvre(iso, joursFeries) || jourDejaOccupe(iso);
  }

  function jourIndisponiblePourFin(date: Date): boolean {
    const iso = dateVersIsoLocal(date);
    if (debut && iso < debut) return true;
    return jourIndisponible(date);
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

  const occupant = creerResolveurOccupant({ joursFeries, congesImposes, djImposees, demandes: [] });

  function handleDebutChange(valeur: string) {
    setError("");
    setDebut(valeur);
    if (mode === "DJI") {
      const dj = djiSurDate(valeur);
      setCreneauDji(dj === "apres_midi" ? "matin" : "apres_midi");
      return;
    }
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

  function handleModeChange(valeur: Mode) {
    setMode(valeur);
    setError("");
    setFin("");
    if (valeur === "DJI" && debut) {
      const dj = djiSurDate(debut);
      setCreneauDji(dj === "apres_midi" ? "matin" : "apres_midi");
    }
  }

  // Mode CPI — même dérivation qu'à l'origine dans `PoserDemandeModal`.
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

  // Mode DJI — un seul jour, un seul créneau (jamais "journée entière", une
  // DJI est toujours une seule demi-journée).
  const creneauDjiVerrou = debut ? djiSurDate(debut) : null;
  const creneauDjiOptions: { value: DemiJournee; label: string }[] =
    creneauDjiVerrou === "matin"
      ? [{ value: "apres_midi", label: "Après-midi" }]
      : creneauDjiVerrou === "apres_midi"
        ? [{ value: "matin", label: "Matin" }]
        : [
            { value: "matin", label: "Matin" },
            { value: "apres_midi", label: "Après-midi" },
          ];

  const finPourCalcul = mode === "CPI" ? (fin && fin >= debut ? fin : debut) : debut;
  const demiDebutEffectif = mode === "DJI" ? creneauDji : demiDebut;
  const demiFinEffectif = mode === "DJI" ? creneauDji : demiFin;

  // Nombre de jours de la période en cours de saisie, en excluant ce qui est
  // déjà occupé (férié/CPI/DJI) — même principe que `PoserDemandeModal`,
  // sans la dimension "demande personnelle".
  let joursSaisie: number | null = null;
  if (debut) {
    let total = 0;
    const curseur = new Date(`${debut}T00:00:00Z`);
    const finCurseur = new Date(`${finPourCalcul}T00:00:00Z`);
    while (curseur <= finCurseur) {
      const iso = curseur.toISOString().slice(0, 10);
      const jourSemaine = curseur.getUTCDay();
      if (jourSemaine !== 0 && jourSemaine !== 6) {
        const okMatin =
          !occupant(iso, "matin") &&
          demiCouvertePeriode(
            iso,
            "matin",
            debut,
            finPourCalcul,
            demiDebutEffectif,
            demiFinEffectif,
          );
        const okApresMidi =
          !occupant(iso, "apres_midi") &&
          demiCouvertePeriode(
            iso,
            "apres_midi",
            debut,
            finPourCalcul,
            demiDebutEffectif,
            demiFinEffectif,
          );
        if (mode === "DJI") {
          // Une DJI ne compte que le créneau choisi, pas la journée entière.
          if (demiDebutEffectif === "matin" && okMatin) total += 0.5;
          if (demiDebutEffectif === "apres_midi" && okApresMidi) total += 0.5;
        } else {
          if (okMatin) total += 0.5;
          if (okApresMidi) total += 0.5;
        }
      }
      curseur.setUTCDate(curseur.getUTCDate() + 1);
    }
    joursSaisie = total;
  }

  async function handleSubmit() {
    if (!debut) {
      setError("Merci d'indiquer une date.");
      return;
    }
    setError("");
    setEnvoiEnCours(true);
    try {
      if (mode === "CPI") {
        await onAjouterCongeImpose({ debut, fin: finPourCalcul, demiDebut, demiFin });
      } else {
        await onAjouterDj({ date: debut, demiJournee: creneauDji });
      }
      onClose();
    } catch {
      setError("Impossible d'enregistrer.");
      setEnvoiEnCours(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      className="max-w-md"
      separateur={false}
      align="top"
      header={
        <div className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(code)}`}>
          <div className="flex items-center gap-2.5">
            <div className="rounded-full ring-2 ring-white">
              <TypeBadge code={code} />
            </div>
            <h2 className="text-lg font-semibold text-white">Ajouter</h2>
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
          <h3 className="text-ink-900 px-1 text-sm font-semibold">Type</h3>
          <div className="mt-1 self-start">
            <SelectPille
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as Mode)}
              className={`py-2 pr-8 pl-4 text-sm font-semibold ${TEXTE_MODE_IMPORTANT[mode]}`}
              borderClassName={classeBordureTypeBadge(code)}
              chevronClassName={classeTexteTypeBadge(code)}
              hoverClassName={HOVER_TEINTE_MODE[mode]}
              sansAnneauFocus
            >
              {(Object.keys(LABEL_MODE) as Mode[]).map((m) => (
                <option key={m} value={m}>
                  {LABEL_MODE[m]}
                </option>
              ))}
            </SelectPille>
          </div>
        </div>

        <div>
          <h3 className="text-ink-900 px-1 text-sm font-semibold">
            {mode === "CPI" ? "Période" : "Date"}
          </h3>

          {mode === "CPI" ? (
            <div className="mt-1 grid grid-cols-2 gap-0.5">
              <div
                className="flex flex-col rounded-l-xl p-3"
                style={{
                  backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_MODE[mode]}) 12%, white)`,
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
                    accentColor={`var(${VAR_COULEUR_MODE[mode]})`}
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
                        className={TEXTE_MODE_IMPORTANT[mode]}
                        borderClassName={classeBordureTypeBadge(code)}
                        chevronClassName={classeTexteTypeBadge(code)}
                        hoverClassName={HOVER_TEINTE_MODE[mode]}
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
                        className={TEXTE_MODE_IMPORTANT[mode]}
                        borderClassName={classeBordureTypeBadge(code)}
                        chevronClassName={classeTexteTypeBadge(code)}
                        hoverClassName={HOVER_TEINTE_MODE[mode]}
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
                  backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_MODE[mode]}) 12%, white)`,
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
                    accentColor={`var(${VAR_COULEUR_MODE[mode]})`}
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
                      className={TEXTE_MODE_IMPORTANT[mode]}
                      borderClassName={classeBordureTypeBadge(code)}
                      chevronClassName={classeTexteTypeBadge(code)}
                      hoverClassName={HOVER_TEINTE_MODE[mode]}
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
          ) : (
            <div
              className="mt-1 flex flex-col rounded-xl p-3"
              style={{
                backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_MODE[mode]}) 12%, white)`,
              }}
            >
              <FieldLabel htmlFor="date-dji">Date</FieldLabel>
              <div className="mt-0.5">
                <DatePicker
                  id="date-dji"
                  value={debut}
                  onChange={handleDebutChange}
                  disabled={jourIndisponible}
                  className="border-b-0!"
                  iconClassName="text-ink-900"
                  accentColor={`var(${VAR_COULEUR_MODE[mode]})`}
                  compact
                />
              </div>
              {debut && (
                <div className="mt-2 self-start">
                  <SelectPille
                    value={creneauDji}
                    onChange={(e) => setCreneauDji(e.target.value as DemiJournee)}
                    disabled={creneauDjiOptions.length === 1}
                    className={TEXTE_MODE_IMPORTANT[mode]}
                    borderClassName={classeBordureTypeBadge(code)}
                    chevronClassName={classeTexteTypeBadge(code)}
                    hoverClassName={HOVER_TEINTE_MODE[mode]}
                    sansAnneauFocus
                  >
                    {creneauDjiOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SelectPille>
                </div>
              )}
              {debut && joursSaisie !== null && (
                <p className="text-ink-500 mt-2 px-1 text-xs">
                  Soit{" "}
                  <span
                    className="text-ink-900 rounded px-1 font-bold"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_MODE[mode]}) 30%, white)`,
                    }}
                  >
                    {formatJours(joursSaisie)} {joursSaisie === 1 ? "jour" : "jours"}
                  </span>
                </p>
              )}
            </div>
          )}

          {mode === "CPI" && debut && joursSaisie !== null && (
            <p className="text-ink-500 mt-2 px-1 text-xs">
              Soit{" "}
              <span
                className="text-ink-900 rounded px-1 font-bold"
                style={{
                  backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_MODE[mode]}) 30%, white)`,
                }}
              >
                {formatJours(joursSaisie)} {joursSaisie === 1 ? "jour" : "jours"}
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

          {mode === "CPI" && voirDetail && debut && (
            <div className="mt-2">
              <DetailPeriodeConges
                debut={debut}
                fin={finPourCalcul}
                demiDebut={demiDebutEffectif}
                demiFin={demiFinEffectif}
                codeParDefaut={code}
                occupant={occupant}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Réserve la hauteur du bouton sticky ci-dessous (22/08/2026) — sans
          ce spacer, le dernier texte du contenu scrollable se retrouve caché
          derrière le bouton une fois scrollé tout en bas (le sticky ne
          réserve pas sa place dans le flux normal du document). */}
      <div className="h-16 shrink-0" aria-hidden />

      <div className="bg-surface-card border-ink-300/60 sticky bottom-0 -mx-6 border-t px-6 py-3">
        <Button
          onClick={handleSubmit}
          disabled={envoiEnCours}
          className="rounded-card w-fit px-6 py-3.5"
        >
          <Send size={16} />
          Ajouter
        </Button>
      </div>
    </Modal>
  );
}
