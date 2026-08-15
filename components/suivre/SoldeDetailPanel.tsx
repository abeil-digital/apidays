"use client";

import { useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { formatJours } from "@/lib/format";
import { useHistoriqueSolde } from "@/hooks/useHistoriqueSolde";
import {
  classeBordureTypeBadge,
  classeFondTypeBadge,
  classeTexteTypeBadge,
  TypeBadgePillEnhanced,
} from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";

type ModeSolde = "reel" | "theorique";
type CodeSoldeDetail = "CP" | "RTT" | "CPA";

// Nom de la variable CSS du token couleur du type — pour foncer une couleur
// déjà pâle (RTT/CPA en particulier) via `color-mix`, plutôt qu'une classe
// Tailwind figée par code (voir `MiniCalendrier.tsx` pour le même procédé).
const VAR_COULEUR: Record<CodeSoldeDetail, string> = {
  CP: "--color-cp",
  RTT: "--color-rtt",
  CPA: "--color-cpa",
};

interface SoldeDetailPanelProps {
  code: CodeSoldeDetail;
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

// Le préfixe "CP : "/"RTT : " du libellé d'une demande est gardé (revenu en
// arrière sur le choix initial de le retirer) : utile pour distinguer un
// événement de consommation d'un événement d'acquisition RTT dans le même
// feed, plutôt qu'une redondance avec l'en-tête du panneau.
function libelleEvenement(m: {
  type: "demande" | "ajustement" | "acquisition";
  date: string;
  libelle: string;
}) {
  if (m.type === "ajustement") return `Régul (${formatJjMm(m.date)})`;
  return m.libelle;
}

/**
 * Détail du solde CP/RTT/CPA sur la période de référence — panneau latéral
 * droit de "Suivre les soldes" (même docking `xl:sticky` que le panneau
 * "Détail du congé" d'Export paie), ouvert au clic sur la pill CP, RTT ou
 * CPA d'un collaborateur. Table "Événements" à plat, pas de repli par mois
 * comme `HistoriqueSoldeModal` (ici on veut tout voir d'un coup) :
 * Événement (pill contour + point de statut identique à celle de la colonne
 * Dates d'Export paie) / Jours (signé, couleur du TYPE plutôt qu'un rouge
 * générique — `classeTexteTypeBadge`) / Solde (`soldeApres`, déjà calculé par
 * `fetchHistoriqueCp`/`fetchHistoriqueRtt`/`fetchHistoriqueCpa`, pas
 * recalculé ici).
 *
 * Les 3 types partagent ce composant malgré des formules de solde
 * différentes : CP a un capital connu dès le 1er jour de la période
 * (+ report), donc seule la consommation apparaît en événement ; RTT et CPA
 * n'ont ni report ni capital de départ, le solde se construit mois après
 * mois — chaque accrual mensuel est donc lui-même un événement (`type:
 * "acquisition"`), positif, en plus de la consommation. D'où la ligne
 * "Solde N-1"/"Solde initial" toujours à 0 j pour RTT/CPA (pas de report), et
 * un libellé de tête différencié (RTT/CPA n'ont pas de notion de "N-1").
 * Subtilité CPA propre à `fetchHistoriqueCpa` : l'acquisition se déroule sur
 * la période CP en cours, mais finance des congés dont les dates tombent
 * dans la période SUIVANTE — voir le commentaire de cette fonction.
 */
export function SoldeDetailPanel({
  code,
  utilisateurId,
  nomComplet,
  onClose,
}: SoldeDetailPanelProps) {
  const { historique, loading, error } = useHistoriqueSolde(utilisateurId, code);
  const [mode, setMode] = useState<ModeSolde>("reel");
  const evenements = historique?.mois.flatMap((m) => m.mouvements) ?? [];
  const enAttente = mode === "theorique" ? (historique?.enAttente ?? []) : [];
  const initiales = nomComplet
    .split(" ")
    .map((mot) => mot.charAt(0))
    .join("")
    .toUpperCase();
  const classeTexte = classeTexteTypeBadge(code);
  const classeBordure = classeBordureTypeBadge(code);
  const libelleDepart = code === "CP" ? "Solde N-1" : "Solde initial";

  return (
    <div className="bg-surface-card w-full xl:sticky xl:top-4 xl:w-96 xl:shrink-0">
      <div className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(code)}`}>
        <div className="flex items-center gap-2.5">
          <Avatar initiales={initiales} />
          <div>
            <div className="text-sm font-bold text-white">{nomComplet}</div>
            <div className="text-xs font-semibold text-white/80">Détail du solde {code}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-white/70 hover:text-white"
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
                    <span
                      className={`bg-surface-app flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classeBordure}`}
                      style={{ color: `color-mix(in srgb, var(${VAR_COULEUR[code]}) 65%, black)` }}
                    >
                      {`${libelleDepart} - ${formatJjMmAa(historique.periodeDebut)}`}
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
                        className={`bg-surface-app text-ink-900 flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${classeBordure}`}
                      >
                        {m.type === "acquisition" ? (
                          <Plus size={10} className={`${classeTexte} shrink-0`} />
                        ) : (
                          <span className="bg-status-success-fg h-1.5 w-1.5 shrink-0 rounded-full" />
                        )}
                        {libelleEvenement(m)}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-semibold ${
                        m.jours < 0 || m.type === "acquisition"
                          ? classeTexte
                          : "text-status-success-fg"
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
                        className={`bg-surface-app text-ink-900 flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${classeBordure}`}
                      >
                        <span className="bg-status-warning-fg h-1.5 w-1.5 shrink-0 rounded-full" />
                        {libelleEvenement(m)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-center font-semibold ${classeTexte}`}>
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
              code={code}
              label={`${formatJours(mode === "reel" ? historique.soldeActuel : historique.soldeTheorique)} j`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
