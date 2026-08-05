"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import type { DemiJournee, DjImposee, DjImposeeInput, JourFerie } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { datesDuJourDeLaSemaine, joursFeriesLegaux, lundiSemaineDu15Aout } from "@/lib/joursFeries";
import { useCalendrier } from "@/hooks/useCalendrier";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { ListCard } from "@/components/ui/ListCard";
import { Select } from "@/components/ui/Select";

const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const LABEL_DEMI_JOURNEE: Record<DemiJournee, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
};

function formatSemaineDu15Aout(lundiIso: string): string {
  const d = new Date(`${lundiIso}T00:00:00Z`);
  const dimanche = new Date(d);
  dimanche.setUTCDate(dimanche.getUTCDate() + 6);
  return `${formatDate(lundiIso)} → ${formatDate(dimanche.toISOString().slice(0, 10))}`;
}

// ------------------------------------------------------------
// Jours fériés — bloc partagé par les deux vues
// ------------------------------------------------------------

interface BlocJoursFeriesProps {
  annee: number;
  joursFeries: JourFerie[];
  onAjouter: (input: { date: string; libelle: string }) => Promise<JourFerie>;
  onSupprimer: (id: string) => Promise<void>;
  onPreRemplir: () => Promise<JourFerie[]>;
}

function BlocJoursFeries({
  annee,
  joursFeries,
  onAjouter,
  onSupprimer,
  onPreRemplir,
}: BlocJoursFeriesProps) {
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [date, setDate] = useState("");
  const [libelle, setLibelle] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [preRemplissage, setPreRemplissage] = useState(false);

  const manqueDesFeriesLegaux = useMemo(() => {
    const dates = new Set(joursFeries.map((j) => j.date));
    return joursFeriesLegaux(annee).some((j) => !dates.has(j.date));
  }, [annee, joursFeries]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date || !libelle.trim()) {
      setErreur("Merci d'indiquer une date et un libellé.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await onAjouter({ date, libelle: libelle.trim() });
      setDate("");
      setLibelle("");
      setAjoutOuvert(false);
    } catch {
      setErreur("Impossible d'ajouter ce jour férié.");
    } finally {
      setEnvoi(false);
    }
  }

  async function handlePreRemplir() {
    setPreRemplissage(true);
    try {
      await onPreRemplir();
    } finally {
      setPreRemplissage(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-ink-900 text-base font-semibold">Jours fériés {annee}</h3>
        {manqueDesFeriesLegaux && (
          <Button
            type="button"
            variant="secondary"
            disabled={preRemplissage}
            onClick={handlePreRemplir}
            className="shrink-0 rounded-full px-4 py-1.5 text-xs"
          >
            {preRemplissage ? "…" : "Pré-remplir les jours fériés légaux"}
          </Button>
        )}
      </div>

      {joursFeries.length === 0 ? (
        <EmptyRow text="Aucun jour férié renseigné pour cette année." />
      ) : (
        <ListCard>
          {joursFeries.map((f, i) => (
            <div
              key={f.id}
              className={`flex items-center justify-between px-4 py-3 text-sm ${
                i === joursFeries.length - 1 ? "" : "border-ink-300/60 border-b"
              }`}
            >
              <span className="text-ink-900">
                {formatDate(f.date)} — {f.libelle}
              </span>
              <button
                type="button"
                onClick={() => onSupprimer(f.id)}
                aria-label="Supprimer ce jour férié"
                className="text-status-danger-fg shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </ListCard>
      )}

      {ajoutOuvert ? (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <div>
            <FieldLabel htmlFor="ferie-date">Date</FieldLabel>
            <Input
              id="ferie-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2 w-40"
            />
          </div>
          <div>
            <FieldLabel htmlFor="ferie-libelle">Libellé</FieldLabel>
            <Input
              id="ferie-libelle"
              type="text"
              placeholder="Ex. Lundi de Pentecôte"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              className="mt-2 w-48"
            />
          </div>
          <Button type="submit" disabled={envoi} className="rounded-full px-4 py-2.5 text-xs">
            Ajouter
          </Button>
          <button
            type="button"
            onClick={() => setAjoutOuvert(false)}
            className="text-ink-500 rounded-full px-2 py-2.5 text-xs font-semibold underline"
          >
            Annuler
          </button>
          {erreur && <p className="text-status-danger-fg w-full text-xs">{erreur}</p>}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAjoutOuvert(true)}
          className="text-ink-900 w-fit text-xs font-semibold underline"
        >
          + ajouter un jour férié
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Vue "Année en cours" — lecture seule + correction ponctuelle
// ------------------------------------------------------------

interface LigneCorrectionDjProps {
  dj: DjImposee;
  onValider: (input: DjImposeeInput) => Promise<void>;
  onAnnuler: () => void;
}

function LigneCorrectionDj({ dj, onValider, onAnnuler }: LigneCorrectionDjProps) {
  const [date, setDate] = useState(dj.date);
  const [demiJournee, setDemiJournee] = useState<DemiJournee>(dj.demiJournee);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    try {
      await onValider({ date, demiJournee });
    } catch {
      setErreur("Impossible d'enregistrer cette correction.");
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-40"
        />
        <Select
          value={demiJournee}
          onChange={(e) => setDemiJournee(e.target.value as DemiJournee)}
          className="w-32"
        >
          <option value="matin">Matin</option>
          <option value="apres_midi">Après-midi</option>
        </Select>
        <Button type="submit" disabled={envoi} className="rounded-full px-4 py-1.5 text-xs">
          Valider
        </Button>
        <button
          type="button"
          onClick={onAnnuler}
          className="text-ink-500 text-xs font-semibold underline"
        >
          Annuler
        </button>
      </div>
      {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}
    </form>
  );
}

function VueAnneeEnCours({ annee }: { annee: number }) {
  const calendrier = useCalendrier(annee);
  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);
  const semaineAout = lundiSemaineDu15Aout(annee);

  if (calendrier.loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {calendrier.error && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {calendrier.error}
        </div>
      )}

      <div className="bg-surface-card rounded-card flex flex-col gap-5 p-5 shadow-sm">
        <h2 className="text-ink-900 text-lg font-semibold">Demi-journées imposées {annee}</h2>

        <div>
          <FieldLabel>Semaine du 15 août imposée</FieldLabel>
          <p className="text-ink-900 mt-2 text-sm font-semibold">
            {formatSemaineDu15Aout(semaineAout)}
          </p>
        </div>

        <div>
          {calendrier.djImposees.length === 0 ? (
            <EmptyRow text="Aucune demi-journée imposée paramétrée pour cette année." />
          ) : (
            <ListCard>
              {calendrier.djImposees.map((dj, i) => (
                <div
                  key={dj.id}
                  className={
                    i === calendrier.djImposees.length - 1 ? "" : "border-ink-300/60 border-b"
                  }
                >
                  {ligneOuverte === dj.id ? (
                    <LigneCorrectionDj
                      dj={dj}
                      onValider={async (input) => {
                        await calendrier.modifierDj(dj.id, input);
                        setLigneOuverte(null);
                      }}
                      onAnnuler={() => setLigneOuverte(null)}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="text-ink-900">
                        {formatDate(dj.date)} — {LABEL_DEMI_JOURNEE[dj.demiJournee]}
                      </span>
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setLigneOuverte(dj.id)}
                          className="text-ink-500 text-xs font-semibold underline"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => calendrier.supprimerDj(dj.id)}
                          aria-label="Supprimer cette demi-journée imposée"
                          className="text-status-danger-fg shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </ListCard>
          )}
        </div>
      </div>

      <div className="bg-surface-card rounded-card p-5 shadow-sm">
        <BlocJoursFeries
          annee={annee}
          joursFeries={calendrier.joursFeries}
          onAjouter={calendrier.ajouterFerie}
          onSupprimer={calendrier.supprimerFerie}
          onPreRemplir={calendrier.preRemplirFeries}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Vue "Paramétrage année à venir" — saisie + validation
// ------------------------------------------------------------

function VueParametrageAnneeAVenir({ annee }: { annee: number }) {
  const calendrier = useCalendrier(annee);

  if (calendrier.loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  return (
    <FormulaireParametrageAnneeAVenir
      key={calendrier.parametrage?.id ?? `a-venir-${annee}`}
      annee={annee}
      calendrier={calendrier}
    />
  );
}

function FormulaireParametrageAnneeAVenir({
  annee,
  calendrier,
}: {
  annee: number;
  calendrier: ReturnType<typeof useCalendrier>;
}) {
  const [jourSemaine, setJourSemaine] = useState(calendrier.parametrage?.jourSemaineDefaut ?? 5);
  const [nbCible, setNbCible] = useState(String(calendrier.parametrage?.nbDemiJourneesCible ?? 16));
  const [datesJourSemaineCochees, setDatesJourSemaineCochees] = useState<Set<string>>(
    () => new Set(calendrier.djImposees.map((dj) => dj.date)),
  );
  const [dateLibre, setDateLibre] = useState("");
  const [datesLibres, setDatesLibres] = useState<string[]>(() =>
    calendrier.djImposees
      .map((dj) => dj.date)
      .filter(
        (date) =>
          !datesDuJourDeLaSemaine(annee, calendrier.parametrage?.jourSemaineDefaut ?? 5).includes(
            date,
          ),
      ),
  );
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [valide, setValide] = useState(false);

  const datesJourSemaine = useMemo(
    () => datesDuJourDeLaSemaine(annee, jourSemaine),
    [annee, jourSemaine],
  );

  function handleChangeJourSemaine(valeur: number) {
    setJourSemaine(valeur);
    setDatesJourSemaineCochees(new Set());
  }

  function toggleDate(date: string) {
    setValide(false);
    setDatesJourSemaineCochees((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }

  function ajouterDateLibre() {
    if (!dateLibre) return;
    setValide(false);
    setDatesLibres((prev) => (prev.includes(dateLibre) ? prev : [...prev, dateLibre].sort()));
    setDateLibre("");
  }

  function retirerDateLibre(date: string) {
    setValide(false);
    setDatesLibres((prev) => prev.filter((d) => d !== date));
  }

  const cible = Number(nbCible) || 0;
  const selectionnees = datesJourSemaineCochees.size + datesLibres.length;
  const restant = cible - selectionnees;

  async function handleValider() {
    setErreur("");
    setEnvoi(true);
    try {
      const djs = [...Array.from(datesJourSemaineCochees), ...datesLibres].map((date) => ({
        date,
        demiJournee: "apres_midi" as const,
      }));

      await calendrier.validerParametrage(
        {
          annee,
          semaineAoutImposee: lundiSemaineDu15Aout(annee),
          nbDemiJourneesCible: cible,
          jourSemaineDefaut: jourSemaine,
        },
        djs,
      );
      setValide(true);
    } catch {
      setErreur("Impossible d'enregistrer le paramétrage.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface-card rounded-card flex flex-col gap-5 p-5 shadow-sm">
        <h2 className="text-ink-900 text-lg font-semibold">
          Paramétrage des demi-journées imposées {annee}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="jour-semaine">Jour de la semaine par défaut</FieldLabel>
            <Select
              id="jour-semaine"
              value={jourSemaine}
              onChange={(e) => handleChangeJourSemaine(Number(e.target.value))}
              className="mt-2 block w-40"
            >
              {JOURS_SEMAINE.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="nb-cible">Nombre de DJ visé</FieldLabel>
            <Input
              id="nb-cible"
              type="number"
              min={0}
              value={nbCible}
              onChange={(e) => {
                setNbCible(e.target.value);
                setValide(false);
              }}
              className="mt-2 w-40"
            />
          </div>
        </div>

        <div
          className={`rounded-control px-3.5 py-3 text-sm font-semibold ${
            restant === 0
              ? "bg-status-success-bg text-status-success-fg"
              : "bg-status-warning-bg text-status-warning-fg"
          }`}
        >
          {restant === 0
            ? `${selectionnees} demi-journée${selectionnees > 1 ? "s" : ""} sélectionnée${selectionnees > 1 ? "s" : ""} — objectif atteint`
            : restant > 0
              ? `${restant} demi-journée${restant > 1 ? "s" : ""} restante${restant > 1 ? "s" : ""} pour atteindre l'objectif (${selectionnees}/${cible})`
              : `${Math.abs(restant)} demi-journée${Math.abs(restant) > 1 ? "s" : ""} au-delà de l'objectif (${selectionnees}/${cible})`}
        </div>

        <div>
          <FieldLabel>
            {JOURS_SEMAINE[jourSemaine - 1]}s de {annee}
          </FieldLabel>
          <ListCard className="mt-2">
            {datesJourSemaine.map((date, i) => (
              <label
                key={date}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm ${
                  i === datesJourSemaine.length - 1 ? "" : "border-ink-300/60 border-b"
                }`}
              >
                <input
                  type="checkbox"
                  checked={datesJourSemaineCochees.has(date)}
                  onChange={() => toggleDate(date)}
                />
                <span className="text-ink-900">{formatDate(date)}</span>
              </label>
            ))}
          </ListCard>
        </div>

        <div>
          <FieldLabel htmlFor="date-libre">Ajouter une autre date</FieldLabel>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="date-libre"
              type="date"
              value={dateLibre}
              onChange={(e) => setDateLibre(e.target.value)}
              className="w-40"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={ajouterDateLibre}
              className="rounded-full px-4 py-2.5 text-xs"
            >
              Ajouter
            </Button>
          </div>
          {datesLibres.length > 0 && (
            <ListCard className="mt-2">
              {datesLibres.map((date, i) => (
                <div
                  key={date}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                    i === datesLibres.length - 1 ? "" : "border-ink-300/60 border-b"
                  }`}
                >
                  <span className="text-ink-900">{formatDate(date)}</span>
                  <button
                    type="button"
                    onClick={() => retirerDateLibre(date)}
                    aria-label="Retirer cette date"
                    className="text-status-danger-fg shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </ListCard>
          )}
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        {valide && !erreur && (
          <div className="rounded-control bg-status-success-bg text-status-success-fg px-3 py-2.5 text-sm">
            Paramétrage {annee} enregistré.
          </div>
        )}

        <Button
          type="button"
          disabled={envoi}
          onClick={handleValider}
          className="rounded-card w-fit self-start px-6 py-3"
        >
          {envoi ? "Validation…" : "Valider"}
        </Button>
      </div>

      <div className="bg-surface-card rounded-card p-5 shadow-sm">
        <BlocJoursFeries
          annee={annee}
          joursFeries={calendrier.joursFeries}
          onAjouter={calendrier.ajouterFerie}
          onSupprimer={calendrier.supprimerFerie}
          onPreRemplir={calendrier.preRemplirFeries}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Page
// ------------------------------------------------------------

export function CalendrierPage() {
  const anneeEnCours = new Date().getFullYear();
  const anneeAVenir = anneeEnCours + 1;
  const [vue, setVue] = useState<"en_cours" | "a_venir">("en_cours");

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0">
      <h1 className="text-ink-900 px-1 text-2xl font-semibold">Calendrier</h1>

      <div className="flex gap-2 px-1">
        <button
          type="button"
          onClick={() => setVue("en_cours")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            vue === "en_cours"
              ? "bg-brand text-brand-foreground"
              : "bg-surface-card text-ink-900 shadow-sm"
          }`}
        >
          Année en cours ({anneeEnCours})
        </button>
        <button
          type="button"
          onClick={() => setVue("a_venir")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            vue === "a_venir"
              ? "bg-brand text-brand-foreground"
              : "bg-surface-card text-ink-900 shadow-sm"
          }`}
        >
          Paramétrage {anneeAVenir}
        </button>
      </div>

      {vue === "en_cours" ? (
        <VueAnneeEnCours annee={anneeEnCours} />
      ) : (
        <VueParametrageAnneeAVenir annee={anneeAVenir} />
      )}
    </div>
  );
}
