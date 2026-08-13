"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Eye, PlusCircle } from "lucide-react";
import { formatDate, formatJours, formatPeriodeDemande, todayISO } from "@/lib/format";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import { useReglesConges } from "@/hooks/useReglesConges";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { SoldeCard } from "@/components/ui/SoldeCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RequestList } from "@/components/demandes/RequestList";
import {
  TypeBadge,
  classeFondAttenueTypeBadge,
  classeFondTypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { Modal } from "@/components/ui/Modal";
import { ReglesCongesModal } from "@/components/dashboard/ReglesCongesModal";
import type { Demande } from "@/lib/types";

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

/** Sélecteur "Affichage : Vue complète / Mois en cours" — pas un vrai 3e
 * comportement : pilote exactement le même booléen "vue complète" qu'avant
 * (mois en cours = aujourd'hui → fin de la fenêtre), juste un select. Rendu
 * en texte souligné + chevron, volontairement discret (pas la pilule
 * `SelectPille` des popins DJI/CPI, trop visible ici). */
function SelectAffichage({ actif, onChange }: { actif: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="relative inline-flex w-fit items-center gap-1.5 self-start">
      <span className="text-ink-500 text-xs">Affichage :</span>
      <select
        value={actif ? "complete" : "mois_en_cours"}
        onChange={(e) => onChange(e.target.value === "complete")}
        className="text-ink-900 relative appearance-none pr-4 text-xs font-semibold underline underline-offset-2 outline-none"
      >
        <option value="mois_en_cours">Mois en cours</option>
        <option value="complete">Vue complète</option>
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
 * Accueil 2 (scénarisation) — duplicata de `DashboardPage` pour itérer sur
 * l'évolution de l'accueil collaborateur sans toucher à l'écran en
 * production. Route `/accueil2`, à retravailler/retirer une fois la
 * direction validée (voir Backlog.md).
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
  const { soldes, loading: loadingSoldes } = useSoldes();
  const { demandes, loading: loadingDemandes } = useDemandes();
  const { reglesAcquisition, loading: loadingRegles } = useReglesConges();
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [attentesOuvertes, setAttentesOuvertes] = useState(false);
  const [legendeOuverte, setLegendeOuverte] = useState<LegendeOuverte | null>(null);
  const [snippet, setSnippet] = useState<{ demande: Demande; ancre: DOMRect } | null>(null);
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

  const enCours = demandes
    .filter((d) => d.statut === "en attente")
    .sort((a, b) => a.debut.localeCompare(b.debut));

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
  const joursFeriesTous = [
    ...calendrierAnneePrecedente.joursFeries,
    ...calendrierAnneeA.joursFeries,
    ...calendrierAnneeB.joursFeries,
  ]
    .filter((f) => f.date >= rangeActive.debut && f.date <= rangeActive.fin)
    .sort((a, b) => a.date.localeCompare(b.date));

  function demandeDuJour(iso: string): Demande | undefined {
    return demandes.find((d) => d.statut !== "refusé" && iso >= d.debut && iso <= d.fin);
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-4 md:max-w-6xl md:pt-0">
      <div className="px-1 pt-5 md:pt-0">
        <h1 className="text-ink-900 text-2xl font-semibold">Bonjour, {utilisateur.prenom}</h1>
      </div>

      <div className="flex flex-col gap-2">
        <div className="bg-mint-tint flex flex-col gap-4 rounded-2xl p-4 md:flex-row md:items-center md:gap-6 md:p-5">
          <div className="flex shrink-0 flex-col gap-1 md:w-44">
            <h2 className="text-ink-900 text-lg font-bold">Soldes</h2>
            <p className="text-ink-500 text-xs leading-snug">Quels congés imposés cette année ?</p>
            <button
              type="button"
              onClick={() => setReglesOuvertes(true)}
              className="text-ink-900 w-fit text-xs font-semibold underline"
            >
              découvrir
            </button>
          </div>

          <div className="grid max-w-2xl flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <SoldeCard
              valeur={soldes.cp.valeur}
              conditionPrefixe={soldes.cp.conditionPrefixe}
              conditionAccent={soldes.cp.conditionAccent}
              tone="cp"
            />
            <SoldeCard
              valeur={soldes.rtt.valeur}
              conditionPrefixe={soldes.rtt.conditionPrefixe}
              conditionAccent={soldes.rtt.conditionAccent}
              tone="rtt"
            />
            <SoldeCard
              valeur={soldes.cpa.valeur}
              conditionPrefixe={soldes.cpa.conditionPrefixe}
              conditionAccent={soldes.cpa.conditionAccent}
              tone="cpa"
            />
            <Link
              href="/nouvelle-demande"
              className="bg-mint flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl p-4 text-white shadow-sm"
            >
              <span className="text-sm font-semibold">Poser un congé</span>
              <PlusCircle size={20} />
            </Link>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAttentesOuvertes(true)}
        className={`rounded-control px-4 py-3 text-left text-sm font-semibold transition-opacity duration-150 hover:opacity-80 ${
          enCours.length > 0
            ? "bg-status-warning-bg text-status-warning-fg"
            : "bg-status-neutral-bg text-status-neutral-fg"
        }`}
      >
        {enCours.length > 0
          ? `En attente de validation (${enCours.length})`
          : "Aucune demande de validation en cours"}
      </button>

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
      </div>

      {onglet === "en_cours" && (
        <SelectAffichage actif={vueCompleteEnCours} onChange={setVueCompleteEnCours} />
      )}
      {onglet === "periode_cp" && (
        <SelectAffichage actif={vueCompletePeriodeCp} onChange={setVueCompletePeriodeCp} />
      )}

      {onglet === "annee_suivante" && !anneeSuivanteParametree && (
        <div className="bg-status-neutral-bg text-status-neutral-fg rounded-control px-4 py-3 text-sm font-semibold">
          {`Le calendrier ${anneeSuivante} n’est pas encore paramétré par l’administrateur.`}
        </div>
      )}

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="grid max-w-[900px] flex-1 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))] gap-4">
          {moisActifs.map(({ annee, moisIndex }) => (
            <MiniCalendrier
              key={`${annee}-${moisIndex}`}
              annee={annee}
              moisIndex={moisIndex}
              tipoDuJour={tipoDuJour}
              estEnGroupe={estEnGroupe}
              onJourClick={handleJourClick}
            />
          ))}
        </div>

        <div className="flex w-full flex-col gap-3 md:w-72 md:shrink-0">
          <LegendeCard
            code="CPI"
            label="Congés imposés"
            compteur={`${congesImposesTous.length} période${congesImposesTous.length > 1 ? "s" : ""}`}
            onClick={() => setLegendeOuverte({ kind: "CPI" })}
          />
          <LegendeCard
            code="DJI"
            label="Demi-journées imposées"
            compteur={`${djImposeesTous.length} demi-journée${djImposeesTous.length > 1 ? "s" : ""}`}
            onClick={() => setLegendeOuverte({ kind: "DJI" })}
          />
          <LegendeCard
            code="FERIE"
            label="Jours fériés"
            compteur={`${joursFeriesTous.length} jour${joursFeriesTous.length > 1 ? "s" : ""}`}
            onClick={() => setLegendeOuverte({ kind: "FERIE" })}
          />
          {typesPersoPresents.map((code) => {
            const count = demandesVisibles.filter((d) => codeBadgeDemande(d) === code).length;
            return (
              <LegendeCard
                key={code}
                code={code}
                label={LABEL_LEGENDE[code] ?? code}
                compteur={`${count} demande${count > 1 ? "s" : ""}`}
                onClick={() => setLegendeOuverte({ kind: "PERSO", code })}
              />
            );
          })}
        </div>
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

      {attentesOuvertes && (
        <Modal title="En attente de validation" onClose={() => setAttentesOuvertes(false)}>
          <RequestList demandes={enCours} emptyText="Aucune demande en attente." />
        </Modal>
      )}

      {legendeOuverte && (
        <Modal
          title={
            legendeOuverte.kind === "CPI"
              ? "Congés imposés"
              : legendeOuverte.kind === "DJI"
                ? "Demi-journées imposées"
                : legendeOuverte.kind === "FERIE"
                  ? "Jours fériés"
                  : (LABEL_LEGENDE[legendeOuverte.code] ?? legendeOuverte.code)
          }
          onClose={() => setLegendeOuverte(null)}
        >
          {legendeOuverte.kind === "CPI" &&
            (congesImposesTous.length === 0 ? (
              <p className="text-ink-500 text-sm">Aucun congé imposé.</p>
            ) : (
              <div className="flex flex-col">
                {congesImposesTous.map((c) => (
                  <div
                    key={c.id}
                    className="border-ink-300/60 flex items-center justify-between border-b py-2.5 text-sm last:border-0"
                  >
                    <span className="text-ink-900 font-semibold">
                      {formatPeriodeDemande(c.debut, c.fin)}
                    </span>
                  </div>
                ))}
              </div>
            ))}

          {legendeOuverte.kind === "DJI" &&
            (djImposeesTous.length === 0 ? (
              <p className="text-ink-500 text-sm">Aucune demi-journée imposée.</p>
            ) : (
              <div className="flex flex-col">
                {djImposeesTous.map((d) => (
                  <div
                    key={d.id}
                    className="border-ink-300/60 flex items-center justify-between border-b py-2.5 text-sm last:border-0"
                  >
                    <span className="text-ink-900 font-semibold">{formatDate(d.date)}</span>
                    <span className="text-ink-500 text-xs">
                      {d.demiJournee === "matin" ? "Matin" : "Après-midi"}
                    </span>
                  </div>
                ))}
              </div>
            ))}

          {legendeOuverte.kind === "FERIE" &&
            (joursFeriesTous.length === 0 ? (
              <p className="text-ink-500 text-sm">Aucun jour férié.</p>
            ) : (
              <div className="flex flex-col">
                {joursFeriesTous.map((f) => (
                  <div
                    key={f.id}
                    className="border-ink-300/60 flex items-center justify-between border-b py-2.5 text-sm last:border-0"
                  >
                    <span className="text-ink-900 font-semibold">{formatDate(f.date)}</span>
                    <span className="text-ink-500 text-xs">{f.libelle}</span>
                  </div>
                ))}
              </div>
            ))}

          {legendeOuverte.kind === "PERSO" && (
            <RequestList
              demandes={demandesVisibles.filter((d) => codeBadgeDemande(d) === legendeOuverte.code)}
              emptyText="Aucune demande."
            />
          )}
        </Modal>
      )}
    </div>
  );
}
