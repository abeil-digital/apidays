"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Demande } from "@/lib/types";
import { formatDateAction, formatJours } from "@/lib/format";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { classeFondTypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

const NB_LIGNES = 6;

// Fond au survol : blanc teinté à 5% de la couleur du type de congé
// concerné (même procédé `color-mix` que `DetailCongePanel`/`MiniCalendrier`)
// plutôt que le gris neutre générique — classes littérales une par code
// (obligatoire : une classe Tailwind construite par interpolation à
// l'exécution n'est jamais générée par le compilateur, voir CONTEXTE.md).
const HOVER_TEINTE: Record<TypeBadgeCode, string> = {
  CP: "hover:bg-[color-mix(in_srgb,var(--color-cp)_5%,white)]",
  RTT: "hover:bg-[color-mix(in_srgb,var(--color-rtt)_5%,white)]",
  CPA: "hover:bg-[color-mix(in_srgb,var(--color-cpa)_5%,white)]",
  CSS: "hover:bg-[color-mix(in_srgb,var(--color-css)_5%,white)]",
  CE: "hover:bg-[color-mix(in_srgb,var(--color-ce)_5%,white)]",
  RECUP: "hover:bg-[color-mix(in_srgb,var(--color-recup)_5%,white)]",
  EVT_FAM: "hover:bg-[color-mix(in_srgb,var(--color-evtfam)_5%,white)]",
  DJI: "hover:bg-[color-mix(in_srgb,var(--color-dji)_5%,white)]",
  CPI: "hover:bg-[color-mix(in_srgb,var(--color-cpi)_5%,white)]",
  FERIE: "hover:bg-[color-mix(in_srgb,var(--color-ferie)_5%,white)]",
};

function codeBadgeDemande(demande: Demande): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

interface EvenementFeed {
  id: string;
  demandeId: string;
  date: string;
  code: TypeBadgeCode;
  texte: ReactNode;
  // Décision (validée/refusée) pas encore vue — voir `Demande.vu` — met la
  // ligne en emphase dans le journal. Toujours `false` pour un événement
  // "posé" (pas concerné par la notion de "vu").
  nonVu: boolean;
  // Événement "posé" d'une demande encore "en attente" — toujours garanti
  // visible dans le journal (voir découpage juste avant `NB_LIGNES` plus
  // bas), quitte à exclure des décisions plus récentes : à date égale (même
  // jour), `comparerEvenements` fait passer "décidé" avant "posé", ce qui
  // pouvait repousser une demande encore en attente hors des 6 lignes
  // affichées si plusieurs décisions tombaient le même jour.
  enAttente: boolean;
}

// "Stabilo" — surlignage fond coloré (pas juste texte coloré), conforme à la
// charte statut (mêmes tokens que `Badge`/`STATUT_CONFIG`) : orange pour "en
// attente de validation", vert pour "a validé", rouge pour "a refusé".
const TONE_STABILO: Record<"warning" | "success" | "danger", string> = {
  warning: "bg-status-warning-bg text-status-warning-fg",
  success: "bg-status-success-bg text-status-success-fg",
  danger: "bg-status-danger-bg text-status-danger-fg",
};

function Stabilo({
  tone,
  children,
}: {
  tone: "warning" | "success" | "danger";
  children: ReactNode;
}) {
  return <span className={`rounded-sm px-1 font-semibold ${TONE_STABILO[tone]}`}>{children}</span>;
}

// Type de congé et dates en semi-gras (16/08/2026) — d'abord essayé en
// couleur de l'événement (teinte `TypeBadge`), finalement jugé plus sobre en
// semi-gras simple, sans changer la couleur du texte.
function SemiBold({ children }: { children: ReactNode }) {
  return <span className="font-semibold">{children}</span>;
}

/** "le 15/01/2027" / "du 15/01/2027" (jour unique) ou "du 03/08/2026 apm au
 * 28/08/2026 ma" (période, toujours "du…au", quel que soit l'appelant) —
 * `prefixeJourUnique` ne s'applique qu'au cas jour unique ("le" pour un
 * posé, "du" pour une décision, voir les gabarits de phrase plus bas). */
function periodePhrase(demande: Demande, prefixeJourUnique: "le" | "du"): string {
  const estPeriode = demande.debut !== demande.fin;
  if (!estPeriode) {
    const suffixe =
      demande.demiDebut === "apres_midi" ? " apm" : demande.demiFin === "matin" ? " ma" : "";
    return `${prefixeJourUnique} ${formatDateAction(demande.debut)}${suffixe}`;
  }
  const suffixeDebut = demande.demiDebut === "apres_midi" ? " apm" : "";
  const suffixeFin = demande.demiFin === "matin" ? " ma" : "";
  return `du ${formatDateAction(demande.debut)}${suffixeDebut} au ${formatDateAction(demande.fin)}${suffixeFin}`;
}

function nomJournees(jours: number): string {
  if (jours === 1) return "journée";
  if (jours === 0.5) return "demi-journée";
  return "journées";
}

function comptePhrase(jours: number): string {
  if (jours === 1) return "une journée";
  if (jours === 0.5) return "une demi-journée";
  return `${formatJours(jours)} journées`;
}

/** Un événement "posé" (toujours) + un événement "décision" (si tranchée) par
 * demande — même logique de regroupement chronologique qu'un fil d'activité. */
function evenementsDeDemande(demande: Demande): EvenementFeed[] {
  const jours = demande.nbDemiJournees / 2;
  const code = codeBadgeDemande(demande);
  const evenements: EvenementFeed[] = [
    {
      id: `${demande.id}-pose`,
      demandeId: demande.id,
      date: demande.datePose,
      code,
      texte: (
        <>
          Vous avez posé {comptePhrase(jours)} de <SemiBold>{code}</SemiBold> -{" "}
          <SemiBold>{periodePhrase(demande, "le")}</SemiBold> -{" "}
          <Stabilo tone="warning">en validation</Stabilo>
        </>
      ),
      nonVu: false,
      enAttente: demande.statut === "en attente",
    },
  ];

  if (demande.dateDecision && (demande.statut === "validé" || demande.statut === "refusé")) {
    const estValide = demande.statut === "validé";
    const prenom = demande.validateur?.prenom ?? "Le manager";
    const possessif =
      jours === 1 || jours === 0.5
        ? `votre ${nomJournees(jours)}`
        : `vos ${formatJours(jours)} ${nomJournees(jours)}`;
    evenements.push({
      id: `${demande.id}-decision`,
      demandeId: demande.id,
      date: demande.dateDecision,
      code,
      texte: (
        <>
          {prenom} a{" "}
          <Stabilo tone={estValide ? "success" : "danger"}>
            {estValide ? "validé" : "refusé"}
          </Stabilo>{" "}
          {possessif} de <SemiBold>{code}</SemiBold>{" "}
          <SemiBold>{periodePhrase(demande, "du")}</SemiBold>
        </>
      ),
      nonVu: !demande.vu,
      enAttente: false,
    });
  }

  return evenements;
}

/** Tri antéchronologique (plus récent en premier) — `date` n'a qu'une
 * granularité jour (`YYYY-MM-DD`), donc "posé" et "décidé" le même jour sont
 * à égalité sur ce seul critère ; un tri stable garderait alors "posé" en
 * premier (ordre d'insertion de `evenementsDeDemande`), alors qu'une décision
 * arrive forcément après la pose dans le temps réel — départage explicite
 * pour que "décidé" passe toujours devant "posé" à date égale. */
function comparerEvenements(a: EvenementFeed, b: EvenementFeed): number {
  const parDate = b.date.localeCompare(a.date);
  if (parDate !== 0) return parDate;
  return Number(b.id.endsWith("-decision")) - Number(a.id.endsWith("-decision"));
}

function ListeEvenements({ evenements }: { evenements: EvenementFeed[] }) {
  return (
    <div className="flex flex-col gap-1">
      {evenements.length === 0 ? (
        <EmptyRow text="Aucune activité récente." />
      ) : (
        evenements.map((e) => (
          <Link
            key={e.id}
            href={`/historique?demande=${e.demandeId}`}
            className={`flex items-start gap-2.5 px-4 py-3 transition-colors duration-150 ${
              e.nonVu ? "bg-status-success-bg/40" : "bg-surface-card"
            } ${HOVER_TEINTE[e.code]}`}
          >
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(e.code)}`}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-ink-500 text-[10px]">Le {formatDateAction(e.date)}</span>
              <span
                className={`text-ink-900 text-xs leading-snug ${e.nonVu ? "font-semibold" : ""}`}
              >
                {e.texte}
              </span>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}

/**
 * "Activité récente" — tiroir latéral (17/08/2026, Accueil2) : phrases en
 * langage naturel plutôt que le format carte (`ActiviteRecenteListe`), un
 * événement par ligne (posé / décidé), triés du plus récent au plus ancien,
 * 6 derniers. Verbes/statut surlignés (`Stabilo`) conformément à la charte
 * statut ; pastille de couleur (type de congé) devant chaque entrée ; chaque
 * ligne est un lien vers `/historique` (roll au survol comme seule
 * affordance), qui ouvre directement le panneau détaillé sur la demande.
 *
 * N'affiche plus de carte inline dans le corps de page (retirée le
 * 17/08/2026, devenue redondante une fois le tiroir en place) — uniquement
 * le tiroir, piloté par le parent (`tiroirOuvert`/`onFermerTiroir`) dont le
 * déclencheur est le picto à côté de "Bonjour, {prénom}" (`Dashboard3Page`).
 */
export function ActiviteRecenteFeed({
  demandes,
  tiroirOuvert,
  onFermerTiroir,
}: {
  demandes: Demande[];
  tiroirOuvert: boolean;
  onFermerTiroir: () => void;
}) {
  // Les "posé" de demandes encore en attente sont garantis présents (voir
  // `EvenementFeed.enAttente`) : on les réserve d'abord, puis on complète
  // avec les autres événements les plus récents, avant de re-trier
  // chronologiquement l'ensemble pour l'affichage.
  const tries = demandes.flatMap(evenementsDeDemande).sort(comparerEvenements);
  const enAttente = tries.filter((e) => e.enAttente).slice(0, NB_LIGNES);
  const autres = tries
    .filter((e) => !e.enAttente)
    .slice(0, Math.max(0, NB_LIGNES - enAttente.length));
  const evenements = [...enAttente, ...autres].sort(comparerEvenements);

  useEffect(() => {
    if (!tiroirOuvert) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onFermerTiroir();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tiroirOuvert, onFermerTiroir]);

  if (!tiroirOuvert) return null;

  return (
    <div className="bg-ink-900/50 fixed inset-0 z-50 flex justify-end" onClick={onFermerTiroir}>
      <div
        className="bg-surface-card animate-drawer-in-right flex h-full w-full max-w-sm flex-col shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-ink-300/60 flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="text-ink-900 text-base font-bold">Mon journal</h2>
          <button
            type="button"
            onClick={onFermerTiroir}
            aria-label="Fermer"
            className="text-ink-500 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ListeEvenements evenements={evenements} />
        </div>
      </div>
    </div>
  );
}
