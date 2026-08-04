"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  RegleAcquisition,
  RegleAcquisitionInput,
  RegleAnciennete,
  RegleAncienneteInput,
  TypeDemande,
} from "@/lib/types";
import { formatJours } from "@/lib/format";
import { useReglesConges } from "@/hooks/useReglesConges";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { ListCard } from "@/components/ui/ListCard";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

type PresetPeriode =
  "juin_mai" | "annee_civile" | "annee_scolaire" | "avril_mars" | "personnalisee";

const PRESET_PERIODE_VALEUR: Record<
  Exclude<PresetPeriode, "personnalisee">,
  { mois: number; jour: number }
> = {
  juin_mai: { mois: 6, jour: 1 },
  annee_civile: { mois: 1, jour: 1 },
  annee_scolaire: { mois: 9, jour: 1 },
  avril_mars: { mois: 4, jour: 1 },
};

const PRESET_PERIODE_LABEL: Record<PresetPeriode, string> = {
  juin_mai: "Juin → mai",
  annee_civile: "Année civile",
  annee_scolaire: "Année scolaire (septembre)",
  avril_mars: "Avril → mars",
  personnalisee: "Date personnalisée",
};

const ORDRE_PRESETS_CP: PresetPeriode[] = [
  "juin_mai",
  "annee_civile",
  "annee_scolaire",
  "avril_mars",
  "personnalisee",
];

const ORDRE_PRESETS_RTT: PresetPeriode[] = [
  "annee_civile",
  "juin_mai",
  "annee_scolaire",
  "avril_mars",
  "personnalisee",
];

function presetPourPeriode(mois: number, jour: number): PresetPeriode {
  const entree = (
    Object.entries(PRESET_PERIODE_VALEUR) as [
      Exclude<PresetPeriode, "personnalisee">,
      { mois: number; jour: number },
    ][]
  ).find(([, valeur]) => valeur.mois === mois && valeur.jour === jour);

  return entree ? entree[0] : "personnalisee";
}

function RadioOuiNon({
  name,
  valeur,
  onChange,
  guidance,
}: {
  name: string;
  valeur: boolean;
  onChange: (valeur: boolean) => void;
  guidance: string;
}) {
  return (
    <div>
      <div className="flex gap-5">
        <label className="text-ink-900 flex items-center gap-1.5 text-sm">
          <input type="radio" name={name} checked={valeur} onChange={() => onChange(true)} />
          Oui
        </label>
        <label className="text-ink-900 flex items-center gap-1.5 text-sm">
          <input type="radio" name={name} checked={!valeur} onChange={() => onChange(false)} />
          Non
        </label>
      </div>
      <p className="text-ink-500 mt-1 text-xs">{guidance}</p>
    </div>
  );
}

interface BlocAcquisitionProps {
  titre: string;
  type: TypeDemande;
  ordrePresets: PresetPeriode[];
  regle: RegleAcquisition | undefined;
  guidanceReport: string;
  guidanceAnticipation: string;
  onEnregistrer: (type: TypeDemande, input: RegleAcquisitionInput) => Promise<RegleAcquisition>;
}

function BlocAcquisition({
  titre,
  type,
  ordrePresets,
  regle,
  guidanceReport,
  guidanceAnticipation,
  onEnregistrer,
}: BlocAcquisitionProps) {
  const presetParDefaut = ordrePresets[0];
  const baseParDefaut =
    presetParDefaut === "personnalisee"
      ? { mois: 1, jour: 1 }
      : PRESET_PERIODE_VALEUR[presetParDefaut];

  const [preset, setPreset] = useState<PresetPeriode>(
    regle ? presetPourPeriode(regle.periodeDebutMois, regle.periodeDebutJour) : presetParDefaut,
  );
  const [mois, setMois] = useState(regle?.periodeDebutMois ?? baseParDefaut.mois);
  const [jour, setJour] = useState(regle?.periodeDebutJour ?? baseParDefaut.jour);
  const [acquisition, setAcquisition] = useState(regle ? String(regle.tauxAcquisitionMensuel) : "");
  const [report, setReport] = useState(regle?.reportAutorise ?? false);
  const [anticipation, setAnticipation] = useState(regle?.anticipationAutorisee ?? false);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [enregistre, setEnregistre] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const taux = Number(acquisition);
    if (!acquisition || Number.isNaN(taux) || taux < 0) {
      setErreur("Merci d'indiquer un taux d'acquisition valide.");
      return;
    }

    const { mois: moisEnvoye, jour: jourEnvoye } =
      preset === "personnalisee" ? { mois, jour } : PRESET_PERIODE_VALEUR[preset];

    setErreur("");
    setEnvoi(true);
    setEnregistre(false);
    try {
      await onEnregistrer(type, {
        periodeDebutMois: moisEnvoye,
        periodeDebutJour: jourEnvoye,
        tauxAcquisitionMensuel: taux,
        reportAutorise: report,
        anticipationAutorisee: anticipation,
      });
      setEnregistre(true);
    } catch {
      setErreur("Impossible d'enregistrer ces réglages.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="bg-surface-card rounded-card flex flex-col gap-5 p-5 shadow-sm">
      <h2 className="text-ink-900 text-lg font-semibold">{titre}</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <FieldLabel htmlFor={`${type}-periode`}>Période de référence</FieldLabel>
          <Select
            id={`${type}-periode`}
            value={preset}
            onChange={(e) => setPreset(e.target.value as PresetPeriode)}
            className="mt-2 w-full"
          >
            {ordrePresets.map((p) => (
              <option key={p} value={p}>
                {PRESET_PERIODE_LABEL[p]}
              </option>
            ))}
          </Select>
        </div>

        {preset === "personnalisee" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor={`${type}-mois`}>Mois de début</FieldLabel>
              <Input
                id={`${type}-mois`}
                type="number"
                min={1}
                max={12}
                value={mois}
                onChange={(e) => setMois(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${type}-jour`}>Jour de début</FieldLabel>
              <Input
                id={`${type}-jour`}
                type="number"
                min={1}
                max={31}
                value={jour}
                onChange={(e) => setJour(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </div>
          </div>
        )}

        <div>
          <FieldLabel htmlFor={`${type}-acquisition`}>Acquisition (jours/mois)</FieldLabel>
          <Input
            id={`${type}-acquisition`}
            type="number"
            min={0}
            step="0.01"
            placeholder="Ex. 2.08"
            value={acquisition}
            onChange={(e) => setAcquisition(e.target.value)}
            className="mt-2 w-full"
          />
        </div>

        <RadioOuiNon
          name={`${type}-report`}
          valeur={report}
          onChange={setReport}
          guidance={guidanceReport}
        />

        <RadioOuiNon
          name={`${type}-anticipation`}
          valeur={anticipation}
          onChange={setAnticipation}
          guidance={guidanceAnticipation}
        />

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        {enregistre && !erreur && (
          <div className="rounded-control bg-status-success-bg text-status-success-fg px-3 py-2.5 text-sm">
            Réglages enregistrés.
          </div>
        )}

        <Button type="submit" disabled={envoi} className="rounded-card w-full py-3">
          Enregistrer
        </Button>
      </form>
    </div>
  );
}

interface ModalAjoutRegleAncienneteProps {
  onClose: () => void;
  onAjouter: (input: RegleAncienneteInput) => Promise<RegleAnciennete>;
}

function ModalAjoutRegleAnciennete({ onClose, onAjouter }: ModalAjoutRegleAncienneteProps) {
  const [seuil, setSeuil] = useState("");
  const [jours, setJours] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const seuilAnnees = Number(seuil);
    const joursSupplementaires = Number(jours);
    if (!seuil || !jours || Number.isNaN(seuilAnnees) || Number.isNaN(joursSupplementaires)) {
      setErreur("Merci d'indiquer une ancienneté et un nombre de jours valides.");
      return;
    }
    if (seuilAnnees <= 0 || joursSupplementaires <= 0) {
      setErreur("Les valeurs doivent être supérieures à 0.");
      return;
    }

    setErreur("");
    setEnvoi(true);
    try {
      await onAjouter({ seuilAnnees, joursSupplementaires });
      onClose();
    } catch {
      setErreur("Impossible d'ajouter cette règle.");
      setEnvoi(false);
    }
  }

  return (
    <Modal title="Paramétrer une règle d'ancienneté" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <FieldLabel htmlFor="regle-seuil">Ancienneté (années)</FieldLabel>
          <Input
            id="regle-seuil"
            type="number"
            min={1}
            placeholder="Ex. 5"
            value={seuil}
            onChange={(e) => setSeuil(e.target.value)}
            className="mt-2 w-full"
          />
        </div>
        <div>
          <FieldLabel htmlFor="regle-jours">Jours supplémentaires</FieldLabel>
          <Input
            id="regle-jours"
            type="number"
            min={0.5}
            step="0.5"
            placeholder="Ex. 1"
            value={jours}
            onChange={(e) => setJours(e.target.value)}
            className="mt-2 w-full"
          />
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-ink-900 rounded-full px-4 py-2 text-sm font-semibold"
          >
            Annuler
          </button>
          <Button type="submit" disabled={envoi} className="rounded-full px-4 py-2">
            Ajouter
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface BlocAncienneteProps {
  regles: RegleAnciennete[];
  onAjouter: (input: RegleAncienneteInput) => Promise<RegleAnciennete>;
  onSupprimer: (id: string) => Promise<void>;
}

function BlocAnciennete({ regles, onAjouter, onSupprimer }: BlocAncienneteProps) {
  const [modalOuverte, setModalOuverte] = useState(false);

  return (
    <div className="bg-surface-card rounded-card flex flex-col gap-4 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-ink-900 text-lg font-semibold">Ancienneté</h2>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setModalOuverte(true)}
          className="shrink-0 rounded-full px-4 py-2"
        >
          <Plus size={16} />
          Paramétrer une règle
        </Button>
      </div>

      <p className="text-ink-500 text-xs">
        Jours de congés payés supplémentaires accordés selon l&rsquo;ancienneté. Les règles ne se
        cumulent pas entre elles : seule la plus favorable au collaborateur s&rsquo;applique.
      </p>

      {regles.length === 0 ? (
        <EmptyRow text="Aucune règle définie — ex. 1 jour pour 5 ans, 2 jours pour 10 ans." />
      ) : (
        <ListCard>
          {regles.map((regle, i) => (
            <div
              key={regle.id}
              className={`flex items-center justify-between px-4 py-3 text-sm ${
                i === regles.length - 1 ? "" : "border-ink-300/60 border-b"
              }`}
            >
              <span className="text-ink-900">
                {formatJours(regle.joursSupplementaires)} jour
                {regle.joursSupplementaires > 1 ? "s" : ""} supplémentaire
                {regle.joursSupplementaires > 1 ? "s" : ""} à partir de {regle.seuilAnnees} an
                {regle.seuilAnnees > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => onSupprimer(regle.id)}
                aria-label="Supprimer cette règle"
                className="text-status-danger-fg shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </ListCard>
      )}

      {modalOuverte && (
        <ModalAjoutRegleAnciennete onClose={() => setModalOuverte(false)} onAjouter={onAjouter} />
      )}
    </div>
  );
}

export function CongesRttPage() {
  const {
    reglesAcquisition,
    reglesAnciennete,
    loading,
    error,
    enregistrerAcquisition,
    ajouterRegleAnciennete,
    retirerRegleAnciennete,
  } = useReglesConges();

  const regleCp = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const regleRtt = reglesAcquisition.find((r) => r.typeAbsence === "RTT");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0">
      <h1 className="text-ink-900 px-1 text-2xl font-semibold">Congés &amp; RTT</h1>

      {error && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
      ) : (
        <>
          <BlocAcquisition
            key={regleCp?.id ?? "cp-nouveau"}
            titre="Congés Payés"
            type="CP"
            ordrePresets={ORDRE_PRESETS_CP}
            regle={regleCp}
            guidanceReport="Les congés non posés sur une année sont reportés l'année suivante"
            guidanceAnticipation="Les collaborateurs peuvent poser des congés anticipés"
            onEnregistrer={enregistrerAcquisition}
          />

          <BlocAnciennete
            regles={reglesAnciennete}
            onAjouter={ajouterRegleAnciennete}
            onSupprimer={retirerRegleAnciennete}
          />

          <BlocAcquisition
            key={regleRtt?.id ?? "rtt-nouveau"}
            titre="RTT"
            type="RTT"
            ordrePresets={ORDRE_PRESETS_RTT}
            regle={regleRtt}
            guidanceReport="Les RTT non posées sur une année sont reportées l'année suivante"
            guidanceAnticipation="Les collaborateurs peuvent poser des RTT anticipées"
            onEnregistrer={enregistrerAcquisition}
          />
        </>
      )}
    </div>
  );
}
