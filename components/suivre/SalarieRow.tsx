import type { UtilisateurAdmin } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { useSoldes } from "@/hooks/useSoldes";
import { Avatar } from "@/components/ui/Avatar";
import { TypeBadge } from "@/components/demandes/TypeBadge";

interface SalarieRowProps {
  utilisateur: UtilisateurAdmin;
  isLast: boolean;
  onClickCp: () => void;
}

export function SalarieRow({ utilisateur, isLast, onClickCp }: SalarieRowProps) {
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
        <div className="flex shrink-0 items-center gap-4">
          <button
            type="button"
            onClick={onClickCp}
            className="flex w-14 justify-center transition-opacity duration-150 hover:opacity-70"
          >
            <TypeBadge code="CP" variant="pill" label={`${formatJours(soldes.cp.valeur)} j`} />
          </button>
          <span className="flex w-14 justify-center">
            <TypeBadge code="RTT" variant="pill" label={`${formatJours(soldes.rtt.valeur)} j`} />
          </span>
          <span className="flex w-14 justify-center">
            <TypeBadge code="CPA" variant="pill" label={`${formatJours(soldes.cpa.valeur)} j`} />
          </span>
        </div>
      )}
    </div>
  );
}
