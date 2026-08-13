import type { UtilisateurAdmin } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { useSoldes } from "@/hooks/useSoldes";
import { Avatar } from "@/components/ui/Avatar";

interface SalarieRowProps {
  utilisateur: UtilisateurAdmin;
  isLast: boolean;
}

export function SalarieRow({ utilisateur, isLast }: SalarieRowProps) {
  const { soldes, loading } = useSoldes(utilisateur.id);
  const initiales = `${utilisateur.prenom.charAt(0)}${utilisateur.nom.charAt(0)}`.toUpperCase();

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${isLast ? "" : "border-ink-300/60 border-b"}`}
    >
      <Avatar initiales={initiales} />
      <div className="text-ink-900 min-w-0 flex-1 truncate text-sm font-semibold">
        {utilisateur.prenom} {utilisateur.nom}
      </div>
      {loading || !soldes ? (
        <span className="text-ink-500 text-xs">…</span>
      ) : (
        <div className="flex shrink-0 items-center gap-4 text-right text-sm">
          <span className="w-14">
            <span className="text-ink-900 font-bold">{formatJours(soldes.cp.valeur)}</span>{" "}
            <span className="text-ink-500 text-xs">CP</span>
          </span>
          <span className="w-14">
            <span className="text-ink-900 font-bold">{formatJours(soldes.rtt.valeur)}</span>{" "}
            <span className="text-ink-500 text-xs">RTT</span>
          </span>
          <span className="w-14">
            <span className="text-ink-900 font-bold">{formatJours(soldes.cpa.valeur)}</span>{" "}
            <span className="text-ink-500 text-xs">CPA</span>
          </span>
        </div>
      )}
    </div>
  );
}
