"use client";

/**
 * Duplicat de `UtilisateurFichePage.tsx` (02/09/2026, demande explicite) —
 * bac à sable pour la refonte UI de la fiche utilisateur (voir Backlog
 * "Checker l'UI de la fiche utilisateur"). Route dédiée `/parametrer/
 * utilisateurs2/[id]`/`/nouveau`, même pattern que `calendrier2` en son
 * temps : itérer sur une copie sans toucher à l'écran réel, jusqu'à
 * décision de bascule (ou abandon). Partage la même couche données
 * (`useUtilisateurAdmin`) — seule l'UI diverge.
 *
 * Principe à explorer ici : rendre visible le caractère "historique" de
 * Nature du contrat/Durée de travail (aujourd'hui : lecture seule + bouton
 * "Modifier" discret, l'historisation elle-même n'apparaît que plus bas dans
 * un tableau récap séparé — pas évident que ce soit un champ qui CHANGE dans
 * le temps tant qu'on n'a pas déjà fait défiler jusque-là).
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, Pencil, Plus } from "lucide-react";
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
import { formatDateAction, formatDateHeureAction, formatJours, moisEffet } from "@/lib/format";
import { useUtilisateurAdmin } from "@/hooks/useUtilisateurAdmin";
import { TypeBadge } from "@/components/demandes/TypeBadge";
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

interface LigneHistorique {
  key: string;
  texte: string;
}

/**
 * Historique d'UN champ (nature du contrat/durée de travail) reformaté en
 * une ligne de texte par période — "{valeur} depuis le {date}" pour la
 * période en cours (la plus récente), "{valeur} entre le {début} et le
 * {fin}" pour les précédentes, la plus récente en tête (02/09/2026, fusion
 * valeur actuelle + historique dans une seule card, demande explicite —
 * remplace l'ancien `construirePeriodes`/`TableauPeriodes`, qui séparaient
 * les deux dans des sections distinctes de la page). Bornes de période au
 * mois d'effet (`moisEffet`, même règle que le moteur de calcul de solde) —
 * les dates affichées sont donc toujours des 1ers de mois.
 */
function construireLignesHistorique(
  entreesChamp: HistoriqueUtilisateurEntry[],
  valeurActuelle: string,
  dateEntree: string,
  labelValeur: (v: string) => string,
): LigneHistorique[] {
  if (entreesChamp.length === 0) {
    return [
      {
        key: "initial",
        texte: `${labelValeur(valeurActuelle)} depuis le ${formatDateAction(dateEntree)}`,
      },
    ];
  }

  const trie = [...entreesChamp].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
  const moisEntree = dateEntree.slice(0, 7);
  const points = [
    { mois: moisEntree, valeur: trie[0].ancienneValeur ?? valeurActuelle },
    ...trie.map((e) => ({ mois: moisEffet(e.dateEffet), valeur: e.nouvelleValeur })),
  ];

  const lignes = points.map((p, i) => {
    const finExclusive = points[i + 1]?.mois ?? null;
    const debut = formatDateAction(`${p.mois}-01`);
    const texte = finExclusive
      ? `${labelValeur(p.valeur)} entre le ${debut} et le ${formatDateAction(`${moisPrecedent(finExclusive)}-01`)}`
      : `${labelValeur(p.valeur)} depuis le ${debut}`;
    return { key: `${p.mois}-${i}`, texte };
  });

  return [...lignes].reverse();
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

/** "Solde de départ" (02/09/2026, demande explicite) — le report initial
 * (CP/RTT/CPA saisi à la création, `soldeInitial`) n'a plus de "Modifier"
 * accessible depuis cette fiche (voir la note dans `Formulaire`) : affiché
 * ici en pure lecture, associé à l'entrée "Fiche créée par..." (la plus
 * ancienne de la liste, donc déjà en bas visuellement puisque trié du plus
 * récent au plus ancien) plutôt que mélangé aux entrées textuelles du
 * dessus — reprend les pastilles `TypeBadge` (mêmes codes couleur que
 * partout ailleurs pour CP/RTT/CPA) plutôt qu'une ligne de texte. */
function SuiviModifications({
  entrees,
  soldeInitial,
}: {
  entrees: EntreeSuivi[];
  soldeInitial: SoldeInitial | null;
}) {
  return (
    <div className="xl:sticky xl:top-4 xl:w-72 xl:shrink-0">
      <div className="bg-surface-card shadow-sm">
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
        {soldeInitial && (
          <div className="border-ink-300/60 flex flex-col gap-2 border-t px-4 py-3">
            <span className="text-ink-500 text-[10px]">
              Solde de départ au {formatDateAction(soldeInitial.dateReference)}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <TypeBadge code="CP" variant="pill" label={`${formatJours(soldeInitial.cp)} j`} />
              <TypeBadge code="RTT" variant="pill" label={`${formatJours(soldeInitial.rtt)} j`} />
              <TypeBadge code="CPA" variant="pill" label={`${formatJours(soldeInitial.cpa)} j`} />
            </div>
          </div>
        )}
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
          <FieldLabel variant="carte" htmlFor="modif-valeur">
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
                className="w-full rounded-md text-xs"
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
                  className="w-full rounded-md text-xs"
                />
              )}
            </>
          ) : (
            <Select
              id="modif-valeur"
              value={natureSelection}
              onChange={(e) => setNatureSelection(e.target.value as NatureContrat)}
              className="w-full rounded-md text-xs"
            >
              <option value="cdi">CDI</option>
              <option value="cdd">CDD</option>
              <option value="alternance">Alternance</option>
              <option value="stage">Stage</option>
            </Select>
          )}
        </div>

        <div>
          <FieldLabel variant="carte" htmlFor="modif-date-effet">
            Date d&rsquo;effet
          </FieldLabel>
          <Input
            id="modif-date-effet"
            type="date"
            value={dateEffet}
            onChange={(e) => setDateEffet(e.target.value)}
            className="w-full rounded-md text-xs"
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

/** `ModalModifierSoldeInitial` retirée (02/09/2026, "Soldes actuels" sorti du
 * flux principal en édition — voir la note près de son ancien emplacement
 * dans `Formulaire`). Le solde initial reste saisi une seule fois à la
 * création (voir plus bas, mode création uniquement) et affiché en lecture
 * seule dans "Suivi des modifications" — plus de correction depuis cette
 * fiche, les ajustements de solde vivent sur Suivre les soldes. */

interface ModalModifierIdentiteProps {
  prenom: string;
  nom: string;
  email: string;
  dateEntree: string;
  onValider: (valeurs: {
    prenom: string;
    nom: string;
    email: string;
    dateEntree: string;
  }) => Promise<void>;
  onClose: () => void;
}

/** Popin "Modifier l'identité" (02/09/2026, refonte fiche2) — même principe
 * que `ModalModifierChamp` (lecture seule + Modifier) mais sans date d'effet
 * ni historisation : ces champs ne sont pas tracés dans le temps (contrairement
 * à nature du contrat/durée de travail), une correction remplace juste la
 * valeur précédente via le `modifier` global de la fiche. Date d'entrée
 * intégrée ici (02/09/2026, demande explicite) plutôt que laissée en saisie
 * libre dans la card contrat — déjà affichée en lecture seule dans l'encart
 * "Entrée" de la card identité, la modifier depuis ce même endroit reste
 * cohérent avec le principe "lecture seule + Modifier" déjà appliqué
 * ailleurs sur la fiche. */
function ModalModifierIdentite({
  prenom,
  nom,
  email,
  dateEntree,
  onValider,
  onClose,
}: ModalModifierIdentiteProps) {
  const [prenomSaisi, setPrenomSaisi] = useState(prenom);
  const [nomSaisi, setNomSaisi] = useState(nom);
  const [emailSaisi, setEmailSaisi] = useState(email);
  const [dateEntreeSaisie, setDateEntreeSaisie] = useState(dateEntree);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prenomSaisi.trim() || !nomSaisi.trim() || !emailSaisi.trim() || !dateEntreeSaisie) {
      setErreur("Merci de compléter tous les champs.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await onValider({
        prenom: prenomSaisi.trim(),
        nom: nomSaisi.trim(),
        email: emailSaisi.trim(),
        dateEntree: dateEntreeSaisie,
      });
      onClose();
    } catch {
      setErreur("Impossible d'enregistrer ces modifications.");
      setEnvoi(false);
    }
  }

  return (
    <Modal title="Modifier l'identité" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <FieldLabel variant="carte" htmlFor="identite-nom">
            Nom
          </FieldLabel>
          <Input
            id="identite-nom"
            value={nomSaisi}
            onChange={(e) => setNomSaisi(e.target.value)}
            className="w-full rounded-md text-xs"
          />
        </div>
        <div>
          <FieldLabel variant="carte" htmlFor="identite-prenom">
            Prénom
          </FieldLabel>
          <Input
            id="identite-prenom"
            value={prenomSaisi}
            onChange={(e) => setPrenomSaisi(e.target.value)}
            className="w-full rounded-md text-xs"
          />
        </div>
        <div>
          <FieldLabel variant="carte" htmlFor="identite-email">
            Email
          </FieldLabel>
          <Input
            id="identite-email"
            type="email"
            value={emailSaisi}
            onChange={(e) => setEmailSaisi(e.target.value)}
            className="w-full rounded-md text-xs"
          />
        </div>
        <div>
          <FieldLabel variant="carte" htmlFor="identite-date-entree">
            Date d&rsquo;entrée
          </FieldLabel>
          <Input
            id="identite-date-entree"
            type="date"
            value={dateEntreeSaisie}
            onChange={(e) => setDateEntreeSaisie(e.target.value)}
            className="w-full rounded-md text-xs"
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

interface FormulaireProps {
  id?: string;
  initial: UtilisateurAdminInput;
  statut?: UtilisateurAdmin["statut"];
  dateArchivage?: string | null;
  historique: HistoriqueUtilisateurEntry[];
  soldeInitial: SoldeInitial | null;
  dateEntree: string;
  creer: (input: UtilisateurAdminInput, soldeInitial?: SoldeInitial) => Promise<UtilisateurAdmin>;
  modifier: (input: UtilisateurAdminInput) => Promise<UtilisateurAdmin>;
  archiver: () => Promise<void>;
  changerTauxActivite: (input: ChangerChampInput) => Promise<void>;
  changerNatureContrat: (input: ChangerChampInput) => Promise<void>;
  /** Colonne de droite (02/09/2026, demande explicite) — `null` en création
   * (pas de suivi tant que la fiche n'existe pas). Construit par
   * `UtilisateurFichePage2` (`construireSuivi`), affiché ici plutôt que par
   * l'appelant pour pouvoir le regrouper avec la card "Rôle" dans la même
   * colonne. */
  suiviEntrees: EntreeSuivi[] | null;
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
  dateArchivage,
  historique,
  soldeInitial,
  dateEntree,
  creer,
  modifier,
  archiver,
  changerTauxActivite,
  changerNatureContrat,
  suiviEntrees,
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
  const [modaleIdentiteOuverte, setModaleIdentiteOuverte] = useState(false);
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
        router.push(`/parametrer/utilisateurs2/${resultat.id}`);
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
        router.push(`/parametrer/utilisateurs2/${resultat.id}`);
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

  async function handleModifierIdentite(valeurs: {
    prenom: string;
    nom: string;
    email: string;
    dateEntree: string;
  }) {
    await modifier({ ...champs, ...valeurs });
    setChamps((c) => ({ ...c, ...valeurs }));
  }

  const historiqueTaux = historique.filter((h) => h.champ === "taux_activite");
  const historiqueNature = historique.filter((h) => h.champ === "nature_contrat");

  // Card "Rôle" (02/09/2026, demande explicite) — en création, reste dans le
  // flux principal du formulaire (pas de colonne de droite tant que la
  // fiche n'existe pas) ; en édition, déplacée dans la colonne de droite,
  // au-dessus de "Suivi des modifications" (voir le `return` plus bas).
  const carteRole = (
    <div className="bg-surface-card flex flex-col gap-5 p-5 shadow-sm">
      <div>
        <label htmlFor="role" className="text-abeil-navy text-sm font-bold">
          Rôle
        </label>
        <Select
          id="role"
          value={champs.role}
          onChange={(e) => setChamps({ ...champs, role: e.target.value as RoleUtilisateur })}
          className="mt-2 w-full rounded-md text-xs"
        >
          <option value="salarie">Salarié·e</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
    </div>
  );

  return (
    <>
      {/* Deux colonnes (02/09/2026, demande explicite) — la card "Rôle" et
          "Suivi des modifications" partagent la colonne de droite en
          édition ; en création, ni l'une ni l'autre n'existe encore côté
          droite (pas de suivi tant que la fiche n'existe pas, Rôle reste
          dans le flux principal), donc une seule colonne. */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex w-full flex-col gap-5 xl:max-w-2xl xl:min-w-0">
          {/* Séquencé en cards distinctes (02/09/2026, refonte UI de la fiche,
              demande explicite) — identité / contrat / rôle, plutôt qu'une seule
              card englobante (jusque-là "mise en cohérence DS" du 21/08/2026).
              Un seul `<form>` porte toujours l'ensemble (validation + soumission
              globales), les cards ne sont que des groupes visuels à l'intérieur.
              Coins carrés (02/09/2026, même refonte). */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Lien "Modifier" au-dessus de la card identité (02/09/2026, demande
            explicite) — sur le fond de page, plus sur la card elle-même ;
            intitulé avant le picto (inversé sur demande). Regroupé avec la
            card dans son propre conteneur `gap-[1px]` (au lieu du `gap-5`
            global du formulaire) pour ne coller QUE ce lien au bord de cette
            card précise. */}
            <div className={modeEdition ? "flex flex-col gap-[1px]" : ""}>
              {modeEdition && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setModaleIdentiteOuverte(true)}
                    className="text-ink-500 flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                  >
                    Modifier
                    <Pencil size={12} />
                  </button>
                </div>
              )}
              <div className="bg-surface-card flex flex-col gap-2 p-5 shadow-sm">
                {modeEdition ? (
                  /* Identité en lecture seule (02/09/2026, refonte fiche2, demande
               explicite) — même principe que Nature du contrat/Durée de
               travail : plus de champs texte toujours ouverts, une seule
               action "Modifier" qui ouvre la popin dédiée. Le nom reprend le
               style du H1 de page (même poids/taille) : c'est la même
               information, affichée une seule fois au lieu de deux
               (BackHeader + card). */
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-abeil-navy leading-tight font-semibold">
                        <span className="block text-2xl">{champs.nom}</span>
                        <span className="block text-xl">{champs.prenom}</span>
                      </span>
                      <span className="text-ink-500 text-base font-semibold">{champs.email}</span>
                    </div>
                    <div className="bg-mint-tint shrink-0 px-3 py-2 text-right">
                      <div className="text-ink-500 text-xs font-semibold">Entrée</div>
                      <div className="text-ink-900 text-base font-semibold">
                        {formatDateAction(champs.dateEntree)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    <div>
                      <FieldLabel variant="carte" htmlFor="nom">
                        Nom
                      </FieldLabel>
                      <Input
                        id="nom"
                        value={champs.nom}
                        onChange={(e) => setChamps({ ...champs, nom: e.target.value })}
                        className="w-full rounded-md text-xs"
                      />
                    </div>

                    <div>
                      <FieldLabel variant="carte" htmlFor="prenom">
                        Prénom
                      </FieldLabel>
                      <Input
                        id="prenom"
                        value={champs.prenom}
                        onChange={(e) => setChamps({ ...champs, prenom: e.target.value })}
                        className="w-full rounded-md text-xs"
                      />
                    </div>

                    <div>
                      <FieldLabel variant="carte" htmlFor="email">
                        Email
                      </FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        value={champs.email}
                        onChange={(e) => setChamps({ ...champs, email: e.target.value })}
                        className="w-full rounded-md text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bandeau statut (02/09/2026, demande explicite) — entre la
                card identité et les cards Nature du contrat/Durée de
                travail, pleine largeur de la colonne principale. */}
            {modeEdition && statut === "actif" && (
              <div className="bg-mint-tint text-slate px-3.5 py-2.5 text-sm font-semibold">
                Salarié·e de l&rsquo;effectif
              </div>
            )}
            {modeEdition && statut === "archive" && (
              <div className="bg-status-warning-bg text-status-warning-fg px-3.5 py-2.5 text-sm font-semibold">
                Salarié·e archivée
                {dateArchivage ? ` le ${formatDateAction(dateArchivage)}` : ""}
              </div>
            )}

            {/* Nature du contrat / Durée de travail : deux cards à 50% chacune
            (02/09/2026, refonte fiche2, demande explicite) — valeur actuelle
            ET historique fusionnés dans la MÊME card (au lieu du tableau
            récap séparé plus bas dans la page) pour rendre visible d'emblée
            le caractère historisé de ces deux champs. "+ Ajouter un
            événement" ouvre la même popin que l'ancien "Modifier"
            (`ModalModifierChamp`) — reformulé pour coller au principe
            "timeline". En création, pas d'historique à afficher : on garde
            les `<Select>` de saisie libre, comme avant. */}
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-surface-card flex flex-col gap-3 p-5 shadow-sm">
                <div className="text-abeil-navy text-sm font-bold">Nature du contrat</div>
                {modeEdition ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      {construireLignesHistorique(
                        historiqueNature,
                        champs.natureContrat,
                        dateEntree,
                        labelNatureContrat,
                      ).map((l) => (
                        <span key={l.key} className="text-ink-900 text-sm">
                          {l.texte}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setModaleOuverte("nature_contrat")}
                      className="text-ink-500 flex w-fit items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                    >
                      <Plus size={12} />
                      Ajouter un événement
                    </button>
                  </>
                ) : (
                  <Select
                    id="natureContrat"
                    value={champs.natureContrat}
                    onChange={(e) =>
                      setChamps({ ...champs, natureContrat: e.target.value as NatureContrat })
                    }
                    className="w-full rounded-md text-xs"
                  >
                    <option value="cdi">CDI</option>
                    <option value="cdd">CDD</option>
                    <option value="alternance">Alternance</option>
                    <option value="stage">Stage</option>
                  </Select>
                )}
              </div>

              <div className="bg-surface-card flex flex-col gap-3 p-5 shadow-sm">
                <div className="text-abeil-navy text-sm font-bold">Durée de travail</div>
                {modeEdition ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      {construireLignesHistorique(
                        historiqueTaux,
                        String(champs.tauxActivite),
                        dateEntree,
                        formatTauxLabel,
                      ).map((l) => (
                        <span key={l.key} className="text-ink-900 text-sm">
                          {l.texte}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setModaleOuverte("taux_activite")}
                      className="text-ink-500 flex w-fit items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                    >
                      <Plus size={12} />
                      Ajouter un événement
                    </button>
                  </>
                ) : (
                  <>
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
                      className="w-full rounded-md text-xs"
                    >
                      {PRESETS_DUREE.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                      <option value="autre">Autre</option>
                    </Select>
                    {dureeSelection === "autre" && (
                      <div>
                        <FieldLabel variant="carte" htmlFor="tauxAutre">
                          Pourcentage
                        </FieldLabel>
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
                          className="w-full rounded-md text-xs"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {!modeEdition && (
              /* Date d'entrée : saisie libre uniquement en création (02/09/2026,
                 demande explicite) — en édition, sa modification passe par la
                 popin "Modifier" de la card identité (déjà affichée en lecture
                 seule dans son encart "Entrée"), même principe que
                 nature/durée. "Date de référence ancienneté" retirée de la
                 fiche pour l'instant (02/09/2026, "pas un besoin Abeil
                 actuellement") — le champ existe toujours côté données
                 (`ancienneteDateReference`, utilisé par le calcul du bonus
                 d'ancienneté dans `soldes.repository.ts`, resterait piloté
                 par la date d'entrée par défaut), seule la saisie UI a été
                 retirée. */
              <div className="bg-surface-card flex flex-col gap-5 p-5 shadow-sm">
                <div>
                  <FieldLabel variant="carte" htmlFor="dateEntree">
                    Date d&rsquo;entrée
                  </FieldLabel>
                  <Input
                    id="dateEntree"
                    type="date"
                    value={champs.dateEntree}
                    onChange={(e) => setChamps({ ...champs, dateEntree: e.target.value })}
                    className="w-full rounded-md text-xs"
                  />
                </div>
              </div>
            )}

            {!modeEdition && carteRole}

            {!modeEdition && (
              /* Soldes actuels (21/08/2026, lancement en prod) — report de la
             dernière fiche de paie pour un salarié déjà en poste avant
             l'app : remplace le report/accrual automatique tant que la
             période en cours est celle de cette date de référence, voir
             `resolverReportCp`/`resolverPointDepartAccrual` dans
             `soldes.repository.ts`. Facultatif — si la date est laissée
             vide, aucun solde initial n'est créé (comportement inchangé). */
              <div className="bg-surface-card flex flex-col gap-3 p-5 shadow-sm">
                <FieldLabel variant="carte">
                  Soldes actuels{" "}
                  <span className="text-ink-500 font-normal">
                    (report de la dernière fiche de paie, facultatif)
                  </span>
                </FieldLabel>
                <div>
                  <FieldLabel variant="carte" htmlFor="soldeInitDate">
                    Mois de référence
                  </FieldLabel>
                  <Input
                    id="soldeInitDate"
                    type="month"
                    value={soldeInitDate.slice(0, 7)}
                    onChange={(e) => setSoldeInitDate(e.target.value ? `${e.target.value}-01` : "")}
                    className="w-full rounded-md text-xs"
                  />
                  {/* Sélecteur de mois, pas de jour (27/08/2026) — le moteur de
                  solde ne raisonne qu'en mois entiers. */}
                  <p className="text-ink-500 mt-1.5 text-xs">
                    Le solde saisi correspond au solde constaté à la fin du mois précédent. Par
                    exemple, choisir juillet 2026 revient à saisir le solde au 30 juin 2026.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <FieldLabel variant="carte" htmlFor="soldeInitCp">
                      CP
                    </FieldLabel>
                    <Input
                      id="soldeInitCp"
                      type="number"
                      step="0.5"
                      value={soldeInitCp}
                      onChange={(e) => setSoldeInitCp(e.target.value)}
                      className="w-full rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <FieldLabel variant="carte" htmlFor="soldeInitRtt">
                      RTT
                    </FieldLabel>
                    <Input
                      id="soldeInitRtt"
                      type="number"
                      step="0.5"
                      value={soldeInitRtt}
                      onChange={(e) => setSoldeInitRtt(e.target.value)}
                      className="w-full rounded-md text-xs"
                    />
                  </div>
                  <div>
                    <FieldLabel variant="carte" htmlFor="soldeInitCpa">
                      CPA
                    </FieldLabel>
                    <Input
                      id="soldeInitCpa"
                      type="number"
                      step="0.5"
                      value={soldeInitCpa}
                      onChange={(e) => setSoldeInitCpa(e.target.value)}
                      className="w-full rounded-md text-xs"
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

          {/* "Soldes actuels" retiré du flux principal en édition (02/09/2026,
              demande explicite, "élément éphémère... n'a pas grand-chose à
              faire ici") — un report ponctuel à la création, sans
              historisation propre (upsert, pas de date d'effet), pas un
              champ qu'on continue de corriger depuis cette fiche : les vrais
              ajustements de solde vivent désormais sur Suivre les soldes
              ("Ajuster le solde", avec historique et confirmation forte).
              Affiché à la place dans "Suivi des modifications" (colonne de
              droite), associé à l'entrée de création — voir
              `SuiviModifications`. */}

          {id && statut === "actif" && (
            <button
              type="button"
              onClick={() => setConfirmArchivage(true)}
              className="text-status-danger-fg flex items-center gap-1.5 self-start px-1 text-xs font-medium"
            >
              <Archive size={12} />
              Archiver ce profil
            </button>
          )}
        </div>

        {modeEdition && (
          <div className="flex w-full flex-col gap-4 xl:w-72 xl:shrink-0">
            {carteRole}
            {suiviEntrees && (
              <SuiviModifications entrees={suiviEntrees} soldeInitial={soldeInitial} />
            )}
          </div>
        )}
      </div>

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

      {modaleIdentiteOuverte && (
        <ModalModifierIdentite
          prenom={champs.prenom}
          nom={champs.nom}
          email={champs.email}
          dateEntree={champs.dateEntree}
          onValider={handleModifierIdentite}
          onClose={() => setModaleIdentiteOuverte(false)}
        />
      )}
    </>
  );
}

export function UtilisateurFichePage2({ id }: UtilisateurFichePageProps) {
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

      {/* Colonnes (Formulaire principal / Rôle + Suivi des modifications)
          désormais gérées par `Formulaire` lui-même (02/09/2026) — pour que
          la card "Rôle" puisse rejoindre "Suivi des modifications" dans la
          même colonne de droite en édition, il faut que le même composant
          possède les deux (`suiviEntrees` calculé ici et transmis). Bandeau
          statut ("Salarié·e de l'effectif"/"Salarié·e archivée") déplacé
          dans `Formulaire` (02/09/2026, demande explicite) — entre la card
          identité et les cards Nature du contrat/Durée de travail, plutôt
          qu'au-dessus de tout. */}
      <Formulaire
        key={id ?? "nouveau"}
        id={id}
        initial={initial}
        statut={utilisateur?.statut}
        dateArchivage={utilisateur?.dateArchivage}
        historique={historique}
        soldeInitial={soldeInitial}
        dateEntree={initial.dateEntree}
        creer={creer}
        modifier={modifier}
        archiver={archiver}
        changerTauxActivite={changerTauxActivite}
        changerNatureContrat={changerNatureContrat}
        suiviEntrees={id && utilisateur ? construireSuivi(utilisateur, historique) : null}
      />
    </div>
  );
}
