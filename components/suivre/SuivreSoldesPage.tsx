"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import type { Soldes, UtilisateurAdmin } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { fetchSoldes } from "@/lib/data/soldes.repository";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { classeFondActifTypeBadge, TypeBadge } from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { SelectFiltrePill } from "@/components/ui/FiltrePill";
import { SoldeDetailPanel, type ModeSolde } from "@/components/suivre/SoldeDetailPanel";

type CodeSoldeDetail = "CP" | "RTT" | "CPA";
type ColonneTri = "nom" | "cp" | "rtt" | "cpa";

function valeurSolde(soldes: Soldes, colonne: "cp" | "rtt" | "cpa", mode: ModeSolde): number {
  return mode === "theorique" ? soldes[colonne].valeurApresAttente : soldes[colonne].valeur;
}

interface Selection {
  utilisateurId: string;
  code: CodeSoldeDetail;
}

interface Tri {
  colonne: ColonneTri;
  direction: "desc" | "asc";
}

/** Une ligne — reçoit son solde déjà chargé par le parent (24/08/2026 :
 * trier par CP/RTT/CPA suppose de connaître les 3 valeurs de TOUTES les
 * lignes avant de décider l'ordre d'affichage, donc le fetch ne peut plus
 * être local à chaque ligne comme avant — voir `SuivreSoldesPage`). Les 3
 * pills restent cliquables : ouvrent `SoldeDetailPanel` dans la colonne de
 * droite. */
function LigneSolde({
  utilisateur,
  soldes,
  selection,
  mode,
  onClickSolde,
}: {
  utilisateur: UtilisateurAdmin;
  soldes: Soldes | undefined;
  selection: Selection | null;
  mode: ModeSolde;
  onClickSolde: (code: CodeSoldeDetail) => void;
}) {
  const initiales = `${utilisateur.prenom.charAt(0)}${utilisateur.nom.charAt(0)}`.toUpperCase();
  const actif = selection?.utilisateurId === utilisateur.id;
  // Pas un seul type par ligne ici (3 pills CP/RTT/CPA) contrairement à
  // `HistoriqueTable` — état "on" teinté par le type effectivement consulté
  // (`selection.code`, même mécanique `classeFondActifTypeBadge`/30%), survol
  // neutre le reste du temps (24/08/2026).
  const classeLigne = actif ? classeFondActifTypeBadge(selection!.code) : "hover:bg-ink-300/40";

  return (
    <tr className={`transition-colors duration-150 ${classeLigne}`}>
      <td className="px-4 py-3">
        <span className="flex items-center gap-1.5">
          <Avatar initiales={initiales} />
          <span className="text-ink-900 font-semibold">
            {utilisateur.prenom} {utilisateur.nom}
          </span>
        </span>
      </td>
      {!soldes ? (
        <td colSpan={3} className="text-ink-500 px-4 py-3 text-center">
          …
        </td>
      ) : (
        <>
          <td className="px-4 py-3 text-center">
            <button
              type="button"
              onClick={() => onClickSolde("CP")}
              className="rounded-full transition-opacity duration-150 hover:opacity-70"
            >
              <TypeBadge
                code="CP"
                variant={actif && selection?.code === "CP" ? "outline" : "pill"}
                label={`${formatJours(valeurSolde(soldes, "cp", mode))} j`}
              />
            </button>
          </td>
          <td className="px-4 py-3 text-center">
            <button
              type="button"
              onClick={() => onClickSolde("RTT")}
              className="rounded-full transition-opacity duration-150 hover:opacity-70"
            >
              <TypeBadge
                code="RTT"
                variant={actif && selection?.code === "RTT" ? "outline" : "pill"}
                label={`${formatJours(valeurSolde(soldes, "rtt", mode))} j`}
              />
            </button>
          </td>
          <td className="px-4 py-3 text-center">
            <button
              type="button"
              onClick={() => onClickSolde("CPA")}
              className="rounded-full transition-opacity duration-150 hover:opacity-70"
            >
              <TypeBadge
                code="CPA"
                variant={actif && selection?.code === "CPA" ? "outline" : "pill"}
                label={`${formatJours(valeurSolde(soldes, "cpa", mode))} j`}
              />
            </button>
          </td>
        </>
      )}
    </tr>
  );
}

// Même convention que l'export CSV d'Export paie (`CongesPaiePage.genererCsv`)
// — BOM UTF-8 côté appelant, point-virgule comme séparateur (Excel FR).
function genererCsv(lignes: { nom: string; soldes: Soldes | undefined }[], mode: ModeSolde): string {
  const entetes = ["Collaborateur", "CP", "RTT", "CPA"];
  const rangs = lignes.map((l) => [
    l.nom,
    l.soldes ? `${formatJours(valeurSolde(l.soldes, "cp", mode))} j` : "",
    l.soldes ? `${formatJours(valeurSolde(l.soldes, "rtt", mode))} j` : "",
    l.soldes ? `${formatJours(valeurSolde(l.soldes, "cpa", mode))} j` : "",
  ]);

  return [entetes, ...rangs]
    .map((rang) => rang.map((valeur) => `"${valeur.replace(/"/g, '""')}"`).join(";"))
    .join("\n");
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
 *
 * **Soldes chargés en une fois par le parent** (24/08/2026, plus par ligne) :
 * nécessaire pour trier par CP/RTT/CPA (en-têtes cliquables, même cycle
 * desc → asc → aucun tri que "Posé le" dans `HistoriqueTable`) — l'ordre
 * d'affichage doit connaître les 3 valeurs de toutes les lignes en même
 * temps, ce qu'un `useSoldes` local à chaque `LigneSolde` ne permet pas.
 * **Export CSV** (bouton "Exporter", même gabarit que `CongesPaiePage`) :
 * exporte les lignes actuellement affichées, dans l'ordre affiché (filtre
 * collaborateur + tri actif compris).
 *
 * **Toggle réel/théorique** (27/08/2026, demande explicite — avant ça le
 * tableau affichait toujours `.valeur`/réel sans distinction) : par défaut
 * sur "théorique", sorti du tableau et placé au niveau du titre de page (pas
 * mêlé aux filtres de la table) — un vrai switch binaire (piste + poignée),
 * pas un sélecteur/des onglets. Le tri, l'export CSV et la popin
 * `SoldeDetailPanel` ouverte au clic (son `modeParDefaut`) suivent tous le
 * mode sélectionné ici — un seul état partagé, pas de risque d'incohérence
 * entre le tableau et la popin.
 */
export function SuivreSoldesPage() {
  const { utilisateurs, loading, error } = useUtilisateursAdmin();
  const [collaborateurFiltre, setCollaborateurFiltre] = useState("tous");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [soldesParId, setSoldesParId] = useState<Record<string, Soldes>>({});
  const [tri, setTri] = useState<Tri | null>(null);
  // Réel/théorique (27/08/2026, demande explicite) — le tableau affichait
  // toujours le réel (`.valeur`), sans sélecteur ; par défaut sur théorique
  // maintenant, cohérent avec la popin qui démarre sur le même mode.
  const [mode, setMode] = useState<ModeSolde>("theorique");

  const actifs = utilisateurs.filter((u) => u.statut === "actif");

  useEffect(() => {
    let annule = false;
    Promise.all(actifs.map((u) => fetchSoldes(u.id).then((s) => [u.id, s] as const))).then(
      (paires) => {
        if (!annule) setSoldesParId(Object.fromEntries(paires));
      },
    );
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilisateurs]);

  function handleTri(colonne: ColonneTri) {
    setTri((prev) => {
      if (!prev || prev.colonne !== colonne) return { colonne, direction: "desc" };
      if (prev.direction === "desc") return { colonne, direction: "asc" };
      return null;
    });
  }

  function iconeTri(colonne: ColonneTri) {
    if (tri?.colonne !== colonne) return <ArrowUpDown size={12} />;
    return tri.direction === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />;
  }

  const collaborateurs = [...actifs]
    .map((u) => [u.id, `${u.prenom} ${u.nom}`] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const filtresBase = actifs.filter(
    (u) => collaborateurFiltre === "tous" || u.id === collaborateurFiltre,
  );
  const filtres = tri
    ? [...filtresBase].sort((a, b) => {
        if (tri.colonne === "nom") {
          const comparaison = `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`);
          return tri.direction === "desc" ? -comparaison : comparaison;
        }
        const soldeA = soldesParId[a.id];
        const soldeB = soldesParId[b.id];
        const va = soldeA ? valeurSolde(soldeA, tri.colonne, mode) : 0;
        const vb = soldeB ? valeurSolde(soldeB, tri.colonne, mode) : 0;
        return tri.direction === "desc" ? vb - va : va - vb;
      })
    : filtresBase;
  const utilisateurSelectionne = actifs.find((u) => u.id === selection?.utilisateurId) ?? null;

  function exporter() {
    const lignes = filtres.map((u) => ({
      nom: `${u.prenom} ${u.nom}`,
      soldes: soldesParId[u.id],
    }));
    const csv = genererCsv(lignes, mode);
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `soldes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0">
      <div className="flex flex-col gap-2 px-1">
        <h1 className="text-ink-900 text-2xl font-semibold">Suivre les soldes</h1>
        {/* Toggle réel/théorique (27/08/2026, sorti du tableau — demande
            explicite : "un toggle", pas un sélecteur/onglets ; placé sous le
            titre plutôt qu'à côté, en plus petit) — un vrai switch binaire
            (piste + poignée), pas encore de primitive partagée dans
            `components/ui/` pour ça, construit ici. */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold ${mode === "reel" ? "text-ink-900" : "text-ink-500"}`}
          >
            Réel
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={mode === "theorique"}
            aria-label="Basculer entre solde réel et solde théorique"
            onClick={() => setMode(mode === "theorique" ? "reel" : "theorique")}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${
              mode === "theorique" ? "bg-mint/90" : "bg-ink-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                mode === "theorique" ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-xs font-semibold ${mode === "theorique" ? "text-ink-900" : "text-ink-500"}`}
          >
            Théorique
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,900px)_24rem]">
        <div className="bg-surface-card w-full min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3">
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
            <Button
              onClick={exporter}
              disabled={filtres.length === 0}
              className="rounded-full px-4 py-2"
            >
              <Download size={16} />
              Exporter (CSV)
            </Button>
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
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleTri("nom")}
                          className="hover:text-ink-900 flex items-center gap-1"
                        >
                          Collaborateur
                          {iconeTri("nom")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleTri("cp")}
                          className="hover:text-ink-900 mx-auto flex items-center gap-1"
                        >
                          CP
                          {iconeTri("cp")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleTri("rtt")}
                          className="hover:text-ink-900 mx-auto flex items-center gap-1"
                        >
                          RTT
                          {iconeTri("rtt")}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleTri("cpa")}
                          className="hover:text-ink-900 mx-auto flex items-center gap-1"
                        >
                          CPA
                          {iconeTri("cpa")}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtres.map((u) => (
                      <LigneSolde
                        key={u.id}
                        utilisateur={u}
                        soldes={soldesParId[u.id]}
                        selection={selection}
                        mode={mode}
                        onClickSolde={(code) => setSelection({ utilisateurId: u.id, code })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {selection && utilisateurSelectionne && (
          <SoldeDetailPanel
            key={`${selection.utilisateurId}-${selection.code}`}
            code={selection.code}
            utilisateurId={utilisateurSelectionne.id}
            nomComplet={`${utilisateurSelectionne.prenom} ${utilisateurSelectionne.nom}`}
            onClose={() => setSelection(null)}
            modeParDefaut={mode}
          />
        )}
      </div>
    </div>
  );
}
