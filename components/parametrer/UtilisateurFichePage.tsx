"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, Pencil } from "lucide-react";
import type {
  ChampHistoriqueUtilisateur,
  ChangerChampInput,
  HistoriqueUtilisateurEntry,
  NatureContrat,
  RoleUtilisateur,
  SoldeInitial,
  UtilisateurAdmin,
  UtilisateurAdminInput,
} from "@/lib/types";
import {
  formatDateAction,
  formatDateHeureAction,
  formatJours,
  formatMoisAnneeCourt,
  moisEffet,
} from "@/lib/format";
import { useUtilisateurAdmin } from "@/hooks/useUtilisateurAdmin";
import { BackHeader } from "@/components/ui/BackHeader";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";

interface UtilisateurFichePageProps {
  id?: string; // absent = mode création
}

const CHAMPS_VIDES: UtilisateurAdminInput = {
  prenom: "",
  nom: "",
  email: "",
  dateEntree: "",
  natureContrat: "cdi",
  tauxActivite: 100,
  ancienneteDateReference: null,
  role: "salarie",
};

const PRESETS_DUREE: { value: string; label: string }[] = [
  { value: "100", label: "Temps plein (100 %)" },
  { value: "80", label: "80 %" },
  { value: "50", label: "Mi-temps (50 %)" },
  { value: "33.33", label: "Tiers-temps (33,33 %)" },
];

const NATURE_CONTRAT_LABEL: Record<NatureContrat, string> = {
  cdi: "CDI",
  cdd: "CDD",
  alternance: "Alternance",
  stage: "Stage",
};

function presetPourTaux(taux: number): string {
  const preset = PRESETS_DUREE.find((p) => Number(p.value) === taux);
  return preset ? preset.value : "autre";
}

function formatTauxLabel(valeur: string): string {
  const n = Number(valeur);
  if (n === 100) return "Temps plein";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n)}%`;
}

function labelNatureContrat(valeur: string): string {
  return NATURE_CONTRAT_LABEL[valeur as NatureContrat] ?? valeur;
}

function moisPrecedent(anneeMoisIso: string): string {
  const [annee, mois] = anneeMoisIso.split("-").map(Number);
  const moisPrec = mois - 1;
  if (moisPrec < 1) return `${annee - 1}-12`;
  return `${annee}-${String(moisPrec).padStart(2, "0")}`;
}

function formatMoisAnneeLong(anneeMoisIso: string): string {
  const d = new Date(`${anneeMoisIso}-01T00:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

interface LignePeriode {
  key: string;
  label: string;
  valeurLabel: string;
}

/**
 * Construit les périodes affichées dans le tableau récap (21/08/2026,
 * historisation) à partir de l'historique d'UN champ (déjà filtré), triées
 * chronologiquement — "Depuis le {date d'entrée}" en une seule ligne si
 * aucun changement n'a jamais été fait, sinon une ligne par période "du mm/aa
 * au mm/aa" bornée par le mois d'effet (`moisEffet`, même règle que le moteur
 * de calcul) de chaque changement.
 */
function construirePeriodes(
  entreesChamp: HistoriqueUtilisateurEntry[],
  valeurActuelle: string,
  dateEntree: string,
  labelValeur: (v: string) => string,
): LignePeriode[] {
  if (entreesChamp.length === 0) {
    return [
      {
        key: "initial",
        label: `Depuis le ${formatDateAction(dateEntree)}`,
        valeurLabel: labelValeur(valeurActuelle),
      },
    ];
  }

  const trie = [...entreesChamp].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
  const moisEntree = dateEntree.slice(0, 7);
  const points = [
    { mois: moisEntree, valeur: trie[0].ancienneValeur ?? valeurActuelle },
    ...trie.map((e) => ({ mois: moisEffet(e.dateEffet), valeur: e.nouvelleValeur })),
  ];

  return points.map((p, i) => {
    const finExclusive = points[i + 1]?.mois ?? null;
    const label = finExclusive
      ? `Période du ${formatMoisAnneeCourt(p.mois)} au ${formatMoisAnneeCourt(moisPrecedent(finExclusive))}`
      : `Depuis le ${formatMoisAnneeCourt(p.mois)}`;
    return { key: `${p.mois}-${i}`, label, valeurLabel: labelValeur(p.valeur) };
  });
}

function TableauPeriodes({ titre, lignes }: { titre: string; lignes: LignePeriode[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-ink-500 text-xs font-semibold tracking-wide uppercase">{titre}</h3>
      <div className="bg-surface-card rounded-card overflow-hidden">
        {lignes.map((l, i) => (
          <div
            key={l.key}
            className={`flex items-center justify-between px-4 py-2.5 text-sm ${
              i > 0 ? "border-ink-300/60 border-t" : ""
            }`}
          >
            <span className="text-ink-500">{l.label}</span>
            <span className="text-ink-900 font-semibold">{l.valeurLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EntreeSuivi {
  id: string;
  date: string;
  texte: string;
}

/** "Suivi des modifications" (21/08/2026) — création du profil + chaque
 * changement de durée de travail/nature de contrat, les deux mélangés,
 * triés du plus récent au plus ancien. */
function construireSuivi(
  utilisateur: UtilisateurAdmin,
  historique: HistoriqueUtilisateurEntry[],
): EntreeSuivi[] {
  const creation: EntreeSuivi = {
    id: "creation",
    date: utilisateur.createdAt,
    texte: `Fiche créée par ${utilisateur.creeParNom ?? "—"}`,
  };

  const modifs: EntreeSuivi[] = historique.map((h) => {
    const effetLabel = formatMoisAnneeLong(moisEffet(h.dateEffet));
    if (h.champ === "taux_activite") {
      const avant = h.ancienneValeur ? formatTauxLabel(h.ancienneValeur) : "?";
      return {
        id: h.id,
        date: h.createdAt,
        texte: `Durée de travail modifiée : ${avant} → ${formatTauxLabel(h.nouvelleValeur)}, effective à partir de ${effetLabel}`,
      };
    }
    const avant = h.ancienneValeur ? labelNatureContrat(h.ancienneValeur) : "?";
    return {
      id: h.id,
      date: h.createdAt,
      texte: `Nature du contrat modifiée : ${avant} → ${labelNatureContrat(h.nouvelleValeur)}, effective à partir de ${effetLabel}`,
    };
  });

  return [...modifs, creation].sort((a, b) => b.date.localeCompare(a.date));
}

function SuiviModifications({ entrees }: { entrees: EntreeSuivi[] }) {
  return (
    <div className="xl:sticky xl:top-4 xl:w-72 xl:shrink-0">
      <div className="bg-surface-card rounded-card shadow-sm">
        <h2 className="text-ink-900 px-4 pt-3 pb-2 text-sm font-semibold">
          Suivi des modifications
        </h2>
        <div className="border-ink-300/60 flex flex-col gap-1 border-t p-1">
          {entrees.map((e) => (
            <div key={e.id} className="flex items-start gap-2.5 px-3 py-2.5">
              <span className="bg-mint mt-1.5 h-2 w-2 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-ink-500 text-[10px]">{formatDateHeureAction(e.date)}</span>
                <span className="text-ink-900 text-xs leading-snug">{e.texte}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ModalModifierChampProps {
  champ: ChampHistoriqueUtilisateur;
  valeurActuelle: string;
  onValider: (input: ChangerChampInput) => Promise<void>;
  onClose: () => void;
}

/** Popin "Modifier Durée de travail"/"Modifier Nature du contrat" (21/08/2026)
 * — même popin paramétrée par `champ` : sur une fiche existante, ces deux
 * champs ne se changent plus via un menu déroulant libre mais via cette
 * action + une date d'effet, pour ne pas fausser rétroactivement le calcul
 * du solde en cours (voir `resolverTauxActiviteEffectif`). */
function ModalModifierChamp({
  champ,
  valeurActuelle,
  onValider,
  onClose,
}: ModalModifierChampProps) {
  const estTaux = champ === "taux_activite";
  const [dureeSelection, setDureeSelection] = useState(() =>
    estTaux ? presetPourTaux(Number(valeurActuelle)) : "",
  );
  const [tauxAutre, setTauxAutre] = useState(() =>
    estTaux && presetPourTaux(Number(valeurActuelle)) === "autre" ? valeurActuelle : "",
  );
  const [natureSelection, setNatureSelection] = useState<NatureContrat>(
    estTaux ? "cdi" : (valeurActuelle as NatureContrat),
  );
  const [dateEffet, setDateEffet] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const valeur = estTaux
    ? dureeSelection === "autre"
      ? tauxAutre
      : dureeSelection
    : natureSelection;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dateEffet || !valeur) {
      setErreur("Merci de compléter tous les champs.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await onValider({ valeur: String(valeur), dateEffet });
      onClose();
    } catch {
      setErreur("Impossible d'enregistrer ce changement.");
      setEnvoi(false);
    }
  }

  return (
    <Modal
      title={estTaux ? "Modifier la durée de travail" : "Modifier la nature du contrat"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <FieldLabel htmlFor="modif-valeur">
            {estTaux ? "Durée de travail" : "Nature du contrat"}
          </FieldLabel>
          {estTaux ? (
            <>
              <Select
                id="modif-valeur"
                value={dureeSelection}
                onChange={(e) => {
                  const v = e.target.value;
                  setDureeSelection(v);
                  if (v === "autre") setTauxAutre(valeurActuelle);
                }}
                className="mt-2 w-full"
              >
                {PRESETS_DUREE.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
                <option value="autre">Autre</option>
              </Select>
              {dureeSelection === "autre" && (
                <Input
                  type="number"
                  min={1}
                  max={100}
                  step="0.01"
                  value={tauxAutre}
                  onChange={(e) => setTauxAutre(e.target.value)}
                  className="mt-2 w-full"
                />
              )}
            </>
          ) : (
            <Select
              id="modif-valeur"
              value={natureSelection}
              onChange={(e) => setNatureSelection(e.target.value as NatureContrat)}
              className="mt-2 w-full"
            >
              <option value="cdi">CDI</option>
              <option value="cdd">CDD</option>
              <option value="alternance">Alternance</option>
              <option value="stage">Stage</option>
            </Select>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="modif-date-effet">Date d&rsquo;effet</FieldLabel>
          <Input
            id="modif-date-effet"
            type="date"
            value={dateEffet}
            onChange={(e) => setDateEffet(e.target.value)}
            className="mt-2 w-full"
          />
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        <Button type="submit" disabled={envoi} className="rounded-card w-fit self-start px-6 py-3">
          <Check size={16} />
          Valider
        </Button>
      </form>
    </Modal>
  );
}

interface ModalModifierSoldeInitialProps {
  valeurActuelle: SoldeInitial | null;
  onValider: (input: SoldeInitial) => Promise<void>;
  onClose: () => void;
}

/** Popin de correction du solde initial (21/08/2026, lancement en prod) — pas
 * de "date d'effet" ni d'historique ici (contrairement à
 * `ModalModifierChamp`) : une seule valeur de référence, une correction
 * écrase simplement la précédente (`enregistrerSoldeInitial`, upsert). */
function ModalModifierSoldeInitial({
  valeurActuelle,
  onValider,
  onClose,
}: ModalModifierSoldeInitialProps) {
  const [dateReference, setDateReference] = useState(valeurActuelle?.dateReference ?? "");
  const [cp, setCp] = useState(String(valeurActuelle?.cp ?? 0));
  const [rtt, setRtt] = useState(String(valeurActuelle?.rtt ?? 0));
  const [cpa, setCpa] = useState(String(valeurActuelle?.cpa ?? 0));
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dateReference) {
      setErreur("Merci de renseigner la date de référence.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await onValider({
        dateReference,
        cp: Number(cp) || 0,
        rtt: Number(rtt) || 0,
        cpa: Number(cpa) || 0,
      });
      onClose();
    } catch {
      setErreur("Impossible d'enregistrer ce solde.");
      setEnvoi(false);
    }
  }

  return (
    <Modal title="Modifier les soldes actuels" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <FieldLabel htmlFor="solde-init-date">Date de référence</FieldLabel>
          <Input
            id="solde-init-date"
            type="date"
            value={dateReference}
            onChange={(e) => setDateReference(e.target.value)}
            className="mt-2 w-full"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <FieldLabel htmlFor="solde-init-cp">CP</FieldLabel>
            <Input
              id="solde-init-cp"
              type="number"
              step="0.5"
              value={cp}
              onChange={(e) => setCp(e.target.value)}
              className="mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel htmlFor="solde-init-rtt">RTT</FieldLabel>
            <Input
              id="solde-init-rtt"
              type="number"
              step="0.5"
              value={rtt}
              onChange={(e) => setRtt(e.target.value)}
              className="mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel htmlFor="solde-init-cpa">CPA</FieldLabel>
            <Input
              id="solde-init-cpa"
              type="number"
              step="0.5"
              value={cpa}
              onChange={(e) => setCpa(e.target.value)}
              className="mt-2 w-full"
            />
          </div>
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        <Button type="submit" disabled={envoi} className="rounded-card w-fit self-start px-6 py-3">
          <Check size={16} />
          Valider
        </Button>
      </form>
    </Modal>
  );
}

interface FormulaireProps {
  id?: string;
  initial: UtilisateurAdminInput;
  statut?: UtilisateurAdmin["statut"];
  historique: HistoriqueUtilisateurEntry[];
  soldeInitial: SoldeInitial | null;
  dateEntree: string;
  creer: (input: UtilisateurAdminInput, soldeInitial?: SoldeInitial) => Promise<UtilisateurAdmin>;
  modifier: (input: UtilisateurAdminInput) => Promise<UtilisateurAdmin>;
  archiver: () => Promise<void>;
  changerTauxActivite: (input: ChangerChampInput) => Promise<void>;
  changerNatureContrat: (input: ChangerChampInput) => Promise<void>;
  enregistrerSoldeInitial: (input: SoldeInitial) => Promise<void>;
}

/**
 * Formulaire proprement dit — un composant à part pour que son état
 * (`champs`) puisse s'initialiser directement depuis `initial` sans passer
 * par un effect de synchronisation : `UtilisateurFichePage` ne le monte
 * (avec une `key`) qu'une fois les données prêtes (ou vides, en création).
 */
function Formulaire({
  id,
  initial,
  statut,
  historique,
  soldeInitial,
  dateEntree,
  creer,
  modifier,
  archiver,
  changerTauxActivite,
  changerNatureContrat,
  enregistrerSoldeInitial,
}: FormulaireProps) {
  const router = useRouter();
  const [champs, setChamps] = useState<UtilisateurAdminInput>(initial);
  const [dureeSelection, setDureeSelection] = useState(() => presetPourTaux(initial.tauxActivite));
  const [tauxAutre, setTauxAutre] = useState(() =>
    presetPourTaux(initial.tauxActivite) === "autre" ? String(initial.tauxActivite) : "",
  );
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [confirmArchivage, setConfirmArchivage] = useState(false);
  const [modaleOuverte, setModaleOuverte] = useState<ChampHistoriqueUtilisateur | null>(null);
  const [modaleSoldeInitiale, setModaleSoldeInitiale] = useState(false);
  const [soldeInitDate, setSoldeInitDate] = useState("");
  const [soldeInitCp, setSoldeInitCp] = useState("0");
  const [soldeInitRtt, setSoldeInitRtt] = useState("0");
  const [soldeInitCpa, setSoldeInitCpa] = useState("0");

  const modeEdition = Boolean(id);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!champs.prenom || !champs.nom || !champs.email || !champs.dateEntree) {
      setErreur("Merci de compléter tous les champs obligatoires.");
      return;
    }

    setErreur("");
    setEnvoi(true);
    try {
      if (id) {
        const resultat = await modifier(champs);
        router.push(`/parametrer/utilisateurs/${resultat.id}`);
      } else {
        const soldeInitialInput: SoldeInitial | undefined = soldeInitDate
          ? {
              dateReference: soldeInitDate,
              cp: Number(soldeInitCp) || 0,
              rtt: Number(soldeInitRtt) || 0,
              cpa: Number(soldeInitCpa) || 0,
            }
          : undefined;
        const resultat = await creer(champs, soldeInitialInput);
        router.push(`/parametrer/utilisateurs/${resultat.id}`);
      }
    } catch {
      setErreur(
        id ? "Impossible d'enregistrer les modifications." : "Impossible de créer ce profil.",
      );
    } finally {
      setEnvoi(false);
    }
  }

  async function handleArchiver() {
    setConfirmArchivage(false);
    try {
      await archiver();
    } catch {
      setErreur("Impossible d'archiver ce profil.");
    }
  }

  async function handleChangerTaux(input: ChangerChampInput) {
    await changerTauxActivite(input);
    setChamps((c) => ({ ...c, tauxActivite: Number(input.valeur) }));
  }

  async function handleChangerNature(input: ChangerChampInput) {
    await changerNatureContrat(input);
    setChamps((c) => ({ ...c, natureContrat: input.valeur as NatureContrat }));
  }

  async function handleEnregistrerSolde(input: SoldeInitial) {
    await enregistrerSoldeInitial(input);
  }

  const historiqueTaux = historique.filter((h) => h.champ === "taux_activite");
  const historiqueNature = historique.filter((h) => h.champ === "nature_contrat");

  return (
    <>
      {/* Card englobante (21/08/2026, mise en cohérence DS) — même convention
          que les formulaires de `CongesRttPage.tsx`
          (`bg-surface-card rounded-card p-5 shadow-sm`) : le formulaire
          flottait directement sur le fond de page jusqu'ici, seule page de
          ce type sans card. */}
      <div className="bg-surface-card rounded-card flex flex-col gap-5 p-5 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="prenom">Prénom</FieldLabel>
              <Input
                id="prenom"
                value={champs.prenom}
                onChange={(e) => setChamps({ ...champs, prenom: e.target.value })}
                className="mt-2 w-full"
              />
            </div>
            <div>
              <FieldLabel htmlFor="nom">Nom</FieldLabel>
              <Input
                id="nom"
                value={champs.nom}
                onChange={(e) => setChamps({ ...champs, nom: e.target.value })}
                className="mt-2 w-full"
              />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              value={champs.email}
              onChange={(e) => setChamps({ ...champs, email: e.target.value })}
              className="mt-2 w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="dateEntree">Date d&rsquo;entrée</FieldLabel>
              <Input
                id="dateEntree"
                type="date"
                value={champs.dateEntree}
                onChange={(e) => setChamps({ ...champs, dateEntree: e.target.value })}
                className="mt-2 w-full"
              />
            </div>
            <div>
              <FieldLabel htmlFor="role">Rôle</FieldLabel>
              <Select
                id="role"
                value={champs.role}
                onChange={(e) => setChamps({ ...champs, role: e.target.value as RoleUtilisateur })}
                className="mt-2 w-full"
              >
                <option value="salarie">Salarié·e</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
          </div>

          {modeEdition ? (
            /* Durée de travail / Nature du contrat en lecture seule
               (21/08/2026, historisation) — sur une fiche existante, ces deux
               champs ne se changent plus via un menu déroulant libre mais via
               l'action "Modifier" (popin + date d'effet), pour ne pas fausser
               rétroactivement le calcul du solde en cours. */
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Nature du contrat</FieldLabel>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-ink-900 text-sm">
                    {labelNatureContrat(champs.natureContrat)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModaleOuverte("nature_contrat")}
                    className="text-ink-900 flex shrink-0 items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                  >
                    <Pencil size={12} />
                    Modifier
                  </button>
                </div>
              </div>
              <div>
                <FieldLabel>Durée de travail</FieldLabel>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-ink-900 text-sm">
                    {formatTauxLabel(String(champs.tauxActivite))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModaleOuverte("taux_activite")}
                    className="text-ink-900 flex shrink-0 items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                  >
                    <Pencil size={12} />
                    Modifier
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="natureContrat">Nature du contrat</FieldLabel>
                <Select
                  id="natureContrat"
                  value={champs.natureContrat}
                  onChange={(e) =>
                    setChamps({ ...champs, natureContrat: e.target.value as NatureContrat })
                  }
                  className="mt-2 w-full"
                >
                  <option value="cdi">CDI</option>
                  <option value="cdd">CDD</option>
                  <option value="alternance">Alternance</option>
                  <option value="stage">Stage</option>
                </Select>
              </div>
              <div>
                <FieldLabel htmlFor="dureeTravail">Durée de travail</FieldLabel>
                <Select
                  id="dureeTravail"
                  value={dureeSelection}
                  onChange={(e) => {
                    const valeur = e.target.value;
                    setDureeSelection(valeur);
                    if (valeur === "autre") {
                      setTauxAutre(String(champs.tauxActivite));
                    } else {
                      setChamps({ ...champs, tauxActivite: Number(valeur) });
                    }
                  }}
                  className="mt-2 w-full"
                >
                  {PRESETS_DUREE.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                  <option value="autre">Autre</option>
                </Select>
              </div>
            </div>
          )}

          {!modeEdition && dureeSelection === "autre" && (
            <div>
              <FieldLabel htmlFor="tauxAutre">Pourcentage</FieldLabel>
              <Input
                id="tauxAutre"
                type="number"
                min={1}
                max={100}
                step="0.01"
                value={tauxAutre}
                onChange={(e) => {
                  const valeur = e.target.value;
                  setTauxAutre(valeur);
                  const n = Number(valeur);
                  if (valeur && !Number.isNaN(n)) {
                    setChamps({ ...champs, tauxActivite: n });
                  }
                }}
                className="mt-2 w-full"
              />
            </div>
          )}

          <div>
            <FieldLabel htmlFor="anciennete">
              Date de référence ancienneté{" "}
              <span className="text-ink-500 font-normal">
                (si différente de la date d&rsquo;entrée)
              </span>
            </FieldLabel>
            <Input
              id="anciennete"
              type="date"
              value={champs.ancienneteDateReference ?? ""}
              onChange={(e) =>
                setChamps({ ...champs, ancienneteDateReference: e.target.value || null })
              }
              className="mt-2 w-full"
            />
          </div>

          {!modeEdition && (
            /* Soldes actuels (21/08/2026, lancement en prod) — report de la
               dernière fiche de paie pour un salarié déjà en poste avant
               l'app : remplace le report/accrual automatique tant que la
               période en cours est celle de cette date de référence, voir
               `resolverReportCp`/`resolverPointDepartAccrual` dans
               `soldes.repository.ts`. Facultatif — si la date est laissée
               vide, aucun solde initial n'est créé (comportement inchangé). */
            <div className="border-ink-300/60 flex flex-col gap-3 border-t pt-5">
              <FieldLabel>
                Soldes actuels{" "}
                <span className="text-ink-500 font-normal">
                  (report de la dernière fiche de paie, facultatif)
                </span>
              </FieldLabel>
              <div>
                <FieldLabel htmlFor="soldeInitDate">Date de référence</FieldLabel>
                <Input
                  id="soldeInitDate"
                  type="date"
                  value={soldeInitDate}
                  onChange={(e) => setSoldeInitDate(e.target.value)}
                  className="mt-2 w-full"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FieldLabel htmlFor="soldeInitCp">CP</FieldLabel>
                  <Input
                    id="soldeInitCp"
                    type="number"
                    step="0.5"
                    value={soldeInitCp}
                    onChange={(e) => setSoldeInitCp(e.target.value)}
                    className="mt-2 w-full"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="soldeInitRtt">RTT</FieldLabel>
                  <Input
                    id="soldeInitRtt"
                    type="number"
                    step="0.5"
                    value={soldeInitRtt}
                    onChange={(e) => setSoldeInitRtt(e.target.value)}
                    className="mt-2 w-full"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="soldeInitCpa">CPA</FieldLabel>
                  <Input
                    id="soldeInitCpa"
                    type="number"
                    step="0.5"
                    value={soldeInitCpa}
                    onChange={(e) => setSoldeInitCpa(e.target.value)}
                    className="mt-2 w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {erreur && (
            <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
              {erreur}
            </div>
          )}

          <Button
            type="submit"
            disabled={envoi}
            className="rounded-card w-fit self-start px-6 py-3.5"
          >
            <Check size={16} />
            {id ? "Enregistrer" : "Créer le profil"}
          </Button>
        </form>
      </div>

      {modeEdition && (
        <div className="mt-5 flex flex-col gap-4">
          <TableauPeriodes
            titre="Nature du contrat"
            lignes={construirePeriodes(
              historiqueNature,
              champs.natureContrat,
              dateEntree,
              labelNatureContrat,
            )}
          />
          <TableauPeriodes
            titre="Durée de travail"
            lignes={construirePeriodes(
              historiqueTaux,
              String(champs.tauxActivite),
              dateEntree,
              formatTauxLabel,
            )}
          />

          <div className="flex flex-col gap-2">
            <h3 className="text-ink-500 text-xs font-semibold tracking-wide uppercase">
              Soldes actuels
            </h3>
            <div className="bg-surface-card rounded-card flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              {soldeInitial ? (
                <span className="text-ink-900">
                  Au {formatDateAction(soldeInitial.dateReference)} : CP{" "}
                  {formatJours(soldeInitial.cp)} · RTT {formatJours(soldeInitial.rtt)} · CPA{" "}
                  {formatJours(soldeInitial.cpa)}
                </span>
              ) : (
                <span className="text-ink-500">Aucun solde de départ saisi.</span>
              )}
              <button
                type="button"
                onClick={() => setModaleSoldeInitiale(true)}
                className="text-ink-900 flex shrink-0 items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
              >
                <Pencil size={12} />
                Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {id && statut === "actif" && (
        <button
          type="button"
          onClick={() => setConfirmArchivage(true)}
          className="text-status-danger-fg mt-2 flex items-center gap-1.5 self-start px-1 text-xs font-medium"
        >
          <Archive size={12} />
          Archiver ce profil
        </button>
      )}

      {confirmArchivage && (
        <Modal title="Archiver ce profil ?" onClose={() => setConfirmArchivage(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-ink-500 text-sm">
              Cette action coupe l&rsquo;accès de{" "}
              <span className="text-ink-900 font-semibold">
                {champs.prenom} {champs.nom}
              </span>{" "}
              à l&rsquo;outil. Confirmer ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmArchivage(false)}
                className="text-ink-900 rounded-full px-4 py-2 text-sm font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleArchiver}
                className="bg-status-danger-fg rounded-full px-4 py-2 text-sm font-semibold text-white"
              >
                Archiver
              </button>
            </div>
          </div>
        </Modal>
      )}

      {modaleOuverte === "taux_activite" && (
        <ModalModifierChamp
          champ="taux_activite"
          valeurActuelle={String(champs.tauxActivite)}
          onValider={handleChangerTaux}
          onClose={() => setModaleOuverte(null)}
        />
      )}

      {modaleOuverte === "nature_contrat" && (
        <ModalModifierChamp
          champ="nature_contrat"
          valeurActuelle={champs.natureContrat}
          onValider={handleChangerNature}
          onClose={() => setModaleOuverte(null)}
        />
      )}

      {modaleSoldeInitiale && (
        <ModalModifierSoldeInitial
          valeurActuelle={soldeInitial}
          onValider={handleEnregistrerSolde}
          onClose={() => setModaleSoldeInitiale(false)}
        />
      )}
    </>
  );
}

export function UtilisateurFichePage({ id }: UtilisateurFichePageProps) {
  const {
    utilisateur,
    historique,
    soldeInitial,
    loading,
    error: erreurChargement,
    creer,
    modifier,
    archiver,
    changerTauxActivite,
    changerNatureContrat,
    enregistrerSoldeInitial,
  } = useUtilisateurAdmin(id);

  if (id && loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  if (id && erreurChargement) {
    return (
      <div className="text-status-danger-fg py-20 text-center text-sm">{erreurChargement}</div>
    );
  }

  const initial: UtilisateurAdminInput = utilisateur
    ? {
        prenom: utilisateur.prenom,
        nom: utilisateur.nom,
        email: utilisateur.email,
        dateEntree: utilisateur.dateEntree,
        natureContrat: utilisateur.natureContrat ?? "cdi",
        tauxActivite: utilisateur.tauxActivite,
        ancienneteDateReference: utilisateur.ancienneteDateReference,
        role: utilisateur.role,
      }
    : CHAMPS_VIDES;

  const titre = utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : "Créer un profil";

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0 xl:max-w-none">
      <BackHeader href="/parametrer/utilisateurs" title={titre} />

      {utilisateur?.statut === "archive" && (
        <div className="rounded-control bg-ink-300/40 text-ink-500 px-3.5 py-2.5 text-xs">
          Profil archivé
          {utilisateur.dateArchivage ? ` le ${formatDateAction(utilisateur.dateArchivage)}` : ""}.
        </div>
      )}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex w-full flex-col xl:max-w-2xl xl:min-w-0">
          <Formulaire
            key={id ?? "nouveau"}
            id={id}
            initial={initial}
            statut={utilisateur?.statut}
            historique={historique}
            soldeInitial={soldeInitial}
            dateEntree={initial.dateEntree}
            creer={creer}
            modifier={modifier}
            archiver={archiver}
            changerTauxActivite={changerTauxActivite}
            changerNatureContrat={changerNatureContrat}
            enregistrerSoldeInitial={enregistrerSoldeInitial}
          />
        </div>

        {id && utilisateur && (
          <SuiviModifications entrees={construireSuivi(utilisateur, historique)} />
        )}
      </div>
    </div>
  );
}
