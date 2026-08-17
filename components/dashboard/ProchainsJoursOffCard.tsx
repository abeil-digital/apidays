"use client";

import { useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import { formatJours, todayISO } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { PeriodeAvecPastilles } from "@/components/ui/PeriodeAvecPastilles";
import { STATUT_CONFIG } from "@/components/ui/StatusBadge";
import { TypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { dureeCongeImpose } from "@/lib/joursFeries";
import type { Demande, DemiJournee, JourFerie } from "@/lib/types";

const NB_LIGNES = 6;

type Vue = "prochains" | "attente";

const LABEL_VUE: Record<Vue, string> = {
  prochains: "Prochains jours off",
  attente: "En validation",
};

const TEXTE_VIDE: Record<Vue, string> = {
  prochains: "Aucun jour off à venir.",
  attente: "Aucune demande en attente.",
};

interface JourOff {
  id: string;
  debut: string;
  fin: string;
  demiDebut: DemiJournee;
  demiFin: DemiJournee;
  code: TypeBadgeCode;
  jours: number;
  tone: BadgeTone;
  // `null` pour CPI/DJI/FERIE — verts (tone) comme une demande validée, mais
  // sans le picto de validation (ce n'est pas un événement de décision).
  Icon: LucideIcon | null;
}

function codeBadgeDemande(demande: Demande): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

/**
 * Card "Prochains jours off" (16/08/2026, Accueil2, essai) — même format 1/3
 * largeur que les autres encarts de la ligne. Chaque ligne : `TypeBadge`
 * cerclé + `PeriodeAvecPastilles` + `Badge` (icône `STATUT_CONFIG` + nombre
 * de jours) — mêmes composants, mêmes classes/tailles que `SuiviDemandeRow`
 * (le feed "Demandes à traiter" de `SuivrePage`) pour son bloc période/durée.
 * CPI/DJI/FERIE (pas de vrai statut) : vert comme "validé" (même tone), mais
 * sans icône — ce n'est pas un événement de décision. Le titre est un
 * sélecteur (`<select>` discret + chevron, même pattern que "Solde actuel ▾"
 * de `SoldeDetailPanel`) entre deux vues, pas une case à cocher :
 * - "Prochains jours off" : jours non travaillés CERTAINS à venir — demandes
 *   perso validées, congés imposés (CPI), demi-journées imposées (DJI),
 *   jours fériés (FERIE).
 * - "En attente de validation" : uniquement les demandes perso pas encore
 *   tranchées (CPI/DJI/FERIE n'ont pas de notion d'attente, absents de cette
 *   vue).
 * Fenêtre année en cours + année suivante (pour ne pas couper la liste fin
 * décembre), 6 prochaines entrées triées par date.
 */
export function ProchainsJoursOffCard() {
  const anneeActuelle = new Date().getFullYear();
  const calActuel = useCalendrier(anneeActuelle);
  const calSuivant = useCalendrier(anneeActuelle + 1);
  const { demandes, loading: loadingDemandes } = useDemandes();
  const [vue, setVue] = useState<Vue>("prochains");

  const entete = (
    <div className="px-4 py-3">
      <span className="relative inline-flex items-center">
        <select
          value={vue}
          onChange={(e) => setVue(e.target.value as Vue)}
          className="text-ink-500 relative cursor-pointer appearance-none bg-transparent pr-5 text-base font-bold outline-none"
        >
          {(Object.entries(LABEL_VUE) as [Vue, string][]).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="text-ink-500 pointer-events-none absolute right-0" />
      </span>
    </div>
  );

  if (calActuel.loading || calSuivant.loading || loadingDemandes) {
    return (
      <div className="w-full lg:max-w-[300px] lg:shrink-0">
        {entete}
        <div className="border-ink-300/60 border-t p-4">
          <div className="text-ink-500 py-8 text-center text-sm">Chargement…</div>
        </div>
      </div>
    );
  }

  const today = todayISO();
  const joursFeriesToutesAnnees: JourFerie[] = [
    ...calActuel.joursFeries,
    ...calSuivant.joursFeries,
  ];
  const congesImposesTous = [...calActuel.congesImposes, ...calSuivant.congesImposes];
  const djImposeesTous = [...calActuel.djImposees, ...calSuivant.djImposees];

  const demandesPerso = demandes
    .filter((d) => d.statut === (vue === "attente" ? "en attente" : "validé") && d.fin >= today)
    .map((d) => ({
      id: d.id,
      debut: d.debut,
      fin: d.fin,
      demiDebut: d.demiDebut,
      demiFin: d.demiFin,
      code: codeBadgeDemande(d),
      jours: d.nbDemiJournees / 2,
      tone: STATUT_CONFIG[d.statut].tone,
      Icon: STATUT_CONFIG[d.statut].Icon,
    }));

  // CPI/DJI/FERIE n'ont pas de notion d'attente — absents de la vue "En
  // attente de validation".
  const jours: JourOff[] =
    vue === "attente"
      ? demandesPerso
      : [
          ...demandesPerso,
          ...joursFeriesToutesAnnees.map((f) => ({
            id: f.id,
            debut: f.date,
            fin: f.date,
            demiDebut: "matin" as const,
            demiFin: "apres_midi" as const,
            code: "FERIE" as const,
            jours: 1,
            tone: "success" as BadgeTone,
            Icon: null,
          })),
          ...congesImposesTous.map((c) => ({
            id: c.id,
            debut: c.debut,
            fin: c.fin,
            demiDebut: "matin" as const,
            demiFin: "apres_midi" as const,
            code: "CPI" as const,
            jours: dureeCongeImpose(c, joursFeriesToutesAnnees),
            tone: "success" as BadgeTone,
            Icon: null,
          })),
          ...djImposeesTous.map((d) => ({
            id: d.id,
            debut: d.date,
            fin: d.date,
            demiDebut: d.demiJournee,
            demiFin: d.demiJournee,
            code: "DJI" as const,
            jours: 0.5,
            tone: "success" as BadgeTone,
            Icon: null,
          })),
        ];

  const prochains = jours
    .filter((j) => j.fin >= today)
    .sort((a, b) => a.debut.localeCompare(b.debut))
    .slice(0, NB_LIGNES);

  return (
    <div className="w-full lg:max-w-[300px] lg:shrink-0">
      {entete}
      <div className="flex flex-col gap-1">
        {prochains.length === 0 ? (
          <EmptyRow text={TEXTE_VIDE[vue]} />
        ) : (
          prochains.map((j) => (
            <div key={j.id} className="bg-surface-card flex items-center gap-3 px-4 py-3">
              <TypeBadge code={j.code} />
              <div className="min-w-0 flex-1">
                <PeriodeAvecPastilles
                  debut={j.debut}
                  fin={j.fin}
                  demiDebut={j.demiDebut}
                  demiFin={j.demiFin}
                />
              </div>
              <span className="origin-right scale-90">
                <Badge tone={j.tone}>
                  {j.Icon && <j.Icon size={12} strokeWidth={2.5} />}
                  <span className="text-[14.4px]">{formatJours(j.jours)} j</span>
                </Badge>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
