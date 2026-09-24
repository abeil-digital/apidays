"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Newspaper, PlusCircle } from "lucide-react";
import { getAujourdhui } from "@/lib/aujourdhui";
import { todayISO } from "@/lib/format";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { SoldeCard } from "@/components/ui/SoldeCard";
import { classeFondTypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import {
  SnippetJourCalendrier,
  type JourCalendrierClique,
} from "@/components/demandes/SnippetJourCalendrier";
import { CompteurTypologies } from "@/components/demandes/CompteurTypologies";
import { compterTypologies } from "@/components/demandes/compterTypologies";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { ActiviteRecenteFeed } from "@/components/dashboard/ActiviteRecenteFeed";
import { DemandesAEtudierCard } from "@/components/dashboard/DemandesAEtudierCard";
import { CollaborateursEnCongeCard } from "@/components/dashboard/CollaborateursEnCongeCard";
import { FaqCard } from "@/components/dashboard/FaqCard";
import { ProchainsJoursOffCard } from "@/components/dashboard/ProchainsJoursOffCard";
import { PoserDemandeModal } from "@/components/nouvelle-demande/PoserDemandeModal";
import { SoldeDetailPanel } from "@/components/suivre/SoldeDetailPanel";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";
import {
  DetailJourCommunPanel,
  type JourCommunClique,
} from "@/components/demandes/DetailJourCommunPanel";
import type { Demande } from "@/lib/types";

type CodeSoldeDetail = "CP" | "RTT" | "CPA";

function isoDate(annee: number, moisIndex: number, jour: number): string {
  return new Date(Date.UTC(annee, moisIndex, jour)).toISOString().slice(0, 10);
}

function ajouterJoursIso(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Tous les mois (année + index) couverts par une plage de dates ISO,
 * bornes incluses — remplace l'ancien rolling 12 mois par une plage dont la
 * longueur dépend de l'onglet actif (jusqu'à la fin de l'année civile ou de
 * la période de référence CP). */
function moisEntre(debutIso: string, finIso: string): { annee: number; moisIndex: number }[] {
  const mois: { annee: number; moisIndex: number }[] = [];
  let annee = Number(debutIso.slice(0, 4));
  let moisIndex = Number(debutIso.slice(5, 7)) - 1;
  const anneeFin = Number(finIso.slice(0, 4));
  const moisIndexFin = Number(finIso.slice(5, 7)) - 1;

  while (annee < anneeFin || (annee === anneeFin && moisIndex <= moisIndexFin)) {
    mois.push({ annee, moisIndex });
    moisIndex += 1;
    if (moisIndex > 11) {
      moisIndex = 0;
      annee += 1;
    }
  }

  return mois;
}

function codeBadgeDemande(demande: Demande): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

/** Sélecteur "Commence : Aujourd'hui / Il y a 3 mois" (15/09/2026, demande
 * explicite de Vincent) — même composant que `SelectAffichage` de
 * `CalendrierCollaborateur.tsx` (`<select>` natif stylé en texte souligné +
 * chevron, duplication assumée), adapté à un libellé fixe plutôt qu'un mois
 * calculé. */
function SelectCommence({ actif, onChange }: { actif: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="relative inline-flex w-fit items-center gap-1.5">
      <span className="text-ink-500 text-xs">Commence :</span>
      <select
        value={actif ? "il_y_a_3_mois" : "aujourdhui"}
        onChange={(e) => onChange(e.target.value === "il_y_a_3_mois")}
        className="text-mint relative appearance-none pr-4 text-xs font-normal underline underline-offset-2 outline-none"
      >
        <option value="aujourdhui">Aujourd&apos;hui</option>
        <option value="il_y_a_3_mois">Il y a 3 mois</option>
      </select>
      <ChevronDown size={11} className="text-mint pointer-events-none absolute right-0" />
    </div>
  );
}

// "Prochains jours off" masquée (14/09/2026, demande explicite de Vincent —
// "je me demande si la vue liste est utile", "sans l'effacer on va rendre
// invisible le mode liste pour que le calendrier prenne toute la largeur en
// 4 colonnes") : le composant et son import restent en place, juste plus
// rendus — repasser ce booléen à `true` restaure l'ancien layout 3 colonnes
// + liste sans rien reconstruire.
const AFFICHER_PROCHAINS_JOURS_OFF = false;

// Nom de la variable CSS du token couleur du type — pour la variante `moitie`
// d'une pastille demi-journée (`tipoDuJour`), qui prend une couleur CSS brute
// plutôt qu'une classe Tailwind. Même procédé que `DetailCongePanel.tsx`/
// `PoserDemandeModal.tsx`.
const VAR_COULEUR_TYPE: Record<TypeBadgeCode, string> = {
  CP: "--color-cp",
  RTT: "--color-rtt",
  CPA: "--color-cpa",
  CSS: "--color-css",
  CE: "--color-ce",
  RECUP: "--color-recup",
  EVT_FAM: "--color-evtfam",
  DJI: "--color-dji",
  CPI: "--color-cpi",
  FERIE: "--color-ferie",
};

/**
 * Accueil collaborateur — écran unique, route `/` (14/08/2026 : remplace
 * l'ancien `DashboardPage` d'origine, supprimé ; le composant a repris ce
 * nom le 28/08/2026, après avoir porté le nom historique "Dashboard2Page"
 * — même logique que `Calendrier2Page`, déjà renommé le 18/08/2026).
 *
 * "Demandes en cours"/"Prochains congés" remplacés par une vue calendrier
 * rolling 9 mois (12 à l'origine, réduit le même jour — "c'est suffisant",
 * demande explicite de Vincent), à partir du mois en cours (14/09/2026,
 * retour en arrière demandé par Vincent — "le sélecteur de calendrier est
 * aussi compliqué en définitive" : remplace les 3 onglets Année en
 * cours/Période de référence CP/Année suivante + leurs bascules "vue
 * complète" du 10/09/2026, jugés trop compliqués à l'usage). Chaque
 * compteur de la légende (`CompteurTypologies`) reste calculé sur CETTE
 * SEULE fenêtre glissante — pas de retour
 * au bug d'origine qui avait motivé les 3 onglets ("22 jours fériés" qui ne
 * voulait rien dire, somme de deux années civiles complètes) : la fenêtre ne
 * s'étend jamais sur plus de 2 années civiles (l'actuelle + la suivante), et
 * chaque jour commun (`anneeVisiblePourCommuns`) n'est compté que s'il tombe
 * dans la fenêtre.
 * Le calendrier affiche les demandes du collaborateur (validées en couleur
 * pleine, en attente en couleur atténuée) fusionnées avec les jours communs
 * (Fériés/CPI/DJI). Colonne latérale légende (CPI/DJI/Fériés + un type par
 * nature de demande utilisée, cliquable pour le détail en lecture seule)
 * retirée le 20/08/2026 — changement de philosophie de cette section, voir
 * CONTEXTE.md. "En attente de validation" est un encart stabilo séparé
 * au-dessus du calendrier (ouvre sa propre popin).
 */
export function DashboardPage() {
  const { utilisateur, loading: loadingUtilisateur } = useUtilisateur();
  const { soldes, loading: loadingSoldes, refetch: refetchSoldes } = useSoldes();
  const {
    demandes,
    loading: loadingDemandes,
    refetch: refetchDemandes,
    marquerVue,
    retirer,
  } = useDemandes();
  const [soldeDetailOuvert, setSoldeDetailOuvert] = useState<CodeSoldeDetail | null>(null);
  const [tiroirActiviteOuvert, setTiroirActiviteOuvert] = useState(false);
  // Fondu du surlignage "n nouvelles décisions" à la fermeture du tiroir
  // journal — voir `fermerTiroirActivite` plus bas pour le détail.
  const [journalFermetureEnCours, setJournalFermetureEnCours] = useState(false);
  const [nouvelleDemandeOuverte, setNouvelleDemandeOuverte] = useState(false);
  // Date pré-remplie de la popin "Poser un congé" (20/08/2026) — non-null
  // uniquement quand ouverte via un clic sur un jour vide du calendrier ;
  // reste `null` pour une ouverture "vierge" via le bouton dédié.
  const [dateNouvelleDemande, setDateNouvelleDemande] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<{ jour: JourCalendrierClique; ancre: DOMRect } | null>(
    null,
  );
  // Détail d'un congé personnel (CP/RTT/CPA) au clic sur le calendrier
  // (14/09/2026, demande explicite de Vincent : "on va tenter un truc" —
  // panneau `DetailCongePanel` à droite du calendrier plutôt que le popover
  // `SnippetJourCalendrier`, qui reste réservé aux jours communs CPI/DJI/
  // Férié, sans détail personnel à afficher). Sa présence pousse le
  // calendrier à se recomposer (4 → 3 mois par ligne, voir plus bas).
  const [demandeSelectionnee, setDemandeSelectionnee] = useState<Demande | null>(null);
  // Card détail pour un jour "commun" (CI = CPI/DJI, Férié), en plus du
  // popover `SnippetJourCalendrier` existant (14/09/2026, demande explicite
  // de Vincent — "traiter en card congé détail les CI... et les FE aussi.
  // Pour le moment tu ne remplaces pas les over") : même emplacement colonne
  // 4 que `DetailCongePanel`, lecture seule (non modifiable par le
  // collaborateur), le popover au survol/clic reste déclenché en parallèle.
  const [jourCommunSelectionne, setJourCommunSelectionne] = useState<JourCommunClique | null>(null);
  // "Commence : Aujourd'hui / Il y a 3 mois" (15/09/2026, demande explicite
  // de Vincent, point 3 du Backlog "Calendrier simplifié") — décale le DÉBUT
  // de la fenêtre glissante de 3 mois en arrière, sans changer sa largeur (9
  // mois). `SelectAffichage` (composant repris de `CalendrierCollaborateur.tsx`,
  // duplication assumée) juste sous le titre "Mon Calendrier".
  const [commenceIlYA3Mois, setCommenceIlYA3Mois] = useState(false);
  // `getAujourdhui()` plutôt que `new Date()` (10/09/2026, demande explicite
  // de Vincent) — pour que le bandeau de date simulée locale entraîne bien la
  // fenêtre de 12 mois glissants ci-dessous.
  const anneeActuelle = getAujourdhui().getFullYear();
  const anneePrecedente = anneeActuelle - 1;
  const anneeSuivante = anneeActuelle + 1;
  // Jours "communs" (Fériés/CPI/DJI) — 3 années possibles désormais
  // (15/09/2026) : la fenêtre glissante peut désormais démarrer jusqu'à 3
  // mois avant le mois en cours ("Il y a 3 mois" ci-dessus), donc franchir le
  // 1er janvier si on est en janvier/février/mars — l'année précédente n'est
  // plus jamais totalement hors champ comme avant ce point.
  const calendrierAnneePrecedente = useCalendrier(anneePrecedente);
  const calendrierAnneeA = useCalendrier(anneeActuelle);
  const calendrierAnneeB = useCalendrier(anneeSuivante);

  const loading =
    loadingUtilisateur ||
    loadingSoldes ||
    loadingDemandes ||
    calendrierAnneePrecedente.loading ||
    calendrierAnneeA.loading ||
    calendrierAnneeB.loading;

  if (loading || !utilisateur || !soldes) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  const todayIso = todayISO();
  // 1er jour du mois en cours (25/08/2026, bug signalé par Vincent) — la
  // fenêtre doit démarrer le 1er du mois, pas littéralement aujourd'hui :
  // sinon un congé déjà posé plus tôt dans le mois (validé ou encore en
  // attente) disparaissait de la légende/du calendrier.
  //
  // Décalage de début (15/09/2026, "Commence : Aujourd'hui / Il y a 3 mois")
  // — `moisIndexDebutBrut` peut être négatif (ex. mois en cours = janvier,
  // décalage -3 → octobre de l'année PRÉCÉDENTE) ; le modulo est reconstruit
  // à la main (`((x % 12) + 12) % 12`) plutôt qu'avec `%` seul, qui renvoie
  // un résultat négatif en JS pour un dividende négatif. La largeur de la
  // fenêtre (9 mois, réduite de 12 le 14/09/2026, "c'est suffisant") ne
  // change jamais, seul son point de départ glisse.
  const decalageMoisDebut = commenceIlYA3Mois ? -3 : 0;
  const moisIndexDebutBrut = getAujourdhui().getMonth() + decalageMoisDebut;
  const moisIndexDebut = ((moisIndexDebutBrut % 12) + 12) % 12;
  const anneeDebutFenetre = anneeActuelle + Math.floor(moisIndexDebutBrut / 12);
  const debutMoisActuel = isoDate(anneeDebutFenetre, moisIndexDebut, 1);
  const moisIndexFinBrut = moisIndexDebutBrut + 8;
  const moisIndexFin = ((moisIndexFinBrut % 12) + 12) % 12;
  const anneeFinFenetre = anneeActuelle + Math.floor(moisIndexFinBrut / 12);
  const finFenetre9Mois = ajouterJoursIso(isoDate(anneeFinFenetre, moisIndexFin + 1, 1), -1);
  const rangeActive = { debut: debutMoisActuel, fin: finFenetre9Mois };
  const moisActifs = moisEntre(rangeActive.debut, rangeActive.fin);

  function calendrierPourAnnee(annee: number) {
    if (annee === anneePrecedente) return calendrierAnneePrecedente;
    if (annee === anneeSuivante) return calendrierAnneeB;
    return calendrierAnneeA;
  }

  // Plus d'exception "année en cours toujours visible" (10/09/2026, retirée
  // à la demande explicite de Vincent) — un calendrier n'est visible aux
  // collaborateurs qu'une fois explicitement publié par l'admin, même pour
  // l'année civile en cours (avant : elle l'était par défaut, indépendamment
  // du statut réel de publication en base).
  function anneeVisiblePourCommuns(annee: number): boolean {
    return Boolean(calendrierPourAnnee(annee).parametrage?.valideLe);
  }

  // Message "calendrier(s) pas encore paramétré(s)" (10/09/2026, généralisé
  // à demande explicite de Vincent) — auparavant affiché uniquement sur
  // l'onglet "Année suivante" ; couvre désormais aussi "En cours" (une
  // année) et "Période de référence" (juin → mai, jusqu'à 2 années à
  // cheval — seule(s) celle(s) non publiée(s) parmi les 2 sont listées).
  const anneesNonParametrees = (() => {
    const anneeDebut = Number(rangeActive.debut.slice(0, 4));
    const anneeFin = Number(rangeActive.fin.slice(0, 4));
    const annees: number[] = [];
    for (let a = anneeDebut; a <= anneeFin; a++) annees.push(a);
    return annees.filter((a) => !anneeVisiblePourCommuns(a));
  })();

  // Listes fusionnées des 2 années potentiellement pertinentes (14/09/2026 —
  // fenêtre de 12 mois glissants, ne touche plus jamais l'année précédente),
  // filtrées aux années effectivement visibles (même règle que les pastilles
  // du calendrier, `anneeVisiblePourCommuns` — les fériés restent toujours
  // visibles) — alimente le compteur par typologie (`compterTypologies`) sur
  // la période active.
  const joursFeriesToutesAnnees = [
    ...calendrierAnneeA.joursFeries,
    ...calendrierAnneeB.joursFeries,
  ];
  const congesImposesVisibles = [
    ...calendrierAnneeA.congesImposes,
    ...calendrierAnneeB.congesImposes,
  ].filter((c) => anneeVisiblePourCommuns(Number(c.debut.slice(0, 4))));
  const djImposeesVisibles = [
    ...calendrierAnneeA.djImposees,
    ...calendrierAnneeB.djImposees,
  ].filter((d) => anneeVisiblePourCommuns(Number(d.date.slice(0, 4))));
  const typologies = compterTypologies({
    demandes,
    rangeActive,
    congesImposes: congesImposesVisibles,
    djImposees: djImposeesVisibles,
    joursFeries: joursFeriesToutesAnnees,
    joursFeriesPourDuree: joursFeriesToutesAnnees,
  });

  // `!d.congeImposeId` (10/09/2026, demande explicite) — sans ce filtre, la
  // demande "CP" auto-générée par un CPI pour ce collaborateur
  // (`ajouterCongeImpose()`) était trouvée EN PREMIER, avant même le CPI
  // lui-même (`communDuJour`/`occupantDuJour` ci-dessous testent
  // `demandeDuJour` avant CPI/DJI) — la case du jour et la popin de détail
  // affichaient donc "CP" au lieu de "CPI" (mauvaise couleur, mauvais
  // libellé) pour un jour pourtant imposé par l'entreprise.
  function demandeDuJour(iso: string): Demande | undefined {
    return demandes.find(
      (d) =>
        d.statut !== "refusé" &&
        d.statut !== "annulé" &&
        iso >= d.debut &&
        iso <= d.fin &&
        !d.congeImposeId,
    );
  }

  // Jours communs, tous types confondus : les Fériés sont montrés même sur
  // une année pas encore publiée (fixes, connus à l'avance). CPI/DJI de
  // l'année EN COURS sont toujours affichés (déjà réels/en vigueur — cette
  // année n'a d'ailleurs jamais de bouton "Publier" côté Calendrier, voir
  // `estAnneeLive` dans CalendrierPage.tsx) ; ceux de l'année À VENIR ne le
  // sont que si le paramétrage a été publié par Delphine — pas encore
  // garantis/définitifs avant ça. Une DJI est une demi-journée (variante
  // `moitie`, matin=gauche/après-midi=droite) — jamais un fond plein, sinon
  // on perd l'info du créneau.
  function communDuJour(iso: string): PastilleJour | null {
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    if (cal.joursFeries.some((f) => f.date === iso)) {
      return { classeFond: classeFondTypeBadge("FERIE") };
    }
    if (!anneeVisiblePourCommuns(annee)) return null;
    if (cal.congesImposes.some((c) => iso >= c.debut && iso <= c.fin)) {
      return { classeFond: classeFondTypeBadge("CPI") };
    }
    const dji = cal.djImposees.find((d) => d.date === iso);
    if (dji) {
      // Couleur CPI plutôt que DJI (20/08/2026, demande explicite, scopée à
      // Accueil) — introduction de la notion "CI" (Congés Imposés = CPI +
      // DJI fusionnés côté collaborateur, la distinction CPI/DJI restant
      // pertinente côté paramétrage Delphine). Forme demi-pastille conservée
      // (utile pour distinguer une demi-journée d'une période complète).
      return {
        moitie: {
          couleur: "var(--color-cpi)",
          cote: dji.demiJournee === "matin" ? "gauche" : "droite",
        },
      };
    }
    return null;
  }

  // Priorité d'affichage : férié > demande personnelle du collaborateur > CPI
  // > DJI (15/09/2026, férié remonté devant la demande — voir plus bas).
  //
  // Demi-journée d'une demande rendue comme telle (25/08/2026, bug signalé
  // par Vincent : "16/09 pour Delphine s'affiche comme une journée") — avant
  // ce fix, un jour occupé par une demande était TOUJOURS un fond plein
  // (`classeFond`), quelle que soit sa vraie couverture. Seuls les bornes
  // (`iso === demande.debut`/`demande.fin`) peuvent être demi-couvertes ; un
  // jour au milieu d'une période multi-jours reste toujours plein. Même
  // variante `moitie` que la pastille DJI juste au-dessus (couleur pleine +
  // côté posé), teinte atténuée en plus pour "en attente" (`color-mix`,
  // équivalent de `classeFondAttenueTypeBadge` mais applicable à une couleur
  // CSS brute plutôt qu'à une classe Tailwind).
  // Validé/en attente distingués visuellement (14/09/2026, demande explicite
  // de Vincent — "on joue sur la transparence, ce n'est pas efficace
  // visuellement" : remplace l'ancien fond atténué/`color-mix` 50% par un
  // fond TOUJOURS plein). **Recentré le 15/09/2026, plusieurs itérations le
  // même jour** : essayé d'abord en couleur de chiffre (vert validé/orange
  // en attente), rejugé "pas efficace" — recentré sur un contour orange
  // autour de la pastille pour "en attente" seulement (`couleurContour`,
  // `var(--color-status-warning-fg)`, même token que `StatusBadge`), le
  // chiffre redevenant blanc dans tous les cas, y compris validé. Contour
  // composé en `box-shadow` plutôt qu'en classe `ring-*` Tailwind
  // (`ombreContour` dans `MiniCalendrier.tsx`) pour rester partiel sur les
  // vraies limites de période (`isStart`/`isEnd`) et ne jamais doubler à la
  // jointure entre deux éléments adjacents de même statut.
  //
  // Chevauchement demande/férié/DJI (15/09/2026, cas concret de Vincent — un
  // CP posé du 9 au 13/11 avec un férié le 11 et une DJI l'après-midi du 13 :
  // le calcul de jours exclut déjà correctement ces créneaux, 3,5j, mais le
  // calendrier les masquait entièrement sous la couleur du CP) :
  // - Un jour férié n'est jamais réellement consommé par une demande (déjà
  //   hors du décompte) — il garde donc TOUJOURS sa couleur dédiée, même à
  //   l'intérieur de la plage d'une demande.
  // - Une DJI qui tombe sur un créneau par ailleurs "couvert" par la demande
  //   (au milieu de la période, ou sur le créneau externe d'un jour de
  //   borne) perce ce créneau — plus de fond atténué façon "toujours pris"
  //   sur ce côté-là, couleur DJI pleine à la place (variante `partage`,
  //   pas `moitie`). Un chevauchement demande/CPI reste en revanche un cas
  //   marginal non traité ici (voir Backlog.md), la demande l'emporte comme
  //   avant.
  function tipoDuJour(iso: string): PastilleJour | null {
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    if (cal.joursFeries.some((f) => f.date === iso)) {
      return { classeFond: classeFondTypeBadge("FERIE") };
    }

    const demande = demandeDuJour(iso);
    if (demande) {
      const code = codeBadgeDemande(demande);
      let matinCouvert = !(iso === demande.debut && demande.demiDebut === "apres_midi");
      let apresMidiCouvert = !(iso === demande.fin && demande.demiFin === "matin");
      const couleurContour =
        demande.statut === "en attente" ? "var(--color-status-warning-fg)" : undefined;
      const couleurDemande = `var(${VAR_COULEUR_TYPE[code]})`;
      // Chiffre en blanc (16/09/2026, demande explicite de Vincent — "on va
      // garder les couleurs actuelles (les originales), on va juste passer
      // les typos des jours posés en blanc") : revient sur l'essai en encre
      // foncée du 15/09/2026 (`texteSombre`), abandonné après la session du
      // 16/09 sur les fonds pâles par type — `texteSombre` retiré, le blanc
      // redevient le défaut (même comportement que `CalendrierCollaborateur.tsx`,
      // qui n'a jamais eu cet essai).

      const dji = anneeVisiblePourCommuns(annee)
        ? cal.djImposees.find((d) => d.date === iso)
        : undefined;
      if (dji?.demiJournee === "matin") matinCouvert = false;
      if (dji?.demiJournee === "apres_midi") apresMidiCouvert = false;

      if (matinCouvert && apresMidiCouvert) {
        return { classeFond: classeFondTypeBadge(code), couleurContour };
      }

      if (dji) {
        // Contour "en attente" posé uniquement côté congé, jamais côté DJI
        // (15/09/2026, demande explicite de Vincent) — la moitié DJI n'a
        // aucune notion de validation, un contour sur toute la case le
        // laisserait croire à tort.
        return {
          partage: matinCouvert
            ? {
                gauche: couleurDemande,
                droite: "var(--color-dji)",
                couleurContourGauche: couleurContour,
              }
            : {
                gauche: "var(--color-dji)",
                droite: couleurDemande,
                couleurContourDroite: couleurContour,
              },
        };
      }
      return {
        moitie: { couleur: couleurDemande, cote: matinCouvert ? "gauche" : "droite" },
        couleurContour,
      };
    }
    return communDuJour(iso);
  }

  function estEnGroupe(isoA: string, isoB: string): boolean {
    const demandeA = demandeDuJour(isoA);
    const demandeB = demandeDuJour(isoB);
    if (demandeA || demandeB) return Boolean(demandeA && demandeB && demandeA.id === demandeB.id);

    // Continuité d'une période CPI à cheval sur plusieurs jours — Fériés/DJI
    // restent toujours des pastilles isolées (jamais de période multi-jours).
    const annee = Number(isoA.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    const cpiA = cal.congesImposes.find((c) => isoA >= c.debut && isoA <= c.fin);
    const cpiB = cal.congesImposes.find((c) => isoB >= c.debut && isoB <= c.fin);
    return Boolean(cpiA && cpiB && cpiA.id === cpiB.id);
  }

  // Ce qui occupe un jour cliqué, dans l'ordre de priorité d'affichage —
  // férié > demande perso > CPI > DJI, même priorité que `tipoDuJour`
  // (24/08/2026 : les fériés ouvrent désormais aussi l'overlay, avec leur
  // nom — `SnippetJourCalendrier`. 15/09/2026 : remonté devant la demande,
  // même raison que `tipoDuJour`). `moitieCliquee` (15/09/2026, gauche =
  // matin/droite = après-midi, voir `MiniCalendrier.onJourClick`) — sur un
  // jour couvert par une demande ET scindé par une DJI (rendu `partage`), le
  // créneau cliqué décide entre le détail congé et le détail CI : cliquer
  // sur LE créneau de la DJI ouvre son détail, l'autre créneau ouvre le
  // détail congé, comme si la DJI perçait un vrai trou dans la demande.
  // Même gating que `communDuJour` pour CPI/DJI (`anneeVisiblePourCommuns`,
  // les fériés y échappent) : pas d'overlay pour une entrée qui n'est de
  // toute façon pas affichée sur la pastille (année à venir non publiée).
  function occupantDuJour(
    iso: string,
    moitieCliquee?: "gauche" | "droite",
  ): JourCalendrierClique | null {
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    const ferie = cal.joursFeries.find((f) => f.date === iso);
    if (ferie) return { kind: "ferie", ferie };

    const demande = demandeDuJour(iso);
    if (demande) {
      const dji =
        moitieCliquee && anneeVisiblePourCommuns(annee)
          ? cal.djImposees.find((d) => d.date === iso)
          : undefined;
      const demiClique = moitieCliquee === "gauche" ? "matin" : "apres_midi";
      if (dji && dji.demiJournee === demiClique) return { kind: "dji", dji };
      return { kind: "demande", demande };
    }

    if (!anneeVisiblePourCommuns(annee)) return null;
    const cpi = cal.congesImposes.find((c) => iso >= c.debut && iso <= c.fin);
    if (cpi) return { kind: "cpi", cpi };
    const dji = cal.djImposees.find((d) => d.date === iso);
    if (dji) return { kind: "dji", dji };
    return null;
  }

  function handleJourClick(iso: string, ancre: DOMRect, moitieCliquee?: "gauche" | "droite") {
    const jour = occupantDuJour(iso, moitieCliquee);
    if (!jour) return;
    // Un congé personnel (CP/RTT/CPA) ouvre le panneau détaillé à droite du
    // calendrier — CPI/DJI/Férié ouvrent la card `DetailJourCommunPanel` dans
    // cette même colonne 4 (14/09/2026, demande explicite de Vincent). Le
    // popover `SnippetJourCalendrier` ne reste déclenché que pour un CPI
    // (14/09/2026, 2e itération — une fois la card en place, Vincent a
    // demandé de retirer le popover devenu redondant pour DJI/Férié ; gardé
    // pour CPI, non retiré explicitement).
    if (jour.kind === "demande") {
      setSnippet(null);
      setJourCommunSelectionne(null);
      setDemandeSelectionnee(jour.demande);
    } else {
      setDemandeSelectionnee(null);
      setJourCommunSelectionne(jour);
      setSnippet(jour.kind === "cpi" ? { jour, ancre } : null);
    }
  }

  // Clic sur un jour SANS congé (20/08/2026, demande explicite) — ouvre
  // "Poser un congé" avec ce jour pré-rempli comme date de début (voir le
  // "+" vert au survol dans `MiniCalendrier`, prop `onJourVideClick`).
  function handleJourVideClick(iso: string) {
    setDateNouvelleDemande(iso);
    setNouvelleDemandeOuverte(true);
  }

  // Phrase "Mes demandes" (18/08/2026, test) — "en attente" (nécessite une
  // action du manager) et "nouvelles décisions" (déjà tranchées, pas encore
  // vues) s'affichent tous les deux en emphase, indépendamment l'un de
  // l'autre. "vu" se marque à la FERMETURE du tiroir journal (10/09/2026,
  // simplifié à la demande de Vincent — remplace l'ancien principe "depuis
  // votre dernière connexion" basé sur sessionStorage/localStorage, retiré
  // de `useDemandes`, voir Backlog "Limites connues du vu par session").
  // D'abord essayé au moment de l'OUVERTURE (même jour) : les nouveautés
  // s'effaçaient avant d'avoir pu être vues — à la fermeture, elles restent
  // mises en emphase tout le temps où le tiroir reste ouvert.
  const nbEnAttente = demandes.filter((d) => d.statut === "en attente").length;
  // `!d.congeImposeId` (10/09/2026, demande explicite) — une demande "CP"
  // auto-générée par un CPI est validée par l'acte même de créer le CPI, pas
  // une vraie décision manager sur une demande du collaborateur : "Hector a
  // validé votre CPI" n'aurait pas de sens à notifier ni à lister dans le
  // journal ("Mon journal", tiroir `ActiviteRecenteFeed`).
  const demandesPourJournal = demandes.filter((d) => !d.congeImposeId);
  const decisionsNonVues = demandesPourJournal.filter(
    (d) => (d.statut === "validé" || d.statut === "refusé" || d.statut === "annulé") && !d.vu,
  );
  const nbDecisionsNonVues = decisionsNonVues.length;

  // Fondu du surlignage "n nouvelles décisions" à la fermeture du tiroir
  // (10/09/2026, demande explicite) — sans ce délai, `marquerVue` fait
  // disparaître le surlignage EXACTEMENT au moment de la fermeture (les deux
  // états React se mettent à jour dans le même tick), aucune transition
  // visible n'a le temps de jouer. `journalFermetureEnCours` (déclaré plus
  // haut avec les autres `useState`) garde le surlignage affiché (les
  // décisions restent non vues côté `demandes` tant que `marquerVue` n'a pas
  // été appelée) le temps du fondu CSS, puis marque vu une fois l'animation
  // terminée.
  const DUREE_FONDU_MS = 500;

  function fermerTiroirActivite() {
    setTiroirActiviteOuvert(false);
    if (decisionsNonVues.length === 0) return;
    setJournalFermetureEnCours(true);
    const ids = decisionsNonVues.map((d) => d.id);
    window.setTimeout(() => {
      ids.forEach((id) => {
        marquerVue(id).catch(() => {});
      });
      setJournalFermetureEnCours(false);
    }, DUREE_FONDU_MS);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6 pb-4 md:max-w-none md:pt-0">
      <div className="animate-stagger-in px-1 pt-5 md:pt-0">
        <h1 className="text-ink-900 text-2xl font-semibold">Bonjour, {utilisateur.prenom}</h1>
      </div>

      {(utilisateur.role === "manager" || utilisateur.role === "admin") && (
        <div className="animate-stagger-in flex flex-wrap gap-3" style={{ animationDelay: "70ms" }}>
          <DemandesAEtudierCard />
          <CollaborateursEnCongeCard />
        </div>
      )}

      <div
        className="animate-stagger-in flex w-fit flex-col gap-1 rounded-xl bg-transparent px-3 py-2"
        style={{ animationDelay: "140ms" }}
      >
        <span className="text-ink-500 text-xs font-semibold">Depuis ma dernière visite</span>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
          <span className="flex items-center gap-0.5">
            <Newspaper size={12} className="text-ink-500" />
            {nbEnAttente > 0 ? (
              <span className="bg-status-warning-bg text-status-warning-fg rounded-sm px-1 font-semibold">
                {nbEnAttente} {nbEnAttente === 1 ? "demande" : "demandes"} en attente
              </span>
            ) : (
              <span className="text-ink-500">0 demande en attente</span>
            )}
          </span>
          <span className="text-ink-500" aria-hidden="true">
            |
          </span>
          {nbDecisionsNonVues > 0 ? (
            <span
              className={`inline-flex items-center gap-1.5 transition-opacity duration-500 ${
                journalFermetureEnCours ? "opacity-0" : "opacity-100"
              }`}
            >
              <span className="text-ink-900 rounded-sm bg-yellow-100 px-1 font-semibold">
                {nbDecisionsNonVues}{" "}
                {nbDecisionsNonVues === 1 ? "nouvelle décision" : "nouvelles décisions"}
              </span>
              <span className="text-ink-500">-</span>
              <button
                type="button"
                onClick={() => setTiroirActiviteOuvert(true)}
                className="text-ink-900 font-bold underline"
              >
                voir le journal
              </button>
            </span>
          ) : (
            <>
              <span className="text-ink-500">aucune décision récente -</span>
              <button
                type="button"
                onClick={() => setTiroirActiviteOuvert(true)}
                className="text-ink-500 underline"
              >
                voir le journal
              </button>
            </>
          )}
        </div>
      </div>

      {/* Titre de section réduit + interlignage resserré (20/08/2026, demande
          explicite) — le h2 passe de text-lg/text-ink-900 à text-sm/text-ink-500
          (aligné visuellement, plus discret que les autres titres de section) ;
          `-mt-[12.24px]` compense le `gap-6` du conteneur racine pour un
          interlignage réduit de ~51% avec le bloc "Depuis ma dernière visite"
          au-dessus, et `gap-[11px]` (au lieu de `gap-4`) réduit de 30%
          l'interlignage avec la grille de cards Soldes en dessous. Valeurs
          arbitraires ad hoc, pas de token dédié. */}
      <div
        className="animate-stagger-in -mt-[12.24px] flex flex-col gap-[11px] rounded-2xl py-4 md:py-5"
        style={{ animationDelay: "210ms" }}
      >
        <div className="flex flex-col gap-1 px-1">
          <h2 className="text-ink-900 text-base font-semibold">Suivre mes soldes</h2>
        </div>

        <div className="grid max-w-[900px] grid-cols-2 gap-3 md:grid-cols-[minmax(0,200px)_minmax(0,200px)_minmax(0,200px)_160px]">
          <SoldeCard
            valeur={soldes.cp.valeurApresAttente}
            conditionPrefixe={soldes.cp.conditionPrefixe}
            conditionAccent={soldes.cp.conditionAccent}
            tone="cp"
            onClick={() => setSoldeDetailOuvert("CP")}
            classeValeur="text-ink-900"
          />
          <SoldeCard
            valeur={soldes.rtt.valeurApresAttente}
            conditionPrefixe={soldes.rtt.conditionPrefixe}
            conditionAccent={soldes.rtt.conditionAccent}
            tone="rtt"
            onClick={() => setSoldeDetailOuvert("RTT")}
            classeValeur="text-ink-900"
          />
          <SoldeCard
            valeur={soldes.cpa.valeurApresAttente}
            conditionPrefixe={soldes.cpa.conditionPrefixe}
            conditionAccent={soldes.cpa.conditionAccent}
            tone="cpa"
            onClick={() => setSoldeDetailOuvert("CPA")}
            classeValeur="text-ink-900"
          />
          <button
            type="button"
            onClick={() => setNouvelleDemandeOuverte(true)}
            className="text-slate hover:text-slate/80 flex h-full w-full flex-col items-center justify-center gap-2 p-4 transition-[transform,color] hover:scale-110"
          >
            <PlusCircle size={56} />
            <span className="text-sm font-semibold">Poser un congé</span>
          </button>
        </div>
      </div>

      {/* "Mon Calendrier" — plus de sélecteur d'onglet (14/09/2026, retiré
          avec la fenêtre glissante — voir doc en tête de fichier). Le
          compteur par typologie ne partage plus cette ligne (14/09/2026,
          2e itération demandée par Vincent — d'abord calé sur 3 colonnes
          pour ne plus déborder dans la 4ᵉ, puis carrément déplacé dedans,
          empilé verticalement — voir `CompteurTypologies` plus bas).
          `SelectCommence` (15/09/2026) juste en dessous — seul réglage de
          navigation pour l'instant, voir Backlog "Calendrier simplifié". */}
      <div
        className="animate-stagger-in flex flex-col gap-1 px-1"
        style={{ animationDelay: "280ms" }}
      >
        <h2 className="text-ink-900 text-base font-semibold">Mon Calendrier</h2>
        <SelectCommence actif={commenceIlYA3Mois} onChange={setCommenceIlYA3Mois} />
      </div>

      {/* Colonne "Prochains jours off" (20/08/2026, remplace la colonne
          légende CPI/DJI/Fériés retirée le même jour). Largeur 288px
          (`md:w-72`, 20/08/2026 — élargie depuis 256px/`md:w-64`, demande
          explicite de lisibilité). Placée avant "Mon Calendrier" (ordre
          inversé, 20/08/2026, demande explicite). */}
      {/* Expérimentation (20/08/2026, "on tente un truc") — grille calendrier
          plafonnée à 3 mois par ligne (au lieu de 4 à cette largeur).
          Répartition du gain en gouttière/marge (`gap-[92px]`/`mr-[120px]`)
          abandonnée au profit d'agrandir les cartes mois elles-mêmes
          (200px → 230px, `max-w-[706px]` sur la grille) — retour à `gap-3`/
          pas de marge pour laisser à la grille la place de grandir plutôt
          que de la lui reprendre. */}
      {/* Plus de `animate-stagger-in` sur CE conteneur (14/09/2026, bug
          trouvé en vérifiant le `sticky` du panneau détail congé) — son
          animation `transform: translateY(...)` reste posée après coup
          (`animation-fill-mode: both`, `to { transform: translateY(0) }` ≠
          `none`), ce qui crée un référentiel de positionnement CSS pour tout
          descendant `position: fixed`/`sticky` (même piège déjà documenté
          pour `SnippetJourCalendrier`, côté `position: fixed`) — le panneau
          `DetailCongePanel` (`xl:sticky`) restait confiné à l'intérieur de
          CE conteneur au lieu de coller au viewport, et scrollait hors champ
          avec lui. Perte du fondu d'entrée pour cette seule section,
          délibéré : la correction du `sticky` prime. */}
      <div className="flex flex-col gap-3 md:flex-row">
        {/* Hauteur plafonnée à 604px (20/08/2026, demande explicite) = 2
            lignes de cards mois (290px × 2 + 24px de gap) pour que le bas de
            cette card s'aligne sur le bas de 2 lignes de calendrier — le
            titre/bandeau d'onglets étant désormais commun aux deux colonnes
            (déplacé au-dessus), plus de décalage à compenser entre elles.
            Plutôt que de suivre la hauteur réelle du calendrier
            (`align-items: stretch` par défaut du `flex md:flex-row`
            parent) — au-delà de 2 lignes équivalentes de contenu, la liste
            scrolle en interne (`overflow-y-auto` dans `ProchainsJoursOffCard`)
            au lieu de continuer à grandir. Essai du 07/09/2026 (`align-items:
            stretch` sans hauteur fixe, puis nombre d'items adapté sans
            scroll) revenu en arrière sur demande explicite — retour à cette
            version. */}
        {AFFICHER_PROCHAINS_JOURS_OFF && (
          <div className="p-2 md:h-[604px] md:w-72 md:shrink-0">
            <ProchainsJoursOffCard debutPeriode={rangeActive.debut} finPeriode={rangeActive.fin} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-6">
            {anneesNonParametrees.length > 0 && (
              // Effet "stabilo" (21/08/2026, demande explicite) — même
              // convention que la phrase "X demandes en attente" plus haut
              // sur cette page (`bg-status-warning-bg`/`rounded-sm`/`px-1`),
              // plutôt qu'un encart plein `rounded-control` avec padding.
              <p className="text-sm font-normal">
                <span className="text-ink-900 rounded-sm bg-yellow-200 px-1">
                  {anneesNonParametrees.length === 1
                    ? `Le calendrier ${anneesNonParametrees[0]} n’est pas encore paramétré par l’administrateur.`
                    : `Les calendriers ${anneesNonParametrees.join(" et ")} ne sont pas paramétrés par l’administrateur.`}
                </span>
              </p>
            )}

            {/* Panneau détail congé TOUJOURS au même endroit (14/09/2026,
                "on va tenter un truc" puis "il faudrait que le détail congé
                s'affiche toujours à la même place" — demande explicite de
                Vincent) : grille de 4 colonnes ÉGALES en permanence (jamais
                conditionnelle, contrairement au 1er essai qui faisait
                recomposer le calendrier 4↔3 colonnes à l'ouverture) — 3
                colonnes pour les mois, la 4ᵉ colonne réservée en dur au
                panneau `DetailCongePanel`, vide tant qu'aucun congé
                personnel (CP/RTT/CPA, `demandeSelectionnee`) n'est cliqué.
                Vraie grille CSS (plus `flex-wrap`) : chaque mois a
                maintenant une position de grille fixe, `w-full` suffit,
                plus besoin de largeurs `calc()` à la main.

                `xl:` plutôt que `lg:` (14/09/2026, 4e itération — "en
                desktop tu affiches le détail en le calant en haut du
                calendrier que tu consultes") : `DetailCongePanel` a déjà un
                comportement `xl:sticky xl:top-4` intégré (défaut, tant que
                `pleineLargeur` n'est pas passé) — il reste collé en haut du
                viewport pendant le scroll, sans qu'aucun JS ne soit
                nécessaire pour "ramener" le panneau à l'écran (un essai de
                `scrollIntoView` au clic, rejeté par Vincent, a été retiré).
                Caler CETTE grille sur le même palier `xl:` que ce
                `sticky` intégré évite la zone morte entre `lg:` et `xl:` où
                le panneau restait un bloc plein-largeur sans style sticky.

                PAS de `items-start` (14/09/2026, 2e bug trouvé en
                vérifiant le `sticky`) : un élément `sticky` ne peut coller
                que dans les limites de la boîte de SON PROPRE parent — avec
                `items-start`, la 4ᵉ colonne n'était haute que du contenu du
                panneau (~300px), bien moins que les 3 lignes de mois
                (~1200px) : le `sticky` cessait de fonctionner dès qu'on
                scrollait au-delà de cette hauteur, la colonne entière étant
                déjà sortie de l'écran. Étirement par défaut (`stretch`) :
                la 4ᵉ colonne prend la hauteur complète de la grille, le
                panneau reste "sticky-able" sur toute la hauteur du
                calendrier consulté. */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
                {moisActifs.map(({ annee, moisIndex }) => (
                  <MiniCalendrier
                    key={`${annee}-${moisIndex}`}
                    annee={annee}
                    moisIndex={moisIndex}
                    tipoDuJour={tipoDuJour}
                    estEnGroupe={estEnGroupe}
                    onJourClick={handleJourClick}
                    onJourVideClick={handleJourVideClick}
                    estAujourdhui={(iso) => iso === todayIso}
                    // Exception (15/09/2026, demande explicite de Vincent) —
                    // un jour déjà posé (congé perso) garde son chiffre à
                    // pleine opacité, seuls les jours vides passés s'atténuent.
                    estPasse={(iso) => iso < todayIso && !demandeDuJour(iso)}
                    className="h-[290px] w-full"
                    texteJour="text-base"
                    paddingClassName="p-6"
                    classeTitreMois="text-ink-900 text-base"
                  />
                ))}
              </div>
              {/* 4ᵉ colonne (14/09/2026, 3e itération — "le composant congé
                  détail doit se positionner au-dessus de la légende") :
                  panneau détail congé (quand un congé personnel est
                  sélectionné) EN PREMIER, légende empilée verticalement
                  (`vertical`, voir `CompteurTypologies`) EN DESSOUS — les
                  deux dans la même colonne fixe, jamais celle des mois. */}
              <div className="flex flex-col gap-4">
                {/* `hidden sm:block` (22/09/2026, demande explicite de
                    Vincent — "gérer une exception sur mobile") : sous `sm:`,
                    ce panneau s'ouvre désormais en popin (voir plus bas)
                    plutôt que de s'empiler dans le flux sous la grille des
                    mois. `flex-1` ajouté le 24/09/2026 (4ᵉ cause du bug
                    "panneau sticky qui sort de l'écran", jamais couverte par
                    l'audit du 23/09/2026 — voir CONTEXTE.md) : ce wrapper vit
                    dans une colonne `flex flex-col` (pour empiler
                    panneau+légende), qui NE stretch PAS ses enfants sur l'axe
                    principal (vertical) par défaut — contrairement à la
                    grille parente, bien étirée par `xl:items-stretch`. Sans
                    `flex-1`, ce wrapper retombait à la hauteur de son propre
                    contenu (~215px) au lieu des ~900px de la colonne,
                    laissant à `xl:sticky` aucune marge pour "coller" — le
                    panneau restait figé en haut de la grille, invisible dès
                    qu'on scrollait au-delà. */}
                {demandeSelectionnee && (
                  <div className="hidden sm:block sm:flex-1">
                    <DetailCongePanel
                      key={demandeSelectionnee.id}
                      selection={demandeSelectionnee}
                      onClose={() => setDemandeSelectionnee(null)}
                      onRetirer={(commentaire) => retirer(demandeSelectionnee.id, commentaire)}
                      joursFeries={joursFeriesToutesAnnees}
                      congesImposes={congesImposesVisibles}
                      djImposees={djImposeesVisibles}
                      autresDemandes={demandes.filter((d) => d.id !== demandeSelectionnee.id)}
                    />
                  </div>
                )}
                {/* `hidden sm:block` (23/09/2026, demande explicite de
                    Vincent — "les Congés imposés et FE n'ouvrent pas le
                    template de suivi congé en popin sur mobile", même bug
                    que `DetailCongePanel` ci-dessus mais resté sur ce
                    panneau-ci) : même traitement, popin plus bas. `flex-1`
                    ajouté le 24/09/2026, voir commentaire ci-dessus. */}
                {jourCommunSelectionne && (
                  <div className="hidden sm:block sm:flex-1">
                    <DetailJourCommunPanel
                      jour={jourCommunSelectionne}
                      onClose={() => setJourCommunSelectionne(null)}
                    />
                  </div>
                )}
                {/* Légende masquée tant qu'un panneau détail est ouvert
                    (15/09/2026, demande explicite de Vincent) — réapparaît
                    dès que les deux panneaux sont fermés. */}
                {!demandeSelectionnee && !jourCommunSelectionne && (
                  <CompteurTypologies typologies={typologies} vertical />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="animate-stagger-in" style={{ animationDelay: "420ms" }}>
        <FaqCard />
      </div>

      {snippet && (
        <SnippetJourCalendrier
          jour={snippet.jour}
          ancre={snippet.ancre}
          joursFeries={joursFeriesToutesAnnees}
          onFermer={() => setSnippet(null)}
        />
      )}

      {/* "Poser un congé" (18/08/2026) — s'affiche en popin contextuelle sur
          Accueil plutôt que de naviguer vers `/nouvelle-demande` (route
          conservée pour l'instant, vouée à être désactivée). `onSuccess`
          rafraîchit `demandes`/`soldes` de CETTE page : la popin a sa propre
          instance de `useDemandes`/`useSoldes`, l'ajout ne se répercute pas
          automatiquement ici. */}
      {nouvelleDemandeOuverte && (
        <PoserDemandeModal
          dateInitiale={dateNouvelleDemande ?? undefined}
          onClose={() => {
            setNouvelleDemandeOuverte(false);
            setDateNouvelleDemande(null);
          }}
          onSuccess={() => {
            refetchDemandes();
            refetchSoldes();
          }}
        />
      )}

      {/* Détail de solde (17/08/2026) — même `SoldeDetailPanel` que "Suivre les
          soldes" (vue manager sur un collaborateur), ici recentré en overlay
          pour la propre consultation du salarié sur son solde. Backdrop
          manuel plutôt que `Modal` : `SoldeDetailPanel` a déjà son propre
          bandeau coloré plein bord (voir `DetailCongePanel`/`Modal`
          `header`), l'encapsuler dans le `children` par défaut de `Modal`
          aurait ajouté un double padding.
          `overflow-y-auto` + `py-8` (20/08/2026, demande explicite) — filet
          de sécurité si la popin (header + tableau plafonné à 45vh + pied)
          dépasse quand même la hauteur d'un écran très court : elle défile
          dans le backdrop plutôt que d'être rognée. `items-center` conservé
          — reste centrée dans le cas normal (popin plus petite que
          l'écran), le scroll ne prend le relais que si besoin. */}
      {soldeDetailOuvert && (
        <div
          className="bg-ink-900/50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8"
          onClick={() => setSoldeDetailOuvert(null)}
        >
          {/* `w-full` sous `sm:` (20/08/2026, "sur mobile c'est inutilisable")
              — `SoldeDetailPanel` résout ses propres largeurs internes en
              `w-full` en dessous de `sm:` ; ce wrapper doit donc avoir une
              largeur DÉFINIE (pas `w-fit`, sans quoi le pourcentage
              redescend en `auto`/taille intrinsèque au lieu de remplir
              l'espace dispo). `sm:w-fit` repasse en mode "épouse le
              contenu" une fois les largeurs fixes en px actives. */}
          <div className="w-full sm:w-fit sm:max-w-full" onClick={(e) => e.stopPropagation()}>
            <SoldeDetailPanel
              key={soldeDetailOuvert}
              code={soldeDetailOuvert}
              utilisateurId={utilisateur.id}
              nomComplet={`${utilisateur.prenom} ${utilisateur.nom}`}
              onClose={() => setSoldeDetailOuvert(null)}
              arrondi
              modeParDefaut="theorique"
              headerSimplifie
              avecDetailConge
              // "Annuler cette demande" (11/09/2026, demande explicite de
              // Vincent — accepte la duplication avec /historique, qui
              // portait jusque-là seul cette action pour l'Accueil
              // collaborateur, voir `SoldeDetailPanel.tsx`) : signature
              // `(demandeId, commentaire)`, ce panneau ne connaît pas la
              // demande ouverte à l'intérieur de `SoldeDetailPanel` (état
              // interne), contrairement à `DetailCongePanel.onRetirer`.
              onRetirer={async (demandeId, commentaire) => {
                await retirer(demandeId, commentaire);
                await Promise.all([refetchDemandes(), refetchSoldes()]);
              }}
            />
          </div>
        </div>
      )}

      {/* Popin mobile pour "Mon Calendrier" (22/09/2026, demande explicite de
          Vincent — "les popins suivi congés doivent s'afficher en popin
          quand elles sont déclenchées depuis le suivi solde et le
          calendrier") : sous `sm:`, `DetailCongePanel` se détache de la 4ᵉ
          colonne (masquée à cette largeur, voir plus haut) pour s'ouvrir en
          overlay — même chrome que la popin "Suivre mes soldes" ci-dessus.
          Portail vers `document.body` plutôt qu'un `fixed` local : cette
          page a un piège documenté plus haut (`animate-stagger-in` crée un
          référentiel de positionnement CSS pour tout `position: fixed`
          descendant). `sm:hidden` sur le backdrop uniquement — toujours
          monté, invisible dès `sm:`, pas de détection JS de largeur d'écran. */}
      {demandeSelectionnee &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="bg-ink-900/50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8 sm:hidden"
            onClick={() => setDemandeSelectionnee(null)}
          >
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <DetailCongePanel
                key={demandeSelectionnee.id}
                selection={demandeSelectionnee}
                onClose={() => setDemandeSelectionnee(null)}
                onRetirer={(commentaire) => retirer(demandeSelectionnee.id, commentaire)}
                joursFeries={joursFeriesToutesAnnees}
                congesImposes={congesImposesVisibles}
                djImposees={djImposeesVisibles}
                autresDemandes={demandes.filter((d) => d.id !== demandeSelectionnee.id)}
                pleineLargeur
              />
            </div>
          </div>,
          document.body,
        )}

      {/* Popin mobile pour "Mon Calendrier" — jour commun (CPI/DJI/Férié,
          23/09/2026) : même principe que `DetailCongePanel` juste au-dessus,
          appliqué au panneau qui s'était fait oublier lors du 1er passage. */}
      {jourCommunSelectionne &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="bg-ink-900/50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8 sm:hidden"
            onClick={() => setJourCommunSelectionne(null)}
          >
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <DetailJourCommunPanel
                jour={jourCommunSelectionne}
                onClose={() => setJourCommunSelectionne(null)}
              />
            </div>
          </div>,
          document.body,
        )}

      <ActiviteRecenteFeed
        demandes={demandesPourJournal}
        tiroirOuvert={tiroirActiviteOuvert}
        onFermerTiroir={fermerTiroirActivite}
      />
    </div>
  );
}
