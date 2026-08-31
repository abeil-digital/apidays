"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { Soldes, UtilisateurAdmin } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { retirerDemande } from "@/lib/data/demandes.repository";
import { fetchSoldes } from "@/lib/data/soldes.repository";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import {
  classeFondActifTypeBadge,
  classeFondSurvolTypeBadge,
  classeTexteTypeBadge,
  TypeBadge,
} from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { SelectFiltrePill } from "@/components/ui/FiltrePill";
import { SoldeDetailPanel, type ModeSolde } from "@/components/suivre/SoldeDetailPanel";

type CodeSoldeDetail = "CP" | "RTT" | "CPA";
const TYPES_SOLDE: CodeSoldeDetail[] = ["CP", "RTT", "CPA"];

interface Selection {
  utilisateurId: string;
  code: CodeSoldeDetail;
  // 27/08/2026, "on va rendre cliquable les compteurs : ils ouvrent
  // événement en mode théorique ou réel" — clic sur la pill théorique/réel
  // ouvre directement la popin sur ce mode (Mouvement reste sur "réel").
  mode: ModeSolde;
}

function categorieSolde(soldes: Soldes, code: CodeSoldeDetail) {
  if (code === "RTT") return soldes.rtt;
  if (code === "CPA") return soldes.cpa;
  return soldes.cp;
}

/**
 * Card "Soldes" d'un collaborateur — repris à l'identique de
 * `CardSoldeCollaborateur` (`VerifierFichesPaiePage2.tsx`, "Vérifier les
 * fiches de paie") : identité (avatar + prénom + nom) au-dessus d'un
 * mini-tableau CP/RTT/CPA, ligne teintée au survol/actif. Seule différence
 * demandée explicitement (27/08/2026, "reprends exactement ce système... une
 * seule différence : on affiche le solde théorique et le solde réel") : les
 * 2 colonnes de valeur sont Théorique/Réel (valeurs statiques d'aujourd'hui)
 * au lieu de Solde {mois précédent}/Solde {mois en cours} — pas de notion de
 * période ici, "Suivre les soldes" n'est pas ancré à un export.
 */
function CardSoldeCollaborateur({
  utilisateur,
  soldes,
  selection,
  onSelect,
}: {
  utilisateur: UtilisateurAdmin;
  soldes: Soldes | undefined;
  selection: Selection | null;
  onSelect: (utilisateurId: string, code: CodeSoldeDetail, mode: ModeSolde) => void;
}) {
  return (
    <div className="flex w-fit flex-col">
      <div className="text-ink-500 flex w-fit items-stretch text-xs font-semibold tracking-wide uppercase">
        <div className="w-[150px] shrink-0" />
        <div className="grid flex-1 grid-cols-[4.5rem_minmax(0,150px)_minmax(0,150px)]">
          <span className="px-4 py-2" />
          <span className="px-2 py-2 text-center">Théorique</span>
          <span className="px-2 py-2 text-center">Réel</span>
        </div>
      </div>
      <div
        data-carte-collaborateur={utilisateur.id}
        className="bg-surface-card flex w-fit items-stretch overflow-hidden shadow-sm"
      >
        <div className="border-ink-300/60 flex w-[150px] shrink-0 flex-col items-start justify-center gap-1 border-r px-3 py-3 text-left">
          <Avatar initiales={`${utilisateur.prenom[0]}${utilisateur.nom[0]}`.toUpperCase()} />
          <span className="text-ink-900 text-base font-semibold">{utilisateur.prenom}</span>
          <span className="text-ink-900 text-base font-semibold">{utilisateur.nom}</span>
        </div>
        <div className="flex-1">
          {TYPES_SOLDE.map((code) => {
            const active = selection?.utilisateurId === utilisateur.id && selection.code === code;
            const categorie = soldes ? categorieSolde(soldes, code) : null;
            return (
              <div
                key={code}
                data-mouvement-row={`${utilisateur.id}:${code}`}
                className={`border-ink-300/60 grid grid-cols-[4.5rem_minmax(0,150px)_minmax(0,150px)] items-center border-b transition-colors duration-150 last:border-b-0 ${active ? classeFondActifTypeBadge(code) : classeFondSurvolTypeBadge(code)}`}
              >
                <div className={`px-4 py-2.5 text-sm font-bold ${classeTexteTypeBadge(code)}`}>
                  {code}
                </div>
                <div className="px-2 py-2.5 text-center">
                  {categorie ? (
                    <button
                      type="button"
                      onClick={() => onSelect(utilisateur.id, code, "theorique")}
                      className="rounded-full transition-opacity duration-150 hover:opacity-70"
                    >
                      <TypeBadge
                        code={code}
                        variant="pill"
                        label={`${formatJours(categorie.valeurApresAttente)} j`}
                      />
                    </button>
                  ) : (
                    <span className="text-ink-500">…</span>
                  )}
                </div>
                <div className="px-2 py-2.5 text-center">
                  {categorie ? (
                    <button
                      type="button"
                      onClick={() => onSelect(utilisateur.id, code, "reel")}
                      className="rounded-full transition-opacity duration-150 hover:opacity-70"
                    >
                      <TypeBadge
                        code={code}
                        variant="pill"
                        label={`${formatJours(categorie.valeur)} j`}
                      />
                    </button>
                  ) : (
                    <span className="text-ink-500">…</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Même convention que l'export CSV d'Export paie (`CongesPaiePage.genererCsv`)
// — BOM UTF-8 côté appelant, point-virgule comme séparateur (Excel FR).
function genererCsv(lignes: { nom: string; soldes: Soldes | undefined }[]): string {
  const entetes = [
    "Collaborateur",
    "CP théorique",
    "CP réel",
    "RTT théorique",
    "RTT réel",
    "CPA théorique",
    "CPA réel",
  ];
  const rangs = lignes.map((l) => [
    l.nom,
    ...TYPES_SOLDE.flatMap((code) => {
      if (!l.soldes) return ["", ""];
      const categorie = categorieSolde(l.soldes, code);
      return [
        `${formatJours(categorie.valeurApresAttente)} j`,
        `${formatJours(categorie.valeur)} j`,
      ];
    }),
  ]);

  return [entetes, ...rangs]
    .map((rang) => rang.map((valeur) => `"${valeur.replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

/**
 * Duplication expérimentale de `SuivreSoldesPage` (27/08/2026, demande
 * explicite — "tu vas me dupliquer suivre les soldes") : point de départ
 * pour itérer sur cet écran sans risquer de casser la version utilisée en
 * usage réel. Câblée sur sa propre route (`/suivre/soldes2`), l'original
 * reste sur `/suivre/soldes`, non modifié.
 *
 * Refonte du 27/08/2026 ("reprends exactement ce système pour suivre mes
 * soldes... exactement les mêmes composants et même comportement") — reprend
 * le dispositif construit pour "Vérifier les fiches de paie"
 * (`VerifierFichesPaiePage2.tsx`) : une card par collaborateur (identité +
 * mini-tableau CP/RTT/CPA), un "Mouvement" cliquable qui ouvre à droite la
 * popin détaillée (ici `SoldeDetailPanel`, déjà alignée pixel pour pixel sur
 * ce même langage visuel — voir son historique de commentaires), panneau
 * calé sur le bord haut de la ligne cliquée (`topOffset`, mesuré via
 * `data-mouvement-row`) et scroll auto en douceur vers la card concernée.
 * Seule différence demandée : les 2 colonnes de valeur sont Théorique/Réel
 * (pas de notion de période ici), pas de toggle réel/théorique au niveau du
 * titre — les deux soldes sont désormais affichés en permanence.
 */
export function SuivreSoldesPage2() {
  const { utilisateurs, loading, error } = useUtilisateursAdmin();
  const { utilisateur } = useUtilisateur();
  // "Suivre les soldes 2" n'a jamais eu de bloc Décision/Régularisation
  // séparé par rôle (popin en lecture + "Annuler cette demande" uniquement)
  // — admin et manager y ont donc le même comportement (28/08/2026, "on cale
  // le comportement admin" pour manager sur validé non transmis, rien à
  // préserver de différent ici pour "en attente").
  const peutAnnulerDepuisSoldes = utilisateur?.role === "admin" || utilisateur?.role === "manager";
  // Annuler un congé déjà transmis en paie reste admin-only (28/08/2026),
  // contrairement au cas non-transmis ci-dessus.
  const estAdmin = utilisateur?.role === "admin";
  const [collaborateurFiltre, setCollaborateurFiltre] = useState("tous");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [soldesParId, setSoldesParId] = useState<Record<string, Soldes>>({});
  const cardsRef = useRef<HTMLDivElement>(null);
  const [panelTop, setPanelTop] = useState(0);

  const actifs = utilisateurs.filter((u) => u.statut === "actif");

  // Extrait en fonction nommée (28/08/2026, "Annuler cette demande" pour
  // admin) — relancée après une annulation, pas seulement au montage.
  async function rafraichirSoldes() {
    const paires = await Promise.all(
      actifs.map((u) => fetchSoldes(u.id).then((s) => [u.id, s] as const)),
    );
    setSoldesParId(Object.fromEntries(paires));
  }

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

  // Panneau calé sur le bord haut de la ligne CP/RTT/CPA cliquée (27/08/2026,
  // repris de `VerifierFichesPaiePage2`) — mesuré via `data-mouvement-row`,
  // appliqué en `marginTop` sur `SoldeDetailPanel` (un `top` sticky ne
  // repositionne rien tant qu'on n'a pas scrollé).
  useLayoutEffect(() => {
    if (!selection || !cardsRef.current) {
      setPanelTop(0);
      return;
    }
    const ligne = cardsRef.current.querySelector(
      `[data-mouvement-row="${selection.utilisateurId}:${selection.code}"]`,
    );
    if (!ligne) return;
    const ligneRect = ligne.getBoundingClientRect();
    const containerRect = cardsRef.current.getBoundingClientRect();
    setPanelTop(ligneRect.top - containerRect.top);
  }, [selection, soldesParId]);

  useEffect(() => {
    if (!selection || !cardsRef.current) return;
    const carte = cardsRef.current.querySelector(
      `[data-carte-collaborateur="${selection.utilisateurId}"]`,
    );
    carte?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selection]);

  const collaborateurs = [...actifs]
    .map((u) => [u.id, `${u.prenom} ${u.nom}`] as const)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const filtres = actifs.filter(
    (u) => collaborateurFiltre === "tous" || u.id === collaborateurFiltre,
  );
  const utilisateurSelectionne = actifs.find((u) => u.id === selection?.utilisateurId) ?? null;

  function exporter() {
    const lignes = filtres.map((u) => ({
      nom: `${u.prenom} ${u.nom}`,
      soldes: soldesParId[u.id],
    }));
    const csv = genererCsv(lignes);
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
      <h1 className="text-ink-900 animate-stagger-in px-1 text-2xl font-semibold">
        Suivre les soldes 2
      </h1>

      {error && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error}
        </div>
      )}

      <div
        className="animate-stagger-in flex flex-wrap items-end justify-between gap-3 px-1"
        style={{ animationDelay: "90ms" }}
      >
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

      {loading ? (
        <div className="bg-surface-card w-full shadow-sm">
          <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
        </div>
      ) : filtres.length === 0 ? (
        <div className="bg-surface-card w-full shadow-sm">
          <EmptyRow text="Aucun collaborateur ne correspond à ce filtre." />
        </div>
      ) : (
        <>
          <div
            className={`animate-stagger-in grid grid-cols-1 items-start gap-[5px] ${selection ? "xl:grid-cols-[max-content_max-content]" : ""}`}
            style={{ animationDelay: "180ms" }}
          >
            <div ref={cardsRef} className="flex min-w-0 flex-col gap-3">
              {filtres.map((u) => (
                <CardSoldeCollaborateur
                  key={u.id}
                  utilisateur={u}
                  soldes={soldesParId[u.id]}
                  selection={selection}
                  onSelect={(utilisateurId, code, mode) =>
                    setSelection((prev) =>
                      prev?.utilisateurId === utilisateurId &&
                      prev.code === code &&
                      prev.mode === mode
                        ? null
                        : { utilisateurId, code, mode },
                    )
                  }
                />
              ))}
            </div>
            {selection && utilisateurSelectionne && (
              <SoldeDetailPanel
                key={`${selection.utilisateurId}-${selection.code}-${selection.mode}`}
                code={selection.code}
                utilisateurId={utilisateurSelectionne.id}
                nomComplet={`${utilisateurSelectionne.prenom} ${utilisateurSelectionne.nom}`}
                onClose={() => setSelection(null)}
                modeParDefaut={selection.mode}
                avecDetailConge
                avecAjustement
                style={{ marginTop: panelTop }}
                onRetirer={
                  peutAnnulerDepuisSoldes
                    ? async (demandeId, commentaire) => {
                        await retirerDemande(demandeId, commentaire);
                        await rafraichirSoldes();
                      }
                    : undefined
                }
                peutAnnulerDejaTransmis={estAdmin}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
