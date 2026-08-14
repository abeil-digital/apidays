"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { formatJours } from "@/lib/format";
import { useHistoriqueSoldeCp } from "@/hooks/useHistoriqueSoldeCp";
import { classeBordureTypeBadge, TypeBadgePillEnhanced } from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";

type ModeSolde = "reel" | "theorique";

interface SoldeCpDetailPanelProps {
  utilisateurId: string;
  nomComplet: string;
  onClose: () => void;
}

function formatJjMm(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${iso}T00:00:00`),
  );
}

function formatJjMmAa(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(`${iso}T00:00:00`));
}

// Le libellé d'une demande arrive préfixé "CP : ..." (utile dans un contexte
// mélangé) — inutile ici, la colonne Événement est déjà 100% CP.
function libelleEvenement(m: { type: "demande" | "ajustement"; date: string; libelle: string }) {
  if (m.type === "ajustement") return `Régul (${formatJjMm(m.date)})`;
  return m.libelle.replace(/^CP\s*:\s*/, "");
}

/**
 * Détail du solde CP sur la période de référence — panneau latéral droit de
 * "Suivre les soldes" (même docking `xl:sticky` que le panneau "Détail du
 * congé" d'Export paie), ouvert au clic sur la pill CP d'un collaborateur.
 * Table "Événements" à plat, pas de repli par mois comme `HistoriqueSoldeModal`
 * (ici on veut tout voir d'un coup, du solde N-1 jusqu'à aujourd'hui) :
 * Événement (pill contour + point de statut identique à celle de la colonne
 * Dates d'Export paie — pas de mention "CP" dans le libellé, la colonne est
 * déjà 100% CP) / Jours (signé, couleur selon le sens) / Solde (`soldeApres`,
 * déjà calculé par `fetchHistoriqueCp`, pas recalculé ici).
 */
export function SoldeCpDetailPanel({
  utilisateurId,
  nomComplet,
  onClose,
}: SoldeCpDetailPanelProps) {
  const { historique, loading, error } = useHistoriqueSoldeCp(utilisateurId);
  const [mode, setMode] = useState<ModeSolde>("reel");
  const evenements = historique?.mois.flatMap((m) => m.mouvements) ?? [];
  const enAttente = mode === "theorique" ? (historique?.enAttente ?? []) : [];
  const initiales = nomComplet
    .split(" ")
    .map((mot) => mot.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div className="bg-surface-card w-full xl:sticky xl:top-4 xl:w-96 xl:shrink-0">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar initiales={initiales} />
          <div>
            <div className="text-ink-900 text-sm font-bold">{nomComplet}</div>
            <div className="text-ink-500 text-xs">Détail du solde CP</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-500 shrink-0"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="border-ink-300/60 border-t">
        {loading || !historique ? (
          <div className="text-ink-500 py-8 text-center text-sm">Chargement…</div>
        ) : error ? (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 my-3 px-3 py-2.5 text-sm">
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
                  <th className="px-4 py-3">Événement</th>
                  <th className="px-4 py-3 text-center">Jours</th>
                  <th className="px-4 py-3 text-center">Solde</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3">
                    <span className="bg-surface-app text-cp border-cp rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                      {`Solde N-1 - ${formatJjMmAa(historique.periodeDebut)}`}
                    </span>
                  </td>
                  <td className="text-ink-500 px-4 py-3 text-center">—</td>
                  <td className="text-ink-900 px-4 py-3 text-center font-semibold">
                    {formatJours(historique.soldeDepart)} j
                  </td>
                </tr>
                {evenements.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <span
                        className={`bg-surface-app text-ink-900 flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${classeBordureTypeBadge("CP")}`}
                      >
                        <span className="bg-status-success-fg h-1.5 w-1.5 shrink-0 rounded-full" />
                        {libelleEvenement(m)}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-semibold ${
                        m.jours < 0 ? "text-cp" : "text-status-success-fg"
                      }`}
                    >
                      {m.jours > 0 ? "+" : ""}
                      {formatJours(m.jours)} j
                    </td>
                    <td className="text-ink-900 px-4 py-3 text-center font-semibold">
                      {formatJours(m.soldeApres)} j
                    </td>
                  </tr>
                ))}
                {enAttente.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <span
                        className={`bg-surface-app text-ink-900 flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${classeBordureTypeBadge("CP")}`}
                      >
                        <span className="bg-status-warning-fg h-1.5 w-1.5 shrink-0 rounded-full" />
                        {libelleEvenement(m)}
                      </span>
                    </td>
                    <td className="text-cp px-4 py-3 text-center font-semibold">
                      {formatJours(m.jours)} j
                    </td>
                    <td className="text-ink-900 px-4 py-3 text-center font-semibold">
                      {formatJours(m.soldeApres)} j
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && historique && (
          <div className="border-ink-300/60 flex items-center justify-between border-t px-4 py-3">
            <span className="text-ink-900 flex items-center gap-1 text-sm font-semibold">
              Solde actuel
              <span className="relative inline-flex items-center">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ModeSolde)}
                  className="text-ink-500 cursor-pointer appearance-none bg-transparent pr-4 text-sm font-semibold underline decoration-dotted underline-offset-2 outline-none"
                >
                  <option value="reel">Réel</option>
                  <option value="theorique">Théorique</option>
                </select>
                <ChevronDown
                  size={12}
                  className="text-ink-500 pointer-events-none absolute right-0"
                />
              </span>
            </span>
            <TypeBadgePillEnhanced
              code="CP"
              label={`${formatJours(mode === "reel" ? historique.soldeActuel : historique.soldeTheorique)} j`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
