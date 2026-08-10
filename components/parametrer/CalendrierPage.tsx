"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, Eye, Pencil, PlusCircle, TriangleAlert, Trash2 } from "lucide-react";
import type {
  CongeImpose,
  CongeImposeInput,
  DemiJournee,
  DjImposee,
  DjImposeeInput,
  JourFerie,
} from "@/lib/types";
import { formatDate, formatJourMois, formatJours, nombreJours } from "@/lib/format";
import { datesDuJourDeLaSemaine, joursFeriesLegaux, lundiSemaineDu15Aout } from "@/lib/joursFeries";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useObjectifsCalendrier } from "@/hooks/useObjectifsCalendrier";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { JourBadge } from "@/components/ui/JourBadge";
import { ListCard } from "@/components/ui/ListCard";
import { MiniCalendrier, MOIS_FR, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { Modal } from "@/components/ui/Modal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Select } from "@/components/ui/Select";
import { SelectPille } from "@/components/ui/SelectPille";
import { TypeBadge } from "@/components/demandes/TypeBadge";

const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Jours fériés {annee}</SectionLabel>
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
        <div className="flex flex-col gap-2">
          {joursFeries.map((f) => (
            <div
              key={f.id}
              className="bg-surface-card flex items-center justify-between px-4 py-3 text-sm shadow-sm"
            >
              <span className="text-ink-900">
                <span className="font-bold">{formatDate(f.date)}</span> — {f.libelle}
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
        </div>
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
// Congés imposés — bloc partagé par les deux vues
// ------------------------------------------------------------

interface CongeImposeRowProps {
  conge: CongeImpose;
  onSupprimer: (id: string) => void;
}

function CongeImposeRow({ conge, onSupprimer }: CongeImposeRowProps) {
  return (
    <div className="bg-surface-card flex items-center justify-between px-4 py-3 text-sm shadow-sm">
      <div>
        <div className="text-ink-900 font-bold">
          Du {formatJourMois(conge.debut, false)} au {formatJourMois(conge.fin, false)}
        </div>
        <div className="text-ink-500 text-xs">{nombreJours(conge.debut, conge.fin)} jours</div>
      </div>
      <button
        type="button"
        onClick={() => onSupprimer(conge.id)}
        aria-label="Supprimer cette période de congés imposés"
        className="text-status-danger-fg shrink-0"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

interface BlocCongesImposesProps {
  annee: number;
  congesImposes: CongeImpose[];
  onAjouter: (input: CongeImposeInput) => Promise<CongeImpose>;
  onSupprimer: (id: string) => Promise<void>;
}

function BlocCongesImposes({
  annee,
  congesImposes,
  onAjouter,
  onSupprimer,
}: BlocCongesImposesProps) {
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!debut || !fin || fin < debut) {
      setErreur("Merci d'indiquer une date de début et de fin valides.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await onAjouter({ debut, fin, demiDebut: "matin", demiFin: "apres_midi" });
      setDebut("");
      setFin("");
      setAjoutOuvert(false);
    } catch {
      setErreur("Impossible d'ajouter cette période.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Congés imposés {annee}</SectionLabel>

      {congesImposes.length === 0 ? (
        <EmptyRow text="Aucune période de congés imposés pour cette année." />
      ) : (
        <div className="flex flex-col gap-2">
          {congesImposes.map((c) => (
            <CongeImposeRow key={c.id} conge={c} onSupprimer={onSupprimer} />
          ))}
        </div>
      )}

      {ajoutOuvert ? (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <div>
            <FieldLabel htmlFor="conge-debut">Début</FieldLabel>
            <Input
              id="conge-debut"
              type="date"
              value={debut}
              onChange={(e) => setDebut(e.target.value)}
              className="mt-2 w-40"
            />
          </div>
          <div>
            <FieldLabel htmlFor="conge-fin">Fin</FieldLabel>
            <Input
              id="conge-fin"
              type="date"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className="mt-2 w-40"
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
          + Ajouter congés imposés
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Vue "Année en cours" — lecture seule
// ------------------------------------------------------------

const LABEL_TAG_DEMI_JOURNEE: Record<DemiJournee, string> = {
  matin: "Matin",
  apres_midi: "A. Midi",
};

function nomJourSemaine(iso: string): string {
  const jourSemaine = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return JOURS_SEMAINE[(jourSemaine + 6) % 7];
}

function formatJourMoisComplet(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const jour = d.getUTCDate();
  const jourTexte = jour === 1 ? "1er" : String(jour);
  const mois = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(d);
  return `${jourTexte} ${mois}`;
}

interface DjImposeeCardProps {
  dj: DjImposee;
  onSupprimer?: () => void;
}

function DjImposeeCard({ dj, onSupprimer }: DjImposeeCardProps) {
  return (
    <div className="bg-surface-card flex flex-col gap-1.5 rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <TypeBadge code="DJI" />
        {onSupprimer && (
          <button
            type="button"
            onClick={onSupprimer}
            aria-label="Supprimer cette demi-journée imposée"
            className="text-status-danger-fg shrink-0"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="text-ink-900 mt-1 text-base leading-snug">
        {nomJourSemaine(dj.date)}
        <br />
        <span className="font-bold">{formatJourMoisComplet(dj.date)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-ink-500 text-sm">0,5j</span>
        <TypeBadge code="DJI" variant="outline" label={LABEL_TAG_DEMI_JOURNEE[dj.demiJournee]} />
      </div>
    </div>
  );
}

interface BlocDjImposeesProps {
  djImposees: DjImposee[];
  onAjouter: (input: DjImposeeInput) => Promise<DjImposee>;
  onSupprimer: (id: string) => Promise<void>;
}

function BlocDjImposees({ djImposees, onAjouter, onSupprimer }: BlocDjImposeesProps) {
  const [modeEdition, setModeEdition] = useState(false);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [date, setDate] = useState("");
  const [demiJournee, setDemiJournee] = useState<DemiJournee>("matin");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date) {
      setErreur("Merci d'indiquer une date.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await onAjouter({ date, demiJournee });
      setDate("");
      setDemiJournee("matin");
      setAjoutOuvert(false);
    } catch {
      setErreur("Impossible d'ajouter cette demi-journée.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <SectionLabel>Demi-journées imposées ({djImposees.length})</SectionLabel>
        <button
          type="button"
          onClick={() => {
            setModeEdition((v) => !v);
            setAjoutOuvert(false);
          }}
          className="text-ink-500 flex items-center gap-1 text-xs font-semibold underline"
        >
          <Pencil size={12} />
          {modeEdition ? "Terminer" : "Modifier"}
        </button>
      </div>

      {djImposees.length === 0 && !modeEdition ? (
        <EmptyRow text="Aucune demi-journée imposée paramétrée pour cette année." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {djImposees.map((dj) => (
            <DjImposeeCard
              key={dj.id}
              dj={dj}
              onSupprimer={modeEdition ? () => onSupprimer(dj.id) : undefined}
            />
          ))}

          {modeEdition &&
            (ajoutOuvert ? (
              <form
                onSubmit={handleSubmit}
                className="bg-surface-card flex flex-col gap-2 rounded-xl p-4 shadow-sm"
              >
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full"
                />
                <Select
                  value={demiJournee}
                  onChange={(e) => setDemiJournee(e.target.value as DemiJournee)}
                  className="w-full"
                >
                  <option value="matin">Matin</option>
                  <option value="apres_midi">Après-midi</option>
                </Select>
                <div className="mt-auto flex items-center gap-2">
                  <Button
                    type="submit"
                    disabled={envoi}
                    className="rounded-full px-3 py-1.5 text-xs"
                  >
                    Ajouter
                  </Button>
                  <button
                    type="button"
                    onClick={() => setAjoutOuvert(false)}
                    className="text-ink-500 text-xs font-semibold underline"
                  >
                    Annuler
                  </button>
                </div>
                {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAjoutOuvert(true)}
                className="bg-mint flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-white shadow-sm"
              >
                <PlusCircle size={20} />
                <span className="text-center text-sm font-semibold">Ajouter une demi-journée</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function VueAnneeEnCours({ annee }: { annee: number }) {
  const calendrier = useCalendrier(annee);
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <BlocDjImposees
            djImposees={calendrier.djImposees}
            onAjouter={calendrier.ajouterDj}
            onSupprimer={calendrier.supprimerDj}
          />
        </div>

        <div className="flex flex-col gap-6 md:col-span-1">
          <BlocCongesImposes
            annee={annee}
            congesImposes={calendrier.congesImposes}
            onAjouter={calendrier.ajouterConge}
            onSupprimer={calendrier.supprimerConge}
          />

          <BlocJoursFeries
            annee={annee}
            joursFeries={calendrier.joursFeries}
            onAjouter={calendrier.ajouterFerie}
            onSupprimer={calendrier.supprimerFerie}
            onPreRemplir={calendrier.preRemplirFeries}
          />
        </div>
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
    <div className="flex max-w-2xl flex-col gap-6">
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

      <BlocJoursFeries
        annee={annee}
        joursFeries={calendrier.joursFeries}
        onAjouter={calendrier.ajouterFerie}
        onSupprimer={calendrier.supprimerFerie}
        onPreRemplir={calendrier.preRemplirFeries}
      />
    </div>
  );
}

// ------------------------------------------------------------
// Calendrier 2 — SECTION TEMPORAIRE DE SCÉNARISATION, vue synthétique
// (12 mini-calendriers + pastilles DJI/CPI/férié). Le composant `MiniCalendrier`
// est passé dans le design system (components/ui/MiniCalendrier.tsx, voir
// /design-system) ; ce qui reste ici est la logique métier propre à Calendrier
// (priorité férié > CPI > DJI, continuité de groupe) — à retravailler/retirer
// une fois la direction de cette vue validée. (rev)
// ------------------------------------------------------------

interface ModalCongesImposesProps {
  annee: number;
  congesImposes: CongeImpose[];
  joursFeries: JourFerie[];
  djImposees: DjImposee[];
  cibleJoursCpi: number;
  onAjouter: (input: CongeImposeInput) => Promise<CongeImpose>;
  onSupprimer: (id: string) => Promise<void>;
  onClose: () => void;
}

function moisDeIso(iso: string): { annee: number; moisIndex: number } {
  const [annee, mois] = iso.split("-").map(Number);
  return { annee, moisIndex: mois - 1 };
}

/** Index de semaine (0-based) d'un jour dans son mois, même logique que le
 * placement des cellules dans `MiniCalendrier` (semaines de L à V) — pour
 * cropper l'aperçu ("demi-calendrier") sur la semaine pertinente. */
function semaineIndexDeJour(iso: string): number {
  const [annee, mois, jourCible] = iso.split("-").map(Number);
  let offset = -1;
  let compte = 0;
  let index = -1;
  for (let jour = 1; jour <= jourCible; jour++) {
    const jourSemaine = new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay();
    if (jourSemaine === 0 || jourSemaine === 6) continue;
    if (offset === -1) offset = jourSemaine - 1;
    compte += 1;
    index = offset + compte - 1;
  }
  return Math.floor(index / 5);
}

function estJourOuvre(iso: string, joursFeries: JourFerie[]): boolean {
  const jourSemaine = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0=dimanche..6=samedi
  if (jourSemaine === 0 || jourSemaine === 6) return false;
  return !joursFeries.some((f) => f.date === iso);
}

/** Variante pour `DayPicker` (`disabled`), qui fournit un `Date` en fuseau
 * local du navigateur plutôt qu'une chaîne ISO — comparaison en local pour
 * ne jamais décaler d'un jour par rapport à ce que l'utilisateur clique. */
function estJourDesactiveCalendrier(date: Date, joursFeries: JourFerie[]): boolean {
  const jourSemaine = date.getDay(); // 0=dimanche..6=samedi
  if (jourSemaine === 0 || jourSemaine === 6) return true;
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  return joursFeries.some((f) => f.date === iso);
}

/**
 * Jours ouvrés (L-V, jours fériés exclus) entre deux dates, bornes incluses —
 * une demi-journée déjà imposée (DJI) sur un jour ouvré de la période ne
 * compte que pour 0,5 (déjà "prise", pas disponible en entier).
 */
function joursOuvres(
  debut: string,
  fin: string,
  joursFeries: JourFerie[],
  djImposees: DjImposee[] = [],
): number {
  let compte = 0;
  const curseur = new Date(`${debut}T00:00:00Z`);
  const finDate = new Date(`${fin}T00:00:00Z`);
  while (curseur <= finDate) {
    const iso = curseur.toISOString().slice(0, 10);
    if (estJourOuvre(iso, joursFeries)) {
      compte += djImposees.some((dj) => dj.date === iso) ? 0.5 : 1;
    }
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return compte;
}

function congesImposesInclut(congesImposes: CongeImpose[], iso: string): boolean {
  return congesImposes.some((c) => iso >= c.debut && iso <= c.fin);
}

/** Durée en jours (ouvrés, demi-journées de début/fin comprises) d'une
 * période de congé imposé déjà posée — pour le compteur de volume. */
function dureeCongeImpose(c: CongeImpose, joursFeries: JourFerie[]): number {
  const base = joursOuvres(c.debut, c.fin, joursFeries);
  const ajustDebut = c.demiDebut === "apres_midi" ? 0.5 : 0;
  const ajustFin = c.demiFin === "matin" ? 0.5 : 0;
  return base - ajustDebut - ajustFin;
}


/** Couleur de la pastille de volume selon l'avancement vers une cible —
 * gris = rien posé, orange = entamé, vert = cible atteinte ou dépassée. */
function classesPastilleVolume(valeur: number, cible: number): string {
  if (valeur <= 0) return "bg-surface-app text-ink-500";
  if (valeur > cible) return "bg-status-danger-bg text-status-danger-fg";
  if (valeur >= cible) return "bg-status-success-bg text-status-success-fg";
  return "bg-status-warning-bg text-status-warning-fg";
}

/** Variante DJ de `estJourDesactiveCalendrier` — exclut en plus les jours déjà
 * couverts par une période de congés imposés. */
function estJourDesactiveDj(
  date: Date,
  joursFeries: JourFerie[],
  congesImposes: CongeImpose[],
): boolean {
  if (estJourDesactiveCalendrier(date, joursFeries)) return true;
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  return congesImposesInclut(congesImposes, iso);
}

/**
 * Popin CPI — calquée sur le gabarit de la popin DJI : à gauche la colonne
 * "Sélection" (Du/Au empilés verticalement, chacun avec son créneau) ; à
 * droite (le "cœur") le référentiel des périodes déjà posées, survolables
 * pour un aperçu calendrier en contexte (comme le hover DJI). Deux gabarits
 * de ligne dans la liste : un jour/demi-journée isolé reprend le gabarit DJI
 * (encart jour + date + durée) ; une période affiche deux mini-repères date
 * reliés par "au", suivis de "soit N jours".
 *
 * Les DATES d'une période déjà posée ne sont PAS modifiables (décision
 * produit — changer les dates reviendrait à un delete+recreate silencieux
 * qu'on ne veut pas exposer comme une "vraie" édition) : les lignes ne sont
 * plus cliquables pour recharger le formulaire, et le snippet calendrier
 * (`SnippetConge`) ne propose plus que Supprimer. Le CRÉNEAU (demi-journée)
 * de chaque ligne reste ajustable directement via son `SelectPille` — même
 * mécanique delete+recreate en interne, mais gardée comme un simple réglage
 * de créneau plutôt qu'une édition complète, avec gestion d'erreur.
 */
function ModalCongesImposes({
  congesImposes,
  joursFeries,
  djImposees,
  cibleJoursCpi,
  onAjouter,
  onSupprimer,
  onClose,
}: ModalCongesImposesProps) {
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  // Gestion demi-journée alignée sur NouvelleDemandeForm : un seul jour →
  // matin/après-midi/journée entière ; une période → seulement "après-midi
  // au premier jour" et "matin au dernier jour" (une période ne commence/finit
  // jamais à moitié dans l'autre sens).
  const [demiDebut, setDemiDebut] = useState<DemiJournee>("matin");
  const [demiFin, setDemiFin] = useState<DemiJournee>("apres_midi");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [survolConge, setSurvolConge] = useState<{ conge: CongeImpose; ancre: DOMRect } | null>(
    null,
  );

  function reinitialiser() {
    setDebut("");
    setFin("");
    setDemiDebut("matin");
    setDemiFin("apres_midi");
    setErreur("");
  }

  function handleDebutChange(valeur: string) {
    if (valeur && !estJourOuvre(valeur, joursFeries)) {
      setErreur(
        "Ce jour n'est pas un jour ouvré (week-end ou jour férié) — choisis un autre jour.",
      );
      return;
    }
    setErreur("");
    setDebut(valeur);
    setDemiDebut("matin");
    setDemiFin("apres_midi");
  }

  function handleFinChange(valeur: string) {
    if (valeur && !estJourOuvre(valeur, joursFeries)) {
      setErreur(
        "Ce jour n'est pas un jour ouvré (week-end ou jour férié) — choisis un autre jour.",
      );
      return;
    }
    setErreur("");
    setFin(valeur);
    setDemiDebut("matin");
    setDemiFin("apres_midi");
  }

  // Un seul jour → un seul sélecteur (celui du bas) à 3 options, qui pilote
  // demiDebut ET demiFin ensemble pour éviter la combinaison contradictoire
  // (ex. après-midi au Du + matin au Au sur le même jour).
  const unSeulJour = Boolean(debut && fin && debut === fin);
  const dureeUnJour: DureeDj =
    demiDebut === "matin" && demiFin === "apres_midi"
      ? "entiere"
      : demiDebut === "matin"
        ? "matin"
        : "apres_midi";

  function handleDureeDjChange(valeur: DureeDj) {
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

  let nbJours: number | null = null;
  if (debut && fin && fin >= debut) {
    // Jours ouvrés uniquement (L-V, jours fériés exclus) — pas le nombre de
    // jours calendaires.
    const base = joursOuvres(debut, fin, joursFeries, djImposees);
    const ajustDebut = demiDebut === "apres_midi" ? 0.5 : 0;
    const ajustFin = demiFin === "matin" ? 0.5 : 0;
    nbJours = base - ajustDebut - ajustFin;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!debut || !fin || fin < debut) {
      setErreur("Merci d'indiquer une date de début et de fin valides.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await onAjouter({ debut, fin, demiDebut, demiFin });
      reinitialiser();
    } catch {
      setErreur("Impossible d'ajouter cette période.");
    } finally {
      setEnvoi(false);
    }
  }

  // Les dates d'une période posée ne se modifient plus (voir JSDoc plus
  // haut), mais le créneau (demi-journée) reste ajustable directement depuis
  // la liste — même logique delete+recreate que DJI, avec gestion d'erreur.
  async function changerDureeUnJour(c: CongeImpose, valeur: DureeDj) {
    setErreur("");
    const [demiDebutNouveau, demiFinNouveau]: [DemiJournee, DemiJournee] =
      valeur === "entiere"
        ? ["matin", "apres_midi"]
        : valeur === "matin"
          ? ["matin", "matin"]
          : ["apres_midi", "apres_midi"];
    try {
      await onSupprimer(c.id);
      await onAjouter({
        debut: c.debut,
        fin: c.fin,
        demiDebut: demiDebutNouveau,
        demiFin: demiFinNouveau,
      });
    } catch {
      setErreur("Impossible de modifier ce créneau.");
    }
  }

  // Idem pour une période : changer indépendamment le créneau de début ou
  // de fin, sans toucher à l'autre borne (ni aux dates).
  async function changerDemiDebut(c: CongeImpose, demiDebut: DemiJournee) {
    setErreur("");
    try {
      await onSupprimer(c.id);
      await onAjouter({ debut: c.debut, fin: c.fin, demiDebut, demiFin: c.demiFin });
    } catch {
      setErreur("Impossible de modifier ce créneau.");
    }
  }

  async function changerDemiFin(c: CongeImpose, demiFin: DemiJournee) {
    setErreur("");
    try {
      await onSupprimer(c.id);
      await onAjouter({ debut: c.debut, fin: c.fin, demiDebut: c.demiDebut, demiFin });
    } catch {
      setErreur("Impossible de modifier ce créneau.");
    }
  }

  function tipoApercuSurvol(iso: string): PastilleJour | null {
    if (joursFeries.some((f) => f.date === iso)) return { classeFond: "bg-ferie" };
    const dj = djImposees.find((d) => d.date === iso);
    const enConge = congesImposesInclut(congesImposes, iso);
    if (enConge && dj) {
      return dj.demiJournee === "matin"
        ? { partage: { gauche: "var(--color-dji)", droite: "var(--color-cp)" } }
        : { partage: { gauche: "var(--color-cp)", droite: "var(--color-dji)" } };
    }
    if (enConge) return { classeFond: "bg-cp" };
    if (dj) {
      return {
        moitie: {
          couleur: "var(--color-dji)",
          cote: dj.demiJournee === "matin" ? "gauche" : "droite",
        },
      };
    }
    return null;
  }
  function estEnGroupeApercuSurvol(isoA: string, isoB: string): boolean {
    return congesImposesInclut(congesImposes, isoA) && congesImposesInclut(congesImposes, isoB);
  }

  const totalJoursCpiModal = congesImposes.reduce(
    (somme, c) => somme + dureeCongeImpose(c, joursFeries),
    0,
  );

  return (
    <Modal
      title={
        <span className="flex w-full flex-col items-center gap-1.5">
          <TypeBadge code="CPI" />
          <span
            className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${classesPastilleVolume(totalJoursCpiModal, cibleJoursCpi)}`}
          >
            {formatJours(totalJoursCpiModal)}/{cibleJoursCpi} jours
          </span>
        </span>
      }
      onClose={onClose}
      className="max-w-4xl"
      align="top"
    >
      <div className="flex flex-col gap-4 md:flex-row">
        <form
          onSubmit={handleSubmit}
          className="bg-surface-app flex flex-col gap-3 p-3 md:w-64 md:shrink-0"
        >
          <SectionLabel>Sélection</SectionLabel>

          <div className="bg-mint-tint flex flex-col gap-3 p-3">
            <div>
              <FieldLabel htmlFor="modal-conge-debut">Du</FieldLabel>
              <div className="mt-0.5">
                <DatePicker
                  id="modal-conge-debut"
                  value={debut}
                  onChange={handleDebutChange}
                  disabled={(date) => estJourDesactiveCalendrier(date, joursFeries)}
                />
              </div>
            </div>
            {debut !== fin && (
              <div className="self-start">
                <SelectPille
                  value={demiDebut}
                  onChange={(e) => setDemiDebut(e.target.value as DemiJournee)}
                >
                  <option value="matin">Journée</option>
                  <option value="apres_midi">A. midi</option>
                </SelectPille>
              </div>
            )}

            <div>
              <FieldLabel htmlFor="modal-conge-fin">Au</FieldLabel>
              <div className="mt-0.5">
                <DatePicker
                  id="modal-conge-fin"
                  value={fin}
                  onChange={handleFinChange}
                  disabled={(date) => estJourDesactiveCalendrier(date, joursFeries)}
                />
              </div>
            </div>
            <div className="self-start">
              {unSeulJour ? (
                <SelectPille
                  value={dureeUnJour}
                  onChange={(e) => handleDureeDjChange(e.target.value as DureeDj)}
                >
                  <option value="entiere">Journée</option>
                  <option value="matin">Matin</option>
                  <option value="apres_midi">A. midi</option>
                </SelectPille>
              ) : (
                <SelectPille
                  value={demiFin}
                  onChange={(e) => setDemiFin(e.target.value as DemiJournee)}
                >
                  <option value="apres_midi">Journée</option>
                  <option value="matin">Matin</option>
                </SelectPille>
              )}
            </div>

            {nbJours !== null && (
              <p className="text-ink-500 text-xs">
                soit{" "}
                <span className="text-ink-900 font-bold">
                  {formatJours(nbJours)} {nbJours === 1 ? "jour" : "jours"}
                </span>
              </p>
            )}
          </div>
          {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}

          <div className="mt-1 flex items-center gap-3">
            <Button
              type="submit"
              disabled={envoi}
              className="w-fit rounded-full px-4 py-2.5 text-xs transition-opacity duration-150 enabled:hover:opacity-80"
            >
              <PlusCircle size={16} />
              Ajouter
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-3 md:w-80 md:shrink-0">
          <SectionLabel>Congés imposés ({congesImposes.length})</SectionLabel>

          {congesImposes.length === 0 ? (
            <EmptyRow text="Aucune période de congés imposés pour cette année." />
          ) : (
            <div className="rounded-card bg-surface-card max-h-96 overflow-y-auto">
              {congesImposes.map((c, i) => {
                const unJour = c.debut === c.fin;
                const bordure = i === congesImposes.length - 1 ? "" : "border-ink-300/60 border-b";
                return (
                  <div
                    key={c.id}
                    onMouseEnter={(e) =>
                      setSurvolConge({
                        conge: c,
                        ancre: (
                          e.currentTarget.parentElement as HTMLElement
                        ).getBoundingClientRect(),
                      })
                    }
                    onMouseLeave={() => setSurvolConge(null)}
                    className={`flex items-center gap-3 px-5 py-4 ${bordure}`}
                  >
                    {unJour ? (
                      <>
                        <JourBadge>{nomJourSemaine(c.debut).slice(0, 2)}</JourBadge>
                        <div className="w-28 shrink-0">
                          <div className="text-ink-900 text-sm font-bold whitespace-nowrap">
                            {formatJourMoisComplet(c.debut)}
                          </div>
                          <div className="text-ink-500 text-xs">
                            {c.demiDebut === "matin" && c.demiFin === "apres_midi"
                              ? "1 jour"
                              : "0,5 jour"}
                          </div>
                        </div>
                        <SelectPille
                          value={
                            c.demiDebut === "matin" && c.demiFin === "apres_midi"
                              ? "entiere"
                              : c.demiDebut === "matin"
                                ? "matin"
                                : "apres_midi"
                          }
                          onChange={(e) => changerDureeUnJour(c, e.target.value as DureeDj)}
                        >
                          <option value="entiere">Journée</option>
                          <option value="matin">Matin</option>
                          <option value="apres_midi">A. midi</option>
                        </SelectPille>
                      </>
                    ) : (
                      // Gros composant période : deux snippets "jour" (Du/Au)
                      // empilés et reliés par un connecteur vertical — les
                      // dates ne se modifient pas, seul le créneau de chaque
                      // borne reste ajustable via son propre SelectPille.
                      <div className="relative flex flex-1 flex-col gap-3 py-1">
                        <div
                          aria-hidden
                          className="bg-ink-300 absolute top-9 bottom-9 left-[18px] w-px"
                        />
                        <div className="flex items-center gap-3">
                          <JourBadge className="relative z-10">
                            {nomJourSemaine(c.debut).slice(0, 2)}
                          </JourBadge>
                          <span className="text-ink-900 w-28 shrink-0 text-sm font-bold whitespace-nowrap">
                            {formatJourMoisComplet(c.debut)}
                          </span>
                          <SelectPille
                            value={c.demiDebut}
                            onChange={(e) => changerDemiDebut(c, e.target.value as DemiJournee)}
                            className="ml-auto"
                          >
                            <option value="matin">Journée</option>
                            <option value="apres_midi">A. midi</option>
                          </SelectPille>
                        </div>
                        <div className="flex items-center gap-3">
                          <JourBadge className="relative z-10">
                            {nomJourSemaine(c.fin).slice(0, 2)}
                          </JourBadge>
                          <div className="w-28 shrink-0">
                            <div className="text-ink-900 text-sm font-bold whitespace-nowrap">
                              {formatJourMoisComplet(c.fin)}
                            </div>
                            <div className="text-ink-500 text-xs">
                              {nombreJours(c.debut, c.fin)} jours
                            </div>
                          </div>
                          <SelectPille
                            value={c.demiFin}
                            onChange={(e) => changerDemiFin(c, e.target.value as DemiJournee)}
                            className="ml-auto"
                          >
                            <option value="apres_midi">Journée</option>
                            <option value="matin">Matin</option>
                          </SelectPille>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onSupprimer(c.id)}
                      aria-label="Supprimer cette période de congés imposés"
                      className="text-status-danger-fg ml-auto shrink-0 transition-transform duration-150 hover:scale-125"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {survolConge &&
        (() => {
          const { conge, ancre } = survolConge;
          const debutMois = moisDeIso(conge.debut);
          const finMois = moisDeIso(conge.fin);
          const memesMois =
            debutMois.annee === finMois.annee && debutMois.moisIndex === finMois.moisIndex;
          // Période à cheval sur deux mois → "demi-calendrier" : le mois de
          // début n'affiche que ses semaines à partir de la période, le mois
          // de fin que ses semaines jusqu'à la période (MiniCalendrier garde
          // toujours l'en-tête jours de la semaine).
          const mois = memesMois
            ? [{ ...debutMois, premiereSemaine: undefined, derniereSemaine: undefined }]
            : [
                {
                  ...debutMois,
                  premiereSemaine: semaineIndexDeJour(conge.debut),
                  derniereSemaine: undefined,
                },
                {
                  ...finMois,
                  premiereSemaine: undefined,
                  derniereSemaine: semaineIndexDeJour(conge.fin),
                },
              ];
          return (
            <div
              style={{ position: "fixed", top: ancre.top, left: ancre.right + 12 }}
              className="pointer-events-none z-30 flex flex-col gap-3"
            >
              {mois.map((m) => (
                <MiniCalendrier
                  key={`${m.annee}-${m.moisIndex}`}
                  annee={m.annee}
                  moisIndex={m.moisIndex}
                  tipoDuJour={tipoApercuSurvol}
                  estEnGroupe={estEnGroupeApercuSurvol}
                  premiereSemaine={m.premiereSemaine}
                  derniereSemaine={m.derniereSemaine}
                />
              ))}
            </div>
          );
        })()}
    </Modal>
  );
}

interface SnippetCongeProps {
  conge: CongeImpose;
  ancre: DOMRect;
  onSupprimer: () => Promise<void>;
  onFermer: () => void;
}

/**
 * Petit popover positionné juste sous la période cliquée sur le calendrier
 * (via `ancre`, le `DOMRect` du jour/segment cliqué) — suppression uniquement
 * (bascule sur une confirmation inline avant d'agir, avec gestion d'erreur) :
 * une période de congés imposés déjà posée ne se modifie pas, seulement
 * supprimer puis reposer si besoin.
 */
function SnippetConge({ conge, ancre, onSupprimer, onFermer }: SnippetCongeProps) {
  const [confirmation, setConfirmation] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreur, setErreur] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onFermer();
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [onFermer]);

  async function handleConfirmerSuppression() {
    setSuppression(true);
    try {
      await onSupprimer();
    } catch {
      setErreur("Impossible de supprimer cette période.");
      setSuppression(false);
    }
  }

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top: ancre.bottom + 8, left: ancre.left }}
      className="bg-surface-card z-30 flex w-56 flex-col gap-2 rounded-xl p-3 shadow-lg"
    >
      <div>
        <div className="text-ink-900 text-sm font-bold">
          Du {formatJourMois(conge.debut, false)} au {formatJourMois(conge.fin, false)}
        </div>
        <div className="text-ink-500 text-xs">{nombreJours(conge.debut, conge.fin)} jours</div>
      </div>

      {confirmation ? (
        <div className="flex flex-col gap-2">
          <p className="text-ink-900 text-xs">Supprimer cette période ?</p>
          {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirmerSuppression}
              disabled={suppression}
              className="text-status-danger-fg text-xs font-semibold underline"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(false)}
              className="text-ink-500 text-xs font-semibold underline"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmation(true)}
          className="text-status-danger-fg w-fit text-xs font-semibold underline"
        >
          Supprimer
        </button>
      )}
    </div>
  );
}

type DureeDj = "matin" | "apres_midi" | "entiere";

interface ModalDjImposeesProps {
  annee: number;
  djImposees: DjImposee[];
  joursFeries: JourFerie[];
  congesImposes: CongeImpose[];
  cibleDemiJourneesDji: number;
  onAjouter: (input: DjImposeeInput) => Promise<DjImposee>;
  onSupprimer: (id: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Popin "référentiel" des demi-journées imposées de l'année — à gauche la
 * sélection (onglet Vendredis : liste des 52 vendredis avec ajout ligne à
 * ligne ; onglet Autre date : date picker + créneau), à droite la liste des
 * demi-journées déjà imposées (suppression uniquement, pas d'édition — pour
 * changer un créneau, on supprime puis on rajoute). Chaque ajout/suppression
 * est commis immédiatement (pas de brouillon local à valider en bloc).
 */
function ModalDjImposees({
  annee,
  djImposees,
  joursFeries,
  congesImposes,
  cibleDemiJourneesDji,
  onAjouter,
  onSupprimer,
  onClose,
}: ModalDjImposeesProps) {
  const [onglet, setOnglet] = useState<"vendredis" | "autre_date">("vendredis");
  const [creneauxParDate, setCreneauxParDate] = useState<Record<string, DureeDj>>({});
  const [dateAutre, setDateAutre] = useState("");
  const [creneauAutre, setCreneauAutre] = useState<DureeDj>("apres_midi");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [survolDj, setSurvolDj] = useState<{ dj: DjImposee; ancre: DOMRect } | null>(null);
  // Retour visuel après un ajout — flash mint qui s'estompe, pour que
  // l'admin retrouve la ligne qu'il vient de cocher sur une liste longue.
  const [dateFlash, setDateFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!dateFlash) return;
    const timer = setTimeout(() => setDateFlash(null), 1200);
    return () => clearTimeout(timer);
  }, [dateFlash]);

  const vendredis = useMemo(() => datesDuJourDeLaSemaine(annee, 5), [annee]);
  const datesAjoutees = new Set(djImposees.map((dj) => dj.date));

  // Aperçu au survol d'une DJI déjà posée — même logique de priorité que le
  // calendrier principal (férié > partage CPI+DJI > CPI > DJI), pour donner
  // du contexte visuel sans quitter le popin.
  function tipoApercuSurvol(iso: string): PastilleJour | null {
    if (joursFeries.some((f) => f.date === iso)) return { classeFond: "bg-ferie" };
    const dj = djImposees.find((d) => d.date === iso);
    const enConge = congesImposesInclut(congesImposes, iso);
    if (enConge && dj) {
      return dj.demiJournee === "matin"
        ? { partage: { gauche: "var(--color-dji)", droite: "var(--color-cp)" } }
        : { partage: { gauche: "var(--color-cp)", droite: "var(--color-dji)" } };
    }
    if (enConge) return { classeFond: "bg-cp" };
    if (dj) {
      return {
        moitie: {
          couleur: "var(--color-dji)",
          cote: dj.demiJournee === "matin" ? "gauche" : "droite",
        },
      };
    }
    return null;
  }
  function estEnGroupeApercuSurvol(isoA: string, isoB: string): boolean {
    return congesImposesInclut(congesImposes, isoA) && congesImposesInclut(congesImposes, isoB);
  }

  async function ajouterDate(date: string, creneau: DureeDj) {
    setErreur("");
    setEnvoi(true);
    try {
      if (creneau === "entiere") {
        await onAjouter({ date, demiJournee: "matin" });
        await onAjouter({ date, demiJournee: "apres_midi" });
      } else {
        await onAjouter({ date, demiJournee: creneau });
      }
      setDateAutre("");
      setCreneauAutre("apres_midi");
      setDateFlash(date);
    } catch {
      setErreur("Impossible d'ajouter cette demi-journée.");
    } finally {
      setEnvoi(false);
    }
  }

  // Pas de fonction de mise à jour côté repository — changer le créneau d'une
  // DJI déjà posée revient à la supprimer puis en recréer une avec le nouveau
  // créneau (même logique que la modification d'un CPI). Choisir "Journée"
  // complète la demi-journée manquante plutôt que de remplacer celle-ci (les
  // deux demi-journées du jour restent deux lignes distinctes dans la liste).
  async function changerCreneau(dj: DjImposee, valeur: DureeDj) {
    setErreur("");
    setEnvoi(true);
    try {
      if (valeur === "entiere") {
        const autre: DemiJournee = dj.demiJournee === "matin" ? "apres_midi" : "matin";
        const existeDeja = djImposees.some((d) => d.date === dj.date && d.demiJournee === autre);
        if (!existeDeja) await onAjouter({ date: dj.date, demiJournee: autre });
      } else if (valeur !== dj.demiJournee) {
        await onSupprimer(dj.id);
        await onAjouter({ date: dj.date, demiJournee: valeur });
      }
    } catch {
      setErreur("Impossible de modifier ce créneau.");
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimerDate(date: string) {
    setErreur("");
    setEnvoi(true);
    try {
      const aSupprimer = djImposees.filter((dj) => dj.date === date);
      await Promise.all(aSupprimer.map((dj) => onSupprimer(dj.id)));
    } catch {
      setErreur("Impossible de supprimer cette demi-journée.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Modal
      title={
        <span className="flex w-full flex-col items-center gap-1.5">
          <TypeBadge code="DJI" />
          Demi-journées imposées {annee}
        </span>
      }
      onClose={onClose}
      className="max-w-4xl"
      align="top"
    >
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="bg-surface-app relative flex flex-col gap-3 p-3 md:w-64 md:shrink-0">
          <div
            aria-hidden
            className="border-l-surface-app pointer-events-none absolute top-1/2 left-full hidden -translate-y-1/2 border-y-16 border-l-16 border-y-transparent md:block"
          />
          <SectionLabel>Sélection</SectionLabel>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOnglet("vendredis")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                onglet === "vendredis"
                  ? "bg-brand text-brand-foreground"
                  : "bg-surface-card text-ink-500"
              }`}
            >
              Vendredis
            </button>
            <button
              type="button"
              onClick={() => setOnglet("autre_date")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                onglet === "autre_date"
                  ? "bg-brand text-brand-foreground"
                  : "bg-surface-card text-ink-500"
              }`}
            >
              Autre date
            </button>
          </div>

          {onglet === "vendredis" ? (
            <div className="bg-surface-card max-h-80 overflow-x-hidden overflow-y-auto">
              {vendredis.map((date, i) => {
                const ajoute = datesAjoutees.has(date);
                const creneauxAjoutes = new Set(
                  djImposees.filter((dj) => dj.date === date).map((dj) => dj.demiJournee),
                );
                const valeurAjoutee: DureeDj =
                  creneauxAjoutes.has("matin") && creneauxAjoutes.has("apres_midi")
                    ? "entiere"
                    : creneauxAjoutes.has("matin")
                      ? "matin"
                      : "apres_midi";
                const estFerie = joursFeries.some((f) => f.date === date);
                const estCpi = congesImposesInclut(congesImposes, date);
                const desactive = !ajoute && (estFerie || estCpi);
                const bordure = i === vendredis.length - 1 ? "" : "border-ink-300/60 border-b";
                const moisCourant = new Date(`${date}T00:00:00Z`).getUTCMonth();
                const nouveauMois =
                  i === 0 ||
                  new Date(`${vendredis[i - 1]}T00:00:00Z`).getUTCMonth() !== moisCourant;
                return (
                  <Fragment key={date}>
                    {nouveauMois && (
                      <div className="bg-surface-app text-ink-500 px-4 py-1 text-xs font-semibold">
                        {MOIS_FR[moisCourant]}
                      </div>
                    )}
                    <div
                      className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors duration-700 ${bordure} ${
                        dateFlash === date ? "bg-mint-tint" : ""
                      }`}
                    >
                      <span
                        className={`text-xs ${ajoute || desactive ? "text-ink-500" : "text-ink-900"}`}
                      >
                        <span className="font-bold">
                          {new Date(`${date}T00:00:00Z`).getUTCDate()}
                        </span>{" "}
                        {new Intl.DateTimeFormat("fr-FR", {
                          month: "long",
                          timeZone: "UTC",
                        }).format(new Date(`${date}T00:00:00Z`))}
                      </span>
                      {desactive ? (
                        <TypeBadge code={estFerie ? "FERIE" : "CPI"} variant="pill" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <SelectPille
                            value={ajoute ? valeurAjoutee : (creneauxParDate[date] ?? "apres_midi")}
                            disabled={ajoute}
                            onChange={(e) =>
                              setCreneauxParDate((prev) => ({
                                ...prev,
                                [date]: e.target.value as DureeDj,
                              }))
                            }
                          >
                            <option value="matin">Matin</option>
                            <option value="apres_midi">A. midi</option>
                            <option value="entiere">Journée</option>
                          </SelectPille>
                          {ajoute ? (
                            <button
                              type="button"
                              onClick={() => supprimerDate(date)}
                              disabled={envoi}
                              aria-label="Supprimer cette demi-journée"
                              className="group/dj relative size-[18px] shrink-0"
                            >
                              <Check size={18} className="text-mint block group-hover/dj:hidden" />
                              <Trash2
                                size={18}
                                className="text-status-danger-fg hidden group-hover/dj:block"
                              />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                ajouterDate(date, creneauxParDate[date] ?? "apres_midi")
                              }
                              disabled={envoi}
                              aria-label="Ajouter cette demi-journée"
                              className="text-mint shrink-0 transition-transform duration-150 hover:scale-125"
                            >
                              <PlusCircle size={18} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <div className="bg-mint-tint flex flex-col gap-3 p-3">
              <div>
                <FieldLabel htmlFor="modal-dj-date">Date</FieldLabel>
                <div className="mt-0.5">
                  <DatePicker
                    id="modal-dj-date"
                    value={dateAutre}
                    onChange={setDateAutre}
                    disabled={(date) => estJourDesactiveDj(date, joursFeries, congesImposes)}
                  />
                </div>
              </div>
              <div className="self-start">
                <SelectPille
                  value={creneauAutre}
                  onChange={(e) => setCreneauAutre(e.target.value as DureeDj)}
                >
                  <option value="matin">Matin</option>
                  <option value="apres_midi">A. midi</option>
                  <option value="entiere">Journée</option>
                </SelectPille>
              </div>
              <Button
                type="button"
                disabled={!dateAutre || envoi}
                onClick={() => ajouterDate(dateAutre, creneauAutre)}
                className="w-fit rounded-full px-4 py-2.5 text-xs transition-opacity duration-150 enabled:hover:opacity-80"
              >
                Ajouter
              </Button>
            </div>
          )}
          {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}
        </div>

        <div className="flex flex-col gap-3 md:w-80 md:shrink-0">
          <span
            className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${classesPastilleVolume(djImposees.length, cibleDemiJourneesDji)}`}
          >
            {djImposees.length}/{cibleDemiJourneesDji} demi-journées
          </span>
          {djImposees.length === 0 ? (
            <EmptyRow text="Aucune demi-journée imposée pour cette année." />
          ) : (
            <div className="rounded-card bg-surface-card max-h-96 overflow-y-auto">
              {djImposees.map((dj, i) => {
                const creneauxMemeDate = new Set(
                  djImposees.filter((d) => d.date === dj.date).map((d) => d.demiJournee),
                );
                const valeurSelect: DureeDj =
                  creneauxMemeDate.has("matin") && creneauxMemeDate.has("apres_midi")
                    ? "entiere"
                    : dj.demiJournee;
                return (
                  <div
                    key={dj.id}
                    onMouseEnter={(e) =>
                      setSurvolDj({
                        dj,
                        ancre: (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(),
                      })
                    }
                    onMouseLeave={() => setSurvolDj(null)}
                    className={`flex items-center gap-4 px-5 py-4 ${
                      i === djImposees.length - 1 ? "" : "border-ink-300/60 border-b"
                    }`}
                  >
                    <JourBadge>{nomJourSemaine(dj.date).slice(0, 2)}</JourBadge>
                    <div className="w-28 shrink-0">
                      <div className="text-ink-900 text-sm font-bold whitespace-nowrap">
                        {formatJourMoisComplet(dj.date)}
                      </div>
                      <div className="text-ink-500 text-xs">0,5 jour</div>
                    </div>
                    <SelectPille
                      value={valeurSelect}
                      disabled={envoi}
                      onChange={(e) => changerCreneau(dj, e.target.value as DureeDj)}
                    >
                      <option value="matin">Matin</option>
                      <option value="apres_midi">A. midi</option>
                      <option value="entiere">Journée</option>
                    </SelectPille>
                    <button
                      type="button"
                      onClick={() => onSupprimer(dj.id)}
                      aria-label="Supprimer cette demi-journée imposée"
                      className="text-status-danger-fg ml-auto shrink-0 transition-transform duration-150 hover:scale-125"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {survolDj &&
        (() => {
          const { ancre } = survolDj;
          const { annee: a, moisIndex } = moisDeIso(survolDj.dj.date);
          return (
            <div
              style={{ position: "fixed", top: ancre.top, left: ancre.right + 12 }}
              className="bg-surface-card pointer-events-none z-30 rounded-xl p-3 shadow-lg"
            >
              <MiniCalendrier
                annee={a}
                moisIndex={moisIndex}
                tipoDuJour={tipoApercuSurvol}
                estEnGroupe={estEnGroupeApercuSurvol}
              />
            </div>
          );
        })()}
    </Modal>
  );
}

interface SnippetDjiProps {
  dj: DjImposee;
  ancre: DOMRect;
  onSupprimer: () => Promise<void>;
  onFermer: () => void;
}

/** Équivalent de `SnippetConge` pour une DJI cliquée sur le calendrier —
 * suppression uniquement (pas d'édition de créneau depuis le calendrier). */
function SnippetDji({ dj, ancre, onSupprimer, onFermer }: SnippetDjiProps) {
  const [confirmation, setConfirmation] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreur, setErreur] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onFermer();
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [onFermer]);

  async function handleConfirmerSuppression() {
    setSuppression(true);
    try {
      await onSupprimer();
    } catch {
      setErreur("Impossible de supprimer cette demi-journée.");
      setSuppression(false);
    }
  }

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top: ancre.bottom + 8, left: ancre.left }}
      className="bg-surface-card z-30 flex w-56 flex-col gap-2 rounded-xl p-3 shadow-lg"
    >
      <div>
        <div className="text-ink-900 text-sm font-bold">{formatJourMoisComplet(dj.date)}</div>
        <div className="text-ink-500 text-xs">{LABEL_TAG_DEMI_JOURNEE[dj.demiJournee]}</div>
      </div>

      {confirmation ? (
        <div className="flex flex-col gap-2">
          <p className="text-ink-900 text-xs">Supprimer cette demi-journée ?</p>
          {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirmerSuppression}
              disabled={suppression}
              className="text-status-danger-fg text-xs font-semibold underline"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(false)}
              className="text-ink-500 text-xs font-semibold underline"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmation(true)}
          className="text-status-danger-fg w-fit text-xs font-semibold underline"
        >
          Supprimer
        </button>
      )}
    </div>
  );
}

interface ModalJoursFeriesProps {
  annee: number;
  joursFeries: JourFerie[];
  onAjouter: (input: { date: string; libelle: string }) => Promise<JourFerie>;
  onSupprimer: (id: string) => Promise<void>;
  onPreRemplir: () => Promise<JourFerie[]>;
  onClose: () => void;
}

/**
 * Popin "référentiel" des jours fériés — sur le même gabarit que la popin DJI
 * (encart jour + date + libellé), sans ajout/suppression manuels : les jours
 * fériés légaux sont fixes et non négociables, à une exception près, le lundi
 * de Pentecôte (journée de solidarité), seule vraie décision annuelle de
 * l'employeur — d'où la case à cocher dédiée. Persisté en réutilisant
 * ajouter/supprimerFerie existants (pas de colonne "travaillé" en base :
 * "Pentecôte travaillée" = pas de ligne pour ce jour dans `jours_feries`) —
 * les 11 lignes sont toujours affichées en s'appuyant sur `joursFeriesLegaux`
 * comme référentiel, pour garder la ligne Pentecôte visible même absente.
 */
function ModalJoursFeries({
  annee,
  joursFeries,
  onAjouter,
  onSupprimer,
  onPreRemplir,
  onClose,
}: ModalJoursFeriesProps) {
  const [preRemplissage, setPreRemplissage] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const referentiel = useMemo(() => joursFeriesLegaux(annee), [annee]);
  const pentecoteRef = referentiel.find((f) => f.libelle === "Lundi de Pentecôte");
  const pentecoteEnBase = joursFeries.find((f) => f.libelle === "Lundi de Pentecôte");
  const pentecoteTravaillee = !pentecoteEnBase;

  async function handleTogglePentecote(travaillee: boolean) {
    if (!pentecoteRef) return;
    setErreur("");
    setEnCours(true);
    try {
      if (travaillee) {
        if (pentecoteEnBase) await onSupprimer(pentecoteEnBase.id);
      } else {
        await onAjouter({ date: pentecoteRef.date, libelle: pentecoteRef.libelle });
      }
    } catch {
      setErreur("Impossible de mettre à jour le lundi de Pentecôte.");
    } finally {
      setEnCours(false);
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
    <Modal
      title={
        <span className="flex w-full flex-col items-center gap-1.5">
          <TypeBadge code="FERIE" />
          Jours fériés {annee}
        </span>
      }
      onClose={onClose}
      className="max-w-md"
    >
      <div className="flex flex-col gap-3">
        <div className="bg-mint-tint flex items-center gap-4 p-3 text-sm">
          <span className="text-ink-900 font-semibold">Lundi de Pentecôte</span>
          <label className="flex cursor-pointer items-center gap-1.5 has-[:disabled]:cursor-not-allowed">
            <input
              type="radio"
              name="pentecote"
              checked={pentecoteTravaillee}
              disabled={enCours || joursFeries.length === 0}
              onChange={() => handleTogglePentecote(true)}
            />
            <span className="text-ink-900">Travaillé</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 has-[:disabled]:cursor-not-allowed">
            <input
              type="radio"
              name="pentecote"
              checked={!pentecoteTravaillee}
              disabled={enCours || joursFeries.length === 0}
              onChange={() => handleTogglePentecote(false)}
            />
            <span className="text-ink-900">Férié</span>
          </label>
        </div>
        <span
          className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
            joursFeries.length > 0
              ? "bg-status-success-bg text-status-success-fg"
              : "bg-surface-app text-ink-500"
          }`}
        >
          {joursFeries.length} {joursFeries.length === 1 ? "jour" : "jours"}
        </span>
        {erreur && <p className="text-status-danger-fg px-1 text-xs">{erreur}</p>}

        {joursFeries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <EmptyRow text="Aucun jour férié renseigné pour cette année." />
            <Button
              type="button"
              variant="secondary"
              disabled={preRemplissage}
              onClick={handlePreRemplir}
              className="rounded-full px-4 py-2 text-xs"
            >
              {preRemplissage ? "…" : "Pré-remplir les jours fériés légaux"}
            </Button>
          </div>
        ) : (
          <div className="rounded-card bg-surface-card max-h-96 overflow-y-auto">
            {referentiel.map((f, i) => {
              const estPentecote = f.libelle === "Lundi de Pentecôte";
              const neutralise = estPentecote && pentecoteTravaillee;
              return (
                <div
                  key={f.date}
                  className={`flex items-center gap-4 px-5 py-4 ${
                    i === referentiel.length - 1 ? "" : "border-ink-300/60 border-b"
                  }`}
                >
                  <JourBadge muted={neutralise}>{nomJourSemaine(f.date).slice(0, 2)}</JourBadge>
                  <div className="w-28 shrink-0">
                    <div
                      className={`text-sm font-bold whitespace-nowrap ${
                        neutralise ? "text-ink-500 line-through" : "text-ink-900"
                      }`}
                    >
                      {formatJourMoisComplet(f.date)}
                    </div>
                    <div className="text-ink-500 text-xs">{f.libelle}</div>
                  </div>
                  {neutralise && (
                    <Badge tone="warning" className="ml-auto">
                      Travaillé
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

interface SnippetFerieProps {
  ferie: JourFerie;
  ancre: DOMRect;
  onFermer: () => void;
}

/** Équivalent de `SnippetConge`/`SnippetDji` pour un jour férié cliqué sur le
 * calendrier — purement informatif, aucune action associée (les jours
 * fériés légaux ne s'éditent/suppriment pas depuis le calendrier). */
function SnippetFerie({ ferie, ancre, onFermer }: SnippetFerieProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onFermer();
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [onFermer]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top: ancre.bottom + 8, left: ancre.left }}
      className="bg-surface-card z-30 flex w-56 flex-col gap-1 rounded-xl p-3 shadow-lg"
    >
      <div className="text-ink-900 text-sm font-bold">{formatJourMoisComplet(ferie.date)}</div>
      <div className="text-ink-500 text-xs">{ferie.libelle}</div>
    </div>
  );
}

function VueCalendrierGrille({ annee }: { annee: number }) {
  const estAnneeLive = annee === new Date().getFullYear();
  const calendrier = useCalendrier(annee);
  const { objectifs } = useObjectifsCalendrier();

  // Compteurs de volume affichés sur les cartes légende — pas de cible ni de
  // jauge, juste ce qui est déjà posé, pour un état "en un coup d'œil".
  const totalJoursCpi = useMemo(
    () =>
      calendrier.congesImposes.reduce(
        (somme, c) => somme + dureeCongeImpose(c, calendrier.joursFeries),
        0,
      ),
    [calendrier.congesImposes, calendrier.joursFeries],
  );
  const totalDemiJourneesDji = calendrier.djImposees.length;
  const totalJoursFeries = calendrier.joursFeries.length;
  // Cibles CPI/DJI : réglage global (Congés & RTT), pas de variation par
  // année. `parametrage_periode.nb_demi_journees_cible` n'est PAS utilisé ici
  // — cette colonne est `not null default 16`, donc toujours renseignée dès
  // qu'une année a été touchée une seule fois, ce qui masquerait en
  // permanence toute mise à jour du réglage global (bug constaté : changer
  // la cible DJI dans Congés & RTT n'avait aucun effet sur le Calendrier).
  const cibleJoursCpi = objectifs?.cibleJoursCpi ?? 5;
  const cibleDemiJourneesDji = objectifs?.cibleDemiJourneesDji ?? 16;
  const classesPastilleCpi = classesPastilleVolume(totalJoursCpi, cibleJoursCpi);
  const classesPastilleDji = classesPastilleVolume(totalDemiJourneesDji, cibleDemiJourneesDji);
  const classesPastilleFeries =
    totalJoursFeries > 0
      ? "bg-status-success-bg text-status-success-fg"
      : "bg-surface-app text-ink-500";
  const pretAPublier =
    totalJoursCpi === cibleJoursCpi &&
    totalDemiJourneesDji === cibleDemiJourneesDji &&
    totalJoursFeries > 0;
  const [modalCongesOuvert, setModalCongesOuvert] = useState(false);
  const [snippetConge, setSnippetConge] = useState<{ conge: CongeImpose; ancre: DOMRect } | null>(
    null,
  );
  const [modalDjOuvert, setModalDjOuvert] = useState(false);
  const [snippetDji, setSnippetDji] = useState<{ dj: DjImposee; ancre: DOMRect } | null>(null);
  const [modalFeriesOuvert, setModalFeriesOuvert] = useState(false);
  const [snippetFerie, setSnippetFerie] = useState<{ ferie: JourFerie; ancre: DOMRect } | null>(
    null,
  );
  const [publicationEnCours, setPublicationEnCours] = useState(false);
  const [erreurPublication, setErreurPublication] = useState("");

  async function handlePublier() {
    setErreurPublication("");
    setPublicationEnCours(true);
    try {
      await calendrier.publierParametrage();
    } catch {
      setErreurPublication("Impossible de publier le paramétrage.");
    } finally {
      setPublicationEnCours(false);
    }
  }

  async function handleDepublier() {
    setErreurPublication("");
    setPublicationEnCours(true);
    try {
      await calendrier.depublierParametrage();
    } catch {
      setErreurPublication("Impossible d'annuler la publication.");
    } finally {
      setPublicationEnCours(false);
    }
  }

  if (calendrier.loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  function estEnConge(iso: string): boolean {
    return calendrier.congesImposes.some((c) => iso >= c.debut && iso <= c.fin);
  }

  // Priorité d'affichage quand plusieurs types tombent le même jour : férié
  // > congé imposé (CPI) > demi-journée imposée (DJI). Cas à la marge : un
  // jour qui est À LA FOIS dans un congé imposé ET a une DJI ne doit pas
  // faire disparaître silencieusement la DJI derrière le CPI — le jour se
  // partage en deux couleurs pleines (`partage`), chacune sur sa vraie
  // moitié (matin/après-midi), plutôt que la pastille CPI pleine habituelle.
  function tipoDuJour(iso: string): PastilleJour | null {
    if (calendrier.joursFeries.some((f) => f.date === iso)) {
      return { classeFond: "bg-ferie" };
    }

    const dj = calendrier.djImposees.find((d) => d.date === iso);
    const enConge = estEnConge(iso);

    if (enConge && dj) {
      const couleurDji = "var(--color-dji)";
      const couleurCp = "var(--color-cp)";
      return dj.demiJournee === "matin"
        ? { partage: { gauche: couleurDji, droite: couleurCp } }
        : { partage: { gauche: couleurCp, droite: couleurDji } };
    }
    if (enConge) {
      return { classeFond: "bg-cp" };
    }
    if (dj) {
      return {
        moitie: {
          couleur: "var(--color-dji)",
          cote: dj.demiJournee === "matin" ? "gauche" : "droite",
        },
      };
    }
    return null;
  }

  // Un jour férié à l'intérieur d'une période de congé imposé n'interrompt
  // pas la continuité visuelle (voir règles dans MiniCalendrier.tsx).
  function estEnGroupe(isoA: string, isoB: string): boolean {
    return estEnConge(isoA) && estEnConge(isoB);
  }

  // Cliquer un jour de congé imposé sur le calendrier principal ouvre la
  // modale en mode édition pour cette période (seul moyen actuel pour
  // l'admin de modifier/supprimer un CPI déjà posé sans repasser par la
  // liste "Déjà posés" de la modale).
  function handleJourClick(iso: string, ancre: DOMRect) {
    // Même priorité que l'affichage des pastilles (`tipoDuJour`) : un jour
    // férié prend le dessus visuellement, donc le clic doit ouvrir le
    // snippet férié (lecture seule) plutôt que CPI/DJI sous-jacents.
    const ferie = calendrier.joursFeries.find((f) => f.date === iso);
    if (ferie) {
      setSnippetFerie({ ferie, ancre });
      return;
    }
    const conge = calendrier.congesImposes.find((c) => iso >= c.debut && iso <= c.fin);
    if (conge) {
      setSnippetConge({ conge, ancre });
      return;
    }
    const dj = calendrier.djImposees.find((d) => d.date === iso);
    if (dj) {
      setSnippetDji({ dj, ancre });
    }
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <div className="grid max-w-[900px] flex-1 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))] gap-4">
        {MOIS_FR.map((_, moisIndex) => (
          <MiniCalendrier
            key={moisIndex}
            annee={annee}
            moisIndex={moisIndex}
            tipoDuJour={tipoDuJour}
            estEnGroupe={estEnGroupe}
            onJourClick={handleJourClick}
          />
        ))}
      </div>

      <div className="flex w-full flex-col gap-3 md:w-64 md:shrink-0">
        <button
          type="button"
          onClick={() => setModalCongesOuvert(true)}
          className="bg-surface-card group flex items-start gap-2.5 rounded-xl p-4 text-left shadow-sm"
        >
          <TypeBadge code="CPI" />
          <div className="flex flex-1 flex-col">
            <span className="text-ink-900 text-sm">Congés imposés</span>
            <span
              className={`mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${classesPastilleCpi}`}
            >
              {formatJours(totalJoursCpi)} {totalJoursCpi === 1 ? "jour" : "jours"}
            </span>
          </div>
          {estAnneeLive ? (
            <Eye
              size={18}
              className="text-mint shrink-0 self-center transition-transform duration-150 group-hover:scale-125"
            />
          ) : (
            <PlusCircle
              size={18}
              className="text-mint shrink-0 self-center transition-transform duration-150 group-hover:scale-125"
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => setModalDjOuvert(true)}
          className="bg-surface-card group flex items-start gap-2.5 rounded-xl p-4 text-left shadow-sm"
        >
          <TypeBadge code="DJI" />
          <div className="flex flex-1 flex-col">
            <span className="text-ink-900 text-sm">Demi-journées imposées</span>
            <span
              className={`mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${classesPastilleDji}`}
            >
              {totalDemiJourneesDji} {totalDemiJourneesDji === 1 ? "demi-journée" : "demi-journées"}
            </span>
          </div>
          {estAnneeLive ? (
            <Eye
              size={18}
              className="text-mint shrink-0 self-center transition-transform duration-150 group-hover:scale-125"
            />
          ) : (
            <PlusCircle
              size={18}
              className="text-mint shrink-0 self-center transition-transform duration-150 group-hover:scale-125"
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => setModalFeriesOuvert(true)}
          className="bg-surface-card group flex items-start gap-2.5 rounded-xl p-4 text-left shadow-sm"
        >
          <TypeBadge code="FERIE" />
          <div className="flex flex-1 flex-col">
            <span className="text-ink-900 text-sm">Jours fériés</span>
            <span
              className={`mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${classesPastilleFeries}`}
            >
              {totalJoursFeries} {totalJoursFeries === 1 ? "jour" : "jours"}
            </span>
          </div>
          <Eye
            size={18}
            className="text-mint shrink-0 self-center transition-transform duration-150 group-hover:scale-125"
          />
        </button>

        {!estAnneeLive &&
          (calendrier.parametrage?.valideLe ? (
            <div className="flex flex-col gap-1 px-1">
              <p className="text-ink-500 text-sm">
                Publié le {formatDate(calendrier.parametrage.valideLe.slice(0, 10))} — visible par
                les collaborateurs
              </p>
              <button
                type="button"
                onClick={handleDepublier}
                disabled={publicationEnCours}
                className="text-ink-500 w-fit text-xs underline underline-offset-2 disabled:opacity-60"
              >
                {publicationEnCours ? "Annulation…" : "Annuler la publication"}
              </button>
              {erreurPublication && (
                <p className="text-status-danger-fg text-xs">{erreurPublication}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-ink-500 px-1 text-sm">
                <span className="bg-status-warning-bg text-status-warning-fg px-1">Brouillon</span>{" "}
                ce calendrier n&rsquo;est pas visible par les collaborateurs
              </p>
              <Button
                type="button"
                variant={pretAPublier ? "primary" : "secondary"}
                onClick={handlePublier}
                disabled={publicationEnCours || !pretAPublier}
                className="rounded-card w-full px-4 py-2.5"
              >
                {publicationEnCours ? "Publication…" : "Publier"}
              </Button>
              {erreurPublication && (
                <p className="text-status-danger-fg text-xs">{erreurPublication}</p>
              )}
            </div>
          ))}
      </div>

      {snippetConge && (
        <SnippetConge
          conge={snippetConge.conge}
          ancre={snippetConge.ancre}
          onSupprimer={async () => {
            await calendrier.supprimerConge(snippetConge.conge.id);
            setSnippetConge(null);
          }}
          onFermer={() => setSnippetConge(null)}
        />
      )}

      {modalCongesOuvert && (
        <ModalCongesImposes
          annee={annee}
          congesImposes={calendrier.congesImposes}
          joursFeries={calendrier.joursFeries}
          djImposees={calendrier.djImposees}
          cibleJoursCpi={cibleJoursCpi}
          onAjouter={calendrier.ajouterConge}
          onSupprimer={calendrier.supprimerConge}
          onClose={() => setModalCongesOuvert(false)}
        />
      )}

      {snippetDji && (
        <SnippetDji
          dj={snippetDji.dj}
          ancre={snippetDji.ancre}
          onSupprimer={async () => {
            await calendrier.supprimerDj(snippetDji.dj.id);
            setSnippetDji(null);
          }}
          onFermer={() => setSnippetDji(null)}
        />
      )}

      {snippetFerie && (
        <SnippetFerie
          ferie={snippetFerie.ferie}
          ancre={snippetFerie.ancre}
          onFermer={() => setSnippetFerie(null)}
        />
      )}

      {modalDjOuvert && (
        <ModalDjImposees
          annee={annee}
          djImposees={calendrier.djImposees}
          joursFeries={calendrier.joursFeries}
          congesImposes={calendrier.congesImposes}
          cibleDemiJourneesDji={cibleDemiJourneesDji}
          onAjouter={calendrier.ajouterDj}
          onSupprimer={calendrier.supprimerDj}
          onClose={() => setModalDjOuvert(false)}
        />
      )}

      {modalFeriesOuvert && (
        <ModalJoursFeries
          annee={annee}
          joursFeries={calendrier.joursFeries}
          onAjouter={calendrier.ajouterFerie}
          onSupprimer={calendrier.supprimerFerie}
          onPreRemplir={calendrier.preRemplirFeries}
          onClose={() => setModalFeriesOuvert(false)}
        />
      )}
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
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-6xl md:pt-0">
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

/**
 * SECTION TEMPORAIRE DE SCÉNARISATION — vue calendrier synthétique (12
 * mini-calendriers + pastilles), nav de second niveau /parametrer/calendrier2,
 * pas de vérification passée dessus, à retravailler/retirer une fois la
 * direction validée.
 */
export function Calendrier2Page() {
  const anneeEnCours = new Date().getFullYear();
  const anneeAVenir = anneeEnCours + 1;
  const [annee, setAnnee] = useState(anneeEnCours);

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-6xl md:pt-0">
      <h1 className="text-ink-900 px-1 text-2xl font-semibold">Calendrier 2 (scénarisation)</h1>

      <div className="flex gap-2 px-1">
        <button
          type="button"
          onClick={() => setAnnee(anneeEnCours)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            annee === anneeEnCours
              ? "bg-brand text-brand-foreground"
              : "bg-surface-card text-ink-900 shadow-sm"
          }`}
        >
          {anneeEnCours}
        </button>
        <button
          type="button"
          onClick={() => setAnnee(anneeAVenir)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            annee === anneeAVenir
              ? "bg-brand text-brand-foreground"
              : "bg-surface-card text-ink-900 shadow-sm"
          }`}
        >
          {anneeAVenir} - Brouillon
        </button>
      </div>

      {new Date().getMonth() === 11 && (
        <div className="bg-status-warning-bg text-status-warning-fg rounded-control flex items-center gap-2.5 px-4 py-3 text-sm font-semibold">
          <TriangleAlert size={18} className="shrink-0" />
          {`Pensez à paramétrer les jours imposés de ${anneeAVenir} avant la fin de l’année.`}
        </div>
      )}

      <VueCalendrierGrille key={annee} annee={annee} />
    </div>
  );
}
