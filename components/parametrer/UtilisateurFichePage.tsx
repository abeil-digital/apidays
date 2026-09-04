"use client";

/**
 * Fiche utilisateur (Paramétrer > Utilisateurs). Refonte UI (02-04/09/2026,
 * demande explicite, voir Backlog) élaborée sur un brouillon dédié
 * (`UtilisateurFichePage2`/route `utilisateurs2`, même pattern que
 * `calendrier2` en son temps) puis basculée ici comme version par défaut
 * (04/09/2026) — l'ancienne implémentation et la route de brouillon ont été
 * supprimées.
 *
 * Principe central : rendre visible le caractère "historique" de Nature du
 * contrat/Durée de travail (valeur actuelle ET historique fusionnés dans la
 * même card, "+ Ajouter un événement"), plutôt qu'un tableau récap séparé
 * plus bas dans la page. Identité/rôle en lecture seule + "Modifier" ouvrant
 * une popin dédiée, chaque champ s'enregistrant individuellement dès sa
 * modification (pas de bouton "Enregistrer" global en édition, seulement en
 * création).
 */

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Pencil, Plus, X } from "lucide-react";
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
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { useReglesConges } from "@/hooks/useReglesConges";
import { fetchMoisMinimumChangementRH } from "@/lib/data/exportsPaie.repository";
import { TypeBadge } from "@/components/demandes/TypeBadge";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { SelectPille } from "@/components/ui/SelectPille";
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

const ROLE_LABEL: Record<RoleUtilisateur, string> = {
  salarie: "Collaborateur·rice",
  manager: "Manager",
  admin: "Admin",
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

const MOIS_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

/** Années proposées par le sélecteur "Date d'effet" (04/09/2026, demande
 * explicite) — bornée pour rester une liste courte plutôt qu'une saisie
 * libre, avec l'année en cours par défaut. */
function anneesSelectionnables(): number[] {
  const anneeCourante = new Date().getFullYear();
  const annees: number[] = [];
  for (let a = anneeCourante - 10; a <= anneeCourante + 1; a++) annees.push(a);
  return annees;
}

/** Dernier jour du mois PRÉCÉDENT celui donné ("YYYY-MM") — une période
 * historique finit la veille du mois d'effet de la période suivante, pas au
 * 1er de ce mois-là (04/09/2026, correction demandée : "Temps plein du
 * 01/01/2020 au 01/09/2026" laissait croire que le 80% ne commençait que le
 * 01/10, alors que le mois de septembre est entièrement couvert par
 * l'ancienne valeur — la date de fin affichée doit être le 30/09/2026). */
function dernierJourMoisPrecedent(anneeMoisIso: string): string {
  const d = new Date(`${anneeMoisIso}-01T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
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
 * période en cours (la plus récente), "{valeur} du {début} au {fin}" pour
 * les précédentes, la plus récente en tête (02/09/2026, fusion
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
  const pointsBruts = [
    { mois: moisEntree, valeur: trie[0].ancienneValeur ?? valeurActuelle },
    ...trie.map((e) => ({ mois: moisEffet(e.dateEffet), valeur: e.nouvelleValeur })),
  ];

  // Deux changements effectifs le même mois (ex. corrigé le lendemain) ne
  // laissent aucune période "en vigueur" pour la valeur intermédiaire — sans
  // ce filtre, `dernierJourMoisPrecedent` produit une date de fin ANTÉRIEURE
  // à la date de début ("du 01/09 au 31/08"). On ne garde que la dernière
  // valeur de chaque mois.
  const pointsSansDoublonDeMois = pointsBruts.filter((p, i) => pointsBruts[i + 1]?.mois !== p.mois);

  // Une correction ("Modifier" sur la période en cours) qui déplace juste la
  // date d'effet sans changer la valeur peut faire atterrir ce même point
  // dans un mois différent de celui d'entrée — sans fusion, ça recrée un
  // split absurde entre deux périodes de valeur IDENTIQUE (04/09/2026,
  // demande explicite : "corrige ça aussi"). On ne garde que le premier
  // point de chaque série de valeurs consécutives identiques, pour que la
  // période fusionnée démarre à la date la plus ancienne.
  const points = pointsSansDoublonDeMois.filter(
    (p, i) => i === 0 || pointsSansDoublonDeMois[i - 1].valeur !== p.valeur,
  );

  const lignes = points.map((p, i) => {
    const finExclusive = points[i + 1]?.mois ?? null;
    const debut = formatDateAction(`${p.mois}-01`);
    const texte = finExclusive
      ? `${labelValeur(p.valeur)} du ${debut} au ${formatDateAction(dernierJourMoisPrecedent(finExclusive))}`
      : `${labelValeur(p.valeur)} depuis le ${debut}`;
    return { key: `${p.mois}-${i}`, texte };
  });

  return [...lignes].reverse();
}

/** Dernière ligne d'historique d'un champ (celle de la période EN COURS),
 * `null` si la valeur actuelle n'a jamais changé depuis la date d'entrée —
 * sert à la fois à rappeler la date d'effet en vigueur et à cibler la ligne
 * à corriger en place plutôt qu'en ajouter une nouvelle (voir `corrigerChamp`
 * côté repository, 04/09/2026). */
function derniereEntreeHistorique(
  entreesChamp: HistoriqueUtilisateurEntry[],
): HistoriqueUtilisateurEntry | null {
  if (entreesChamp.length === 0) return null;
  return [...entreesChamp].sort((a, b) => b.dateEffet.localeCompare(a.dateEffet))[0];
}

/** Date d'effet de la valeur EN COURS d'un champ historisé — le dernier
 * changement s'il y en a, sinon la date d'entrée. Sert à préremplir la date
 * dans `ModalModifierChamp` en mode correction (04/09/2026, demande
 * explicite). */
function dateEffetActuelle(entreesChamp: HistoriqueUtilisateurEntry[], dateEntree: string): string {
  const derniere = derniereEntreeHistorique(entreesChamp);
  return derniere ? `${moisEffet(derniere.dateEffet)}-01` : dateEntree;
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
      <div className="bg-surface-card">
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
                {/* Solde de départ rattaché à l'entrée "Fiche créée par..."
                (04/09/2026, demande explicite) — c'est le même événement
                (la fiche est créée AVEC ce report initial), pas deux faits
                distincts affichés séparément comme avant. */}
                {e.id === "creation" && soldeInitial && (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <span className="text-ink-500 text-[10px]">
                      avec les soldes au {formatDateAction(soldeInitial.dateReference)}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <TypeBadge
                        code="CP"
                        variant="pill"
                        label={`${formatJours(soldeInitial.cp)} j`}
                      />
                      <TypeBadge
                        code="RTT"
                        variant="pill"
                        label={`${formatJours(soldeInitial.rtt)} j`}
                      />
                      <TypeBadge
                        code="CPA"
                        variant="pill"
                        label={`${formatJours(soldeInitial.cpa)} j`}
                      />
                    </div>
                  </div>
                )}
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
  /** "corriger" (pill de la période en cours, "Modifier") ne crée pas de
   * nouvelle ligne d'historique — juste le libellé du titre change ici, le
   * choix entre corriger/insérer se fait côté appelant via `onValider`
   * (04/09/2026, demande explicite : "c'est juste de la gestion de
   * l'erreur... tu ne créés pas d'historique"). */
  mode: "corriger" | "ajouter";
  /** `false` uniquement en mode "corriger" quand il n'existe encore aucune
   * ligne d'historique pour ce champ (la valeur actuelle s'applique depuis
   * la date d'entrée, jamais changée depuis) — `corrigerChamp` n'a alors
   * aucune ligne à mettre à jour et ignore silencieusement la date saisie
   * (04/09/2026, bug remonté : "je viens de modifier la date, rien n'est
   * pris en compte"). Le champ date est masqué dans ce cas plutôt que de
   * laisser une saisie qui ne sert à rien. */
  dateModifiable: boolean;
  valeurActuelle: string;
  dateEffetActuelle: string;
  /** Taux d'acquisition mensuel (jours/mois à 100%) de CP et RTT — sert
   * uniquement pour `champ === "taux_activite"`, à afficher un rappel
   * chiffré de l'impact sur l'acquisition avant/après (04/09/2026, demande
   * explicite : "calculer les impacts d'un changement de durée"). `undefined`
   * tant que `useReglesConges` n'a pas fini de charger — le rappel est alors
   * simplement absent plutôt que d'afficher un calcul à moitié fait. */
  tauxAcquisitionCP?: number;
  tauxAcquisitionRTT?: number;
  /** Premier mois ("YYYY-MM") où un changement peut encore être défini — les
   * mois antérieurs sont déjà transmis en paie (04/09/2026, règle explicite :
   * "Delphine ne peut pas définir de changement au-delà des mois passés en
   * paie"). `null` = aucune restriction (rien encore transmis, ou chargement
   * en cours). */
  moisMinimum: string | null;
  onValider: (input: ChangerChampInput) => Promise<void>;
  onClose: () => void;
}

/** En-tête bleu marine commun à toutes les popins de la fiche utilisateur
 * (05/09/2026, demande explicite : "toutes popin de modifications iso...
 * avec la popin création") — remplace le `title` par défaut de `Modal`
 * (barre blanche, texte noir, croix grise) sur `ModalModifierChamp`/
 * `ModalModifierIdentite`/`ModalModifierRole`/`ModalFinContrat`, pour
 * qu'elles soient visuellement identiques à `NouveauUtilisateurModal`. */
function EnTeteModalNavy({ titre, onClose }: { titre: string; onClose: () => void }) {
  return (
    <div className="bg-abeil-navy flex items-center justify-between px-6 py-4">
      <h2 className="text-lg font-semibold text-white">{titre}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="shrink-0 text-white/70 hover:text-white"
      >
        <X size={18} />
      </button>
    </div>
  );
}

/** Popin "Modifier"/"Ajouter un événement" pour Durée de travail/Nature du
 * contrat (21/08/2026, scindée en deux modes le 04/09/2026) — même popin
 * paramétrée par `champ` : sur une fiche existante, ces deux champs ne se
 * changent plus via un menu déroulant libre mais via cette action + une date
 * d'effet, pour ne pas fausser rétroactivement le calcul du solde en cours
 * (voir `resolverTauxActiviteEffectif`). */
function ModalModifierChamp({
  champ,
  mode,
  dateModifiable,
  valeurActuelle,
  dateEffetActuelle: dateActuelleValeur,
  tauxAcquisitionCP,
  tauxAcquisitionRTT,
  moisMinimum,
  onValider,
  onClose,
}: ModalModifierChampProps) {
  const estTaux = champ === "taux_activite";
  // En "ajouter", la valeur actuelle est désactivée dans le sélecteur (un
  // événement CDI→CDI n'a pas de sens, c'est "Corriger" qu'il faut utiliser
  // — 04/09/2026, demande explicite) : la sélection ne peut donc pas
  // démarrer dessus, sous peine d'afficher une option grisée déjà "choisie".
  const [dureeSelection, setDureeSelection] = useState(() => {
    if (!estTaux) return "";
    const preset = presetPourTaux(Number(valeurActuelle));
    if (mode !== "ajouter") return preset;
    return PRESETS_DUREE.find((p) => p.value !== valeurActuelle)?.value ?? preset;
  });
  const [tauxAutre, setTauxAutre] = useState(() =>
    estTaux && presetPourTaux(Number(valeurActuelle)) === "autre" && mode !== "ajouter"
      ? valeurActuelle
      : "",
  );
  const [natureSelection, setNatureSelection] = useState<NatureContrat>(() => {
    if (estTaux) return "cdi";
    if (mode !== "ajouter") return valeurActuelle as NatureContrat;
    return (
      (["cdi", "cdd", "alternance", "stage"] as const).find((v) => v !== valeurActuelle) ?? "cdi"
    );
  });
  // Sélecteur mois + année plutôt qu'un `<input type="date">` (04/09/2026,
  // demande explicite) — une date d'effet est de toute façon toujours
  // arrondie au 1er du mois en aval (`moisEffet`), un sélecteur jour/mois/
  // année laissait croire à tort qu'un jour précis avait un sens. En
  // "ajouter", défaut au mois/année en cours ; en "corriger", défaut à la
  // date d'effet actuelle pour ne pas la déplacer sans y toucher.
  const [moisSelection, setMoisSelection] = useState(() =>
    mode === "ajouter" ? new Date().getMonth() + 1 : Number(dateActuelleValeur.slice(5, 7)),
  );
  const [anneeSelection, setAnneeSelection] = useState(() =>
    mode === "ajouter" ? new Date().getFullYear() : Number(dateActuelleValeur.slice(0, 4)),
  );
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const valeur = estTaux
    ? dureeSelection === "autre"
      ? tauxAutre
      : dureeSelection
    : natureSelection;
  const dateEffet = `${anneeSelection}-${String(moisSelection).padStart(2, "0")}-01`;

  // Rappel d'impact CP/RTT (04/09/2026, demande explicite) — uniquement pour
  // "Durée de travail", et seulement une fois une nouvelle valeur numérique
  // valide saisie (pas tant que "Autre" est vide, pas pour Nature du
  // contrat qui n'entre dans aucun calcul de solde).
  const tauxNouveau = estTaux ? Number(valeur) : null;
  const tauxActuel = estTaux ? Number(valeurActuelle) : null;
  const impactAcquisition =
    estTaux && tauxNouveau !== null && !Number.isNaN(tauxNouveau) && tauxNouveau !== tauxActuel
      ? [
          tauxAcquisitionCP !== undefined && {
            label: "CP",
            avant: (tauxAcquisitionCP * (tauxActuel ?? 0)) / 100,
            apres: (tauxAcquisitionCP * tauxNouveau) / 100,
          },
          tauxAcquisitionRTT !== undefined && {
            label: "RTT",
            avant: (tauxAcquisitionRTT * (tauxActuel ?? 0)) / 100,
            apres: (tauxAcquisitionRTT * tauxNouveau) / 100,
          },
        ].filter((x): x is { label: string; avant: number; apres: number } => Boolean(x))
      : [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valeur) {
      setErreur("Merci de compléter tous les champs.");
      return;
    }
    // Garde-fou redondant avec les options désactivées du sélecteur mois/
    // année ci-dessous — au cas où l'état initial (pré-rempli avant la fin
    // du chargement de `moisMinimum`) se retrouverait sur un mois déjà
    // transmis.
    if (
      dateModifiable &&
      moisMinimum &&
      `${anneeSelection}-${String(moisSelection).padStart(2, "0")}` < moisMinimum
    ) {
      setErreur("Ce mois est déjà transmis en paie, tu ne peux pas y définir de changement.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await onValider({
        valeur: String(valeur),
        dateEffet: dateModifiable ? dateEffet : dateActuelleValeur,
      });
      onClose();
    } catch {
      setErreur("Impossible d'enregistrer ce changement.");
      setEnvoi(false);
    }
  }

  const titre =
    mode === "corriger"
      ? estTaux
        ? "Corriger la durée de travail"
        : "Corriger la nature du contrat"
      : "Ajouter un événement";

  return (
    <Modal onClose={onClose} header={<EnTeteModalNavy titre={titre} onClose={onClose} />}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="modif-valeur" className="text-abeil-navy mb-1.5 block text-sm font-bold">
            {estTaux ? "Durée de travail" : "Nature du contrat"}
          </label>
          {estTaux ? (
            <>
              <SelectPille
                id="modif-valeur"
                value={dureeSelection}
                onChange={(e) => {
                  const v = e.target.value;
                  setDureeSelection(v);
                  if (v === "autre") setTauxAutre(valeurActuelle);
                }}
                borderClassName="border-slate"
                chevronClassName="text-abeil-navy"
                hoverClassName="enabled:hover:bg-surface-app"
                className="w-fit !py-2.5 !pr-8 !pl-3 !text-sm"
              >
                {PRESETS_DUREE.map((preset) => (
                  <option
                    key={preset.value}
                    value={preset.value}
                    disabled={mode === "ajouter" && preset.value === valeurActuelle}
                  >
                    {preset.label}
                  </option>
                ))}
                <option value="autre">Autre</option>
              </SelectPille>
              {dureeSelection === "autre" && (
                <Input
                  type="number"
                  min={1}
                  max={100}
                  step="0.01"
                  value={tauxAutre}
                  onChange={(e) => setTauxAutre(e.target.value)}
                  className="!border-slate mt-2 w-24 rounded-md text-xs"
                />
              )}
            </>
          ) : (
            <SelectPille
              id="modif-valeur"
              value={natureSelection}
              onChange={(e) => setNatureSelection(e.target.value as NatureContrat)}
              borderClassName="border-slate"
              chevronClassName="text-abeil-navy"
              hoverClassName="enabled:hover:bg-surface-app"
              className="w-fit !py-2.5 !pr-8 !pl-3 !text-sm"
            >
              {(["cdi", "cdd", "alternance", "stage"] as const).map((v) => (
                <option key={v} value={v} disabled={mode === "ajouter" && v === valeurActuelle}>
                  {NATURE_CONTRAT_LABEL[v]}
                </option>
              ))}
            </SelectPille>
          )}
        </div>

        {dateModifiable ? (
          <div>
            <label
              htmlFor="modif-date-effet-mois"
              className="text-abeil-navy mb-1.5 block text-sm font-bold"
            >
              Date d&rsquo;effet
            </label>
            <p className="text-abeil-navy mb-1.5 text-xs font-semibold">Au début de</p>
            <div className="flex gap-2">
              <SelectPille
                id="modif-date-effet-mois"
                value={moisSelection}
                onChange={(e) => setMoisSelection(Number(e.target.value))}
                borderClassName="border-slate"
                chevronClassName="text-abeil-navy"
                hoverClassName="enabled:hover:bg-surface-app"
                className="w-fit !py-2.5 !pr-8 !pl-3 !text-sm"
              >
                {MOIS_LABELS.map((label, i) => (
                  <option
                    key={label}
                    value={i + 1}
                    disabled={
                      moisMinimum !== null &&
                      `${anneeSelection}-${String(i + 1).padStart(2, "0")}` < moisMinimum
                    }
                  >
                    {label}
                  </option>
                ))}
              </SelectPille>
              <SelectPille
                id="modif-date-effet-annee"
                value={anneeSelection}
                onChange={(e) => setAnneeSelection(Number(e.target.value))}
                borderClassName="border-slate"
                chevronClassName="text-abeil-navy"
                hoverClassName="enabled:hover:bg-surface-app"
                className="w-fit !py-2.5 !pr-8 !pl-3 !text-sm"
              >
                {anneesSelectionnables().map((annee) => (
                  <option
                    key={annee}
                    value={annee}
                    disabled={moisMinimum !== null && `${annee}-12` < moisMinimum}
                  >
                    {annee}
                  </option>
                ))}
              </SelectPille>
            </div>
          </div>
        ) : (
          <p className="text-ink-500 text-xs">
            Cette valeur s&rsquo;applique depuis la date d&rsquo;entrée (
            {formatDateAction(dateActuelleValeur)}). Pour corriger cette date, modifie-la depuis la
            fiche identité.
          </p>
        )}

        {impactAcquisition.length > 0 && (
          <div className="bg-mint-tint text-slate flex flex-col gap-1 px-3.5 py-2.5 text-xs">
            <span className="font-semibold">Impact sur l&rsquo;acquisition mensuelle :</span>
            {impactAcquisition.map((i) => (
              <span key={i.label}>
                {i.label} : {formatJours(i.avant)} j/mois → {formatJours(i.apres)} j/mois
              </span>
            ))}
          </div>
        )}

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
    <Modal
      onClose={onClose}
      header={<EnTeteModalNavy titre="Modifier l'identité" onClose={onClose} />}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="identite-nom" className="text-abeil-navy mb-1.5 block text-sm font-bold">
            Nom
          </label>
          <Input
            id="identite-nom"
            value={nomSaisi}
            onChange={(e) => setNomSaisi(e.target.value)}
            className="!border-slate w-full rounded-md text-xs"
          />
        </div>
        <div>
          <label
            htmlFor="identite-prenom"
            className="text-abeil-navy mb-1.5 block text-sm font-bold"
          >
            Prénom
          </label>
          <Input
            id="identite-prenom"
            value={prenomSaisi}
            onChange={(e) => setPrenomSaisi(e.target.value)}
            className="!border-slate w-full rounded-md text-xs"
          />
        </div>
        <div>
          <label
            htmlFor="identite-email"
            className="text-abeil-navy mb-1.5 block text-sm font-bold"
          >
            Email
          </label>
          <Input
            id="identite-email"
            type="email"
            value={emailSaisi}
            onChange={(e) => setEmailSaisi(e.target.value)}
            className="!border-slate w-full max-w-72 rounded-md text-xs"
          />
        </div>
        <div>
          <label
            htmlFor="identite-date-entree"
            className="text-abeil-navy mb-1.5 block text-sm font-bold"
          >
            Date d&rsquo;entrée
          </label>
          <Input
            id="identite-date-entree"
            type="date"
            value={dateEntreeSaisie}
            onChange={(e) => setDateEntreeSaisie(e.target.value)}
            className="!border-slate w-40 rounded-md text-xs"
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

interface ModalModifierRoleProps {
  role: RoleUtilisateur;
  dernierAdmin: boolean;
  onValider: (role: RoleUtilisateur) => Promise<void>;
  onClose: () => void;
}

/** Popin "Modifier le rôle" (04/09/2026, demande explicite) — même principe
 * que `ModalModifierIdentite` : pas d'historisation, une correction remplace
 * juste la valeur précédente via le `modifier` global de la fiche.
 *
 * `dernierAdmin` (04/09/2026, demande explicite : "il doit toujours avoir un
 * administrateur") bloque le passage à un rôle non-admin quand ce profil est
 * le seul admin actif restant — option désactivée dans le `<Select>` et
 * garde-fou redondant à la soumission. */
function ModalModifierRole({ role, dernierAdmin, onValider, onClose }: ModalModifierRoleProps) {
  const [roleSaisi, setRoleSaisi] = useState(role);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (dernierAdmin && roleSaisi !== "admin") {
      setErreur("Il doit toujours y avoir au moins un administrateur.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await onValider(roleSaisi);
      onClose();
    } catch {
      setErreur("Impossible d'enregistrer cette modification.");
      setEnvoi(false);
    }
  }

  return (
    <Modal
      onClose={onClose}
      header={<EnTeteModalNavy titre="Modifier le rôle" onClose={onClose} />}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="role-modif" className="text-abeil-navy mb-1.5 block text-sm font-bold">
            Rôle
          </label>
          <SelectPille
            id="role-modif"
            value={roleSaisi}
            onChange={(e) => setRoleSaisi(e.target.value as RoleUtilisateur)}
            borderClassName="border-slate"
            chevronClassName="text-abeil-navy"
            hoverClassName="enabled:hover:bg-surface-app"
            className="w-fit !py-2.5 !pr-8 !pl-3 !text-sm"
          >
            <option value="salarie" disabled={dernierAdmin}>
              Collaborateur·rice
            </option>
            <option value="manager" disabled={dernierAdmin}>
              Manager
            </option>
            <option value="admin">Admin</option>
          </SelectPille>
          {dernierAdmin && (
            <p className="text-ink-500 mt-1.5 text-[11px]">
              Il doit toujours y avoir au moins un administrateur.
            </p>
          )}
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

interface ModalFinContratProps {
  /** "Il doit toujours y avoir un administrateur" (04/09/2026, demande
   * explicite : même garde-fou que `ModalModifierRole`, une fin de contrat
   * archive au même titre qu'une rétrogradation) — garde-fou redondant avec
   * le bouton déjà désactivé côté carte, au cas où la popin s'ouvrirait
   * quand même sur un état obsolète. */
  dernierAdmin: boolean;
  onValider: (date: string) => Promise<void>;
  onClose: () => void;
}

/** Popin "Fin de contrat" (04/09/2026, demande explicite — offboarding
 * réduit à 3 effets concrets : archivage, gel de l'acquisition de congés,
 * blocage de connexion, tous appliqués à la date choisie, voir
 * `definirFinContrat` côté repository/`proxy.ts` pour le blocage). Pas de
 * validation de date minimale ici — une date passée est volontairement
 * acceptée (applique les 3 effets immédiatement, voir
 * `definirFinContrat`). */
function ModalFinContrat({ dernierAdmin, onValider, onClose }: ModalFinContratProps) {
  const [date, setDate] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (dernierAdmin) {
      setErreur("Il doit toujours y avoir au moins un administrateur.");
      return;
    }
    if (!date) {
      setErreur("Merci de choisir une date.");
      return;
    }
    setErreur("");
    setEnvoi(true);
    try {
      await onValider(date);
    } catch {
      setErreur("Impossible d'enregistrer cette fin de contrat.");
      setEnvoi(false);
    }
  }

  return (
    <Modal onClose={onClose} header={<EnTeteModalNavy titre="Fin de contrat" onClose={onClose} />}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="fin-contrat-date"
            className="text-abeil-navy mb-1.5 block text-sm font-bold"
          >
            Date de fin de contrat
          </label>
          <Input
            id="fin-contrat-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="!border-slate w-40 rounded-md text-xs"
          />
        </div>

        <p className="text-status-danger-fg text-xs">
          Ce compte sera archivé, l&rsquo;acquisition des congés gelée et le collaborateur
          n&rsquo;aura plus accès à Apidays à cette date.
        </p>

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
  dateFinContrat?: string | null;
  historique: HistoriqueUtilisateurEntry[];
  soldeInitial: SoldeInitial | null;
  dateEntree: string;
  creer: (
    input: UtilisateurAdminInput,
    soldeInitial?: SoldeInitial,
    dateFinContrat?: string,
  ) => Promise<UtilisateurAdmin>;
  modifier: (input: UtilisateurAdminInput) => Promise<UtilisateurAdmin>;
  /** Fourni uniquement quand `Formulaire` tourne en popin (04/09/2026,
   * "Créer un profil" sur la page Utilisateurs) — remplace la navigation par
   * défaut vers la fiche du profil créé (`router.push`) par la fermeture de
   * la popin + rafraîchissement de la liste, `onCreated` reçoit le profil
   * créé pour ça. `undefined` = comportement page inchangé. */
  onCreated?: (utilisateur: UtilisateurAdmin) => void;
  definirFinContrat: (date: string) => Promise<void>;
  annulerFinContrat: () => Promise<void>;
  changerTauxActivite: (input: ChangerChampInput) => Promise<void>;
  changerNatureContrat: (input: ChangerChampInput) => Promise<void>;
  corrigerTauxActivite: (
    dernierHistoriqueId: string | null,
    input: ChangerChampInput,
  ) => Promise<void>;
  corrigerNatureContrat: (
    dernierHistoriqueId: string | null,
    input: ChangerChampInput,
  ) => Promise<void>;
  /** Colonne de droite (02/09/2026, demande explicite) — `null` en création
   * (pas de suivi tant que la fiche n'existe pas). Construit par
   * `UtilisateurFichePage` (`construireSuivi`), affiché ici plutôt que par
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
  dateFinContrat,
  historique,
  soldeInitial,
  dateEntree,
  creer,
  modifier,
  definirFinContrat,
  annulerFinContrat,
  changerTauxActivite,
  changerNatureContrat,
  corrigerTauxActivite,
  corrigerNatureContrat,
  suiviEntrees,
  onCreated,
}: FormulaireProps) {
  const router = useRouter();
  const [champs, setChamps] = useState<UtilisateurAdminInput>(initial);
  const [dureeSelection, setDureeSelection] = useState(() => presetPourTaux(initial.tauxActivite));
  const [tauxAutre, setTauxAutre] = useState(() =>
    presetPourTaux(initial.tauxActivite) === "autre" ? String(initial.tauxActivite) : "",
  );
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [modaleFinContratOuverte, setModaleFinContratOuverte] = useState(false);
  const [modaleOuverte, setModaleOuverte] = useState<{
    champ: ChampHistoriqueUtilisateur;
    mode: "corriger" | "ajouter";
  } | null>(null);
  const [modaleIdentiteOuverte, setModaleIdentiteOuverte] = useState(false);
  const [modaleRoleOuverte, setModaleRoleOuverte] = useState(false);
  const [soldeInitDate, setSoldeInitDate] = useState("");
  const [soldeInitCp, setSoldeInitCp] = useState("0");
  const [soldeInitRtt, setSoldeInitRtt] = useState("0");
  const [soldeInitCpa, setSoldeInitCpa] = useState("0");
  // Date de sortie CDD (04/09/2026, demande explicite) — création uniquement,
  // affichée seulement quand "Nature du contrat" = CDD. Écrite directement
  // dans `date_fin_contrat` à la création (voir `creerUtilisateurAdmin`).
  const [dateSortieCdd, setDateSortieCdd] = useState("");

  const modeEdition = Boolean(id);

  // "Il doit toujours avoir un administrateur" (04/09/2026, demande
  // explicite) — compte les admins actifs pour bloquer le changement de
  // rôle sur le dernier restant (`ModalModifierRole`) et interdire
  // l'archivage d'un profil admin (l'archivage retirant de fait ce profil
  // de la liste des admins actifs).
  const { utilisateurs: tousUtilisateurs } = useUtilisateursAdmin();
  const nombreAdminsActifs = tousUtilisateurs.filter(
    (u) => u.role === "admin" && u.statut === "actif",
  ).length;
  const estAdmin = champs.role === "admin";
  const dernierAdmin = estAdmin && statut === "actif" && nombreAdminsActifs <= 1;

  // Rappel d'impact sur l'acquisition CP/RTT dans la popin "Durée de
  // travail" (04/09/2026, demande explicite) — voir `ModalModifierChamp`.
  const { reglesAcquisition } = useReglesConges();
  const tauxAcquisitionCP = reglesAcquisition.find(
    (r) => r.typeAbsence === "CP",
  )?.tauxAcquisitionMensuel;
  const tauxAcquisitionRTT = reglesAcquisition.find(
    (r) => r.typeAbsence === "RTT",
  )?.tauxAcquisitionMensuel;

  // "Delphine ne peut pas définir de changement au-delà des mois passés en
  // paie" (04/09/2026, règle explicite) — un mois déjà transmis a déjà
  // généré des fiches de paie, y toucher rétroactivement fausserait un
  // calcul déjà figé. `null` tant qu'aucune transmission n'a encore eu lieu
  // (aucune restriction) ou pendant le chargement.
  const [moisMinimumChangement, setMoisMinimumChangement] = useState<string | null>(null);
  useEffect(() => {
    fetchMoisMinimumChangementRH()
      .then(setMoisMinimumChangement)
      .catch(() => setMoisMinimumChangement(null));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!champs.prenom || !champs.nom || !champs.email || !champs.dateEntree) {
      setErreur("Merci de compléter tous les champs obligatoires.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(champs.email)) {
      setErreur("Merci de saisir une adresse email valide.");
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
        const resultat = await creer(
          champs,
          soldeInitialInput,
          champs.natureContrat === "cdd" && dateSortieCdd ? dateSortieCdd : undefined,
        );
        if (onCreated) {
          onCreated(resultat);
        } else {
          router.push(`/parametrer/utilisateurs/${resultat.id}`);
        }
      }
    } catch {
      setErreur(
        id ? "Impossible d'enregistrer les modifications." : "Impossible de créer ce profil.",
      );
    } finally {
      setEnvoi(false);
    }
  }

  async function handleDefinirFinContrat(date: string) {
    await definirFinContrat(date);
    setModaleFinContratOuverte(false);
  }

  async function handleAnnulerFinContrat() {
    try {
      await annulerFinContrat();
    } catch {
      setErreur("Impossible d'annuler cette fin de contrat.");
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

  async function handleModifierRole(role: RoleUtilisateur) {
    await modifier({ ...champs, role });
    setChamps((c) => ({ ...c, role }));
  }

  const historiqueTaux = historique.filter((h) => h.champ === "taux_activite");
  const historiqueNature = historique.filter((h) => h.champ === "nature_contrat");

  async function handleCorrigerTaux(input: ChangerChampInput) {
    await corrigerTauxActivite(derniereEntreeHistorique(historiqueTaux)?.id ?? null, input);
    setChamps((c) => ({ ...c, tauxActivite: Number(input.valeur) }));
  }

  async function handleCorrigerNature(input: ChangerChampInput) {
    await corrigerNatureContrat(derniereEntreeHistorique(historiqueNature)?.id ?? null, input);
    setChamps((c) => ({ ...c, natureContrat: input.valeur as NatureContrat }));
  }

  // Card "Rôle" (02/09/2026, demande explicite) — en création, reste dans le
  // flux principal du formulaire (pas de colonne de droite tant que la
  // fiche n'existe pas) ; en édition, déplacée dans la colonne de droite,
  // au-dessus de "Suivi des modifications" (voir le `return` plus bas). En
  // édition, plus de titre ni de sélecteur (demande explicite) — juste la
  // valeur affichée par défaut sur sa card ; en création, le `<Select>` de
  // saisie reste nécessaire (il faut bien choisir un rôle pour créer le
  // profil).
  const carteRole = modeEdition ? (
    <div className="bg-mint-tint flex items-center justify-between px-5 py-2.5">
      <span className="text-slate text-sm font-bold">{ROLE_LABEL[champs.role]}</span>
      <button
        type="button"
        onClick={() => setModaleRoleOuverte(true)}
        className="text-slate/70 hover:text-slate flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
      >
        Modifier
        <Pencil size={12} />
      </button>
    </div>
  ) : (
    <div className="bg-surface-card border-ink-300/60 flex flex-col gap-3 border p-5">
      <label htmlFor="role" className="text-abeil-navy text-sm font-bold">
        Rôle
      </label>
      {/* Select en pilule (04/09/2026, demande explicite : "prends les
      selects pill" en référence à `PoserDemandeModal`) — pas de couleur par
      valeur ici, contrairement aux types de congés qui ont un code couleur
      dédié (`TypeBadge`) : Rôle/Nature du contrat n'ont pas d'équivalent,
      teinte neutre navy. `inline-block` (comportement natif du composant) au
      lieu de `w-full` — un rôle n'a pas besoin de toute la largeur de la
      card ("arrête de faire des champs qui prennent toute la largeur"). */}
      <SelectPille
        id="role"
        value={champs.role}
        onChange={(e) => setChamps({ ...champs, role: e.target.value as RoleUtilisateur })}
        borderClassName="border-slate"
        chevronClassName="text-abeil-navy"
        hoverClassName="enabled:hover:bg-surface-app"
        className="w-fit !py-2.5 !pr-8 !pl-3 !text-sm"
      >
        <option value="salarie">Collaborateur·rice</option>
        <option value="manager">Manager</option>
        <option value="admin">Admin</option>
      </SelectPille>
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
          <form onSubmit={handleSubmit} className="flex flex-col gap-[5px]">
            <div className={modeEdition ? "flex flex-col gap-0" : ""}>
              <div className="bg-surface-card border-ink-300/60 relative flex flex-col gap-2 border p-5">
                {/* Lien "Modifier" dans le coin haut droit de la card identité
                (04/09/2026, demande explicite — auparavant au-dessus de la
                card, sur le fond de page) ; intitulé avant le picto. */}
                {modeEdition && (
                  <button
                    type="button"
                    onClick={() => setModaleIdentiteOuverte(true)}
                    className="text-ink-500 absolute top-5 right-5 flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                  >
                    Modifier
                    <Pencil size={12} />
                  </button>
                )}
                {modeEdition ? (
                  /* Identité en lecture seule (02/09/2026, refonte fiche2, demande
               explicite) — même principe que Nature du contrat/Durée de
               travail : plus de champs texte toujours ouverts, une seule
               action "Modifier" qui ouvre la popin dédiée. Le nom reprend le
               style du H1 de page (même poids/taille) : c'est la même
               information, affichée une seule fois au lieu de deux
               (BackHeader + card). */
                  <div className="flex flex-col gap-1">
                    <span className="text-abeil-navy leading-tight font-semibold">
                      <span className="block text-2xl">{champs.nom}</span>
                      <span className="block text-xl">{champs.prenom}</span>
                    </span>
                    <span className="text-ink-500 text-base font-semibold">{champs.email}</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {/* Nom/Prénom côte à côte (04/09/2026, demande explicite
                    "réduire la largeur des champs en fonction de leur type")
                    — deux champs texte courts, pas besoin chacun de toute la
                    largeur de la card ; Email reste seul en pleine largeur,
                    plus variable en longueur. */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="nom"
                          className="text-abeil-navy mb-1.5 block text-sm font-bold"
                        >
                          Nom
                        </label>
                        <Input
                          id="nom"
                          value={champs.nom}
                          onChange={(e) => setChamps({ ...champs, nom: e.target.value })}
                          className="!border-slate w-full rounded-md text-xs"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="prenom"
                          className="text-abeil-navy mb-1.5 block text-sm font-bold"
                        >
                          Prénom
                        </label>
                        <Input
                          id="prenom"
                          value={champs.prenom}
                          onChange={(e) => setChamps({ ...champs, prenom: e.target.value })}
                          className="!border-slate w-full rounded-md text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="text-abeil-navy mb-1.5 block text-sm font-bold"
                      >
                        Email
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={champs.email}
                        onChange={(e) => setChamps({ ...champs, email: e.target.value })}
                        className="!border-slate w-full max-w-72 rounded-md text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bandeau statut (02/09/2026, demande explicite ; collé à la
                  card identité, 0 espace, 04/09/2026) — juste sous la card
                  identité, regroupé avec elle dans le même conteneur
                  `gap-0` pour ne laisser aucun espace entre les deux. */}
              {/* Bouton "Archiver" retiré (04/09/2026, demande explicite) —
                  l'archivage passe désormais uniquement par "Fin de contrat"
                  (immédiate si la date choisie est aujourd'hui/passée, voir
                  `definirFinContrat`), plus par une action directe ici. */}
              {modeEdition && statut === "actif" && (
                <div className="bg-mint-tint text-slate border-mint-tint border px-3.5 py-2.5 text-sm font-semibold">
                  Collaborateur·rice de l&rsquo;effectif depuis le{" "}
                  <span className="font-bold">{formatDateAction(champs.dateEntree)}</span>
                </div>
              )}
              {modeEdition && statut === "archive" && (
                <div className="bg-status-warning-bg text-status-warning-fg px-3.5 py-2.5 text-sm font-semibold">
                  Collaborateur·rice archivée
                  {dateArchivage ? ` le ${formatDateAction(dateArchivage)}` : ""}
                </div>
              )}
            </div>

            {/* Rôle juste après l'identité (05/09/2026, demande explicite :
            "mets role après le bloc identité") — avant Nature du
            contrat/Durée de travail, plutôt qu'en bas du formulaire. */}
            {!modeEdition && carteRole}

            {/* Nature du contrat / Durée de travail : deux cards à 50% chacune
            en édition (02/09/2026, refonte fiche2, demande explicite) —
            valeur actuelle ET historique fusionnés dans la MÊME card (au
            lieu du tableau récap séparé plus bas dans la page) pour rendre
            visible d'emblée le caractère historisé de ces deux champs. "+
            Ajouter un événement" ouvre la même popin que l'ancien
            "Modifier" (`ModalModifierChamp`) — reformulé pour coller au
            principe "timeline". En création, chaque card reprend toute la
            largeur (05/09/2026, demande explicite : "même largeur que la
            première card Nom/Prénom/Email") au lieu du 50/50 — pas
            d'historique à afficher, juste les `<Select>` de saisie libre. */}
            <div
              className={
                modeEdition ? "grid grid-cols-1 gap-5 sm:grid-cols-2" : "flex flex-col gap-[5px]"
              }
            >
              <div className="bg-surface-card border-ink-300/60 flex flex-col gap-3 border p-5">
                <div className="text-abeil-navy text-sm font-bold">Nature du contrat</div>
                {modeEdition ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      {construireLignesHistorique(
                        historiqueNature,
                        champs.natureContrat,
                        dateEntree,
                        labelNatureContrat,
                      ).map((l, i) =>
                        // Correction en place de la période en cours mise de
                        // côté pour l'instant (04/09/2026, demande explicite
                        // : "on va mettre de côté les modifications des
                        // événements en cours") — seul "+ Ajouter un
                        // événement" reste accessible. `handleCorrigerNature`/
                        // `corrigerNatureContrat`/mode "corriger" restent en
                        // place côté logique (voir plus bas) pour une
                        // réactivation future sans tout reconstruire.
                        i === 0 ? (
                          <span
                            key={l.key}
                            className="bg-mint-tint border-mint text-slate w-fit rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                          >
                            {l.texte}
                          </span>
                        ) : (
                          <span
                            key={l.key}
                            className="border-ink-300 text-ink-500 w-fit rounded-full border bg-transparent px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                          >
                            {l.texte}
                          </span>
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setModaleOuverte({ champ: "nature_contrat", mode: "ajouter" })}
                      className="text-ink-500 flex w-fit items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                    >
                      <Plus size={12} />
                      Ajouter un événement
                    </button>
                  </>
                ) : (
                  <SelectPille
                    id="natureContrat"
                    value={champs.natureContrat}
                    onChange={(e) =>
                      setChamps({ ...champs, natureContrat: e.target.value as NatureContrat })
                    }
                    borderClassName="border-slate"
                    chevronClassName="text-abeil-navy"
                    hoverClassName="enabled:hover:bg-surface-app"
                    className="w-fit !py-2.5 !pr-8 !pl-3 !text-sm"
                  >
                    <option value="cdi">CDI</option>
                    <option value="cdd">CDD</option>
                    <option value="alternance">Alternance</option>
                    <option value="stage">Stage</option>
                  </SelectPille>
                )}
              </div>

              {/* "Dates de contrat" juste après Nature du contrat (05/09/2026,
              demande explicite : "le bloc date après nature du contrat"). */}
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
                <div className="bg-surface-card border-ink-300/60 flex flex-col gap-3 border p-5">
                  {/* Titre "Dates de contrat" retiré (05/09/2026, demande
                  explicite) — "Date d'entrée"/"Date de sortie" reprennent
                  chacune le traitement titre (navy gras) à la place. Date de
                  sortie CDD (04/09/2026, "prévoir pour les CDD une date
                  d'entrée et une date de sortie") — affichée seulement pour
                  un CDD, à côté de la date d'entrée plutôt qu'en pleine
                  largeur (deux dates courtes). Écrite dans `date_fin_contrat`
                  à la création (voir `handleSubmit`). */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="dateEntree"
                        className="text-abeil-navy mb-1.5 block text-sm font-bold"
                      >
                        Date d&rsquo;entrée
                      </label>
                      <Input
                        id="dateEntree"
                        type="date"
                        value={champs.dateEntree}
                        onChange={(e) => setChamps({ ...champs, dateEntree: e.target.value })}
                        className="!border-slate w-1/2 rounded-md text-xs"
                      />
                    </div>
                    {champs.natureContrat === "cdd" && (
                      <div>
                        <label
                          htmlFor="dateSortieCdd"
                          className="text-abeil-navy mb-1.5 block text-sm font-bold"
                        >
                          Date de sortie
                        </label>
                        <Input
                          id="dateSortieCdd"
                          type="date"
                          value={dateSortieCdd}
                          onChange={(e) => setDateSortieCdd(e.target.value)}
                          className="!border-slate w-1/2 rounded-md text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-surface-card border-ink-300/60 flex flex-col gap-3 border p-5">
                <div className="text-abeil-navy text-sm font-bold">Durée de travail</div>
                {modeEdition ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      {construireLignesHistorique(
                        historiqueTaux,
                        String(champs.tauxActivite),
                        dateEntree,
                        formatTauxLabel,
                      ).map((l, i) =>
                        // Correction en place mise de côté pour l'instant —
                        // voir le commentaire équivalent sur "Nature du
                        // contrat" juste au-dessus.
                        i === 0 ? (
                          <span
                            key={l.key}
                            className="bg-mint-tint border-mint text-slate w-fit rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                          >
                            {l.texte}
                          </span>
                        ) : (
                          <span
                            key={l.key}
                            className="border-ink-300 text-ink-500 w-fit rounded-full border bg-transparent px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                          >
                            {l.texte}
                          </span>
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setModaleOuverte({ champ: "taux_activite", mode: "ajouter" })}
                      className="text-ink-500 flex w-fit items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                    >
                      <Plus size={12} />
                      Ajouter un événement
                    </button>
                  </>
                ) : (
                  <>
                    <SelectPille
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
                      borderClassName="border-slate"
                      chevronClassName="text-abeil-navy"
                      hoverClassName="enabled:hover:bg-surface-app"
                      className="w-fit !py-2.5 !pr-8 !pl-3 !text-sm"
                    >
                      {PRESETS_DUREE.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                      <option value="autre">Autre</option>
                    </SelectPille>
                    {dureeSelection === "autre" && (
                      <div>
                        <FieldLabel variant="carte" htmlFor="tauxAutre">
                          Pourcentage
                        </FieldLabel>
                        {/* Champ numérique court (04/09/2026, "réduire la
                        largeur des champs en fonction de leur type") — pas
                        besoin de toute la largeur de la card pour "80". */}
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
                          className="!border-slate w-24 rounded-md text-xs"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* "Fin de contrat" (04/09/2026, demande explicite — offboarding
            réduit à 3 effets : archivage, gel de l'acquisition de congés,
            blocage de connexion à la date choisie) — uniquement en édition,
            une fiche en création n'a pas encore de contrat à terminer. */}
            {modeEdition && (
              <div className="bg-surface-card border-ink-300/60 flex flex-col gap-3 border p-5">
                <div className="text-abeil-navy text-sm font-bold">Fin de contrat</div>
                {dateFinContrat ? (
                  <div className="flex items-center gap-2">
                    <span className="text-status-danger-fg w-fit rounded-full border border-current px-2.5 py-1 text-xs font-bold whitespace-nowrap">
                      Fin de contrat le {formatDateAction(dateFinContrat)}
                    </span>
                    <button
                      type="button"
                      onClick={handleAnnulerFinContrat}
                      className="text-ink-500 flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={dernierAdmin}
                    title={
                      dernierAdmin
                        ? "Rétrogradez d'abord ce profil pour pouvoir lui définir une fin de contrat."
                        : undefined
                    }
                    onClick={() => setModaleFinContratOuverte(true)}
                    className="text-ink-500 hover:text-status-danger-fg disabled:text-ink-500 flex w-fit items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
                  >
                    Définir une date de fin de contrat
                  </button>
                )}
              </div>
            )}

            {!modeEdition && (
              /* Soldes actuels (21/08/2026, lancement en prod) — report de la
             dernière fiche de paie pour un salarié déjà en poste avant
             l'app : remplace le report/accrual automatique tant que la
             période en cours est celle de cette date de référence, voir
             `resolverReportCp`/`resolverPointDepartAccrual` dans
             `soldes.repository.ts`. Facultatif — si la date est laissée
             vide, aucun solde initial n'est créé (comportement inchangé). */
              <div className="bg-surface-card border-ink-300/60 flex flex-col gap-3 border p-5">
                {/* Titre en carte navy + gras (04/09/2026, "unifier les
                intitulés") — même traitement que "Nature du contrat"/"Durée
                de travail"/"Rôle" ci-dessus, au lieu d'un `FieldLabel` gris
                qui le faisait passer pour un simple champ parmi d'autres.
                Un seul texte d'aide, condensé (04/09/2026, retour explicite
                "trop de texte d'aide" — fusion des deux phrases précédentes),
                et plus de sous-titre "Jours restants à cette date" : les
                labels CP/RTT/CPA suffisent, la card + son titre donnent déjà
                le contexte. */}
                <div className="text-abeil-navy text-sm font-bold">Solde initial (facultatif)</div>
                <div className="mt-2">
                  {/* Sélecteurs mois + année (05/09/2026, demande explicite :
                  "Sélecteur mois puis sélecteur années") — même pattern que
                  "Date d'effet" dans `ModalModifierChamp` (deux `<Select>`
                  plutôt qu'un `<input type="month">`), pour rester cohérent
                  avec le reste de la fiche. Le mois "—" (non choisi) est ce
                  qui fait de ce report un champ facultatif : tant qu'aucun
                  mois n'est choisi, `soldeInitDate` reste vide et aucun solde
                  initial n'est créé (comportement inchangé, voir
                  `handleSubmit`). */}
                  <p className="text-abeil-navy mb-[9px] text-xs font-semibold">Au début du mois</p>
                  {/* `SelectPille` (05/09/2026, demande explicite : "c'est
                  des pills aussi") — même traitement que Nature du
                  contrat/Durée de travail/Rôle, plutôt que `Select` dont le
                  `className` s'applique au conteneur et non au `<select>`
                  lui-même (bordure non personnalisable telle quelle). */}
                  <div className="flex gap-2">
                    <SelectPille
                      id="soldeInitDateMois"
                      value={soldeInitDate ? String(Number(soldeInitDate.slice(5, 7))) : ""}
                      onChange={(e) => {
                        const mois = e.target.value;
                        if (!mois) {
                          setSoldeInitDate("");
                          return;
                        }
                        const annee = soldeInitDate
                          ? soldeInitDate.slice(0, 4)
                          : String(new Date().getFullYear());
                        setSoldeInitDate(`${annee}-${mois.padStart(2, "0")}-01`);
                      }}
                      borderClassName="border-slate"
                      chevronClassName="text-abeil-navy"
                      hoverClassName="enabled:hover:bg-surface-app"
                      className="w-fit !py-2.5 !pr-8 !pl-3 !text-sm"
                    >
                      <option value="">—</option>
                      {MOIS_LABELS.map((label, i) => (
                        <option key={label} value={i + 1}>
                          {label}
                        </option>
                      ))}
                    </SelectPille>
                    <SelectPille
                      id="soldeInitDateAnnee"
                      disabled={!soldeInitDate}
                      value={
                        soldeInitDate ? soldeInitDate.slice(0, 4) : String(new Date().getFullYear())
                      }
                      onChange={(e) => {
                        if (!soldeInitDate) return;
                        setSoldeInitDate(`${e.target.value}-${soldeInitDate.slice(5, 7)}-01`);
                      }}
                      borderClassName="border-slate"
                      chevronClassName="text-abeil-navy"
                      hoverClassName="enabled:hover:bg-surface-app"
                      className="w-fit !py-2.5 !pr-8 !pl-3 !text-sm"
                    >
                      {anneesSelectionnables().map((annee) => (
                        <option key={annee} value={annee}>
                          {annee}
                        </option>
                      ))}
                    </SelectPille>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="text-abeil-navy mb-[9px] text-xs font-semibold">
                    Le collaborateur dispose de
                  </div>
                  <div className="flex gap-[40px]">
                    {/* `TypeBadge` devant chaque solde, même ligne (05/09/2026,
                    demande explicite) — remplace le label texte coloré : le
                    badge affiche déjà "CP"/"RTT"/"CPA" via `LABEL_COURT`. */}
                    <div className="flex shrink-0 items-center gap-2">
                      <TypeBadge code="CP" />
                      <Input
                        id="soldeInitCp"
                        type="number"
                        step="0.5"
                        value={soldeInitCp}
                        onChange={(e) => setSoldeInitCp(e.target.value)}
                        className="!border-slate w-16 [appearance:textfield] rounded-md text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <TypeBadge code="RTT" />
                      <Input
                        id="soldeInitRtt"
                        type="number"
                        step="0.5"
                        value={soldeInitRtt}
                        onChange={(e) => setSoldeInitRtt(e.target.value)}
                        className="!border-slate w-16 [appearance:textfield] rounded-md text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <TypeBadge code="CPA" />
                      <Input
                        id="soldeInitCpa"
                        type="number"
                        step="0.5"
                        value={soldeInitCpa}
                        onChange={(e) => setSoldeInitCpa(e.target.value)}
                        className="!border-slate w-16 [appearance:textfield] rounded-md text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bouton "Enregistrer"/erreur retirés en édition (04/09/2026,
            demande explicite) — chaque champ s'enregistre désormais
            individuellement dès sa modification (popins identité/rôle,
            "+ Ajouter un événement" pour nature du contrat/durée de
            travail) : plus aucune modification en attente à valider ici.
            Le formulaire (et son `handleSubmit`) reste nécessaire tel quel
            en création. */}
            {!modeEdition && (
              <>
                {erreur && (
                  <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
                    {erreur}
                  </div>
                )}

                {/* Bouton de validation simple, en bas du formulaire
                (05/09/2026, demande explicite : "on va abandonner le
                principe de validation sticky" — le bandeau collé au scroll
                posait plus de problèmes de calage qu'il n'apportait de
                valeur) — plus de `sticky`/bandeau pleine largeur, juste le
                bouton en fin de flux, comme avant cette exploration. */}
                <Button
                  type="submit"
                  disabled={envoi}
                  className="rounded-card mt-[25px] w-fit self-start px-6 py-3.5"
                >
                  <Check size={16} />
                  Créer le profil
                </Button>
              </>
            )}
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
              `SuiviModifications`. Action "Archiver" intégrée au bandeau
              "Collaborateur·rice de l'effectif" (demande explicite) — plus de bouton
              séparé ici. */}
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

      {modaleOuverte?.champ === "taux_activite" && (
        <ModalModifierChamp
          champ="taux_activite"
          mode={modaleOuverte.mode}
          dateModifiable={
            modaleOuverte.mode === "ajouter" || derniereEntreeHistorique(historiqueTaux) !== null
          }
          valeurActuelle={String(champs.tauxActivite)}
          dateEffetActuelle={dateEffetActuelle(historiqueTaux, dateEntree)}
          tauxAcquisitionCP={tauxAcquisitionCP}
          tauxAcquisitionRTT={tauxAcquisitionRTT}
          moisMinimum={moisMinimumChangement}
          onValider={modaleOuverte.mode === "corriger" ? handleCorrigerTaux : handleChangerTaux}
          onClose={() => setModaleOuverte(null)}
        />
      )}

      {modaleOuverte?.champ === "nature_contrat" && (
        <ModalModifierChamp
          champ="nature_contrat"
          mode={modaleOuverte.mode}
          dateModifiable={
            modaleOuverte.mode === "ajouter" || derniereEntreeHistorique(historiqueNature) !== null
          }
          valeurActuelle={champs.natureContrat}
          dateEffetActuelle={dateEffetActuelle(historiqueNature, dateEntree)}
          moisMinimum={moisMinimumChangement}
          onValider={modaleOuverte.mode === "corriger" ? handleCorrigerNature : handleChangerNature}
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

      {modaleRoleOuverte && (
        <ModalModifierRole
          role={champs.role}
          dernierAdmin={dernierAdmin}
          onValider={handleModifierRole}
          onClose={() => setModaleRoleOuverte(false)}
        />
      )}

      {modaleFinContratOuverte && (
        <ModalFinContrat
          dernierAdmin={dernierAdmin}
          onValider={handleDefinirFinContrat}
          onClose={() => setModaleFinContratOuverte(false)}
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
    definirFinContrat,
    annulerFinContrat,
    changerTauxActivite,
    changerNatureContrat,
    corrigerTauxActivite,
    corrigerNatureContrat,
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

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0 xl:max-w-none">
      {/* Petit lien retour (02/09/2026, demande explicite) — même pattern que
          "Transmissions paie" (`TransmissionsPaiePage.tsx`), remplace
          `BackHeader` (gros bouton rond + titre accolé). Pas de H1 séparé
          (retiré, même demande) : le nom est déjà affiché en grand dans la
          card identité juste en dessous en édition — le répéter en H1
          faisait doublon (déjà noté à l'ajout de cette card). Reste à
          harmoniser sur le reste de l'app un jour (voir Backlog,
          "Uniformisation des éléments UI"). */}
      <Link
        href="/parametrer/utilisateurs"
        className="text-ink-500 hover:text-ink-900 flex w-fit items-center gap-1 px-1 text-sm font-semibold"
      >
        <ChevronLeft size={16} />
        Utilisateurs
      </Link>

      {/* Colonnes (Formulaire principal / Rôle + Suivi des modifications)
          désormais gérées par `Formulaire` lui-même (02/09/2026) — pour que
          la card "Rôle" puisse rejoindre "Suivi des modifications" dans la
          même colonne de droite en édition, il faut que le même composant
          possède les deux (`suiviEntrees` calculé ici et transmis). Bandeau
          statut ("Collaborateur·rice de l'effectif"/"Collaborateur·rice archivée") déplacé
          dans `Formulaire` (02/09/2026, demande explicite) — entre la card
          identité et les cards Nature du contrat/Durée de travail, plutôt
          qu'au-dessus de tout. */}
      <Formulaire
        key={id ?? "nouveau"}
        id={id}
        initial={initial}
        statut={utilisateur?.statut}
        dateArchivage={utilisateur?.dateArchivage}
        dateFinContrat={utilisateur?.dateFinContrat}
        historique={historique}
        soldeInitial={soldeInitial}
        dateEntree={initial.dateEntree}
        creer={creer}
        modifier={modifier}
        definirFinContrat={definirFinContrat}
        annulerFinContrat={annulerFinContrat}
        changerTauxActivite={changerTauxActivite}
        changerNatureContrat={changerNatureContrat}
        corrigerTauxActivite={corrigerTauxActivite}
        corrigerNatureContrat={corrigerNatureContrat}
        suiviEntrees={id && utilisateur ? construireSuivi(utilisateur, historique) : null}
      />
    </div>
  );
}

interface NouveauUtilisateurModalProps {
  onClose: () => void;
  /** Appelé avec le profil créé — pas de navigation (04/09/2026, demande
   * explicite : "on peut le jouer en popin sur la page utilisateurs") : la
   * page Utilisateurs referme la popin et recharge sa liste elle-même. */
  onCreated: (utilisateur: UtilisateurAdmin) => void;
}

/** Popin "Créer un profil" sur la page Utilisateurs (04/09/2026, demande
 * explicite) — le même `Formulaire` que la page dédiée `/nouveau` (gardée
 * par ailleurs pour l'accès direct par URL), juste dans une `Modal` plutôt
 * qu'un conteneur de page, sans le lien retour (inutile en popin) et avec
 * `onCreated` à la place de la navigation par défaut vers la fiche créée. */
export function NouveauUtilisateurModal({ onClose, onCreated }: NouveauUtilisateurModalProps) {
  const {
    creer,
    modifier,
    definirFinContrat,
    annulerFinContrat,
    changerTauxActivite,
    changerNatureContrat,
    corrigerTauxActivite,
    corrigerNatureContrat,
  } = useUtilisateurAdmin();

  return (
    // `align="top"` retiré (05/09/2026, demande explicite — "le bandeau
    // sticky doit être calé en bas de la fenêtre de la popin") : cet
    // alignement ajoute un `pt-12` fixe au-dessus du panneau, qui, combiné à
    // `max-h-[90vh]`, peut dépasser 100vh sur une fenêtre basse (48px +
    // 90% > 100% dès que la hauteur de fenêtre passe sous ~480px) — le bas
    // du panneau (et donc le bandeau sticky "Créer le profil") se retrouve
    // alors hors écran, avec le contenu de la page visible en dessous.
    // `align="center"` (défaut) n'ajoute aucun décalage fixe : le panneau
    // reste toujours ≤ 90vh, donc toujours entièrement visible.
    <Modal
      onClose={onClose}
      className="max-w-2xl"
      header={<EnTeteModalNavy titre="Créer un profil collaborateur" onClose={onClose} />}
    >
      {/* Fond gris de page (04/09/2026, demande explicite) — le corps de la
      popin est blanc par défaut (`Modal`), comme les cards du formulaire :
      aucun contraste entre elles. Bleed en marges négatives pour reprendre
      tout le corps scrollable malgré son padding (`px-6 py-4`, cas avec
      `header`) — marges asymétriques (`-mx-6 -my-4`, pas `-m-6` uniforme,
      05/09/2026 : la valeur uniforme dépassait de 8px le vrai bord bas de
      la popin, laissant un espace visible avant le bandeau sticky, voir
      commentaire sur ce dernier). */}
      <div className="bg-surface-app -mx-6 -my-4 px-6 py-4">
        <Formulaire
          initial={CHAMPS_VIDES}
          historique={[]}
          soldeInitial={null}
          dateEntree=""
          creer={creer}
          modifier={modifier}
          definirFinContrat={definirFinContrat}
          annulerFinContrat={annulerFinContrat}
          changerTauxActivite={changerTauxActivite}
          changerNatureContrat={changerNatureContrat}
          corrigerTauxActivite={corrigerTauxActivite}
          corrigerNatureContrat={corrigerNatureContrat}
          suiviEntrees={null}
          onCreated={onCreated}
        />
      </div>
    </Modal>
  );
}
