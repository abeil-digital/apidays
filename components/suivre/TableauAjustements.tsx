import { formatJours } from "@/lib/format";
import type { AjustementEquipe } from "@/lib/data/soldes.repository";
import { EmptyRow } from "@/components/ui/EmptyRow";

/**
 * Table dédiée aux régularisations manuelles (27/08/2026, filtre "Régul
 * CP/RTT/CPA" de "Suivre les demandes", puis réutilisée par "Quels congés
 * transmettre"/"Générer l'export" — "faut prévoir une catégorie régulation
 * aussi") — colonnes Collaborateur/Dates (date de création)/Durée (delta
 * signé)/Statut (tiret, pas de workflow de validation applicable). Ligne
 * cliquable → `DetailAjustementPanel` chez l'appelant (pas géré ici).
 */
export function TableauAjustements({
  ajustements,
  selectionId,
  onSelect,
}: {
  ajustements: AjustementEquipe[];
  selectionId: string | null;
  onSelect: (id: string) => void;
}) {
  if (ajustements.length === 0) {
    return <EmptyRow text="Aucune régularisation sur cette période." />;
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
          <th className="px-4 py-3">Collaborateur</th>
          <th className="px-4 py-3">Dates</th>
          <th className="px-4 py-3">Durée</th>
          <th className="px-4 py-3">Statut</th>
        </tr>
      </thead>
      <tbody>
        {ajustements.map((a) => (
          <tr
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={`border-ink-300/60 cursor-pointer border-b transition-colors duration-150 last:border-b-0 hover:bg-surface-app ${
              selectionId === a.id ? "bg-surface-app" : ""
            }`}
          >
            <td className="text-ink-900 px-4 py-3 font-semibold">{a.nomComplet}</td>
            <td className="text-ink-900 px-4 py-3">{a.date}</td>
            <td className="text-ink-900 px-4 py-3" title={a.motif}>
              {a.deltaJours > 0 ? "+" : ""}
              {formatJours(a.deltaJours)} j
            </td>
            <td className="text-ink-500 px-4 py-3">—</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
