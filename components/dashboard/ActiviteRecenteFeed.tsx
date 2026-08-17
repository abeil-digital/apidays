import type { ReactNode } from "react";
import Link from "next/link";
import type { Demande } from "@/lib/types";
import { formatDateAction, formatJours } from "@/lib/format";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { classeFondTypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

const NB_LIGNES = 6;

function codeBadgeDemande(demande: Demande): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

interface EvenementFeed {
  id: string;
  demandeId: string;
  date: string;
  code: TypeBadgeCode;
  texte: ReactNode;
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
    });
  }

  return evenements;
}

/**
 * "Activité récente" — variante feed (16/08/2026, Accueil2, essai) : phrases
 * en langage naturel plutôt que le format carte (`ActiviteRecenteListe`),
 * un événement par ligne (posé / décidé), triés du plus récent au plus
 * ancien, 6 derniers. Verbes/statut surlignés (`Stabilo`) conformément à la
 * charte statut ; pastille de couleur (type de congé) devant chaque entrée ;
 * chaque ligne est un lien vers `/historique` (roll au survol comme seule
 * affordance, pas de soulignement ni de libellé "Voir"), qui ouvre
 * directement le panneau détaillé sur la demande concernée.
 */
export function ActiviteRecenteFeed({ demandes }: { demandes: Demande[] }) {
  const evenements = demandes
    .flatMap(evenementsDeDemande)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, NB_LIGNES);

  return (
    <div className="bg-surface-card w-full md:max-w-[270px]">
      <div className="px-4 py-3">
        <h2 className="text-ink-900 text-lg font-bold">Activité récente</h2>
      </div>

      <div className="border-ink-300/60 border-t">
        {evenements.length === 0 ? (
          <EmptyRow text="Aucune activité récente." />
        ) : (
          evenements.map((e) => (
            <Link
              key={e.id}
              href={`/historique?demande=${e.demandeId}`}
              className="hover:bg-surface-app flex items-start gap-2.5 px-4 py-3 transition-colors duration-150"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(e.code)}`}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-ink-500 text-[10px]">Le {formatDateAction(e.date)}</span>
                <span className="text-ink-900 text-xs leading-snug">{e.texte}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
