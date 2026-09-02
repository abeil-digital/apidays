"use client";

import { useState } from "react";
import { ChevronDown, Newspaper, PlusCircle } from "lucide-react";
import { todayISO } from "@/lib/format";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import { useReglesConges } from "@/hooks/useReglesConges";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { SoldeCard } from "@/components/ui/SoldeCard";
import {
  classeFondAttenueTypeBadge,
  classeFondTypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import {
  SnippetJourCalendrier,
  type JourCalendrierClique,
} from "@/components/demandes/SnippetJourCalendrier";
import { CompteurTypologies } from "@/components/demandes/CompteurTypologies";
import { compterTypologies } from "@/components/demandes/compterTypologies";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { ActiviteRecenteFeed } from "@/components/dashboard/ActiviteRecenteFeed";
import { DemandesAEtudierCard } from "@/components/dashboard/DemandesAEtudierCard";
import { FaqCard } from "@/components/dashboard/FaqCard";
import { ProchainsJoursOffCard } from "@/components/dashboard/ProchainsJoursOffCard";
import { PoserDemandeModal } from "@/components/nouvelle-demande/PoserDemandeModal";
import { SoldeDetailPanel } from "@/components/suivre/SoldeDetailPanel";
import type { Demande } from "@/lib/types";

type CodeSoldeDetail = "CP" | "RTT" | "CPA";

type Onglet = "en_cours" | "periode_cp" | "annee_suivante";

function isoDate(annee: number, moisIndex: number, jour: number): string {
  return new Date(Date.UTC(annee, moisIndex, jour)).toISOString().slice(0, 10);
}

function ajouterJoursIso(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "Juin 26" — mois abrégé + année sur 2 chiffres, pour le libellé de
 * l'onglet "Période de référence" (ex. "Juin 26 → Mai 27"). */
function formatMoisAnneeCourt(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const texte = new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(d);
  return texte.charAt(0).toUpperCase() + texte.slice(1).replace(".", "");
}

/** Sélecteur "Débute : {mois en cours} / {début de la période}" — pas un vrai
 * 3e comportement : pilote exactement le même booléen "vue complète"
 * qu'avant (mois en cours = aujourd'hui → fin de la fenêtre), juste un
 * select. Libellés personnalisés par appelant (20/08/2026, demande
 * explicite) — ex. "Août 26"/"Janv. 26" pour l'onglet année civile,
 * "Août 26"/"Juin 26" pour l'onglet période de référence CP — plutôt que
 * les génériques "Mois en cours"/"Début période" d'origine. Rendu en texte
 * souligné + chevron, volontairement discret (pas la pilule `SelectPille`
 * des popins DJI/CPI, trop visible ici). */
function SelectAffichage({
  actif,
  onChange,
  labelMoisEnCours,
  labelDebut,
}: {
  actif: boolean;
  onChange: (v: boolean) => void;
  labelMoisEnCours: string;
  labelDebut: string;
}) {
  return (
    <div className="relative inline-flex w-fit items-center gap-1.5">
      <span className="text-ink-500 text-xs">Débute :</span>
      <select
        value={actif ? "complete" : "mois_en_cours"}
        onChange={(e) => onChange(e.target.value === "complete")}
        className="text-ink-900 relative appearance-none pr-4 text-xs font-normal underline underline-offset-2 outline-none"
      >
        <option value="mois_en_cours">{labelMoisEnCours}</option>
        <option value="complete">{labelDebut}</option>
      </select>
      <ChevronDown size={11} className="text-mint pointer-events-none absolute right-0" />
    </div>
  );
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
 * "Demandes en cours"/"Prochains congés" remplacés par une vue calendrier en
 * 3 onglets — Année en cours / Période de référence CP / Année suivante —
 * plutôt qu'un rolling 12 mois : chaque onglet affiche par défaut de
 * aujourd'hui jusqu'à la fin de sa fenêtre (bouton "vue complète" pour
 * revoir depuis le début, sauf "Année suivante" qui reste toujours pleine).
 * Ça évite de fusionner des jours de deux années civiles derrière un seul
 * chiffre dans la légende (le cas qui a motivé cette refonte : "22 jours
 * fériés" ne voulait rien dire, c'était 11+11 de deux années différentes).
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
  const { demandes, loading: loadingDemandes, refetch: refetchDemandes } = useDemandes();
  const { reglesAcquisition, loading: loadingRegles } = useReglesConges();
  const [soldeDetailOuvert, setSoldeDetailOuvert] = useState<CodeSoldeDetail | null>(null);
  const [tiroirActiviteOuvert, setTiroirActiviteOuvert] = useState(false);
  const [nouvelleDemandeOuverte, setNouvelleDemandeOuverte] = useState(false);
  // Date pré-remplie de la popin "Poser un congé" (20/08/2026) — non-null
  // uniquement quand ouverte via un clic sur un jour vide du calendrier ;
  // reste `null` pour une ouverture "vierge" via le bouton dédié.
  const [dateNouvelleDemande, setDateNouvelleDemande] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<{ jour: JourCalendrierClique; ancre: DOMRect } | null>(
    null,
  );
  const [onglet, setOnglet] = useState<Onglet>("en_cours");
  const [vueCompleteEnCours, setVueCompleteEnCours] = useState(false);
  const [vueCompletePeriodeCp, setVueCompletePeriodeCp] = useState(false);

  const anneeActuelle = new Date().getFullYear();
  const anneePrecedente = anneeActuelle - 1;
  const anneeSuivante = anneeActuelle + 1;
  // Jours "communs" (Fériés/CPI/DJI) — 3 années possibles selon l'onglet :
  // la période de référence CP peut chevaucher l'année précédente si elle
  // n'a pas encore démarré cette année (ex. période "juin → mai", vue avant
  // le 1er juin).
  const calendrierAnneePrecedente = useCalendrier(anneePrecedente);
  const calendrierAnneeA = useCalendrier(anneeActuelle);
  const calendrierAnneeB = useCalendrier(anneeSuivante);

  const loading =
    loadingUtilisateur ||
    loadingSoldes ||
    loadingDemandes ||
    loadingRegles ||
    calendrierAnneePrecedente.loading ||
    calendrierAnneeA.loading ||
    calendrierAnneeB.loading;

  if (loading || !utilisateur || !soldes) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  const todayIso = todayISO();
  const debutAnneeActuelle = isoDate(anneeActuelle, 0, 1);
  const finAnneeActuelle = isoDate(anneeActuelle, 11, 31);
  // 1er jour du mois en cours (25/08/2026, bug signalé par Vincent) — la vue
  // "mois en cours" ("Août 26") doit démarrer le 1er du mois, pas
  // littéralement aujourd'hui : sinon un congé déjà posé plus tôt dans le
  // mois (validé ou encore en attente) disparaissait de la légende/du
  // calendrier alors que le libellé affiché ("Août 26") laisse croire que
  // tout le mois est couvert.
  const debutMoisActuel = isoDate(anneeActuelle, new Date().getMonth(), 1);

  const regleCp = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  // Fenêtre de la période de référence CP contenant aujourd'hui — par
  // exemple pour "1er juin → 31 mai", si on est en août la période va du
  // 01/06 cette année au 31/05 l'an prochain ; si on est en mars, elle va du
  // 01/06 l'an dernier au 31/05 cette année.
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

  function calendrierPourAnnee(annee: number) {
    if (annee === anneePrecedente) return calendrierAnneePrecedente;
    if (annee === anneeSuivante) return calendrierAnneeB;
    return calendrierAnneeA;
  }

  function anneeVisiblePourCommuns(annee: number): boolean {
    return annee === anneeActuelle || Boolean(calendrierPourAnnee(annee).parametrage?.valideLe);
  }

  // Listes fusionnées des 3 années potentiellement pertinentes, filtrées aux
  // années effectivement visibles (même règle que les pastilles du
  // calendrier, `anneeVisiblePourCommuns` — les fériés restent toujours
  // visibles) — alimente le compteur par typologie (`compterTypologies`) sur
  // la période active.
  const joursFeriesToutesAnnees = [
    ...calendrierAnneePrecedente.joursFeries,
    ...calendrierAnneeA.joursFeries,
    ...calendrierAnneeB.joursFeries,
  ];
  const congesImposesVisibles = [
    ...calendrierAnneePrecedente.congesImposes,
    ...calendrierAnneeA.congesImposes,
    ...calendrierAnneeB.congesImposes,
  ].filter((c) => anneeVisiblePourCommuns(Number(c.debut.slice(0, 4))));
  const djImposeesVisibles = [
    ...calendrierAnneePrecedente.djImposees,
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

  function demandeDuJour(iso: string): Demande | undefined {
    return demandes.find(
      (d) => d.statut !== "refusé" && d.statut !== "annulé" && iso >= d.debut && iso <= d.fin,
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

  // Priorité d'affichage : demande personnelle du collaborateur > férié > CPI
  // > DJI. Un chevauchement demande/CPI-DJI reste un cas marginal (voir
  // Backlog.md — scan de chevauchement dédié), la demande perso l'emporte
  // visuellement ici plutôt que de le masquer.
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
  function tipoDuJour(iso: string): PastilleJour | null {
    const demande = demandeDuJour(iso);
    if (demande) {
      const code = codeBadgeDemande(demande);
      const matinCouvert = !(iso === demande.debut && demande.demiDebut === "apres_midi");
      const apresMidiCouvert = !(iso === demande.fin && demande.demiFin === "matin");

      if (matinCouvert && apresMidiCouvert) {
        const classeFond =
          demande.statut === "en attente"
            ? classeFondAttenueTypeBadge(code)
            : classeFondTypeBadge(code);
        return { classeFond };
      }

      const couleurBase = `var(${VAR_COULEUR_TYPE[code]})`;
      const couleur =
        demande.statut === "en attente"
          ? `color-mix(in srgb, ${couleurBase} 50%, white)`
          : couleurBase;
      return { moitie: { couleur, cote: matinCouvert ? "gauche" : "droite" } };
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
  // demande perso > férié > CPI > DJI, même priorité que `communDuJour`
  // (24/08/2026 : les fériés ouvrent désormais aussi l'overlay, avec leur
  // nom — `SnippetJourCalendrier`). Même gating que `communDuJour` pour
  // CPI/DJI (`anneeVisiblePourCommuns`, les fériés y échappent) : pas
  // d'overlay pour une entrée qui n'est de toute façon pas affichée sur la
  // pastille (année à venir non publiée).
  function occupantDuJour(iso: string): JourCalendrierClique | null {
    const demande = demandeDuJour(iso);
    if (demande) return { kind: "demande", demande };
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    const ferie = cal.joursFeries.find((f) => f.date === iso);
    if (ferie) return { kind: "ferie", ferie };
    if (!anneeVisiblePourCommuns(annee)) return null;
    const cpi = cal.congesImposes.find((c) => iso >= c.debut && iso <= c.fin);
    if (cpi) return { kind: "cpi", cpi };
    const dji = cal.djImposees.find((d) => d.date === iso);
    if (dji) return { kind: "dji", dji };
    return null;
  }

  function handleJourClick(iso: string, ancre: DOMRect) {
    const jour = occupantDuJour(iso);
    if (jour) setSnippet({ jour, ancre });
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
  // l'autre. "vu" ne se marque plus à la fermeture du volet journal (Vincent :
  // perturbant que la mise en avant disparaisse dès qu'on ouvre/ferme le
  // tiroir) — voir `useDemandes` pour le nouveau principe "depuis votre
  // dernière connexion" (mise en avant conservée toute la session en cours,
  // effacée au début de la session suivante).
  const nbEnAttente = demandes.filter((d) => d.statut === "en attente").length;
  const nbDecisionsNonVues = demandes.filter(
    (d) => (d.statut === "validé" || d.statut === "refusé" || d.statut === "annulé") && !d.vu,
  ).length;

  return (
    <div className="flex w-full max-w-md flex-col gap-6 pb-4 md:max-w-none md:pt-0">
      <div className="animate-stagger-in px-1 pt-5 md:pt-0">
        <h1 className="text-slate text-2xl font-semibold">Bonjour, {utilisateur.prenom}</h1>
      </div>

      <div
        className="animate-stagger-in flex w-fit flex-col gap-1 rounded-xl bg-transparent px-3 py-2"
        style={{ animationDelay: "70ms" }}
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
            <>
              <span className="text-ink-900 rounded-sm bg-yellow-100 px-1 font-semibold">
                {nbDecisionsNonVues}{" "}
                {nbDecisionsNonVues === 1 ? "nouvelle décision" : "nouvelles décisions"}
              </span>
              <span className="text-ink-500">-</span>
              <button
                type="button"
                onClick={() => setTiroirActiviteOuvert(true)}
                className="text-mint font-bold underline"
              >
                voir le journal
              </button>
            </>
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

      {utilisateur.role === "manager" && (
        <div className="animate-stagger-in" style={{ animationDelay: "140ms" }}>
          <DemandesAEtudierCard />
        </div>
      )}

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
          <h2 className="text-slate text-base font-semibold">Suivre mes soldes</h2>
        </div>

        <div className="grid max-w-[900px] grid-cols-2 gap-3 md:grid-cols-[minmax(0,200px)_minmax(0,200px)_minmax(0,200px)_160px]">
          <SoldeCard
            valeur={soldes.cp.valeurApresAttente}
            conditionPrefixe={soldes.cp.conditionPrefixe}
            conditionAccent={soldes.cp.conditionAccent}
            tone="cp"
            onClick={() => setSoldeDetailOuvert("CP")}
            classeValeur="text-slate"
          />
          <SoldeCard
            valeur={soldes.rtt.valeurApresAttente}
            conditionPrefixe={soldes.rtt.conditionPrefixe}
            conditionAccent={soldes.rtt.conditionAccent}
            tone="rtt"
            onClick={() => setSoldeDetailOuvert("RTT")}
            classeValeur="text-slate"
          />
          <SoldeCard
            valeur={soldes.cpa.valeurApresAttente}
            conditionPrefixe={soldes.cpa.conditionPrefixe}
            conditionAccent={soldes.cpa.conditionAccent}
            tone="cpa"
            onClick={() => setSoldeDetailOuvert("CPA")}
            classeValeur="text-slate"
          />
          <button
            type="button"
            onClick={() => setNouvelleDemandeOuverte(true)}
            className="text-mint hover:text-mint-hover flex h-full w-full flex-col items-center justify-center gap-2 p-4 transition-[transform,color] hover:scale-110"
          >
            <PlusCircle size={56} />
            <span className="text-sm font-semibold">Poser un congé</span>
          </button>
        </div>
      </div>

      {/* "Mon Calendrier" — titre + filtre onglets déplacés au-dessus des DEUX
          colonnes (20/08/2026, demande explicite) : depuis que l'onglet actif
          filtre aussi "Prochains jours off" (`debutPeriode`/`finPeriode`), le
          filtre ne concerne plus seulement le calendrier — le caler à gauche
          au-dessus des deux colonnes le rend visuellement plus clair. */}
      <div className="animate-stagger-in" style={{ animationDelay: "280ms" }}>
        <h2 className="text-slate mb-[14px] px-1 text-base font-semibold">Mon Calendrier</h2>
        {/* Compteur par typologie (24/08/2026, demande explicite) — sur la
            même ligne que les onglets de sélection de période, poussé à
            droite (`justify-between`) : un total par typologie de "day off"
            réellement présente sur la période active. */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1">
          <div className="flex flex-wrap items-center gap-2">
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
              <SelectAffichage
                actif={vueCompleteEnCours}
                onChange={setVueCompleteEnCours}
                labelMoisEnCours={formatMoisAnneeCourt(todayIso)}
                labelDebut={formatMoisAnneeCourt(debutAnneeActuelle)}
              />
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
              <SelectAffichage
                actif={vueCompletePeriodeCp}
                onChange={setVueCompletePeriodeCp}
                labelMoisEnCours={formatMoisAnneeCourt(todayIso)}
                labelDebut={formatMoisAnneeCourt(debutPeriodeCp)}
              />
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

          <CompteurTypologies typologies={typologies} />
        </div>
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
      <div
        className="animate-stagger-in flex flex-col gap-3 md:flex-row"
        style={{ animationDelay: "350ms" }}
      >
        {/* Hauteur plafonnée à 604px (20/08/2026, demande explicite) = 2
            lignes de cards mois (290px × 2 + 24px de gap) pour que le bas de
            cette card s'aligne sur le bas de 2 lignes de calendrier — le
            titre/bandeau d'onglets étant désormais commun aux deux colonnes
            (déplacé au-dessus), plus de décalage à compenser entre elles.
            Plutôt que de suivre la hauteur réelle du calendrier
            (`align-items: stretch` par défaut du `flex md:flex-row`
            parent) — au-delà de 2 lignes équivalentes de contenu, la liste
            scrolle en interne (`overflow-y-auto` dans `ProchainsJoursOffCard`)
            au lieu de continuer à grandir. */}
        <div className="p-2 md:h-[604px] md:w-72 md:shrink-0">
          <ProchainsJoursOffCard debutPeriode={rangeActive.debut} finPeriode={rangeActive.fin} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-6">
            {onglet === "annee_suivante" && !anneeSuivanteParametree && (
              // Effet "stabilo" (21/08/2026, demande explicite) — même
              // convention que la phrase "X demandes en attente" plus haut
              // sur cette page (`bg-status-warning-bg`/`rounded-sm`/`px-1`),
              // plutôt qu'un encart plein `rounded-control` avec padding.
              <p className="text-sm font-normal">
                <span className="text-ink-900 rounded-sm bg-yellow-200 px-1">
                  {`Le calendrier ${anneeSuivante} n’est pas encore paramétré par l’administrateur.`}
                </span>
              </p>
            )}

            {/* Responsive (20/08/2026) — 1 carte/ligne sous `sm`, 2 entre `sm`
                et `lg`, 3 à partir de `lg`. `flex flex-wrap` plutôt qu'un
                `grid-cols-3` (20/08/2026, correction) : avec un `grid`, une
                dernière ligne incomplète (ex. 5 mois → 3+2) réserve quand
                même la 3ᵉ colonne vide, ce qui laissait une gouttière béante
                à droite de "Décembre". En `flex-wrap`, les cartes de la
                dernière ligne s'alignent simplement à gauche, sans colonne
                fantôme. Largeurs par palier en dur sur `MiniCalendrier`
                (`w-full` / `calc(50%-12px)` / `250px`) puisqu'il n'y a plus
                de tracks de grille pour les calculer automatiquement. Gap
                `gap-6` et padding interne `p-6` (via `paddingClassName`) —
                demande explicite d'aération. `max-w-[798px]` = 3×250px +
                2×24px de gap, pour figer 250px par card à `lg`. */}
            <div className="flex max-w-[798px] flex-wrap gap-6">
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
                  className="h-[290px] w-full sm:w-[calc(50%-12px)] lg:w-[calc((100%-48px)/3)]"
                  texteJour="text-base"
                  paddingClassName="p-6"
                  classeTitreMois="text-slate text-base"
                />
              ))}
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
            />
          </div>
        </div>
      )}

      <ActiviteRecenteFeed
        demandes={demandes}
        tiroirOuvert={tiroirActiviteOuvert}
        onFermerTiroir={() => setTiroirActiviteOuvert(false)}
      />
    </div>
  );
}
