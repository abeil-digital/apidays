"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { formatPeriodePillNumerique, nomJourSemaine, todayISO } from "@/lib/format";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandesEquipe } from "@/hooks/useDemandesEquipe";
import { useReglesConges } from "@/hooks/useReglesConges";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { JourBadge } from "@/components/ui/JourBadge";
import { classeBordureTypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import type { DemandeEquipe } from "@/lib/types";

type Onglet = "en_cours" | "periode_cp" | "annee_suivante";

function isoDate(annee: number, moisIndex: number, jour: number): string {
  return new Date(Date.UTC(annee, moisIndex, jour)).toISOString().slice(0, 10);
}

function ajouterJoursIso(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "Juin 26" — même helper que `DashboardPage`/`CalendrierCollaborateur`. */
function formatMoisAnneeCourt(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const texte = new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(d);
  return texte.charAt(0).toUpperCase() + texte.slice(1).replace(".", "");
}

/** "15 septembre 2026" — sans le nom du jour, déjà porté par le `JourBadge`
 * dans l'en-tête du panneau de détail (28/08/2026, demande explicite : "le
 * badge jour en lieu et place du rappel du nom du jour"). */
function formatDateSansJour(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const texte = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

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

function codeBadgeDemande(demande: DemandeEquipe): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

// Dégradé orange clair → rouge foncé (28/08/2026, demande explicite, mockup
// fourni) — mêmes teintes que l'échelle séquentielle "OrRd" (ColorBrewer),
// 5 paliers. Un simple `color-mix` à 2 couleurs (ex. blanc → rouge) glisse
// vers le rose, jamais l'orange intermédiaire du mockup — d'où cette
// interpolation manuelle à plusieurs paliers plutôt qu'une seule mixée.
const PALIERS_HEATMAP: [number, string][] = [
  [0, "#fff7ec"],
  [25, "#fee8c8"],
  [50, "#fdbb84"],
  [75, "#e34a33"],
  [100, "#b30000"],
];

function hexVersRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbVersHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Couleur de la heatmap pour un pourcentage donné (0-100) — interpolation
 * linéaire entre les deux paliers `PALIERS_HEATMAP` encadrant `pct`. */
function couleurHeatmap(pct: number): string {
  const clamp = Math.min(100, Math.max(0, pct));
  for (let i = 0; i < PALIERS_HEATMAP.length - 1; i++) {
    const [p0, c0] = PALIERS_HEATMAP[i];
    const [p1, c1] = PALIERS_HEATMAP[i + 1];
    if (clamp <= p1) {
      const t = (clamp - p0) / (p1 - p0);
      const rgb0 = hexVersRgb(c0);
      const rgb1 = hexVersRgb(c1);
      return rgbVersHex([
        rgb0[0] + (rgb1[0] - rgb0[0]) * t,
        rgb0[1] + (rgb1[1] - rgb0[1]) * t,
        rgb0[2] + (rgb1[2] - rgb0[2]) * t,
      ]);
    }
  }
  return PALIERS_HEATMAP[PALIERS_HEATMAP.length - 1][1];
}

/** Poids d'occupation d'une demande ce jour-là — 1 pour une journée pleine,
 * 0,5 si seule la demi-journée de bord (début/fin de période) est couverte
 * (28/08/2026, demande explicite — même granularité que `tipoDuJour` de
 * `DashboardPage`/`CalendrierCollaborateur`, "matinCouvert"/"apresMidiCouvert"). */
function poidsJourneeDemande(demande: DemandeEquipe, iso: string): number {
  const matinCouvert = !(iso === demande.debut && demande.demiDebut === "apres_midi");
  const apresMidiCouvert = !(iso === demande.fin && demande.demiFin === "matin");
  return matinCouvert && apresMidiCouvert ? 1 : 0.5;
}

type SectionJournee = "journee" | "matin" | "apres_midi";

/** Quelle partie de la journée une demande couvre CE jour précis (bornes de
 * la période) — pilote le regroupement du panneau de détail (28/08/2026,
 * demande explicite : sections "Journée entière"/"Matin"/"Après-midi"). */
function sectionDemande(demande: DemandeEquipe, iso: string): SectionJournee {
  if (iso === demande.debut && demande.demiDebut === "apres_midi") return "apres_midi";
  if (iso === demande.fin && demande.demiFin === "matin") return "matin";
  return "journee";
}

const SECTIONS_JOURNEE: { cle: SectionJournee; libelle: string }[] = [
  { cle: "journee", libelle: "Journée entière" },
  { cle: "matin", libelle: "Matin" },
  { cle: "apres_midi", libelle: "Après-midi" },
];

/**
 * Heatmap "Calendrier des employés" (28/08/2026, Backlog priorité Urgente) —
 * vue par défaut de `/suivre/calendrier`, en complément (pas en remplacement)
 * du calendrier par collaborateur (`CalendrierCollaborateur`, toujours
 * accessible via le sélecteur). Reprend le même système d'onglets de période
 * (Année en cours / Période de référence CP / Année suivante) que les autres
 * calendriers de l'app, mais sans colonne "Prochains jours off" — composants
 * ferrés à gauche, pas de deuxième colonne fixe côté contenu (seul le
 * panneau de détail, à droite, apparaît une fois une date sélectionnée).
 *
 * Même grille que le calendrier par collaborateur (`MiniCalendrier`, même
 * card `h-[290px]`, mêmes breakpoints de largeur, même typo) — identité
 * graphique commune entre vue consolidée et vue individuelle, demande
 * explicite (28/08/2026). Intensité de couleur = proportion de collaborateurs
 * ACTIFS "absents" ce jour-là par rapport à l'effectif actif total —
 * `color-mix` calculé par jour (pas de classe Tailwind possible pour une
 * valeur continue, voir `PastilleJour.plein` dans `MiniCalendrier`, qui
 * remplit toute la largeur de sa case — `w-full` — pour que les jours
 * consécutifs se touchent horizontalement, demande explicite). Deux sources
 * combinées par le MAX de leurs ratios (pas la somme, pour ne jamais dépasser
 * 100% ni compter deux fois la même fermeture) :
 * - congés personnels (validé ou en attente, même convention que le reste de
 *   l'app) — ratio = nombre de collaborateurs concernés / effectif actif ;
 * - fériés/CPI/DJI (28/08/2026, demande explicite) — communs à TOUS les
 *   collaborateurs actifs (même liste pour tout le monde, pas une notion par
 *   personne) : un férié ou un congé imposé (CPI) vaut 100% (entreprise
 *   fermée), une demi-journée imposée (DJI) vaut 50%.
 * Plancher à 15% dès qu'au moins une personne est absente, pour rester
 * visible même sur un gros effectif (1 absent sur 30 = 3% quasi invisible
 * sinon). Chaque jour reste cliquable même à 0% (blanc) — le clic ouvre la
 * colonne de droite listant les collaborateurs absents ce jour (typologie de
 * congé) et un bandeau dédié si le jour est férié/CPI/DJI.
 */
export function CalendrierGlobal() {
  const { demandes, loading: loadingDemandes } = useDemandesEquipe();
  const { utilisateurs, loading: loadingUtilisateurs } = useUtilisateursAdmin();
  const { reglesAcquisition, loading: loadingRegles } = useReglesConges();
  const [onglet, setOnglet] = useState<Onglet>("en_cours");
  const [vueCompleteEnCours, setVueCompleteEnCours] = useState(false);
  const [vueCompletePeriodeCp, setVueCompletePeriodeCp] = useState(false);
  // Jour du panneau détail ouvert par défaut au chargement (29/08/2026) —
  // "aujourd'hui" plutôt qu'aucune sélection, cohérent avec `estMisEnAvant`/
  // `estAujourdhui` déjà mis en avant sur la grille dès l'ouverture.
  const [dateSelectionnee, setDateSelectionnee] = useState<string | null>(() => todayISO());

  const anneeActuelle = new Date().getFullYear();
  const anneePrecedente = anneeActuelle - 1;
  const anneeSuivante = anneeActuelle + 1;
  const calendrierAnneePrecedente = useCalendrier(anneePrecedente);
  const calendrierAnneeA = useCalendrier(anneeActuelle);
  const calendrierAnneeB = useCalendrier(anneeSuivante);

  const loading =
    loadingDemandes ||
    loadingUtilisateurs ||
    loadingRegles ||
    calendrierAnneePrecedente.loading ||
    calendrierAnneeA.loading ||
    calendrierAnneeB.loading;

  if (loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  const actifsIds = new Set(utilisateurs.filter((u) => u.statut === "actif").map((u) => u.id));
  const totalActifs = actifsIds.size;

  const todayIso = todayISO();
  const debutAnneeActuelle = isoDate(anneeActuelle, 0, 1);
  const finAnneeActuelle = isoDate(anneeActuelle, 11, 31);
  const debutMoisActuel = isoDate(anneeActuelle, new Date().getMonth(), 1);

  const regleCp = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const debutPeriodeCp = regleCp
    ? todayIso >= isoDate(anneeActuelle, regleCp.periodeDebutMois - 1, regleCp.periodeDebutJour)
      ? isoDate(anneeActuelle, regleCp.periodeDebutMois - 1, regleCp.periodeDebutJour)
      : isoDate(anneePrecedente, regleCp.periodeDebutMois - 1, regleCp.periodeDebutJour)
    : debutAnneeActuelle;
  const finPeriodeCp = regleCp
    ? ajouterJoursIso(
        isoDate(
          Number(debutPeriodeCp.slice(0, 4)) + 1,
          regleCp.periodeDebutMois - 1,
          regleCp.periodeDebutJour,
        ),
        -1,
      )
    : finAnneeActuelle;

  const ranges: Record<Onglet, { debut: string; fin: string }> = {
    en_cours: {
      debut: vueCompleteEnCours ? debutAnneeActuelle : debutMoisActuel,
      fin: finAnneeActuelle,
    },
    periode_cp: {
      debut: vueCompletePeriodeCp ? debutPeriodeCp : debutMoisActuel,
      fin: finPeriodeCp,
    },
    annee_suivante: { debut: isoDate(anneeSuivante, 0, 1), fin: isoDate(anneeSuivante, 11, 31) },
  };
  const rangeActive = ranges[onglet];
  const moisActifs = moisEntre(rangeActive.debut, rangeActive.fin);
  const anneeSuivanteParametree = Boolean(calendrierAnneeB.parametrage?.valideLe);

  function occupantsDuJour(iso: string): DemandeEquipe[] {
    const vues = new Set<string>();
    return demandes.filter((d) => {
      if (d.statut !== "validé" && d.statut !== "en attente") return false;
      if (iso < d.debut || iso > d.fin) return false;
      if (!actifsIds.has(d.demandeur.id)) return false;
      if (vues.has(d.demandeur.id)) return false;
      vues.add(d.demandeur.id);
      return true;
    });
  }

  function calendrierPourAnnee(annee: number) {
    if (annee === anneePrecedente) return calendrierAnneePrecedente;
    if (annee === anneeSuivante) return calendrierAnneeB;
    return calendrierAnneeA;
  }

  // Même gating que `DashboardPage`/`CalendrierCollaborateur` : les fériés
  // sont toujours visibles (fixes, connus à l'avance), CPI/DJI de l'année à
  // venir seulement si Delphine l'a publiée.
  function anneeVisiblePourCommuns(annee: number): boolean {
    return annee === anneeActuelle || Boolean(calendrierPourAnnee(annee).parametrage?.valideLe);
  }

  // Fériés/CPI/DJI (28/08/2026, demande explicite) — contrairement aux
  // congés personnels, ces 3 éléments sont communs à TOUS les collaborateurs
  // actifs (même liste pour tout le monde, pas une notion par personne) :
  // un férié ou un CPI ferme donc l'entreprise à 100%, une DJI (demi-journée)
  // à 50%. Priorité férié > CPI > DJI, même ordre que les autres calendriers.
  function communDuJour(iso: string): { type: "ferie" | "cpi" | "dji"; libelle?: string } | null {
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    const ferie = cal.joursFeries.find((f) => f.date === iso);
    if (ferie) return { type: "ferie", libelle: ferie.libelle };
    if (!anneeVisiblePourCommuns(annee)) return null;
    const cpi = cal.congesImposes.find((c) => iso >= c.debut && iso <= c.fin);
    if (cpi) return { type: "cpi" };
    const dji = cal.djImposees.find((d) => d.date === iso);
    if (dji) return { type: "dji", libelle: dji.demiJournee === "matin" ? "Matin" : "Après-midi" };
    return null;
  }

  function ratioCommunDuJour(iso: string): number {
    const commun = communDuJour(iso);
    if (!commun) return 0;
    return commun.type === "dji" ? 0.5 : 1;
  }

  // Poids en jours (pas en têtes) — une demi-journée compte pour 0,5, même
  // granularité que le reste de l'app (voir `poidsJourneeDemande`).
  function poidsOccupationDuJour(iso: string): number {
    return occupantsDuJour(iso).reduce((somme, d) => somme + poidsJourneeDemande(d, iso), 0);
  }

  function tipoDuJour(iso: string): PastilleJour {
    // Férié en couleur dédiée (28/08/2026, demande explicite) — plutôt que
    // fondu dans le dégradé d'intensité, un férié reste identifiable au
    // premier coup d'œil (même couleur `--color-ferie` que le reste de
    // l'app), y compris s'il coïncide avec des congés personnels ce jour-là.
    const etiquette = etiquetteDuJour(iso);
    if (communDuJour(iso)?.type === "ferie") {
      return { plein: { couleur: "var(--color-ferie)", texteSombre: false, etiquette } };
    }
    const ratioPersonnel = totalActifs === 0 ? 0 : poidsOccupationDuJour(iso) / totalActifs;
    const ratio = Math.max(ratioPersonnel, ratioCommunDuJour(iso));
    if (ratio === 0) {
      // Aucune interaction sur un jour vide (28/08/2026, demande explicite) —
      // `interactif: false` neutralise le clic (`onJourClick`) et le curseur
      // pointeur côté `MiniCalendrier` ; pas d'`etiquette` non plus, qui
      // conditionne déjà le grossissement du chiffre et la bulle au survol.
      return { plein: { couleur: "#ffffff", texteSombre: true, interactif: false } };
    }
    const pct = Math.min(100, Math.max(15, Math.round(ratio * 100)));
    return {
      plein: {
        couleur: couleurHeatmap(pct),
        texteSombre: pct < 55,
        etiquette,
      },
    };
  }

  // "n collaborateurs off" (28/08/2026, bulle au survol) — un férié/CPI/DJI
  // concerne tout l'effectif actif (même liste pour tout le monde, voir
  // `communDuJour`), sinon le nombre de collaborateurs sur un congé
  // personnel ce jour-là.
  function etiquetteDuJour(iso: string): string {
    const commun = communDuJour(iso);
    if (commun?.type === "ferie") return "Jour férié";
    const n = commun ? totalActifs : occupantsDuJour(iso).length;
    return `${n} collab${n > 1 ? "s" : ""} off`;
  }

  // "n Collab. off · n demi-jour." (28/08/2026, en-tête du panneau de
  // détail) — un férié/CPI concerne tout l'effectif à 100% (2
  // demi-journées chacun), une DJI à 50% (1 demi-journée chacun) ; sinon
  // somme des poids réels des congés personnels de ce jour (0,5 ou 1 par
  // collaborateur, voir `poidsJourneeDemande`).
  function statsDuJour(iso: string): { nbCollaborateurs: number; nbDemiJournees: number } {
    const commun = communDuJour(iso);
    if (commun && commun.type !== "dji") {
      return { nbCollaborateurs: totalActifs, nbDemiJournees: totalActifs * 2 };
    }
    if (commun?.type === "dji") {
      return { nbCollaborateurs: totalActifs, nbDemiJournees: totalActifs };
    }
    const occupants = occupantsDuJour(iso);
    return {
      nbCollaborateurs: occupants.length,
      nbDemiJournees: occupants.reduce((s, d) => s + poidsJourneeDemande(d, iso) * 2, 0),
    };
  }

  const occupantsSelection = dateSelectionnee ? occupantsDuJour(dateSelectionnee) : [];
  const communSelection = dateSelectionnee ? communDuJour(dateSelectionnee) : null;
  const statsSelection = dateSelectionnee ? statsDuJour(dateSelectionnee) : null;
  const couleurSelection = dateSelectionnee
    ? (tipoDuJour(dateSelectionnee).plein ?? { couleur: "#ffffff", texteSombre: true })
    : null;
  // Demi-journée imposée (DJI) intégrée dans la section Matin/Après-midi
  // correspondante (28/08/2026, demande explicite) — plutôt qu'un bandeau
  // séparé, elle rejoint la liste comme une ligne de plus (elle concerne
  // tous les collaborateurs actifs, pas une demande individuelle).
  const sectionDji =
    communSelection?.type === "dji"
      ? communSelection.libelle === "Matin"
        ? "matin"
        : "apres_midi"
      : null;
  const sectionsSelection = SECTIONS_JOURNEE.map((s) => ({
    ...s,
    demandes: occupantsSelection.filter(
      (d) => dateSelectionnee && sectionDemande(d, dateSelectionnee) === s.cle,
    ),
    dji: s.cle === sectionDji,
  })).filter((s) => s.demandes.length > 0 || s.dji);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => setOnglet("en_cours")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              onglet === "en_cours"
                ? "bg-slate/90 hover:bg-slate text-white"
                : "border-slate text-slate hover:bg-slate/10 border bg-transparent"
            }`}
          >
            {anneeActuelle}
          </button>
          {onglet === "en_cours" && (
            <div className="relative inline-flex w-fit items-center gap-1.5">
              <span className="text-ink-500 text-xs">Débute :</span>
              <select
                value={vueCompleteEnCours ? "complete" : "mois_en_cours"}
                onChange={(e) => setVueCompleteEnCours(e.target.value === "complete")}
                className="text-ink-900 relative appearance-none pr-4 text-xs font-normal underline underline-offset-2 outline-none"
              >
                <option value="mois_en_cours">{formatMoisAnneeCourt(todayIso)}</option>
                <option value="complete">{formatMoisAnneeCourt(debutAnneeActuelle)}</option>
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOnglet("periode_cp")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              onglet === "periode_cp"
                ? "bg-slate/90 hover:bg-slate text-white"
                : "border-slate text-slate hover:bg-slate/10 border bg-transparent"
            }`}
          >
            {`${formatMoisAnneeCourt(debutPeriodeCp)} → ${formatMoisAnneeCourt(finPeriodeCp)}`}
          </button>
          {onglet === "periode_cp" && (
            <div className="relative inline-flex w-fit items-center gap-1.5">
              <span className="text-ink-500 text-xs">Débute :</span>
              <select
                value={vueCompletePeriodeCp ? "complete" : "mois_en_cours"}
                onChange={(e) => setVueCompletePeriodeCp(e.target.value === "complete")}
                className="text-ink-900 relative appearance-none pr-4 text-xs font-normal underline underline-offset-2 outline-none"
              >
                <option value="mois_en_cours">{formatMoisAnneeCourt(todayIso)}</option>
                <option value="complete">{formatMoisAnneeCourt(debutPeriodeCp)}</option>
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOnglet("annee_suivante")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              onglet === "annee_suivante"
                ? "bg-slate/90 hover:bg-slate text-white"
                : "border-slate text-slate hover:bg-slate/10 border bg-transparent"
            }`}
          >
            {anneeSuivante}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-[10px] xl:grid-cols-[max-content_16rem]">
        <div className="min-w-0">
          {onglet === "annee_suivante" && !anneeSuivanteParametree && (
            <p className="mb-4 text-sm font-normal">
              <span className="text-ink-900 rounded-sm bg-yellow-200 px-1">
                {`Le calendrier ${anneeSuivante} n’est pas encore paramétré par l’administrateur.`}
              </span>
            </p>
          )}
          <div className="flex max-w-[797px] flex-wrap gap-[10px]">
            {moisActifs.map(({ annee, moisIndex }) => (
              <MiniCalendrier
                key={`${annee}-${moisIndex}`}
                annee={annee}
                moisIndex={moisIndex}
                tipoDuJour={tipoDuJour}
                onJourClick={(iso) => setDateSelectionnee(iso)}
                estAujourdhui={(iso) => iso === todayIso}
                estMisEnAvant={(iso) => iso === dateSelectionnee}
                className="h-[290px] w-full max-w-[259px] sm:w-[calc(50%-5px)] lg:w-[calc((100%-20px)/3)]"
                texteJour="text-base"
                paddingClassName="p-6"
                classeTitreMois="text-slate text-base"
              />
            ))}
          </div>
        </div>

        {dateSelectionnee && statsSelection && couleurSelection && (
          // Largeur/position identiques à `DetailCongePanel` (`xl:w-64
          // xl:shrink-0 xl:sticky xl:top-4`) — même gabarit que le panneau de
          // détail d'un congé, dont ce bandeau reprend aussi la structure
          // (28/08/2026, demande explicite) : bandeau coloré (ici la couleur
          // heatmap du jour plutôt qu'une couleur de type) avec titre + sous-
          // titre + fermer, puis un corps blanc en dessous.
          <div className="flex w-full flex-col gap-[3px] xl:sticky xl:top-4 xl:w-64 xl:shrink-0">
            <div className="px-4 py-3" style={{ background: couleurSelection.couleur }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <JourBadge>{nomJourSemaine(dateSelectionnee).slice(0, 2)}</JourBadge>
                  <div>
                    <div
                      className={`text-sm font-bold ${couleurSelection.texteSombre ? "text-ink-900" : "text-white"}`}
                    >
                      {formatDateSansJour(dateSelectionnee)}
                    </div>
                    <div
                      className={`text-xs font-semibold ${couleurSelection.texteSombre ? "text-ink-900/70" : "text-white/80"}`}
                    >
                      {communSelection?.type === "ferie"
                        ? "Jour férié"
                        : `${statsSelection.nbCollaborateurs} Collab. off · ${statsSelection.nbDemiJournees} demi-jour.`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDateSelectionnee(null)}
                  aria-label="Fermer"
                  className={`shrink-0 ${
                    couleurSelection.texteSombre
                      ? "text-ink-900/60 hover:text-ink-900"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="bg-surface-card flex flex-col gap-4 p-4 shadow-sm">
              {communSelection?.type === "cpi" && (
                <div className="rounded-control bg-status-warning-bg text-status-warning-fg px-3 py-2 text-xs font-semibold">
                  Congé imposé pour tous les collaborateurs
                </div>
              )}
              {communSelection?.type === "ferie" ? (
                <p className="text-ink-500 text-center text-[11px] font-semibold">
                  Personne ne travaille aujourd&apos;hui !
                </p>
              ) : sectionsSelection.length === 0 && !communSelection ? (
                <EmptyRow text="Aucun collaborateur en congé ce jour-là." />
              ) : (
                sectionsSelection.map((section) => (
                  <div key={section.cle} className="flex flex-col gap-2.5">
                    <h4 className="text-ink-900 text-sm font-semibold">{section.libelle}</h4>
                    {section.demandes.map((d) => {
                      const code = codeBadgeDemande(d);
                      return (
                        <div key={d.id} className="flex items-center gap-2.5 pl-3">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-ink-500 truncate text-xs font-semibold">
                              {d.demandeur.prenom} {d.demandeur.nom}
                            </span>
                            <span
                              className={`bg-surface-app text-ink-900 flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${classeBordureTypeBadge(code)}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                  d.statut === "validé"
                                    ? "bg-status-success-fg"
                                    : "bg-status-warning-fg"
                                }`}
                              />
                              {code} : {formatPeriodePillNumerique(d.debut, d.fin)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {section.dji && (
                      <div className="flex items-center pl-3">
                        <span className="bg-dji/15 text-dji w-fit rounded-sm px-1 text-xs font-semibold">
                          Demi-journée imposée
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
