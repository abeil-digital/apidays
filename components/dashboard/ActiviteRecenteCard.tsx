import Link from "next/link";
import type { Demande, StatutDemande } from "@/lib/types";
import { formatDateAction, formatJours } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { PeriodeAvecPastilles } from "@/components/ui/PeriodeAvecPastilles";
import { STATUT_CONFIG } from "@/components/ui/StatusBadge";
import { TypeBadge } from "@/components/demandes/TypeBadge";

// Libellé de la ligne de date au-dessus — suit le statut plutôt que de
// toujours dire "Posé le" (demande explicite : distinguer visuellement une
// demande encore en attente de sa décision, une fois traitée).
const LIBELLE_DATE: Record<StatutDemande, string> = {
  "en attente": "Posé le",
  validé: "Validé le",
  refusé: "Refusé le",
  annulé: "Annulé le",
};

/**
 * Ligne "Activité récente" (16/08/2026, Accueil2) — même composants que la
 * popin "Détail du congé" de Suivre les demandes (`TypeBadge` cerclé,
 * `PeriodeAvecPastilles`, `Badge`/`STATUT_CONFIG`), assemblés différemment :
 * ligne de date au-dessus (libellé + date qui suivent le statut, voir
 * `LIBELLE_DATE`), puis Type/Dates/Durée-statut sur une seule ligne — essai
 * alternatif au tableau `ActiviteRecenteTable` (colonne 1/3 largeur au lieu
 * d'un tableau pleine largeur).
 *
 * Cliquable (16/08/2026) : renvoie vers `/historique?demande=<id>`, qui
 * ouvre directement le panneau "Détail du congé" déployé sur cette ligne
 * (lecture seule côté collaborateur, voir `DetailCongePanel`) plutôt qu'un
 * historique "à plat" à re-parcourir.
 */
export function ActiviteRecenteCard({ demande, isLast }: { demande: Demande; isLast: boolean }) {
  const jours = demande.nbDemiJournees / 2;
  const code = demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
  const { tone, Icon } = STATUT_CONFIG[demande.statut];
  const dateAffichee =
    demande.statut === "en attente" ? demande.datePose : (demande.dateDecision ?? demande.datePose);

  return (
    <Link
      href={`/historique?demande=${demande.id}`}
      className={`hover:bg-surface-app flex flex-col gap-1.5 px-4 py-3 transition-colors duration-150 ${isLast ? "" : "border-ink-300/60 border-b"}`}
    >
      <span className="text-ink-500 text-[10px]">
        {`${LIBELLE_DATE[demande.statut]} ${formatDateAction(dateAffichee)}`}
      </span>
      <div className="flex items-center gap-3">
        <TypeBadge code={code} />
        <div className="min-w-0 flex-1">
          <PeriodeAvecPastilles
            debut={demande.debut}
            fin={demande.fin}
            demiDebut={demande.demiDebut}
            demiFin={demande.demiFin}
          />
        </div>
        <span className="origin-right scale-90">
          <Badge tone={tone}>
            <Icon size={12} strokeWidth={2.5} />
            <span className="text-[14.4px]">{formatJours(jours)} j</span>
          </Badge>
        </span>
      </div>
    </Link>
  );
}
