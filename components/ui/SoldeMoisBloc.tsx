import { ChevronDown } from "lucide-react";
import type { MouvementSolde } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { TypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

function formatJjMm(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${iso}T00:00:00`),
  );
}

interface SoldeMoisBlocProps {
  /** Type de solde concerné (couleur des pastilles) — CP pour l'instant. */
  code: TypeBadgeCode;
  /** Nom du mois, déjà capitalisé (ex. "Juin"). */
  libelleMois: string;
  /** Événements du mois (demandes validées + ajustements manuels), triés chronologiquement. */
  mouvements: MouvementSolde[];
  /** Libellé de la ligne de clôture (ex. "Solde paie juin"). */
  soldeLibelle: string;
  soldeValeur: number;
  /** Repli/déploiement des événements — contrôlé par l'appelant (un seul état pour tous les blocs). */
  ouvert: boolean;
  onToggle: () => void;
}

/**
 * Bloc "solde d'un mois" — pill de mois + repère d'événements (stabilo,
 * cliquable pour dérouler) + liste des mouvements + ligne de solde de
 * clôture. Brique du design system, née dans la popin d'historique de solde
 * de l'Espace Suivre (voir `/design-system`) — réutilisable pour tout futur
 * feed de solde par mois (RTT, etc.), pas spécifique à `HistoriqueSoldeModal`.
 */
export function SoldeMoisBloc({
  code,
  libelleMois,
  mouvements,
  soldeLibelle,
  soldeValeur,
  ouvert,
  onToggle,
}: SoldeMoisBlocProps) {
  const n = mouvements.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="bg-surface-app text-ink-900 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize">
          {libelleMois}
        </span>
        {n === 0 ? (
          <span className="text-ink-500 text-xs">Pas d&rsquo;événement</span>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="bg-status-warning-bg text-status-warning-fg flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
          >
            {ouvert ? "Masquer" : `${n} événement${n > 1 ? "s" : ""}`}
            <ChevronDown
              size={12}
              className={`transition-transform duration-150 ${ouvert ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {ouvert &&
        mouvements.map((m) =>
          m.type === "demande" ? (
            <div
              key={m.id}
              className="text-status-success-fg flex items-center justify-between pl-12 text-xs"
            >
              <span>{m.libelle}</span>
              <span className="font-bold">{formatJours(Math.abs(m.jours))} j</span>
            </div>
          ) : (
            <div key={m.id} className="flex items-center justify-between pl-12 text-xs">
              <span className="text-ink-500">{`Régul (${formatJjMm(m.date)})`}</span>
              <span
                className={`font-bold ${m.jours < 0 ? "text-status-danger-fg" : "text-status-success-fg"}`}
              >
                {m.jours > 0 ? "+" : ""}
                {formatJours(m.jours)} j
              </span>
            </div>
          ),
        )}

      <div className="flex items-center justify-between pl-2.5 text-sm">
        <span className="text-ink-500">{soldeLibelle}</span>
        <TypeBadge code={code} variant="pill" label={`${formatJours(soldeValeur)} j`} />
      </div>
    </div>
  );
}
