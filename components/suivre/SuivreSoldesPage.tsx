"use client";

import { useState } from "react";
import type { UtilisateurAdmin } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { TypeBadge } from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { SelectFiltrePill } from "@/components/ui/FiltrePill";
import { SoldeCpDetailPanel } from "@/components/suivre/SoldeCpDetailPanel";

/** Une ligne = un `useSoldes` — le calcul est par utilisateur (pas de route
 * batch), donc chaque ligne fait son propre appel plutôt que d'essayer de
 * paralléliser dans le composant parent (même pattern que `SalarieRow`).
 * Pill CP cliquable : ouvre `SoldeCpDetailPanel` dans la colonne de droite
 * (seul CP a un historique détaillé pour l'instant, comme `HistoriqueSoldeModal`
 * ailleurs dans l'app). */
function LigneSolde({
  utilisateur,
  active,
  onClickCp,
}: {
  utilisateur: UtilisateurAdmin;
  active: boolean;
  onClickCp: () => void;
}) {
  const { soldes, loading } = useSoldes(utilisateur.id);
  const initiales = `${utilisateur.prenom.charAt(0)}${utilisateur.nom.charAt(0)}`.toUpperCase();

  return (
    <tr>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1.5">
          <Avatar initiales={initiales} />
          <span className="text-ink-900 font-semibold">
            {utilisateur.prenom} {utilisateur.nom}
          </span>
        </span>
      </td>
      {loading || !soldes ? (
        <td colSpan={3} className="text-ink-500 px-4 py-3">
          …
        </td>
      ) : (
        <>
          <td className="px-4 py-3">
            <button
              type="button"
              onClick={onClickCp}
              className="rounded-full transition-opacity duration-150 hover:opacity-70"
            >
              <TypeBadge
                code="CP"
                variant={active ? "outline" : "pill"}
                label={`${formatJours(soldes.cp.valeur)} j`}
              />
            </button>
          </td>
          <td className="px-4 py-3">
            <TypeBadge code="RTT" variant="pill" label={`${formatJours(soldes.rtt.valeur)} j`} />
          </td>
          <td className="px-4 py-3">
            <TypeBadge code="CPA" variant="pill" label={`${formatJours(soldes.cpa.valeur)} j`} />
          </td>
        </>
      )}
    </tr>
  );
}

/**
 * "Suivre les soldes" (`/suivre/soldes`) — tableau des soldes CP/RTT/CPA de
 * tous les collaborateurs actifs, même conventions de tableau que
 * `HistoriqueTable`/`SuivreDemandesPage` (card sans arrondi ni ombre,
 * en-têtes en majuscules, colonne Collaborateur avatar + nom). Valeurs en
 * pill `TypeBadge` plutôt qu'en texte brut — reprend le même langage visuel
 * que `SalarieRow` (liste "Salariés" de l'écran principal de Suivre) et le
 * reste de l'app pour un solde, pas une variante texte inventée ici.
 *
 * Seuls les collaborateurs actifs sont affichés (pas de filtre de statut —
 * pas demandé, à ajouter si besoin plus tard). Filtre Collaborateur : même
 * `SelectFiltrePill` et même construction de la liste (dérivée des données
 * chargées, pas figée en dur) que sur `SuivreDemandesPage` — pas de variante
 * ad hoc ici.
 */
export function SuivreSoldesPage() {
  const { utilisateurs, loading, error } = useUtilisateursAdmin();
  const [collaborateurFiltre, setCollaborateurFiltre] = useState("tous");
  const [selectionId, setSelectionId] = useState<string | null>(null);

  const actifs = utilisateurs.filter((u) => u.statut === "actif");
  const collaborateurs = [...actifs]
    .map((u) => [u.id, `${u.prenom} ${u.nom}`] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const filtres = actifs.filter(
    (u) => collaborateurFiltre === "tous" || u.id === collaborateurFiltre,
  );
  const selection = actifs.find((u) => u.id === selectionId) ?? null;

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-6xl md:pt-0">
      <h1 className="text-ink-900 px-1 text-2xl font-semibold">Suivre les soldes</h1>

      {error && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div
          className={`bg-surface-card w-full xl:min-w-0 ${selection ? "xl:flex-1" : "md:max-w-[900px]"}`}
        >
          <div className="flex flex-wrap items-end gap-3 px-4 py-3">
            <SelectFiltrePill
              value={collaborateurFiltre}
              onChange={(e) => setCollaborateurFiltre(e.target.value)}
            >
              <option value="tous">Tous les collaborateurs</option>
              {collaborateurs.map(([id, nom]) => (
                <option key={id} value={id}>
                  {nom}
                </option>
              ))}
            </SelectFiltrePill>
          </div>

          <div className="border-ink-300/60 border-t">
            {loading ? (
              <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
            ) : filtres.length === 0 ? (
              <EmptyRow text="Aucun collaborateur ne correspond à ce filtre." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
                      <th className="px-4 py-3">Collaborateur</th>
                      <th className="px-4 py-3">CP</th>
                      <th className="px-4 py-3">RTT</th>
                      <th className="px-4 py-3">CPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtres.map((u) => (
                      <LigneSolde
                        key={u.id}
                        utilisateur={u}
                        active={u.id === selectionId}
                        onClickCp={() => setSelectionId(u.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {selection && (
          <SoldeCpDetailPanel
            utilisateurId={selection.id}
            nomComplet={`${selection.prenom} ${selection.nom}`}
            onClose={() => setSelectionId(null)}
          />
        )}
      </div>
    </div>
  );
}
