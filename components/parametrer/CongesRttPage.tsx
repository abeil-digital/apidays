"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type {
  ObjectifsCalendrier,
  ObjectifsCalendrierInput,
  RegleAcquisition,
  RegleAcquisitionInput,
  RegleAnciennete,
  RegleAncienneteInput,
  TypeDemande,
} from "@/lib/types";
import { formatJours } from "@/lib/format";
import { useObjectifsCalendrier } from "@/hooks/useObjectifsCalendrier";
import { useReglesConges } from "@/hooks/useReglesConges";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { ListCard } from "@/components/ui/ListCard";
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
  juin_mai: "1er Juin - 31 Mai",
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
  titre,
  valeur,
  onChange,
  guidance,
}: {
  name: string;
  titre: string;
  valeur: boolean;
  onChange: (valeur: boolean) => void;
  guidance: string;
}) {
  return (
    <div>
      <FieldLabel>{titre}</FieldLabel>
      <div className="mt-2 flex gap-5">
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
  titreReport: string;
  guidanceReport: string;
  titreAnticipation: string;
  guidanceAnticipation: string;
  onEnregistrer: (type: TypeDemande, input: RegleAcquisitionInput) => Promise<RegleAcquisition>;
  children?: ReactNode;
}

function BlocAcquisition({
  titre,
  type,
  ordrePresets,
  regle,
  titreReport,
  guidanceReport,
  titreAnticipation,
  guidanceAnticipation,
  onEnregistrer,
  children,
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
  const [modifie, setModifie] = useState(false);

  function marquerModifie() {
    setModifie(true);
    setEnregistre(false);
  }

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
      setModifie(false);
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor={`${type}-periode`}>Période de référence</FieldLabel>
            <Select
              id={`${type}-periode`}
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value as PresetPeriode);
                marquerModifie();
              }}
              className="mt-2 block w-40"
            >
              {ordrePresets.map((p) => (
                <option key={p} value={p}>
                  {PRESET_PERIODE_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <FieldLabel htmlFor={`${type}-acquisition`}>Acquisition</FieldLabel>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id={`${type}-acquisition`}
                type="number"
                min={0}
                step="0.01"
                placeholder="Ex. 2.08"
                value={acquisition}
                onChange={(e) => {
                  setAcquisition(e.target.value);
                  marquerModifie();
                }}
                className="w-20"
              />
              <span className="text-ink-500 text-sm">jours / mois</span>
            </div>
          </div>
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
                onChange={(e) => {
                  setMois(Number(e.target.value));
                  marquerModifie();
                }}
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
                onChange={(e) => {
                  setJour(Number(e.target.value));
                  marquerModifie();
                }}
                className="mt-2 w-full"
              />
            </div>
          </div>
        )}

        <RadioOuiNon
          name={`${type}-report`}
          titre={titreReport}
          valeur={report}
          onChange={(valeur) => {
            setReport(valeur);
            marquerModifie();
          }}
          guidance={guidanceReport}
        />

        <RadioOuiNon
          name={`${type}-anticipation`}
          titre={titreAnticipation}
          valeur={anticipation}
          onChange={(valeur) => {
            setAnticipation(valeur);
            marquerModifie();
          }}
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

        <Button
          type="submit"
          disabled={envoi || !modifie}
          className="rounded-card w-fit self-start px-6 py-3"
        >
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>

      {children && (
        <div className="border-ink-300/60 flex flex-col gap-4 border-t pt-5">{children}</div>
      )}
    </div>
  );
}

interface LigneFormulaireAncienneteProps {
  valeurInitiale?: RegleAnciennete;
  onValider: (input: RegleAncienneteInput) => Promise<void>;
  onAnnuler: () => void;
}

function LigneFormulaireAnciennete({
  valeurInitiale,
  onValider,
  onAnnuler,
}: LigneFormulaireAncienneteProps) {
  const [jours, setJours] = useState(
    valeurInitiale ? String(valeurInitiale.joursSupplementaires) : "",
  );
  const [seuil, setSeuil] = useState(valeurInitiale ? String(valeurInitiale.seuilAnnees) : "");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const joursSupplementaires = Number(jours);
    const seuilAnnees = Number(seuil);
    if (!jours || !seuil || Number.isNaN(joursSupplementaires) || Number.isNaN(seuilAnnees)) {
      setErreur("Merci d'indiquer des valeurs valides.");
      return;
    }
    if (joursSupplementaires <= 0 || seuilAnnees <= 0) {
      setErreur("Les valeurs doivent être supérieures à 0.");
      return;
    }

    setErreur("");
    setEnvoi(true);
    try {
      await onValider({ seuilAnnees, joursSupplementaires });
    } catch {
      setErreur("Impossible d'enregistrer cette règle.");
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={0.5}
          step="0.5"
          placeholder="Ex. 1"
          value={jours}
          onChange={(e) => setJours(e.target.value)}
          className="w-16"
          aria-label="Jours de CP supplémentaires"
        />
        <span className="text-ink-900 text-sm">jour(s) de CP supplémentaire tous les</span>
        <Input
          type="number"
          min={1}
          placeholder="Ex. 5"
          value={seuil}
          onChange={(e) => setSeuil(e.target.value)}
          className="w-16"
          aria-label="Ancienneté en années"
        />
        <span className="text-ink-900 text-sm">ans</span>
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

interface BlocAncienneteProps {
  regles: RegleAnciennete[];
  onAjouter: (input: RegleAncienneteInput) => Promise<RegleAnciennete>;
  onModifier: (id: string, input: RegleAncienneteInput) => Promise<RegleAnciennete>;
  onSupprimer: (id: string) => Promise<void>;
}

function BlocAnciennete({ regles, onAjouter, onModifier, onSupprimer }: BlocAncienneteProps) {
  const [ligneOuverte, setLigneOuverte] = useState<string | "nouvelle" | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-ink-900 text-base font-semibold">Ancienneté</h2>

      <p className="text-ink-500 text-xs">
        Jours de congés payés supplémentaires accordés selon l&rsquo;ancienneté. Les règles ne se
        cumulent pas entre elles : seule la plus favorable au collaborateur s&rsquo;applique.
      </p>

      {regles.length > 0 && (
        <ListCard>
          {regles.map((regle, i) => (
            <div
              key={regle.id}
              className={i === regles.length - 1 ? "" : "border-ink-300/60 border-b"}
            >
              {ligneOuverte === regle.id ? (
                <LigneFormulaireAnciennete
                  valeurInitiale={regle}
                  onValider={async (input) => {
                    await onModifier(regle.id, input);
                    setLigneOuverte(null);
                  }}
                  onAnnuler={() => setLigneOuverte(null)}
                />
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="text-ink-900">
                    {formatJours(regle.joursSupplementaires)} jour
                    {regle.joursSupplementaires > 1 ? "s" : ""} de CP supplémentaire
                    {regle.joursSupplementaires > 1 ? "s" : ""} tous les {regle.seuilAnnees} an
                    {regle.seuilAnnees > 1 ? "s" : ""}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setLigneOuverte(regle.id)}
                      className="text-ink-500 text-xs font-semibold underline"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => onSupprimer(regle.id)}
                      aria-label="Supprimer cette règle"
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

      {ligneOuverte === "nouvelle" ? (
        <ListCard>
          <LigneFormulaireAnciennete
            onValider={async (input) => {
              await onAjouter(input);
              setLigneOuverte(null);
            }}
            onAnnuler={() => setLigneOuverte(null)}
          />
        </ListCard>
      ) : (
        <button
          type="button"
          onClick={() => setLigneOuverte("nouvelle")}
          className="text-ink-900 w-fit text-xs font-semibold underline"
        >
          + ajouter une règle
        </button>
      )}
    </div>
  );
}

/**
 * Objectifs annuels de volume CPI (congés imposés) et DJI (demi-journées
 * imposées) — réglage global (pas par année), consommé par l'écran
 * Calendrier pour les cibles de progression (pastilles couleur, blocage du
 * bouton "Publier"). Même gabarit que `BlocAcquisition` (titre, formulaire,
 * bouton "Enregistrer" désactivé tant que rien n'a changé).
 */
function BlocObjectifsCalendrier({
  objectifs,
  onEnregistrer,
}: {
  objectifs: ObjectifsCalendrier | null;
  onEnregistrer: (input: ObjectifsCalendrierInput) => Promise<ObjectifsCalendrier>;
}) {
  const [cibleJoursCpi, setCibleJoursCpi] = useState(
    objectifs ? String(objectifs.cibleJoursCpi) : "",
  );
  const [cibleDemiJourneesDji, setCibleDemiJourneesDji] = useState(
    objectifs ? String(objectifs.cibleDemiJourneesDji) : "",
  );
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [modifie, setModifie] = useState(false);

  function marquerModifie() {
    setModifie(true);
    setEnregistre(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const cpi = Number(cibleJoursCpi);
    const dji = Number(cibleDemiJourneesDji);
    if (!cibleJoursCpi || Number.isNaN(cpi) || cpi < 0) {
      setErreur("Merci d'indiquer un nombre de jours CPI valide.");
      return;
    }
    if (!cibleDemiJourneesDji || Number.isNaN(dji) || dji < 0) {
      setErreur("Merci d'indiquer un nombre de demi-journées DJI valide.");
      return;
    }

    setErreur("");
    setEnvoi(true);
    setEnregistre(false);
    try {
      await onEnregistrer({ cibleJoursCpi: cpi, cibleDemiJourneesDji: dji });
      setEnregistre(true);
      setModifie(false);
    } catch {
      setErreur("Impossible d'enregistrer ces objectifs.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="bg-surface-card rounded-card flex flex-col gap-5 p-5 shadow-sm">
      <h2 className="text-ink-900 text-lg font-semibold">Congés &amp; demi-journées imposés</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="objectifs-cpi">CP Imposés</FieldLabel>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id="objectifs-cpi"
                type="number"
                min={0}
                step="0.5"
                value={cibleJoursCpi}
                onChange={(e) => {
                  setCibleJoursCpi(e.target.value);
                  marquerModifie();
                }}
                className="w-20"
              />
              <span className="text-ink-500 text-sm">jours / an</span>
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="objectifs-dji">Demi-journées imposées</FieldLabel>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id="objectifs-dji"
                type="number"
                min={0}
                value={cibleDemiJourneesDji}
                onChange={(e) => {
                  setCibleDemiJourneesDji(e.target.value);
                  marquerModifie();
                }}
                className="w-20"
              />
              <span className="text-ink-500 text-sm">demi-journées / an</span>
            </div>
          </div>
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        {enregistre && !erreur && (
          <div className="rounded-control bg-status-success-bg text-status-success-fg px-3 py-2.5 text-sm">
            Objectifs enregistrés.
          </div>
        )}

        <Button
          type="submit"
          disabled={envoi || !modifie}
          className="rounded-card w-fit self-start px-6 py-3"
        >
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
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
    modifierRegleAnciennete,
    retirerRegleAnciennete,
  } = useReglesConges();
  const {
    objectifs,
    loading: loadingObjectifs,
    error: erreurObjectifs,
    enregistrerObjectifs,
  } = useObjectifsCalendrier();

  const regleCp = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const regleRtt = reglesAcquisition.find((r) => r.typeAbsence === "RTT");

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0">
      <h1 className="text-slate animate-stagger-in px-1 text-2xl font-semibold">
        Congés &amp; RTT
      </h1>

      {(error || erreurObjectifs) && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error || erreurObjectifs}
        </div>
      )}

      {loading || loadingObjectifs ? (
        <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
      ) : (
        <>
          <div className="animate-stagger-in">
            <BlocAcquisition
              key={regleCp?.id ?? "cp-nouveau"}
              titre="Congés Payés"
              type="CP"
              ordrePresets={ORDRE_PRESETS_CP}
              regle={regleCp}
              titreReport="Congés reportés"
              guidanceReport="Les congés non posés sur une année sont reportés l'année suivante"
              titreAnticipation="Congés anticipés"
              guidanceAnticipation="Les collaborateurs peuvent poser des congés anticipés"
              onEnregistrer={enregistrerAcquisition}
            >
              <BlocAnciennete
                regles={reglesAnciennete}
                onAjouter={ajouterRegleAnciennete}
                onModifier={modifierRegleAnciennete}
                onSupprimer={retirerRegleAnciennete}
              />
            </BlocAcquisition>
          </div>

          <div className="animate-stagger-in" style={{ animationDelay: "90ms" }}>
            <BlocObjectifsCalendrier
              key={objectifs ? "objectifs-charges" : "objectifs-chargement"}
              objectifs={objectifs}
              onEnregistrer={enregistrerObjectifs}
            />
          </div>

          <div className="animate-stagger-in" style={{ animationDelay: "180ms" }}>
            <BlocAcquisition
              key={regleRtt?.id ?? "rtt-nouveau"}
              titre="RTT"
              type="RTT"
              ordrePresets={ORDRE_PRESETS_RTT}
              regle={regleRtt}
              titreReport="RTT reportées"
              guidanceReport="Les RTT non posées sur une année sont reportées l'année suivante"
              titreAnticipation="RTT anticipées"
              guidanceAnticipation="Les collaborateurs peuvent poser des RTT anticipées"
              onEnregistrer={enregistrerAcquisition}
            />
          </div>
        </>
      )}
    </div>
  );
}
