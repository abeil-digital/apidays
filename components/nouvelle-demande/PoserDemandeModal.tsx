"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import type { Demande, DemiJournee, TypeDemande } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { estJourOuvre } from "@/lib/joursFeries";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldeAnticipe } from "@/hooks/useSoldeAnticipe";
import { useSoldes } from "@/hooks/useSoldes";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Modal } from "@/components/ui/Modal";
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

// "Congés anticipés" n'est pas un type d'absence à part en base : c'est un CP
// (type "CP") posé avec is_anticipation=true, qui consomme le solde théorique
// plutôt que le solde réel — voir BASE-DE-DONNEES.md. `code` = pastille/couleur
// affichée (CPA a sa propre couleur, distincte de CP).
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

const NOTE_LONGUEUR_MAX = 200;
const NOTE_LONGUEUR_ALERTE = 175;

// Nom de la variable CSS du token couleur du type — pour teinter un fond via
// `color-mix` (même procédé que `DetailCongePanel`/`SoldeDetailPanel`).
const VAR_COULEUR_TYPE: Record<string, string> = {
  CP: "--color-cp",
  RTT: "--color-rtt",
  CPA: "--color-cpa",
  CSS: "--color-css",
  CE: "--color-ce",
  RECUP: "--color-recup",
  EVT_FAM: "--color-evtfam",
};

// Texte du sélecteur de type teinté couleur du type, en `!important` pour
// gagner sur `text-ink-900` de `SelectPille` — classes littérales une par
// code (obligatoire : une classe construite par concaténation à l'exécution,
// ex. `` `${classeTexteTypeBadge(code)}!` ``, n'est jamais générée par
// Tailwind, voir CONTEXTE.md). CP, RTT, CPA, CSS et CE sont des teintes trop
// claires en typo sur fond blanc (peu de contraste) — foncées ici (RTT réutilise
// `--color-status-success-fg` déjà dans la palette ; les autres, sans
// équivalent foncé existant, en valeur arbitraire, même teinte assombrie
// d'environ 35%). Bordure/chevron/fond au survol restent dans la couleur
// d'origine du type.
const TEXTE_TYPE_IMPORTANT: Record<string, string> = {
  CP: "text-[color:#3b5c9b]!",
  RTT: "text-[color:var(--color-status-success-fg)]!",
  CPA: "text-[color:#66757f]!",
  CSS: "text-[color:#6d6762]!",
  CE: "text-[color:#8d6a3c]!",
  RECUP: "text-recup!",
  EVT_FAM: "text-evtfam!",
};

// Fond au survol du sélecteur de type : blanc teinté à 10% de la couleur du
// type (même procédé `color-mix` que `ActiviteRecenteFeed`/`DetailCongePanel`)
// — classes littérales une par code, même contrainte que ci-dessus.
const HOVER_TEINTE_TYPE: Record<string, string> = {
  CP: "enabled:hover:bg-[color-mix(in_srgb,var(--color-cp)_10%,white)]",
  RTT: "enabled:hover:bg-[color-mix(in_srgb,var(--color-rtt)_10%,white)]",
  CPA: "enabled:hover:bg-[color-mix(in_srgb,var(--color-cpa)_10%,white)]",
  CSS: "enabled:hover:bg-[color-mix(in_srgb,var(--color-css)_10%,white)]",
  CE: "enabled:hover:bg-[color-mix(in_srgb,var(--color-ce)_10%,white)]",
  RECUP: "enabled:hover:bg-[color-mix(in_srgb,var(--color-recup)_10%,white)]",
  EVT_FAM: "enabled:hover:bg-[color-mix(in_srgb,var(--color-evtfam)_10%,white)]",
};

// Même conversion que `DatePicker` en interne (fuseau local, pas UTC) — la
// comparaison avec les dates `disabled` doit utiliser exactement la même
// base, sinon décalage d'un jour possible selon l'heure/le fuseau.
function dateVersIsoLocal(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/**
 * "Nouvelle demande" — popin de dépôt d'une demande (18/08/2026), remplace
 * l'ancien formulaire plein écran (`NouvelleDemandeForm`, supprimé le même
 * jour — plus référencé par aucune route depuis que `/nouvelle-demande`
 * pointe sur cette popin) ET un premier essai à calendrier custom cliquable
 * (abandonné le même jour). Reprend le gabarit de `ModalCongesImposes` (Paramétrer >
 * Calendrier, popin CPI) plutôt qu'un calendrier maison : deux `DatePicker`
 * (Du/Au) dont le `disabled` bloque directement les jours non sélectionnables
 * (week-end, férié, jour déjà imposé/posé) — un vrai blocage plutôt qu'un
 * simple avertissement visuel, et beaucoup moins de code qu'un calendrier de
 * sélection de période fait main.
 *
 * Le nombre de jours (voir `creerResolveurOccupant`, `DetailPeriodeConges.tsx`)
 * exclut week-ends et fériés, comme le fait le serveur à l'enregistrement
 * (`calculerNbDemiJournees`, `demandes.repository.ts`) — et déduit en plus
 * tout ce qui couvre déjà une demi-journée de la période (CPI, DJI, une
 * autre demande déjà posée), même chose côté serveur depuis le 18/08/2026.
 *
 * "Solde à la date de la demande" (`fetchSoldeAnticipe`) — uniquement pour
 * RTT et Congés anticipés (CP a un capital connu d'avance, la notion
 * n'a pas de sens pour lui) : projette l'accrual jusqu'à la date de début
 * choisie plutôt que jusqu'à aujourd'hui, pour refléter les jours qui auront
 * été acquis d'ici la demande. "Après la demande" se base sur cette valeur
 * anticipée pour RTT/CPA, sur le solde actuel sinon.
 */
export function PoserDemandeModal({
  onClose,
  onSuccess,
  dateInitiale,
}: {
  onClose: () => void;
  /** Appelé juste après l'enregistrement réussi, avant `onClose` — l'appelant
   * l'utilise pour rafraîchir ses propres `demandes`/`soldes` (l'ajout se
   * fait dans l'instance locale de `useDemandes` de cette popin, pas dans
   * celle, distincte, de la page qui l'a ouverte). */
  onSuccess?: () => void;
  /**
   * Pré-remplit la date de début (20/08/2026) — ex. clic sur un jour vide du
   * calendrier côté `Dashboard2Page`. La date de fin reste vide (l'appelant
   * ne connaît que le jour cliqué, pas la durée souhaitée). Opt-in, sans
   * effet sur les appelants qui ne le passent pas (ouverture "vierge" via
   * le bouton "Poser un congé").
   */
  dateInitiale?: string;
}) {
  const { demandes, ajouterDemande } = useDemandes();
  const { soldes } = useSoldes();

  const anneeActuelle = new Date().getFullYear();
  const calActuel = useCalendrier(anneeActuelle);
  const calSuivant = useCalendrier(anneeActuelle + 1);

  const [optionKey, setOptionKey] = useState("CP");
  const [debut, setDebut] = useState(dateInitiale ?? "");
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

  function demandeDuJour(iso: string): Demande | undefined {
    return demandes.find(
      (d) => d.statut !== "refusé" && d.statut !== "annulé" && iso >= d.debut && iso <= d.fin,
    );
  }

  function jourDejaOccupe(iso: string): boolean {
    return congesImposes.some((c) => iso >= c.debut && iso <= c.fin) || Boolean(demandeDuJour(iso));
  }

  // Créneau DJI sur une date donnée (`null` si aucune DJI ce jour-là) — sert à
  // verrouiller le sélecteur de demi-journée d'une borne (Du/Au) qui tombe
  // sur une DJI : ce créneau est déjà imposé, donc pas question de le
  // proposer comme un choix, un seul reste cohérent (18/08/2026, cas signalé
  // par Vincent).
  function djiSurDate(iso: string): DemiJournee | null {
    const dj = djImposees.find((d) => d.date === iso);
    return dj ? dj.demiJournee : null;
  }

  // Demi-journée à proposer par défaut pour une borne qui tombe sur une DJI —
  // celle que la DJI n'occupe PAS, seule option cohérente (démarrer/finir sur
  // le créneau déjà imposé n'a pas de sens, il est déjà exclu du décompte).
  function demiParDefautDebut(iso: string): DemiJournee {
    return djiSurDate(iso) === "matin" ? "apres_midi" : "matin";
  }
  function demiParDefautFin(iso: string): DemiJournee {
    return djiSurDate(iso) === "apres_midi" ? "matin" : "apres_midi";
  }

  // Ce qui occupe DÉJÀ une demi-journée, indépendamment de la demande en
  // cours de saisie — férié > congé imposé (CPI) > demi-journée imposée
  // (DJI) > une autre demande personnelle déjà posée (rare à l'intérieur
  // d'une période tout juste sélectionnée, mais un jour au milieu d'une
  // période choisie n'est pas bloqué par le `disabled` du `DatePicker`, qui
  // ne vérifie que les bornes début/fin). Sert à la fois au détail "voir"
  // (`DetailPeriodeConges`) et au calcul du nombre de jours ci-dessous — les
  // deux doivent voir EXACTEMENT la même chose. Brique partagée avec le lien
  // "Voir" de la validation manager (`DemandeEquipeRow`, 18/08/2026).
  const occupant = creerResolveurOccupant({ joursFeries, congesImposes, djImposees, demandes });

  function jourIndisponible(date: Date): boolean {
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

  // "Un seul jour" couvre aussi le cas où "Au" n'est pas encore renseigné —
  // le sélecteur journée/demi-journée doit rester du côté "Du" tant qu'on n'a
  // pas une vraie période multi-jours (même logique que `finPourCalcul`
  // plus bas).
  const unSeulJour = Boolean(debut) && (!fin || fin === debut);
  const dureeUnJour: DureeUnJour =
    demiDebut === "matin" && demiFin === "apres_midi"
      ? "entiere"
      : demiDebut === "matin"
        ? "matin"
        : "apres_midi";

  // Options réellement proposées pour chaque sélecteur de créneau — réduites
  // à la seule option cohérente quand la borne (Du, Au, ou l'unique jour en
  // mode "un seul jour") tombe sur une DJI (18/08/2026, cas signalé par
  // Vincent). `disabled` sur le `SelectPille` quand une seule option reste :
  // rien à choisir, le verrouillage doit être visible, pas juste une liste
  // réduite à un select toujours actif.
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

  // Tant que "Au" n'est pas encore renseigné, on calcule comme si la demande
  // ne portait que sur "Du" (un seul jour) — l'utilisateur doit pouvoir poser
  // une demande d'un jour en ne remplissant qu'une seule date, sans quoi le
  // nombre de jours et le solde restent à "…" pour rien.
  const finPourCalcul = fin && fin >= debut ? fin : debut;
  // Basé sur `occupant` (`creerResolveurOccupant`, même brique que le détail
  // "voir" plus bas) plutôt que sur `joursOuvres` seul : une demi-journée ne
  // compte QUE si rien d'autre ne l'occupe déjà (férié, CPI, DJI, ou une
  // autre demande personnelle déjà posée sur la période) ET qu'elle fait
  // partie de la période demandée. `joursOuvres` seul ne déduisait que
  // fériés/DJI, pas les CPI ni les demandes déjà posées : un congé imposé
  // (CPI) ou une demande déjà existante à l'intérieur de la période choisie
  // se retrouvait compté en plus dans "Soit N jours" et dans l'impact sur le
  // solde (bug signalé le 18/08/2026). Comparer plutôt le code affiché dans
  // le détail "voir" à `option.code` semblait marcher mais confondait à tort
  // "libre et demandé" avec "déjà occupé par une AUTRE demande du même type"
  // (ex. une demande CP existante masquée par la nouvelle demande CP en
  // cours — signalé juste après par Vincent, `occupant` distingue
  // explicitement les deux).
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

  const afficherAnticipe = optionKey === "RTT" || optionKey === "CP_ANTICIPE";
  const typeAnticipe: "RTT" | "CPA" | null =
    optionKey === "RTT" ? "RTT" : optionKey === "CP_ANTICIPE" ? "CPA" : null;
  const { solde: soldeAnticipe, loading: loadingAnticipe } = useSoldeAnticipe(
    typeAnticipe,
    afficherAnticipe && debut ? debut : null,
  );

  const soldeActuel = soldes
    ? optionKey === "CP"
      ? soldes.cp.valeurApresAttente
      : optionKey === "RTT"
        ? soldes.rtt.valeurApresAttente
        : optionKey === "CP_ANTICIPE"
          ? soldes.cpa.valeurApresAttente
          : null
    : null;

  const baseSoldeApres = afficherAnticipe ? soldeAnticipe : soldeActuel;
  const soldeApres =
    baseSoldeApres !== null && joursDemandes !== null ? baseSoldeApres - joursDemandes : null;
  const soldeNegatif = soldeApres !== null && soldeApres < 0;

  async function handleSubmit() {
    if (!debut) {
      setError("Merci d'indiquer une date de début.");
      return;
    }
    // Pas de filet de sécurité anti-chevauchement ici (retiré le 18/08/2026,
    // décision produit) : un jour déjà occupé au milieu de la période choisie
    // — par un CPI, une DJI, ou une AUTRE demande personnelle déjà posée —
    // ne bloque jamais l'envoi. Ce jour est déjà exclu du décompte affiché
    // (`occupant`, `creerResolveurOccupant`) et matérialisé en transparence dans le détail
    // "voir" (ex. une demande CP 10/08→13/08 avec le 11/08 déjà posé ailleurs
    // affiche 3 jours, transparence sur le 11) — exactement le même principe
    // que pour un jour férié au milieu d'une période : pas de blocage, juste
    // de la transparence sur ce qui compte réellement. Les BORNES
    // (début/fin), elles, restent bloquées par le `disabled` des
    // `DatePicker` (`jourIndisponible`/`jourDejaOccupe`, inchangé) — on ne
    // peut pas démarrer/finir littéralement sur un jour déjà occupé.
    setError("");
    setEnvoiEnCours(true);
    try {
      await ajouterDemande({
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
      setError("Impossible d'enregistrer la demande.");
      setEnvoiEnCours(false);
    }
  }

  // `attenue` : état "off" — utilisé pour "Actuel", moins important que les
  // lignes "à la date de la demande"/"après la demande" : fond blanc, liséré
  // et texte dans la couleur du type plutôt que le badge plein couleur.
  function pillSolde(valeur: number | null, chargement = false, attenue = false) {
    // Solde négatif (ex. après une demande qui dépasse le solde disponible) :
    // inversion du badge plein couleur — fond blanc, texte rouge (alerte),
    // liséré dans la couleur du type pour rester rattaché visuellement à la
    // ligne du dessus.
    const negatif = valeur !== null && valeur < 0;
    const couleur = negatif
      ? `text-status-danger-fg border ${classeBordureTypeBadge(option.code)} bg-white`
      : attenue
        ? `${TEXTE_TYPE_IMPORTANT[option.code]} border ${classeBordureTypeBadge(option.code)} bg-white`
        : `text-white ${classeFondTypeBadge(option.code)}`;
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap ${couleur}`}>
        {chargement || valeur === null ? "…" : `${formatJours(valeur)} j`}
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
        // Bandeau calqué sur les popins de légende CPI/DJI/Fériés/PERSO de
        // "Mes Congés" (Accueil, `headerLegende` dans `Dashboard2Page`) —
        // `TypeBadge` cerclé de blanc, teinte du bandeau = couleur du type
        // sélectionné. Titre ferré à gauche à côté du badge (18/08/2026,
        // essai centré abandonné), grossi (+30%, `text-lg` au lieu de
        // `text-sm`) ; rappel du type retiré — déjà visible via le
        // sélecteur juste en dessous, redondant en sous-titre. (Essai du
        // 18/08/2026 d'étendre le fond du header pour englober le sélecteur
        // — abandonné, revenu à ce format.)
        <div
          className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(option.code)}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="rounded-full ring-2 ring-white">
              <TypeBadge code={option.code} />
            </div>
            <h2 className="text-lg font-semibold text-white">Nouvelle demande</h2>
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
          {/* Typo/taille calquée sur les onglets de période de "Mes Congés"
              (Accueil, ex. "Juin 26 → Mai 27") — `text-sm font-semibold`. */}
          <h3 className="text-ink-900 px-1 text-sm font-semibold">Type d&rsquo;absence</h3>
          {/* `self-start` (18/08/2026) : sans ça, ce `SelectPille` — enfant
              direct du `flex-col` — s'étire en largeur (stretch par défaut sur
              l'axe transversal), et le chevron (positionné en absolu par
              rapport à ce conteneur étiré) se retrouve loin du texte au lieu
              d'être calé juste à côté. Même pattern déjà appliqué aux pills
              demi-journée plus bas. */}
          <div className="mt-1 self-start">
            <SelectPille
              value={optionKey}
              onChange={(e) => setOptionKey(e.target.value)}
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
                {pillSolde(soldeActuel, false, true)}
              </div>
              {afficherAnticipe && (
                <div className="bg-surface-app border-ink-300/60 flex items-center justify-between border-t px-4 py-3">
                  <span className="text-ink-500 text-sm font-semibold">
                    À la date de la demande
                  </span>
                  {pillSolde(soldeAnticipe, loadingAnticipe)}
                </div>
              )}
              {soldeApres !== null && (
                <div
                  className="border-ink-300/60 flex items-center justify-between border-t px-4 py-3"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR_TYPE[option.code]}) 12%, white)`,
                  }}
                >
                  <span className="text-ink-500 text-sm font-semibold">Après la demande</span>
                  {pillSolde(soldeApres)}
                </div>
              )}
            </div>
          ) : (
            <p className="text-ink-500 mt-1 px-1 text-xs">
              Aucun solde associé à ce type d&rsquo;absence.
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
            maxLength={NOTE_LONGUEUR_MAX}
            placeholder="Ex. mariage d'un proche, rendez-vous médical…"
            className="mt-1 w-full rounded-none!"
          />
          <p
            className={`mt-1 px-1 text-right text-xs ${
              note.length >= NOTE_LONGUEUR_MAX
                ? "text-status-danger-fg"
                : note.length >= NOTE_LONGUEUR_ALERTE
                  ? "text-status-warning-fg"
                  : "text-ink-500"
            }`}
          >
            {note.length}/{NOTE_LONGUEUR_MAX}
          </p>
        </div>

        {error && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Bandeau de validation collé en bas de la zone scrollable de la
          popin (`position: sticky`, ancré au conteneur `overflow-y-auto` de
          `Modal`) — reste visible pendant qu'on scrolle un contenu long
          (période multi-semaines, détail "voir" déployé...). Marges
          négatives pour reprendre toute la largeur du panneau malgré le
          padding du corps de la popin. */}
      <div className="bg-surface-card border-ink-300/60 sticky bottom-0 -mx-6 border-t px-6 py-3">
        <Button
          onClick={handleSubmit}
          disabled={envoiEnCours || soldeNegatif}
          className="rounded-card w-fit px-6 py-3.5"
        >
          <Send size={16} />
          Envoyer la demande
        </Button>
      </div>
    </Modal>
  );
}
