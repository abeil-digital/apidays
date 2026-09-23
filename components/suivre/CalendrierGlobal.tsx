"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { getAujourdhui } from "@/lib/aujourdhui";
import { formatPeriodePillNumerique, nomJourSemaine, todayISO } from "@/lib/format";
import { couleurHeatmap } from "@/lib/heatmap";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandesEquipe } from "@/hooks/useDemandesEquipe";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { JourBadge } from "@/components/ui/JourBadge";
import { classeBordureTypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import type { DemandeEquipe } from "@/lib/types";

/** Sélecteur "Commence : Aujourd'hui / Il y a 3 mois" — même composant que
 * `SelectCommence` de `DashboardPage.tsx`/`CalendrierCollaborateur.tsx`
 * (duplication assumée, même convention). */
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

function isoDate(annee: number, moisIndex: number, jour: number): string {
  return new Date(Date.UTC(annee, moisIndex, jour)).toISOString().slice(0, 10);
}

function ajouterJoursIso(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
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
// 5 paliers. Extrait dans `lib/heatmap.ts` (18/09/2026) pour être réutilisé
// par la card "Collaborateurs en congé aujourd'hui" de l'Accueil.

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
  // "Commence : Aujourd'hui / Il y a 3 mois" (17/09/2026, demande explicite
  // de Vincent — "appliquer le même système d'affichage que les calendriers
  // collaborateurs plutôt que les anciens filtres") : remplace les 3 onglets
  // En cours/Période CP/Année suivante par la même fenêtre glissante de 9
  // mois que `DashboardPage.tsx`/`CalendrierCollaborateur.tsx`, formule
  // reprise à l'identique (voir le commentaire détaillé là-bas).
  const [commenceIlYA3Mois, setCommenceIlYA3Mois] = useState(false);
  // Jour du panneau détail ouvert par défaut au chargement (29/08/2026) —
  // "aujourd'hui" plutôt qu'aucune sélection, cohérent avec `estMisEnAvant`/
  // `estAujourdhui` déjà mis en avant sur la grille dès l'ouverture.
  const [dateSelectionnee, setDateSelectionnee] = useState<string | null>(() => todayISO());

  // `getAujourdhui()` plutôt que `new Date()` (10/09/2026, demande explicite
  // de Vincent) — voir DashboardPage.tsx, même correctif : pour que le
  // bandeau de date simulée locale entraîne bien la fenêtre glissante.
  const anneeActuelle = getAujourdhui().getFullYear();
  const anneePrecedente = anneeActuelle - 1;
  const anneeSuivante = anneeActuelle + 1;
  const calendrierAnneePrecedente = useCalendrier(anneePrecedente);
  const calendrierAnneeA = useCalendrier(anneeActuelle);
  const calendrierAnneeB = useCalendrier(anneeSuivante);

  const loading =
    loadingDemandes ||
    loadingUtilisateurs ||
    calendrierAnneePrecedente.loading ||
    calendrierAnneeA.loading ||
    calendrierAnneeB.loading;

  if (loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  const actifsIds = new Set(utilisateurs.filter((u) => u.statut === "actif").map((u) => u.id));
  const totalActifs = actifsIds.size;

  const todayIso = todayISO();

  // Fenêtre glissante de 9 mois (17/09/2026, formule identique à
  // `DashboardPage.tsx`) — `moisIndexDebutBrut` peut être négatif (ex. mois
  // en cours = janvier, décalage -3 → octobre de l'année PRÉCÉDENTE), le
  // modulo est reconstruit à la main pour rester positif.
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
  // sont toujours visibles (fixes, connus à l'avance), CPI/DJI seulement si
  // Delphine a publié l'année — plus d'exception pour l'année en cours
  // (10/09/2026, retirée à la demande explicite de Vincent, voir
  // CONTEXTE.md).
  function anneeVisiblePourCommuns(annee: number): boolean {
    return Boolean(calendrierPourAnnee(annee).parametrage?.valideLe);
  }

  // Message "calendrier(s) pas encore paramétré(s)" (10/09/2026, généralisé
  // — voir même logique/commentaire dans DashboardPage.tsx) : couvre "En
  // cours", "Période de référence" (jusqu'à 2 années à cheval) et "Année
  // suivante", pas seulement cette dernière comme avant.
  const anneesNonParametrees = (() => {
    const anneeDebut = Number(rangeActive.debut.slice(0, 4));
    const anneeFin = Number(rangeActive.fin.slice(0, 4));
    const annees: number[] = [];
    for (let a = anneeDebut; a <= anneeFin; a++) annees.push(a);
    return annees.filter((a) => !anneeVisiblePourCommuns(a));
  })();

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
      <div className="px-1">
        <SelectCommence actif={commenceIlYA3Mois} onChange={setCommenceIlYA3Mois} />
      </div>

      {/* `minmax(0,797px)` plutôt que `max-content` (11/09/2026, bug signalé
      — "les calendriers se compressent, c'est laid" avec seulement 3 mois
      affichés) : les mini-calendriers ci-dessous ont des largeurs en
      POURCENTAGE (`lg:w-[calc((100%-20px)/3)]`), qui n'ont pas de référence
      stable pour se résoudre à l'intérieur d'une colonne `max-content` —
      même gabarit "contenu + colonne latérale 16rem" que
      `TransmissionsPaiePage.tsx`/`VerifierFichesPaiePage2.tsx`
      (`minmax(0,900px)_16rem`), qui n'ont pas ce problème. */}
      {/* `xl:items-stretch` (23/09/2026, demande explicite de Vincent) —
          `items-start` limitait la colonne détail à la hauteur de son
          propre contenu (~300-500px) plutôt qu'à celle de la grille des
          mois : le `xl:sticky` du panneau cessait de fonctionner passé
          cette hauteur en scrollant. Fonctionnait la plupart du temps par
          coïncidence (hauteurs comparables), pas de façon fiable. */}
      <div className="grid grid-cols-1 gap-[10px] xl:grid-cols-[minmax(0,797px)_16rem] xl:items-stretch">
        <div className="min-w-0">
          {anneesNonParametrees.length > 0 && (
            <p className="mb-4 text-sm font-normal">
              <span className="text-ink-900 rounded-sm bg-yellow-200 px-1">
                {anneesNonParametrees.length === 1
                  ? `Le calendrier ${anneesNonParametrees[0]} n’est pas encore paramétré par l’administrateur.`
                  : `Les calendriers ${anneesNonParametrees.join(" et ")} ne sont pas paramétrés par l’administrateur.`}
              </span>
            </p>
          )}
          {/* `justify-center` (22/09/2026, demande explicite de Vincent —
              "caler le calendrier consolidé sur mobile") : centre la
              dernière ligne incomplète à `sm:`/`lg:`, sans effet visible sur
              une ligne déjà pleine.
              `max-w-[259px]` réservé à `sm:` et plus (même jour, 2e retour —
              "les calendriers normaux et le calendrier consolidé n'ont pas
              le même comportement sur mobile") : sous `sm:`, les calendriers
              "normaux" (`DashboardPage.tsx`/`CalendrierCollaborateur.tsx`)
              utilisent une vraie grille CSS `grid-cols-1` — chaque card
              occupe 100% de la largeur, sans plafond. Ici en `flex-wrap`,
              le plafond s'appliquait à TOUTES les largeurs (hérité du
              plafond desktop/`lg:`, pas lié au bug d'origine du 11/09 —
              "les calendriers se compressent" à 3 colonnes), ce qui
              rétrécissait la card mobile à 259px au lieu de remplir l'écran
              comme partout ailleurs. */}
          <div className="flex max-w-[797px] flex-wrap justify-center gap-[10px]">
            {moisActifs.map(({ annee, moisIndex }) => (
              <MiniCalendrier
                key={`${annee}-${moisIndex}`}
                annee={annee}
                moisIndex={moisIndex}
                tipoDuJour={tipoDuJour}
                onJourClick={(iso) => setDateSelectionnee(iso)}
                estAujourdhui={(iso) => iso === todayIso}
                estMisEnAvant={(iso) => iso === dateSelectionnee}
                className="h-[290px] w-full sm:w-[calc(50%-5px)] sm:max-w-[259px] lg:w-[calc((100%-20px)/3)]"
                texteJour="text-base"
                paddingClassName="p-6"
                classeTitreMois="text-slate text-base"
              />
            ))}
          </div>
        </div>

        {dateSelectionnee &&
          statsSelection &&
          couleurSelection &&
          (() => {
            // Contenu du détail jour — extrait pour être rendu à deux
            // endroits : la colonne desktop `xl:sticky` juste en dessous
            // (inchangée), ET la popin mobile plus bas (22/09/2026, demande
            // explicite de Vincent — "sur le calendrier consolidé le détail
            // d'un jour doit aussi s'afficher en popin sur mobile", même
            // principe que `DetailCongePanel` partout ailleurs).
            const detailJourJsx = (
              <>
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
              </>
            );

            return (
              <>
                {/* Largeur/position identiques à `DetailCongePanel` (`xl:w-64
                    xl:shrink-0 xl:sticky xl:top-4`) — même gabarit que le
                    panneau de détail d'un congé (28/08/2026, demande
                    explicite). `hidden sm:flex` (22/09/2026) : sous `sm:`, ce
                    panneau s'ouvre en popin (voir plus bas) plutôt que de
                    s'empiler sous la grille des mois. */}
                <div className="hidden w-full flex-col gap-[3px] sm:flex xl:sticky xl:top-4 xl:w-64 xl:shrink-0">
                  {detailJourJsx}
                </div>

                {/* Popin mobile — portail vers `document.body`, `sm:hidden`
                    sur le backdrop uniquement : toujours monté, invisible dès
                    `sm:`. */}
                {typeof document !== "undefined" &&
                  createPortal(
                    <div
                      className="bg-ink-900/50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8 sm:hidden"
                      onClick={() => setDateSelectionnee(null)}
                    >
                      <div
                        className="flex w-full flex-col gap-[3px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {detailJourJsx}
                      </div>
                    </div>,
                    document.body,
                  )}
              </>
            );
          })()}
      </div>
    </div>
  );
}
