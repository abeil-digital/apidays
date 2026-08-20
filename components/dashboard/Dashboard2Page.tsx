"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, Newspaper, PlusCircle, X } from "lucide-react";
import { formatDate, formatJours, formatPeriodeDemande, todayISO } from "@/lib/format";
import { dureeCongeImpose } from "@/lib/joursFeries";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import { useReglesConges } from "@/hooks/useReglesConges";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { Badge } from "@/components/ui/Badge";
import { PeriodeAvecPastilles } from "@/components/ui/PeriodeAvecPastilles";
import { SoldeCard } from "@/components/ui/SoldeCard";
import { STATUT_CONFIG, StatusBadge } from "@/components/ui/StatusBadge";
import {
  TypeBadge,
  classeFondAttenueTypeBadge,
  classeFondTypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { ActiviteRecenteFeed } from "@/components/dashboard/ActiviteRecenteFeed";
import { ListingTiroir } from "@/components/dashboard/ListingTiroir";
import { ReglesCongesModal } from "@/components/dashboard/ReglesCongesModal";
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

/** Sélecteur "Débute : Mois en cours / Début période" — pas un vrai 3e
 * comportement : pilote exactement le même booléen "vue complète" qu'avant
 * (mois en cours = aujourd'hui → fin de la fenêtre), juste un select. Rendu
 * en texte souligné + chevron, volontairement discret (pas la pilule
 * `SelectPille` des popins DJI/CPI, trop visible ici). */
function SelectAffichage({ actif, onChange }: { actif: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="relative inline-flex w-fit items-center gap-1.5">
      <span className="text-ink-500 text-xs">Débute :</span>
      <select
        value={actif ? "complete" : "mois_en_cours"}
        onChange={(e) => onChange(e.target.value === "complete")}
        className="text-ink-900 relative appearance-none pr-4 text-xs font-semibold underline underline-offset-2 outline-none"
      >
        <option value="mois_en_cours">Mois en cours</option>
        <option value="complete">Début période</option>
      </select>
      <ChevronDown size={11} className="text-ink-900 pointer-events-none absolute right-0" />
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

const LABEL_LEGENDE: Partial<Record<TypeBadgeCode, string>> = {
  CP: "Congés payés",
  RTT: "RTT",
  CPA: "Congés en acquisition",
  CSS: "Congé sans solde",
  CE: "Congé exceptionnel",
  RECUP: "Récupération",
  EVT_FAM: "Événement familial",
};

// Ordre d'affichage fixe des cartes de légende — demandé explicitement
// (14/08/2026), CPI repositionnée juste après DJI (les deux "imposés" par
// l'admin) suite à un oubli dans la première formulation de la demande. Les
// codes perso hors de cette liste (CE, RECUP, EVT_FAM...) restent affichés,
// ajoutés après dans leur ordre naturel (voir usage plus bas).
const ORDRE_LEGENDE: TypeBadgeCode[] = ["CP", "RTT", "CPA", "DJI", "CPI", "FERIE", "CSS"];

/** Carte de légende cliquable — même gabarit que les cartes CPI/DJI/Fériés de
 * Paramétrer > Calendrier, adapté en lecture seule (toujours l'icône œil,
 * jamais de +, le collaborateur ne peut rien ajouter depuis cet écran). */
function LegendeCard({
  code,
  label,
  compteur,
  onClick,
}: {
  code: TypeBadgeCode;
  label: string;
  compteur: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-surface-card group flex items-start gap-2.5 rounded-xl p-4 text-left shadow-sm"
    >
      <TypeBadge code={code} />
      <div className="flex flex-1 flex-col">
        <span className="text-ink-900 text-sm">{label}</span>
        <span className="text-ink-500 mt-1 text-xs">{compteur}</span>
      </div>
      <Eye
        size={18}
        className="text-mint shrink-0 self-center transition-transform duration-150 group-hover:scale-125"
      />
    </button>
  );
}

type LegendeOuverte =
  { kind: "CPI" } | { kind: "DJI" } | { kind: "FERIE" } | { kind: "PERSO"; code: TypeBadgeCode };

function SnippetDemande({
  demande,
  ancre,
  onFermer,
}: {
  demande: Demande;
  ancre: DOMRect;
  onFermer: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onFermer} />
      <div
        style={{ position: "fixed", top: ancre.bottom + 8, left: ancre.left }}
        className="bg-surface-card z-30 flex w-56 flex-col gap-2 rounded-xl p-3 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <TypeBadge code={codeBadgeDemande(demande)} />
          <div className="text-ink-900 text-sm font-bold">
            {formatPeriodeDemande(demande.debut, demande.fin)}
          </div>
        </div>
        <div className="text-ink-500 text-xs">
          {formatJours(demande.nbDemiJournees / 2)} jour{demande.nbDemiJournees / 2 > 1 ? "s" : ""}
        </div>
        <StatusBadge statut={demande.statut} />
      </div>
    </>
  );
}

/**
 * Accueil collaborateur — écran unique, route `/` (14/08/2026 : remplace
 * l'ancien `DashboardPage`, supprimé ; le nom de fichier/composant
 * `Dashboard2Page` reste tel quel pour l'instant, pas de renommage fait —
 * voir Backlog.md si on veut nettoyer ça un jour, même logique que
 * `Calendrier2Page`).
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
 * (Fériés/CPI/DJI), + une colonne latérale légende (CPI/DJI/Fériés + un type
 * par nature de demande utilisée, tous scopés à la fenêtre affichée),
 * cliquable pour le détail en lecture seule. "En attente de validation" est
 * un encart stabilo séparé au-dessus du calendrier (ouvre sa propre popin).
 */
export function Dashboard2Page() {
  const { utilisateur, loading: loadingUtilisateur } = useUtilisateur();
  const { soldes, loading: loadingSoldes, refetch: refetchSoldes } = useSoldes();
  const { demandes, loading: loadingDemandes, refetch: refetchDemandes } = useDemandes();
  const { reglesAcquisition, loading: loadingRegles } = useReglesConges();
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [soldeDetailOuvert, setSoldeDetailOuvert] = useState<CodeSoldeDetail | null>(null);
  const [tiroirActiviteOuvert, setTiroirActiviteOuvert] = useState(false);
  const [tiroirListingOuvert, setTiroirListingOuvert] = useState(false);
  const [nouvelleDemandeOuverte, setNouvelleDemandeOuverte] = useState(false);
  const [legendeOuverte, setLegendeOuverte] = useState<LegendeOuverte | null>(null);
  const [calendrierHauteur, setCalendrierHauteur] = useState<number | null>(null);
  const calendrierGridRef = useRef<HTMLDivElement>(null);
  const [snippet, setSnippet] = useState<{ demande: Demande; ancre: DOMRect } | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("en_cours");
  const [vueCompleteEnCours, setVueCompleteEnCours] = useState(false);
  const [vueCompletePeriodeCp, setVueCompletePeriodeCp] = useState(false);

  // Toutes les popins CPI/DJI/Fériés/PERSO s'ouvrent à la même position — le
  // haut de la colonne légende (`absolute` dans son propre conteneur
  // `relative`, pas `fixed` : reste alignée avec le calendrier au scroll,
  // contrairement à un ancrage viewport). Hauteur calée sur celle du
  // calendrier affiché (mesurée au clic) plutôt que sur le nombre de lignes
  // de la liste, pour ne jamais laisser entrevoir les cartes en dessous.
  function ouvrirLegende(cible: LegendeOuverte) {
    setLegendeOuverte(cible);
    setCalendrierHauteur(calendrierGridRef.current?.getBoundingClientRect().height ?? null);
  }

  function fermerLegende() {
    setLegendeOuverte(null);
    setCalendrierHauteur(null);
  }

  // Popin CPI/DJI/Fériés/PERSO — ferme aussi au clavier, comme `Modal`.
  useEffect(() => {
    if (!legendeOuverte) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") fermerLegende();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [legendeOuverte]);

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
    en_cours: { debut: vueCompleteEnCours ? debutAnneeActuelle : todayIso, fin: finAnneeActuelle },
    periode_cp: {
      debut: vueCompletePeriodeCp ? debutPeriodeCp : todayIso,
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

  // Légende (remplace l'ancienne colonne "En attente de validation") — jours
  // communs et types de demandes perso, scopés à la fenêtre affichée par
  // l'onglet actif (plus de fusion aveugle de deux années).
  const demandesVisibles = demandes.filter(
    (d) => d.statut !== "refusé" && d.debut <= rangeActive.fin && d.fin >= rangeActive.debut,
  );
  const typesPersoPresents = Array.from(new Set(demandesVisibles.map(codeBadgeDemande)));
  const congesImposesTous = [
    ...calendrierAnneePrecedente.congesImposes,
    ...calendrierAnneeA.congesImposes,
    ...calendrierAnneeB.congesImposes,
  ]
    .filter(
      (c) =>
        anneeVisiblePourCommuns(Number(c.debut.slice(0, 4))) &&
        c.debut <= rangeActive.fin &&
        c.fin >= rangeActive.debut,
    )
    .sort((a, b) => a.debut.localeCompare(b.debut));
  const congesImposesLabel = `${congesImposesTous.length} période${congesImposesTous.length > 1 ? "s" : ""}`;
  const djImposeesTous = [
    ...calendrierAnneePrecedente.djImposees,
    ...calendrierAnneeA.djImposees,
    ...calendrierAnneeB.djImposees,
  ]
    .filter(
      (d) =>
        anneeVisiblePourCommuns(Number(d.date.slice(0, 4))) &&
        d.date >= rangeActive.debut &&
        d.date <= rangeActive.fin,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const djImposeesLabel = `${djImposeesTous.length} demi-journée${djImposeesTous.length > 1 ? "s" : ""}`;
  const periodeActiveLabel = `${formatDate(rangeActive.debut)} - ${formatDate(rangeActive.fin)}`;
  // Non filtré par `rangeActive` (contrairement à `joursFeriesTous` juste en
  // dessous) : une période de congé imposé affichée peut déborder de la
  // fenêtre active (chevauchement partiel), `dureeCongeImpose` a besoin de
  // TOUS les fériés qui la couvrent réellement pour un décompte juste.
  const joursFeriesToutesAnnees = [
    ...calendrierAnneePrecedente.joursFeries,
    ...calendrierAnneeA.joursFeries,
    ...calendrierAnneeB.joursFeries,
  ];
  const joursFeriesTous = joursFeriesToutesAnnees
    .filter((f) => f.date >= rangeActive.debut && f.date <= rangeActive.fin)
    .sort((a, b) => a.date.localeCompare(b.date));
  const joursFeriesLabel = `${joursFeriesTous.length} jour${joursFeriesTous.length > 1 ? "s" : ""}`;

  // Demandes perso (CP/RTT/CPA/CSS/...) de la fenêtre active pour un code
  // donné — même filtre que `typesPersoPresents`/`LegendeCard`, factorisé
  // pour être réutilisé à la fois par l'en-tête et le corps de la popin.
  function demandesDuType(code: TypeBadgeCode): Demande[] {
    return demandesVisibles.filter((d) => codeBadgeDemande(d) === code);
  }

  function labelDemandes(n: number): string {
    return `${n} demande${n > 1 ? "s" : ""}`;
  }

  // Rend la carte de légende pour un `code` donné, quel que soit son type
  // (commun CPI/DJI/Fériés ou perso CP/RTT/CPA/...) — `null` pour un code
  // perso absent de la fenêtre active (voir `ORDRE_LEGENDE`, filtré avant
  // affichage). Centralise le mapping code → libellé/compteur/onClick pour
  // que l'ordre d'affichage (un simple tableau) n'ait pas à dupliquer cette
  // logique.
  function renderLegendeCard(code: TypeBadgeCode) {
    if (code === "CPI") {
      return (
        <LegendeCard
          key="CPI"
          code="CPI"
          label="Congés imposés"
          compteur={congesImposesLabel}
          onClick={() => ouvrirLegende({ kind: "CPI" })}
        />
      );
    }
    if (code === "DJI") {
      return (
        <LegendeCard
          key="DJI"
          code="DJI"
          label="Demi-journées imposées"
          compteur={djImposeesLabel}
          onClick={() => ouvrirLegende({ kind: "DJI" })}
        />
      );
    }
    if (code === "FERIE") {
      return (
        <LegendeCard
          key="FERIE"
          code="FERIE"
          label="Jours fériés"
          compteur={joursFeriesLabel}
          onClick={() => ouvrirLegende({ kind: "FERIE" })}
        />
      );
    }
    if (!typesPersoPresents.includes(code)) return null;
    return (
      <LegendeCard
        key={code}
        code={code}
        label={LABEL_LEGENDE[code] ?? code}
        compteur={labelDemandes(demandesDuType(code).length)}
        onClick={() => ouvrirLegende({ kind: "PERSO", code })}
      />
    );
  }

  function demandeDuJour(iso: string): Demande | undefined {
    return demandes.find((d) => d.statut !== "refusé" && iso >= d.debut && iso <= d.fin);
  }

  // Met en avant sur le calendrier les jours couverts par la popin
  // actuellement ouverte (CPI/DJI/Fériés/PERSO) — passé à chaque
  // `MiniCalendrier` via `estMisEnAvant`, indépendant du survol.
  function estJourDuPopinOuverte(iso: string): boolean {
    if (!legendeOuverte) return false;
    if (legendeOuverte.kind === "DJI") return djImposeesTous.some((d) => d.date === iso);
    if (legendeOuverte.kind === "FERIE") return joursFeriesTous.some((f) => f.date === iso);
    if (legendeOuverte.kind === "CPI") {
      return congesImposesTous.some((c) => iso >= c.debut && iso <= c.fin);
    }
    return demandesDuType(legendeOuverte.code).some((d) => iso >= d.debut && iso <= d.fin);
  }

  // En-tête plein-cadre coloré des popins récapitulatives CPI/DJI (même
  // gabarit que `SoldeDetailPanel`) : `TypeBadge` cerclé de blanc à la place
  // de l'avatar (sinon invisible sur un fond de la même couleur), compteur à
  // la place du nom, période active affichée (`rangeActive`) à la place du
  // sous-titre "Détail du solde".
  function headerLegende(code: TypeBadgeCode, compteur: string) {
    return (
      <div className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(code)}`}>
        <div className="flex items-center gap-2.5">
          <div className="rounded-full ring-2 ring-white">
            <TypeBadge code={code} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{compteur}</div>
            <div className="text-xs font-semibold text-white/80">{periodeActiveLabel}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={fermerLegende}
          className="shrink-0 text-white/70 hover:text-white"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
      </div>
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
      return {
        moitie: {
          couleur: "var(--color-dji)",
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
  function tipoDuJour(iso: string): PastilleJour | null {
    const demande = demandeDuJour(iso);
    if (demande) {
      const code = codeBadgeDemande(demande);
      const classeFond =
        demande.statut === "en attente"
          ? classeFondAttenueTypeBadge(code)
          : classeFondTypeBadge(code);
      return { classeFond };
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

  function handleJourClick(iso: string, ancre: DOMRect) {
    const demande = demandeDuJour(iso);
    if (demande) setSnippet({ demande, ancre });
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
    (d) => (d.statut === "validé" || d.statut === "refusé") && !d.vu,
  ).length;

  return (
    <div className="flex w-full max-w-md flex-col gap-6 pb-4 md:max-w-6xl md:pt-0">
      <div className="px-1 pt-5 md:pt-0">
        <h1 className="text-ink-900 text-2xl font-semibold">Bonjour, {utilisateur.prenom}</h1>
      </div>

      <div className="flex w-fit flex-col gap-1 rounded-xl bg-transparent px-3 py-2">
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

      <div className="flex flex-col gap-4 rounded-2xl py-4 md:py-5">
        <div className="flex flex-col gap-1 px-1">
          <h2 className="text-ink-900 text-lg font-bold">Soldes</h2>
        </div>

        {/* Colonne fantôme `md:w-72 md:shrink-0` invisible (18/08/2026, test)
              — même largeur que la colonne légende du calendrier plus bas,
              pour que ce `flex-1` se calcule identiquement au sien : le bord
              droit du bouton "Poser un congé" s'aligne alors exactement sur
              celui du 4ème mois du calendrier, quelle que soit la largeur
              d'écran, sans dupliquer sa largeur en dur. */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="grid max-w-[900px] flex-1 grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_1fr_160px]">
            <SoldeCard
              valeur={soldes.cp.valeurApresAttente}
              conditionPrefixe={soldes.cp.conditionPrefixe}
              conditionAccent={soldes.cp.conditionAccent}
              tone="cp"
              avecInfo
              onInfoClick={() => setSoldeDetailOuvert("CP")}
            />
            <SoldeCard
              valeur={soldes.rtt.valeurApresAttente}
              conditionPrefixe={soldes.rtt.conditionPrefixe}
              conditionAccent={soldes.rtt.conditionAccent}
              tone="rtt"
              avecInfo
              onInfoClick={() => setSoldeDetailOuvert("RTT")}
            />
            <SoldeCard
              valeur={soldes.cpa.valeurApresAttente}
              conditionPrefixe={soldes.cpa.conditionPrefixe}
              conditionAccent={soldes.cpa.conditionAccent}
              tone="cpa"
              avecInfo
              onInfoClick={() => setSoldeDetailOuvert("CPA")}
            />
            <button
              type="button"
              onClick={() => setNouvelleDemandeOuverte(true)}
              className="bg-mint flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl p-4 text-white shadow-sm"
            >
              <span className="text-sm font-semibold">Poser un congé</span>
              <PlusCircle size={20} />
            </button>
          </div>
          <div aria-hidden="true" className="hidden md:block md:w-72 md:shrink-0" />
        </div>
      </div>

      {/* Carte masquée (18/08/2026, test) — contenu conservé, juste caché
          (`hidden`) le temps d'itérer sur la ligne au-dessus qui la remplace
          potentiellement. Voir Backlog.md. */}
      <div className="hidden flex-col gap-4 md:flex-row">
        <div className="grid max-w-[900px] flex-1 grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_1fr_160px]">
          <div className="bg-surface-card col-span-2 flex flex-col gap-4 rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0">
                <h2 className="text-ink-900 text-lg font-bold">Mes demandes</h2>
                <span className="text-ink-500 -mt-1 text-sm">Depuis votre dernière visite</span>
              </div>
              <button
                type="button"
                onClick={() => setTiroirActiviteOuvert(true)}
                className="text-mint text-sm font-semibold transition-opacity duration-150 hover:opacity-70"
              >
                Mon journal
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/historique?statut=en_attente"
                className="bg-status-warning-bg text-status-warning-fg flex items-center gap-2 rounded-full py-2 pr-4 pl-3.5 text-base shadow-sm transition-shadow duration-150 hover:shadow-lg"
              >
                <span className="font-semibold">
                  {demandes.filter((d) => d.statut === "en attente").length}
                </span>
                En attente
              </Link>
              <Link
                href="/historique?statut=valide_non_vu"
                className="bg-status-success-bg text-status-success-fg flex items-center gap-2 rounded-full py-2 pr-4 pl-3.5 text-base shadow-sm transition-shadow duration-150 hover:shadow-lg"
              >
                <span className="font-semibold">
                  {demandes.filter((d) => d.statut === "validé" && !d.vu).length}
                </span>
                Validées
              </Link>
              <Link
                href="/historique?statut=refuse_non_vu"
                className="bg-status-danger-bg text-status-danger-fg flex items-center gap-2 rounded-full py-2 pr-4 pl-3.5 text-base shadow-sm transition-shadow duration-150 hover:shadow-lg"
              >
                <span className="font-semibold">
                  {demandes.filter((d) => d.statut === "refusé" && !d.vu).length}
                </span>
                Refusées
              </Link>
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="hidden md:block md:w-72 md:shrink-0" />
      </div>

      <h2 className="text-ink-900 px-1 text-lg font-bold">Mes Congés</h2>

      <div className="flex flex-wrap items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => setOnglet("en_cours")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            onglet === "en_cours"
              ? "bg-brand text-brand-foreground"
              : "bg-surface-card text-ink-900 shadow-sm"
          }`}
        >
          {anneeActuelle}
        </button>
        <button
          type="button"
          onClick={() => setOnglet("periode_cp")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            onglet === "periode_cp"
              ? "bg-brand text-brand-foreground"
              : "bg-surface-card text-ink-900 shadow-sm"
          }`}
        >
          {`${formatMoisAnneeCourt(debutPeriodeCp)} → ${formatMoisAnneeCourt(finPeriodeCp)}`}
        </button>
        <button
          type="button"
          onClick={() => setOnglet("annee_suivante")}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            onglet === "annee_suivante"
              ? "bg-brand text-brand-foreground"
              : "bg-surface-card text-ink-900 shadow-sm"
          }`}
        >
          {anneeSuivante}
        </button>
        {onglet === "en_cours" && (
          <SelectAffichage actif={vueCompleteEnCours} onChange={setVueCompleteEnCours} />
        )}
        {onglet === "periode_cp" && (
          <SelectAffichage actif={vueCompletePeriodeCp} onChange={setVueCompletePeriodeCp} />
        )}
      </div>

      {onglet === "annee_suivante" && !anneeSuivanteParametree && (
        <div className="bg-status-neutral-bg text-status-neutral-fg rounded-control px-4 py-3 text-sm font-semibold">
          {`Le calendrier ${anneeSuivante} n’est pas encore paramétré par l’administrateur.`}
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row">
        <div
          ref={calendrierGridRef}
          className="grid max-w-[900px] flex-1 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))] gap-4"
        >
          {moisActifs.map(({ annee, moisIndex }) => (
            <MiniCalendrier
              key={`${annee}-${moisIndex}`}
              annee={annee}
              moisIndex={moisIndex}
              tipoDuJour={tipoDuJour}
              estEnGroupe={estEnGroupe}
              onJourClick={handleJourClick}
              estMisEnAvant={estJourDuPopinOuverte}
              estAujourdhui={(iso) => iso === todayIso}
            />
          ))}
        </div>

        <div className="relative flex w-full flex-col gap-3 md:w-72 md:shrink-0">
          {ORDRE_LEGENDE.map((code) => renderLegendeCard(code))}
          {typesPersoPresents
            .filter((code) => !ORDRE_LEGENDE.includes(code))
            .map((code) => renderLegendeCard(code))}
          {/* Popin CPI/DJI/Fériés/PERSO — `absolute` dans ce conteneur `relative`
            (pas `fixed`) : reste alignée avec le calendrier au scroll plutôt
            que figée à l'écran, et posée en haut de la colonne (`top-0`, la
            carte cliquée n'importe plus, voir `ouvrirLegende`). Hauteur calée
            sur celle du calendrier affiché (mesurée au clic, pas sur le
            nombre de lignes de la liste) pour ne jamais laisser entrevoir les
            cartes de légende suivantes en dessous. Pas de fond assombri :
            expérimentation demandée explicitement pour ces 4 popins
            seulement, `Modal` reste le composant par défaut partout ailleurs
            (confirmations, `ReglesCongesModal`...). */}
          {legendeOuverte && (
            <>
              <div className="fixed inset-0 z-40" onClick={fermerLegende} />
              <div
                style={calendrierHauteur ? { height: calendrierHauteur } : undefined}
                className="bg-surface-card absolute top-0 left-0 z-50 w-full overflow-y-auto shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {legendeOuverte.kind === "DJI"
                  ? headerLegende("DJI", djImposeesLabel)
                  : legendeOuverte.kind === "CPI"
                    ? headerLegende("CPI", congesImposesLabel)
                    : legendeOuverte.kind === "FERIE"
                      ? headerLegende("FERIE", joursFeriesLabel)
                      : headerLegende(
                          legendeOuverte.code,
                          labelDemandes(demandesDuType(legendeOuverte.code).length),
                        )}

                <div className="border-ink-300/60 border-t px-4 py-1">
                  {/* CPI/DJI/FERIE/PERSO (18/08/2026) — même gabarit (période +
                      `Badge`), tone "success" et pas d'icône pour CPI/DJI/FERIE
                      (pas de notion de statut/décision ici, même convention que
                      `ProchainsJoursOffCard`). `TypeBadge` remplacé par une
                      simple pastille de couleur (18/08/2026) : toutes les
                      lignes d'une même popin partagent le même type, le cercle
                      "CPI"/"DJI"/"CP"... répété à chaque ligne faisait redite
                      avec le titre de la popin. */}
                  {legendeOuverte.kind === "CPI" &&
                    (congesImposesTous.length === 0 ? (
                      <p className="text-ink-500 py-3 text-sm">Aucun congé imposé.</p>
                    ) : (
                      <div className="flex flex-col">
                        {congesImposesTous.map((c) => (
                          <div key={c.id} className="flex items-center gap-3 py-3">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge("CPI")}`}
                            />
                            <div className="min-w-0 flex-1">
                              <PeriodeAvecPastilles
                                debut={c.debut}
                                fin={c.fin}
                                demiDebut="matin"
                                demiFin="apres_midi"
                              />
                            </div>
                            <span className="origin-right scale-90">
                              <Badge tone="success">
                                <span className="text-[14.4px]">
                                  {formatJours(dureeCongeImpose(c, joursFeriesToutesAnnees))} j
                                </span>
                              </Badge>
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}

                  {legendeOuverte.kind === "DJI" &&
                    (djImposeesTous.length === 0 ? (
                      <p className="text-ink-500 py-3 text-sm">Aucune demi-journée imposée.</p>
                    ) : (
                      <div className="flex flex-col">
                        {djImposeesTous.map((d) => (
                          <div key={d.id} className="flex items-center gap-3 py-3">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge("DJI")}`}
                            />
                            <div className="min-w-0 flex-1">
                              <PeriodeAvecPastilles
                                debut={d.date}
                                fin={d.date}
                                demiDebut={d.demiJournee}
                                demiFin={d.demiJournee}
                              />
                            </div>
                            <span className="origin-right scale-90">
                              <Badge tone="success">
                                <span className="text-[14.4px]">0,5 j</span>
                              </Badge>
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}

                  {legendeOuverte.kind === "FERIE" &&
                    (joursFeriesTous.length === 0 ? (
                      <p className="text-ink-500 py-3 text-sm">Aucun jour férié.</p>
                    ) : (
                      <div className="flex flex-col">
                        {joursFeriesTous.map((f) => (
                          <div key={f.id} className="flex items-center gap-3 py-3">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge("FERIE")}`}
                            />
                            <div className="min-w-0 flex-1">
                              <PeriodeAvecPastilles
                                debut={f.date}
                                fin={f.date}
                                demiDebut="matin"
                                demiFin="apres_midi"
                              />
                            </div>
                            <span className="origin-right scale-90">
                              <Badge tone="success">
                                <span className="text-[14.4px]">1 j</span>
                              </Badge>
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}

                  {legendeOuverte.kind === "PERSO" &&
                    (() => {
                      const code = legendeOuverte.code;
                      const demandes = demandesDuType(code);
                      // Même gabarit que la popin "Suivre les demandes"
                      // (`ProchainsJoursOffCard`/`SuiviDemandeRow`) — période +
                      // `Badge` statut/durée, plutôt que la pastille
                      // pill+contour d'origine (17/08/2026).
                      return demandes.length === 0 ? (
                        <p className="text-ink-500 py-3 text-sm">Aucune demande.</p>
                      ) : (
                        <div className="flex flex-col">
                          {demandes.map((d) => {
                            const { tone, Icon } = STATUT_CONFIG[d.statut];
                            return (
                              <div key={d.id} className="flex items-center gap-3 py-3">
                                <span
                                  className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(code)}`}
                                />
                                <div className="min-w-0 flex-1">
                                  <PeriodeAvecPastilles
                                    debut={d.debut}
                                    fin={d.fin}
                                    demiDebut={d.demiDebut}
                                    demiFin={d.demiFin}
                                  />
                                </div>
                                <span className="origin-right scale-90">
                                  <Badge tone={tone}>
                                    <Icon size={12} strokeWidth={2.5} />
                                    <span className="text-[14.4px]">
                                      {formatJours(d.nbDemiJournees / 2)} j
                                    </span>
                                  </Badge>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* "découvrir"/"Mes demandes" déplacés ici (18/08/2026, temporaire) —
          sous les calendriers plutôt qu'au-dessus, le temps de retravailler
          leur emplacement définitif. Voir Backlog.md. "Journal" est remonté
          juste après les compteurs En attente/Validées/Refusées. */}
      <div className="flex items-center gap-3 px-1">
        <button
          type="button"
          onClick={() => setReglesOuvertes(true)}
          className="text-ink-900 text-xs font-semibold underline"
        >
          découvrir
        </button>
        <button
          type="button"
          onClick={() => setTiroirListingOuvert(true)}
          className="bg-status-neutral-bg text-status-neutral-fg inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold transition-opacity duration-150 hover:opacity-80"
        >
          Mes demandes
        </button>
      </div>

      {snippet && (
        <SnippetDemande
          demande={snippet.demande}
          ancre={snippet.ancre}
          onFermer={() => setSnippet(null)}
        />
      )}

      {reglesOuvertes && (
        <ReglesCongesModal soldes={soldes} onClose={() => setReglesOuvertes(false)} />
      )}

      {/* "Poser un congé" (18/08/2026) — s'affiche en popin contextuelle sur
          Accueil plutôt que de naviguer vers `/nouvelle-demande` (route
          conservée pour l'instant, vouée à être désactivée). `onSuccess`
          rafraîchit `demandes`/`soldes` de CETTE page : la popin a sa propre
          instance de `useDemandes`/`useSoldes`, l'ajout ne se répercute pas
          automatiquement ici. */}
      {nouvelleDemandeOuverte && (
        <PoserDemandeModal
          onClose={() => setNouvelleDemandeOuverte(false)}
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
          aurait ajouté un double padding. */}
      {soldeDetailOuvert && (
        <div
          className="bg-ink-900/50 fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setSoldeDetailOuvert(null)}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <SoldeDetailPanel
              key={soldeDetailOuvert}
              code={soldeDetailOuvert}
              utilisateurId={utilisateur.id}
              nomComplet={`${utilisateur.prenom} ${utilisateur.nom}`}
              onClose={() => setSoldeDetailOuvert(null)}
            />
          </div>
        </div>
      )}

      <ActiviteRecenteFeed
        demandes={demandes}
        tiroirOuvert={tiroirActiviteOuvert}
        onFermerTiroir={() => setTiroirActiviteOuvert(false)}
      />

      <ListingTiroir
        demandes={demandes}
        tiroirOuvert={tiroirListingOuvert}
        onFermerTiroir={() => setTiroirListingOuvert(false)}
      />
    </div>
  );
}
