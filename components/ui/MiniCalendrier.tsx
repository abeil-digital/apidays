"use client";

import { useState, type MouseEvent } from "react";
import { Plus, Trash2 } from "lucide-react";

/**
 * MiniCalendrier — vue mensuelle compacte (grille L-V, week-ends masqués)
 * avec une pastille de couleur par jour, façon "année en un coup d'œil".
 * Composant DS pur/présentationnel : aucune notion métier (DJI/CPI/férié...)
 * n'est connue ici, tout passe par les props `tipoDuJour`/`estEnGroupe` —
 * voir `/design-system` pour un exemple d'appel avec données figées.
 *
 * Règles de gestion :
 * - Semaine de 5 colonnes (L M M J V) — les week-ends ne sont jamais
 *   affichés, y compris dans le décompte des jours d'une période.
 * - Un jour ne porte qu'une seule pastille. La couleur/le type à afficher
 *   est décidé par l'appelant via `tipoDuJour` (l'appelant arbitre les
 *   priorités entre types s'il y en a plusieurs le même jour — ex. dans
 *   Calendrier : férié > congé imposé (CPI) > demi-journée imposée (DJI)).
 * - Jours consécutifs regroupés en barre continue ("pilule") : l'arrondi ne
 *   marque que les extrémités RÉELLES de la période, jamais la fin d'une
 *   ligne d'affichage. Un vendredi qui se prolonge le lundi suivant (période
 *   continue au-delà du week-end masqué) reste donc écarré des deux côtés.
 *   La continuité entre deux jours est décidée par l'appelant via
 *   `estEnGroupe` (par ex. un jour férié à l'intérieur d'un congé n'a pas à
 *   interrompre visuellement la période, même s'il change de couleur) — par
 *   défaut (`estEnGroupe` non fourni), seuls deux jours de même `tipo`
 *   fusionnent. Un jour sans aucune pastille (travaillé) interrompt toujours
 *   le groupe : arrondi de part et d'autre de la coupure.
 * - Anti-seam : les jours consécutifs d'une même ligne partageant le groupe
 *   ET l'apparence exacte (même couleur/variante — voir `apparenceKey`) sont
 *   fusionnés en UN SEUL élément DOM (`PeriodeSegment`, `grid-column: span
 *   N`) plutôt que N `<span>` collés. Deux `<span>` de même couleur côte à
 *   côte peuvent laisser un liseré de sous-pixel selon le navigateur/zoom ;
 *   un seul rectangle de fond l'élimine par construction. Un jour dont la
 *   couleur diffère de son voisin (ex. un férié au milieu d'un congé) reste
 *   son propre élément — ce n'est pas un artefact, c'est une vraie frontière
 *   de couleur, mais il garde l'arrondi de groupe (pas de coin arrondi côté
 *   voisin de même groupe).
 * - Survol : survoler n'importe quel jour d'une période en surbrillance
 *   `brightness-110` TOUTE la période (tous ses segments, fusionnés ou non),
 *   pas seulement le jour survolé — état porté par un `groupeId` (date ISO
 *   du vrai début de période) commun à tous les jours du groupe. Pas de
 *   scale ni de liseré/ring au survol : ça casse la continuité visuelle
 *   d'une barre groupée (essayé puis retiré, voir historique).
 * - Écart fixe de 3px entre deux lignes de semaine.
 *
 * Convention demi-journée (variante "moitié") : gauche = matin, droite =
 * après-midi (lecture chronologique gauche→droite) — la moitié pleine
 * indique la demi-journée réellement posée, l'autre est à 45% d'alpha
 * (`color-mix(in srgb, couleur 45%, white)`). Un jour "moitié" n'est jamais
 * fusionné avec un voisin (`apparenceKey` lui donne une clé unique par
 * date) — le dégradé gauche/droite n'a de sens qu'à l'échelle d'un seul jour.
 *
 * Variante "partage" (cas à la marge) : un jour couvert par DEUX types
 * pleins à la fois (ex. une DJI qui tombe sur un jour par ailleurs pris en
 * congé imposé) — chaque moitié dans sa couleur pleine, sans alpha,
 * contrairement à "moitié" qui n'a qu'une seule couleur (l'autre moitié
 * étant sa version alpha 45%). Jamais fusionné avec un voisin non plus.
 *
 * `onJourClick` (optionnel) : rend cliquable tout jour porteur d'une
 * pastille (curseur pointeur, pas les jours travaillés/vides). Pour un
 * segment fusionné, l'ISO renvoyé est celui du premier jour du segment —
 * suffisant pour que l'appelant retrouve à quelle période/quel jour ça
 * correspond, sans avoir besoin de savoir sur quel jour précis du segment
 * le clic a eu lieu. Reçoit aussi le `DOMRect` de l'élément cliqué, pour
 * positionner un popover/snippet juste en dessous côté appelant.
 */

export const MOIS_FR = [
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

const JOURS_SEMAINE_COURT = ["L", "M", "M", "J", "V"];

export interface PastilleJour {
  /** Classe(s) Tailwind pour le fond plein (ex. "bg-cp"). Ignoré si `moitie`/`partage` est fourni. */
  classeFond?: string;
  /** Variante demi-journée : couleur CSS pleine (ex. "var(--color-dji)") + côté posé. */
  moitie?: { couleur: string; cote: "gauche" | "droite" };
  /**
   * Cas à la marge : un jour couvert par deux types différents à la fois
   * (ex. une DJI qui tombe sur un jour par ailleurs pris en congé imposé) —
   * chaque moitié dans sa couleur pleine, contrairement à `moitie` qui n'a
   * qu'une seule couleur (l'autre moitié étant sa version alpha 45%).
   */
  partage?: { gauche: string; droite: string };
}

interface CelluleJour {
  jour: number | null;
  iso: string | null;
  pastille: PastilleJour | null;
}

function genererSemaines(
  annee: number,
  moisIndex: number,
  tipoDuJour: (iso: string) => PastilleJour | null,
): CelluleJour[] {
  const nbJours = new Date(Date.UTC(annee, moisIndex + 1, 0)).getUTCDate();

  const cellules: CelluleJour[] = [];
  let offsetPose = false;
  for (let j = 1; j <= nbJours; j++) {
    const dateUTC = new Date(Date.UTC(annee, moisIndex, j));
    const jourSemaine = dateUTC.getUTCDay(); // 0=dimanche..6=samedi
    if (jourSemaine === 0 || jourSemaine === 6) continue;

    if (!offsetPose) {
      const offset = jourSemaine - 1; // lundi=0..vendredi=4
      for (let i = 0; i < offset; i++) cellules.push({ jour: null, iso: null, pastille: null });
      offsetPose = true;
    }

    const iso = dateUTC.toISOString().slice(0, 10);
    cellules.push({ jour: j, iso, pastille: tipoDuJour(iso) });
  }
  while (cellules.length % 5 !== 0) cellules.push({ jour: null, iso: null, pastille: null });

  return cellules;
}

/** Date calendaire adjacente (delta jours, +/-), y compris week-end — pour
 * savoir si une période se poursuit au-delà d'une fin de ligne (ven→lun). */
function jourAdjacent(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function memePastille(a: PastilleJour, b: PastilleJour): boolean {
  if (a.moitie || b.moitie) return false;
  return a.classeFond === b.classeFond;
}

/**
 * Clé d'apparence exacte d'une pastille — sert à fusionner en un seul
 * élément DOM les jours consécutifs (même ligne) qui doivent avoir un rendu
 * strictement identique, pour éviter tout liseré/seam de sous-pixel entre
 * deux `<span>` de même couleur collés l'un à l'autre. Les demi-journées
 * gardent une clé unique par date : leur dégradé gauche/droite n'a de sens
 * qu'à l'échelle d'un seul jour, jamais fusionné avec un voisin.
 */
function apparenceKey(pastille: PastilleJour | null, iso: string): string | null {
  if (!pastille) return null;
  if (pastille.moitie || pastille.partage) return `m:${iso}`;
  return `f:${pastille.classeFond}`;
}

function JourPastille({
  jour,
  iso,
  pastille,
  isStart,
  isEnd,
  isHovered,
  estAujourdhui,
  agrandi,
  texteJour,
  onSurvol,
  onJourClick,
  onJourVideClick,
  onJourSupprimerClick,
}: {
  jour: number;
  iso: string;
  pastille: PastilleJour | null;
  isStart: boolean;
  isEnd: boolean;
  isHovered: boolean;
  estAujourdhui: boolean;
  agrandi?: boolean;
  texteJour?: string;
  onSurvol: (survole: boolean) => void;
  onJourClick?: (iso: string, ancre: DOMRect) => void;
  onJourSupprimerClick?: (iso: string, ancre: DOMRect) => void;
  /**
   * Clic sur un jour SANS congé (20/08/2026) — distinct d'`onJourClick`
   * (jours porteurs d'une pastille) : sémantique différente, ouvrir "Poser
   * un congé" pré-rempli plutôt qu'afficher le détail d'une période
   * existante. Au survol, le chiffre du jour est remplacé par un petit "+"
   * vert (`text-mint`, couleur de la card "Poser un congé") annonçant
   * l'action. Opt-in, sans effet sur les appelants qui ne le passent pas.
   */
  onJourVideClick?: (iso: string, ancre: DOMRect) => void;
}) {
  // Grossi (16/08/2026, card "Calendrier" d'Accueil2) — typo des jours
  // recalée sur celle des dates de "Prochains jours off" (`PeriodeAvecPastilles`
  // en mode `grand`, `text-sm`/14px), case agrandie en conséquence — opt-in
  // pour ne pas toucher le format par défaut du composant (Mon calendrier).
  const hauteur = agrandi ? "h-9" : "h-7";
  const largeur = agrandi ? "w-9" : "w-7";
  // `texteJour` (20/08/2026) — override explicite de la taille de police,
  // indépendant d'`agrandi` (qui change aussi la taille/forme de la case et
  // l'en-tête du mois) : pour un appelant qui veut UNIQUEMENT grossir le
  // chiffre du jour, pas le reste. Opt-in, `agrandi` reste la valeur par
  // défaut si absent.
  const texte = texteJour ?? (agrandi ? "text-sm" : "text-xs");
  // "Aujourd'hui" : un cercle serré autour du seul chiffre (jamais la case
  // entière), toujours parfaitement rond — indépendant de la forme
  // carrée/pilule de la pastille de congé sous-jacente, qui n'est jamais
  // altérée par ce contour.
  function chiffreAujourdhui(couleurContour: string) {
    return estAujourdhui ? (
      <span
        className={`ring-2 ring-inset ${couleurContour} flex aspect-square h-[1.6em] items-center justify-center rounded-full`}
      >
        {jour}
      </span>
    ) : (
      jour
    );
  }

  // Poubelle en sur-impression (21/08/2026) — crossfade avec le chiffre au
  // survol de la case, même principe que le "+" des jours vides plus bas
  // (`group`/`group-hover`) : aucun changement de taille de case, la case
  // reste `relative` et les deux contenus (chiffre, poubelle) se superposent
  // exactement. `stopPropagation` : la poubelle est nichée dans l'élément qui
  // porte `onJourClick`, sans quoi un clic déclencherait les deux handlers.
  function contenuJour(couleurContour: string) {
    const chiffre = chiffreAujourdhui(couleurContour);
    if (!onJourSupprimerClick) return chiffre;
    return (
      <span className="relative flex h-full w-full items-center justify-center">
        <span className="transition-opacity duration-150 group-hover:opacity-0">{chiffre}</span>
        <button
          type="button"
          onClick={(e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onJourSupprimerClick(iso, e.currentTarget.getBoundingClientRect());
          }}
          aria-label="Supprimer"
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          <Trash2 size={agrandi ? 16 : 12} />
        </button>
      </span>
    );
  }

  if (!pastille) {
    return (
      <span
        className={`text-ink-500 group flex ${hauteur} ${largeur} items-center justify-center ${agrandi ? "rounded-none" : "rounded-full"} ${texte} ${onJourVideClick ? "cursor-pointer" : ""}`}
        onClick={
          onJourVideClick
            ? (e: MouseEvent<HTMLSpanElement>) =>
                onJourVideClick(iso, e.currentTarget.getBoundingClientRect())
            : undefined
        }
      >
        <span className={onJourVideClick ? "group-hover:hidden" : ""}>
          {chiffreAujourdhui("ring-ink-900")}
        </span>
        {onJourVideClick && (
          <Plus
            className="text-mint hidden group-hover:block"
            size={agrandi ? 18 : 14}
            strokeWidth={2.5}
          />
        )}
      </span>
    );
  }

  // Jours isolés → pastille ronde ; jours consécutifs du même groupe → barre
  // continue (coins arrondis seulement aux extrémités du groupe, façon pilule).
  // Carrée plutôt que ronde en mode `agrandi` (16/08/2026, card "Calendrier"
  // d'Accueil2) — pas d'arrondi, ni aux extrémités de groupe.
  const groupe = !(isStart && isEnd);
  const forme = agrandi
    ? "rounded-none"
    : groupe
      ? `${isStart ? "rounded-l-full" : ""} ${isEnd ? "rounded-r-full" : ""}`
      : "rounded-full";
  const taille = groupe ? `${hauteur} w-full` : `${hauteur} ${largeur}`;
  // Le survol met en avant toute la période (pas juste le jour survolé) —
  // luminosité plutôt qu'un scale, pour ne pas casser la continuité visuelle
  // d'une barre groupée.
  const survol = isHovered ? "brightness-110" : "";
  const curseur = onJourClick ? "cursor-pointer" : "";
  const base = `group flex ${taille} items-center justify-center ${forme} ${texte} font-bold transition-[filter] duration-150 ${survol} ${curseur}`;
  const evenements = {
    onMouseEnter: () => onSurvol(true),
    onMouseLeave: () => onSurvol(false),
    onClick: onJourClick
      ? (e: MouseEvent<HTMLSpanElement>) =>
          onJourClick(iso, e.currentTarget.getBoundingClientRect())
      : undefined,
  };

  if (pastille.partage) {
    const { gauche, droite } = pastille.partage;
    const gradient = `linear-gradient(to right, ${gauche} 50%, ${droite} 50%)`;
    return (
      <span className={`${base} text-white`} style={{ background: gradient }} {...evenements}>
        {contenuJour("ring-white")}
      </span>
    );
  }

  if (!pastille.moitie) {
    return (
      <span className={`${base} ${pastille.classeFond} text-white`} {...evenements}>
        {contenuJour("ring-white")}
      </span>
    );
  }

  const { couleur, cote } = pastille.moitie;
  const clair = `color-mix(in srgb, ${couleur} 45%, white)`;
  const gradient =
    cote === "gauche"
      ? `linear-gradient(to right, ${couleur} 50%, ${clair} 50%)`
      : `linear-gradient(to right, ${clair} 50%, ${couleur} 50%)`;

  return (
    <span className={`${base} text-white`} style={{ background: gradient }} {...evenements}>
      {contenuJour("ring-white")}
    </span>
  );
}

/**
 * Fusion de 2+ jours consécutifs (même ligne, même apparence exacte) en un
 * seul élément DOM — un seul rectangle de fond plutôt que N `<span>` collés,
 * pour ne jamais laisser apparaître de liseré de sous-pixel entre deux jours
 * de la même période. Les chiffres restent alignés sur les colonnes de la
 * grille du dessous via une sous-grille interne de même largeur.
 */
function PeriodeSegment({
  jours,
  isos,
  isoPremierJour,
  classeFond,
  isStart,
  isEnd,
  isHovered,
  estAujourdhui,
  agrandi,
  texteJour,
  onSurvol,
  onJourClick,
  onJourSupprimerClick,
}: {
  jours: number[];
  isos: string[];
  isoPremierJour: string;
  classeFond: string;
  isStart: boolean;
  isEnd: boolean;
  isHovered: boolean;
  estAujourdhui?: (iso: string) => boolean;
  agrandi?: boolean;
  texteJour?: string;
  onSurvol: (survole: boolean) => void;
  onJourClick?: (iso: string, ancre: DOMRect) => void;
  onJourSupprimerClick?: (iso: string, ancre: DOMRect) => void;
}) {
  const forme = agrandi
    ? "rounded-none"
    : `${isStart ? "rounded-l-full" : ""} ${isEnd ? "rounded-r-full" : ""}`;
  const survol = isHovered ? "brightness-110" : "";
  const curseur = onJourClick ? "cursor-pointer" : "";
  // En mode `agrandi`, la hauteur ne peut pas dépendre des cases voisines
  // `aspect-square` (une semaine entière peut être fusionnée en une seule
  // barre, sans aucune case voisine dans la ligne pour fixer sa hauteur —
  // `h-full` retombait alors sur un filet de sécurité plus court que les
  // autres lignes, rendu inégal). `aspect-ratio: N/1` reproduit directement
  // "N colonnes de large, 1 de haut" : même hauteur qu'une case `aspect-square`
  // de la même grille, quel que soit N, sans dépendre du contenu des lignes
  // voisines.
  const texte = texteJour ?? (agrandi ? "text-sm" : "text-xs");

  return (
    <div
      className={`group relative grid ${agrandi ? "" : "h-7"} items-center ${forme} ${classeFond} ${texte} font-bold text-white transition-[filter] duration-150 ${survol} ${curseur}`}
      style={{
        gridColumn: `span ${jours.length}`,
        gridTemplateColumns: `repeat(${jours.length}, 1fr)`,
        aspectRatio: agrandi ? `${jours.length} / 1` : undefined,
      }}
      onMouseEnter={() => onSurvol(true)}
      onMouseLeave={() => onSurvol(false)}
      onClick={
        onJourClick
          ? (e: MouseEvent<HTMLDivElement>) =>
              onJourClick(isoPremierJour, e.currentTarget.getBoundingClientRect())
          : undefined
      }
    >
      {/* `contents` (21/08/2026) — laisse les chiffres directement enfants
          de la grille (alignement sur les sous-colonnes inchangé) tout en
          appliquant un fondu commun au survol, en crossfade avec la
          poubelle en sur-impression sur toute la barre (une seule, centrée,
          pas une par jour — la barre entière représente UNE période). */}
      <span
        className={`contents ${onJourSupprimerClick ? "transition-opacity duration-150 group-hover:opacity-0" : ""}`}
      >
        {jours.map((j, idx) =>
          estAujourdhui?.(isos[idx]) ? (
            <span key={j} className="flex h-full items-center justify-center">
              <span className="flex aspect-square h-[1.6em] items-center justify-center rounded-full ring-2 ring-white ring-inset">
                {j}
              </span>
            </span>
          ) : (
            <span key={j} className="flex h-full items-center justify-center">
              {j}
            </span>
          ),
        )}
      </span>
      {onJourSupprimerClick && (
        <button
          type="button"
          onClick={(e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onJourSupprimerClick(isoPremierJour, e.currentTarget.getBoundingClientRect());
          }}
          aria-label="Supprimer"
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          <Trash2 size={agrandi ? 18 : 14} />
        </button>
      )}
    </div>
  );
}

function sontContinus(
  isoA: string | null,
  pA: PastilleJour | null,
  isoB: string | null,
  pB: PastilleJour | null,
  estEnGroupe?: (isoA: string, isoB: string) => boolean,
): boolean {
  if (!isoA || !isoB || !pA || !pB) return false;
  if (estEnGroupe?.(isoA, isoB)) return true;
  return memePastille(pA, pB);
}

/**
 * Identifiant de groupe = date ISO du début réel de la période — porté par
 * tous les jours d'une même barre, pour que le survol de n'importe lequel
 * mette en avant la période entière plutôt que le seul jour survolé.
 */
function calculerGroupeIds(
  semaines: CelluleJour[],
  tipoDuJour: (iso: string) => PastilleJour | null,
  estEnGroupe?: (isoA: string, isoB: string) => boolean,
): (string | null)[] {
  const ids: (string | null)[] = [];
  let courant: string | null = null;

  for (const cellule of semaines) {
    if (!cellule.iso || !cellule.pastille) {
      courant = null;
      ids.push(null);
      continue;
    }
    const veille = jourAdjacent(cellule.iso, -1);
    const estSuite = sontContinus(
      veille,
      tipoDuJour(veille),
      cellule.iso,
      cellule.pastille,
      estEnGroupe,
    );
    if (!estSuite || !courant) {
      courant = cellule.iso;
    }
    ids.push(courant);
  }

  return ids;
}

type ItemRendu =
  | { type: "vide" }
  | {
      type: "seul";
      jour: number;
      iso: string;
      pastille: PastilleJour | null;
      isStart: boolean;
      isEnd: boolean;
      groupeId: string | null;
    }
  | {
      type: "fusion";
      jours: number[];
      isos: string[];
      isoPremierJour: string;
      classeFond: string;
      isStart: boolean;
      isEnd: boolean;
      groupeId: string;
    };

/**
 * Regroupe les jours consécutifs d'une même ligne partageant le même groupe
 * ET la même apparence exacte (`apparenceKey`) en un seul item "fusion" —
 * c'est ce regroupement qui élimine les liserés de sous-pixel entre jours
 * de même couleur (voir `PeriodeSegment`). Un jour dont l'apparence diffère
 * de son voisin (ex. un férié au milieu d'un congé) reste un item "seul",
 * mais garde son arrondi de groupe (`isStart`/`isEnd`) comme avant.
 */
function calculerItemsRendu(
  semaines: CelluleJour[],
  isStarts: boolean[],
  isEnds: boolean[],
  groupeIds: (string | null)[],
): ItemRendu[] {
  const items: ItemRendu[] = [];

  for (let i = 0; i < semaines.length;) {
    const finLigne = i - (i % 5) + 5;
    const cellule = semaines[i];

    if (!cellule.jour || !cellule.iso) {
      items.push({ type: "vide" });
      i += 1;
      continue;
    }

    if (!cellule.pastille) {
      items.push({
        type: "seul",
        jour: cellule.jour,
        iso: cellule.iso,
        pastille: null,
        isStart: isStarts[i],
        isEnd: isEnds[i],
        groupeId: groupeIds[i],
      });
      i += 1;
      continue;
    }

    const apparence = apparenceKey(cellule.pastille, cellule.iso);
    let j = i + 1;
    while (j < finLigne && groupeIds[j] !== null && groupeIds[j] === groupeIds[i]) {
      const suivante = semaines[j];
      if (!suivante.iso || !suivante.pastille) break;
      if (apparenceKey(suivante.pastille, suivante.iso) !== apparence) break;
      j += 1;
    }

    if (j - i === 1) {
      items.push({
        type: "seul",
        jour: cellule.jour,
        iso: cellule.iso,
        pastille: cellule.pastille,
        isStart: isStarts[i],
        isEnd: isEnds[i],
        groupeId: groupeIds[i],
      });
    } else {
      items.push({
        type: "fusion",
        jours: semaines.slice(i, j).map((c) => c.jour as number),
        isos: semaines.slice(i, j).map((c) => c.iso as string),
        isoPremierJour: cellule.iso,
        classeFond: cellule.pastille.classeFond ?? "",
        isStart: isStarts[i],
        isEnd: isEnds[j - 1],
        groupeId: groupeIds[i] as string,
      });
    }

    i = j;
  }

  return items;
}

export interface MiniCalendrierProps {
  annee: number;
  moisIndex: number;
  /** Résout la pastille (couleur/variante) d'un jour donné, ou `null` si le jour est travaillé. */
  tipoDuJour: (iso: string) => PastilleJour | null;
  /**
   * Décide si deux jours adjacents (dates calendaires réelles, week-ends
   * inclus) appartiennent au même groupe visuel — par défaut, seuls deux
   * jours de pastille strictement identique fusionnent. À fournir pour des
   * règles métier (ex. un férié à l'intérieur d'une période de congé ne doit
   * pas l'interrompre visuellement).
   */
  estEnGroupe?: (isoA: string, isoB: string) => boolean;
  /**
   * Rend chaque jour porteur d'une pastille cliquable — pas de handler = pas
   * de curseur pointeur. `ancre` = position de l'élément cliqué
   * (`getBoundingClientRect()`), pour positionner un popover/snippet juste
   * en dessous côté appelant.
   */
  onJourClick?: (iso: string, ancre: DOMRect) => void;
  /**
   * Rend chaque jour SANS pastille cliquable (20/08/2026) — distinct
   * d'`onJourClick`. Au survol, le chiffre du jour est remplacé par un
   * petit "+" vert. Pas de handler = comportement inchangé (jour vide non
   * cliquable).
   */
  onJourVideClick?: (iso: string, ancre: DOMRect) => void;
  /**
   * Poubelle en sur-impression au survol d'un jour PORTEUR d'une pastille
   * (21/08/2026) — crossfade avec le chiffre du jour (ou, pour une période
   * fusionnée en une seule barre, un seul pictogramme centré sur toute la
   * barre), sans changer la taille de la case. `ancre` = position de
   * l'élément survolé, comme `onJourClick`. Opt-in, sans effet sur les
   * appelants qui ne le passent pas.
   */
  onJourSupprimerClick?: (iso: string, ancre: DOMRect) => void;
  /**
   * Restreint `onJourSupprimerClick` à certains jours (21/08/2026) — ex.
   * exclure les jours fériés d'une suppression possible depuis le
   * calendrier. `undefined`/absent : tout jour porteur d'une pastille est
   * supprimable dès que `onJourSupprimerClick` est fourni.
   */
  estJourSupprimable?: (iso: string) => boolean;
  /**
   * Ne rend qu'un sous-ensemble des semaines du mois (index 0-based,
   * inclusif) — "demi-calendrier" pour un aperçu de période à cheval sur
   * deux mois (ex. ne montrer que la fin du mois de début). L'en-tête
   * jours de la semaine reste toujours affiché. Par défaut : tout le mois.
   */
  premiereSemaine?: number;
  derniereSemaine?: number;
  /**
   * Met un jour en surbrillance (`brightness-110`, même effet que le survol)
   * indépendamment de la souris — ex. mettre en avant les jours couverts par
   * une popin ouverte côté appelant. Un jour "vrai" reste en surbrillance
   * tant que le prédicat renvoie `true`, se cumule avec le survol normal
   * (l'un ou l'autre suffit).
   */
  estMisEnAvant?: (iso: string) => boolean;
  /**
   * N'affiche que le snippet (nom du mois + grille), sans la carte
   * `bg-surface-card`/ombre qui l'entoure par défaut — pour un appelant qui
   * fournit sa propre carte/en-tête (ex. carte "Calendrier" d'Accueil2, au
   * format des autres encarts de la page plutôt que celui par défaut du
   * composant), tout en gardant le même snippet (mêmes dimensions) qu'un
   * mois affiché par ailleurs (ex. Mon calendrier).
   */
  sansCarte?: boolean;
  /**
   * Marque un jour d'un simple contour (jamais un remplissage) — pour
   * distinguer "aujourd'hui" sans le confondre visuellement avec une
   * pastille de congé. Se cumule avec une pastille existante ce jour-là.
   */
  estAujourdhui?: (iso: string) => boolean;
  /**
   * Grossit +20% la typo des jours et la hauteur des lignes (16/08/2026,
   * card "Calendrier" d'Accueil2) — n'affecte pas la largeur des pastilles
   * ni l'en-tête du mois. Opt-in, sans effet sur le format par défaut.
   */
  agrandi?: boolean;
  /**
   * Classes additionnelles fusionnées sur la card `bg-surface-card`
   * englobante (20/08/2026) — ex. dimensions explicites (`w-[250px]
   * h-[290px]`) pour un appelant qui veut forcer une taille précise plutôt
   * que la taille naturelle du contenu. Sans effet si `sansCarte`. Opt-in,
   * aucun effet sur les appelants existants qui ne le passent pas.
   */
  className?: string;
  /**
   * Override explicite de la taille de police des chiffres de jour
   * (20/08/2026), indépendant d'`agrandi` — n'affecte ni la taille des
   * cases, ni l'en-tête du mois, ni l'en-tête des jours de la semaine (L M M
   * J V). Opt-in, `agrandi` reste la valeur par défaut si absent.
   */
  texteJour?: string;
  /**
   * Override explicite du padding interne de la card (20/08/2026, défaut
   * `p-4`) — ex. `p-6` pour une card plus aérée. Séparé de `className` (qui
   * est simplement concaténé, donc pas fiable pour *remplacer* une classe
   * déjà présente sur le composant) afin que l'override gagne à coup sûr.
   * Sans effet si `sansCarte`. Opt-in, aucun effet sur les appelants
   * existants qui ne le passent pas.
   */
  paddingClassName?: string;
}

export function MiniCalendrier({
  annee,
  moisIndex,
  tipoDuJour,
  estEnGroupe,
  onJourClick,
  onJourVideClick,
  onJourSupprimerClick,
  estJourSupprimable,
  premiereSemaine,
  derniereSemaine,
  estMisEnAvant,
  sansCarte,
  estAujourdhui,
  agrandi,
  className,
  texteJour,
  paddingClassName,
}: MiniCalendrierProps) {
  const [groupeSurvole, setGroupeSurvole] = useState<string | null>(null);
  const semaines = genererSemaines(annee, moisIndex, tipoDuJour);
  const groupeIds = calculerGroupeIds(semaines, tipoDuJour, estEnGroupe);
  const isStarts = semaines.map((cellule) => {
    const veille = cellule.iso ? jourAdjacent(cellule.iso, -1) : null;
    return !sontContinus(
      veille,
      veille ? tipoDuJour(veille) : null,
      cellule.iso,
      cellule.pastille,
      estEnGroupe,
    );
  });
  const isEnds = semaines.map((cellule) => {
    const lendemain = cellule.iso ? jourAdjacent(cellule.iso, 1) : null;
    return !sontContinus(
      cellule.iso,
      cellule.pastille,
      lendemain,
      lendemain ? tipoDuJour(lendemain) : null,
      estEnGroupe,
    );
  });
  const totalSemaines = semaines.length / 5;
  const debutSemaine = premiereSemaine ?? 0;
  const finSemaine = derniereSemaine ?? totalSemaines - 1;
  const debutIndex = debutSemaine * 5;
  const finIndex = (finSemaine + 1) * 5;
  const items = calculerItemsRendu(
    semaines.slice(debutIndex, finIndex),
    isStarts.slice(debutIndex, finIndex),
    isEnds.slice(debutIndex, finIndex),
    groupeIds.slice(debutIndex, finIndex),
  );

  const grille = (
    <>
      {/* Toujours plus grand que le contenu qu'il coiffe (en-tête jours et
          chiffres alignés sur `text-xs`/`text-sm`, en mode `agrandi`) — un
          titre de section plus petit que son propre contenu inverse la
          hiérarchie de lecture. Gris (`text-ink-500`, charte DS) plutôt que
          noir en mode `agrandi` — titre secondaire, pas la donnée principale
          de la card. */}
      <div
        className={`mb-3 shrink-0 text-center font-bold ${agrandi ? "text-ink-500 text-base" : "text-ink-900 text-base"}`}
      >
        {MOIS_FR[moisIndex]}
      </div>
      {/* `flex-1 content-between` (20/08/2026) — sur une card à hauteur
          fixe (ex. `h-[290px]` côté Accueil), répartit l'espace vertical
          disponible entre les lignes de semaines plutôt que de le laisser
          vide en bas : le nombre de semaines varie (5 ou 6) selon le mois,
          donc un `gap-y` fixe en px aurait soit laissé du vide soit débordé
          selon les mois. `gap-y-[3px]` reste l'écart plancher entre lignes.
          Sans effet si le conteneur n'a pas de hauteur explicite (callers
          existants sans `className` de hauteur fixe). */}
      <div className="grid flex-1 grid-cols-5 content-between gap-y-[3px]">
        {JOURS_SEMAINE_COURT.map((j, i) => (
          <div
            key={i}
            className={`text-ink-900 text-center font-bold ${agrandi ? "text-[13px]" : "text-[14px]"}`}
          >
            {j}
          </div>
        ))}
        {items.map((item, i) => {
          if (item.type === "vide") {
            return (
              <div
                key={i}
                className={`flex items-center justify-center ${agrandi ? "border-ink-300/40 aspect-square border" : ""}`}
              >
                <span className={agrandi ? "h-9 w-9" : "h-7 w-7"} />
              </div>
            );
          }

          if (item.type === "seul") {
            return (
              <div
                key={i}
                className={`flex items-center justify-center ${agrandi ? "border-ink-300/40 aspect-square border" : ""}`}
              >
                <JourPastille
                  jour={item.jour}
                  iso={item.iso}
                  pastille={item.pastille}
                  isStart={item.isStart}
                  isEnd={item.isEnd}
                  isHovered={
                    (item.groupeId !== null && item.groupeId === groupeSurvole) ||
                    (estMisEnAvant?.(item.iso) ?? false)
                  }
                  estAujourdhui={estAujourdhui?.(item.iso) ?? false}
                  agrandi={agrandi}
                  texteJour={texteJour}
                  onSurvol={(survole) => setGroupeSurvole(survole ? item.groupeId : null)}
                  onJourClick={item.pastille ? onJourClick : undefined}
                  onJourVideClick={item.pastille ? undefined : onJourVideClick}
                  onJourSupprimerClick={
                    item.pastille && (estJourSupprimable?.(item.iso) ?? true)
                      ? onJourSupprimerClick
                      : undefined
                  }
                />
              </div>
            );
          }

          return (
            <PeriodeSegment
              key={i}
              jours={item.jours}
              isos={item.isos}
              isoPremierJour={item.isoPremierJour}
              classeFond={item.classeFond}
              isStart={item.isStart}
              isEnd={item.isEnd}
              isHovered={
                item.groupeId === groupeSurvole || item.isos.some((iso) => estMisEnAvant?.(iso))
              }
              estAujourdhui={estAujourdhui}
              agrandi={agrandi}
              texteJour={texteJour}
              onSurvol={(survole) => setGroupeSurvole(survole ? item.groupeId : null)}
              onJourClick={onJourClick}
              onJourSupprimerClick={
                (estJourSupprimable?.(item.isoPremierJour) ?? true)
                  ? onJourSupprimerClick
                  : undefined
              }
            />
          );
        })}
      </div>
    </>
  );

  if (sansCarte) return grille;

  return (
    <div
      className={`bg-surface-card flex flex-col shadow-sm ${paddingClassName ?? "p-4"} ${agrandi ? "" : "rounded-xl"} ${className ?? ""}`}
    >
      {grille}
    </div>
  );
}
