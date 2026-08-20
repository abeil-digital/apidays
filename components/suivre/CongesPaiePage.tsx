"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { DemandeEquipe, StatutDemande } from "@/lib/types";
import { formatJours, formatPeriodePillNumerique } from "@/lib/format";
import { periodePaieParDefaut } from "@/lib/periodePaie";
import { useCongesConsommes } from "@/hooks/useCongesConsommes";
import {
  refuserDemande,
  regulariserDemande,
  remettreEnAttenteDemande,
  validerDemande,
} from "@/lib/data/demandes.repository";
import { classeBordureTypeBadge } from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { InputFiltrePill } from "@/components/ui/FiltrePill";
import { Toast } from "@/components/ui/Toast";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";

type TypeConsomme = "CP" | "RTT" | "CPA" | "CSS";

const TYPES: TypeConsomme[] = ["CP", "RTT", "CPA", "CSS"];

const LABEL_TYPE: Record<TypeConsomme, string> = {
  CP: "CP",
  RTT: "RTT",
  CPA: "Congés anticipés",
  CSS: "Congé sans solde",
};

function libellePeriodeDemande(d: DemandeEquipe): string {
  return formatPeriodePillNumerique(d.debut, d.fin);
}

interface DatePeriode {
  id: string;
  label: string;
  statut: StatutDemande;
}

interface LigneCollab {
  id: string;
  nom: string;
  initiales: string;
  parType: Record<TypeConsomme, { jours: number; dates: DatePeriode[] }>;
}

function ligneVide(): LigneCollab["parType"] {
  return {
    CP: { jours: 0, dates: [] },
    RTT: { jours: 0, dates: [] },
    CPA: { jours: 0, dates: [] },
    CSS: { jours: 0, dates: [] },
  };
}

// Cas à la marge (regularisation) : les jours non validés comptent dans le
// total dès maintenant (voir pastille orange/verte pour les distinguer). Les
// jours annulés (régularisation depuis cette page) ou refusés restent
// visibles pour la traçabilité, mais ne comptent pas — ni l'un ni l'autre
// n'a jamais été (ou n'est plus) un congé réellement accordé.
function grouperParCollaborateur(demandes: DemandeEquipe[]): LigneCollab[] {
  const parId = new Map<string, LigneCollab>();

  for (const d of demandes) {
    const bucket: TypeConsomme =
      d.type === "CP" && d.isAnticipation ? "CPA" : (d.type as TypeConsomme);
    const id = d.demandeur.id;

    if (!parId.has(id)) {
      parId.set(id, {
        id,
        nom: `${d.demandeur.prenom} ${d.demandeur.nom}`,
        initiales: `${d.demandeur.prenom[0]}${d.demandeur.nom[0]}`.toUpperCase(),
        parType: ligneVide(),
      });
    }

    const ligne = parId.get(id)!;
    if (d.statut !== "annulé" && d.statut !== "refusé") {
      ligne.parType[bucket].jours += d.nbDemiJournees / 2;
    }
    ligne.parType[bucket].dates.push({
      id: d.id,
      label: libellePeriodeDemande(d),
      statut: d.statut,
    });
  }

  return [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

function genererCsv(lignes: LigneCollab[]): string {
  const entetes = ["Collaborateur", ...TYPES.map((t) => LABEL_TYPE[t])];
  const rangs = lignes.map((ligne) => [
    ligne.nom,
    ...TYPES.map((t) => {
      const c = ligne.parType[t];
      const dates = c.dates.filter((d) => d.statut !== "annulé" && d.statut !== "refusé");
      return c.jours > 0
        ? `${formatJours(c.jours)} j (${dates.map((d) => d.label).join(", ")})`
        : "0";
    }),
  ]);

  return [entetes, ...rangs]
    .map((rang) => rang.map((valeur) => `"${valeur.replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

/**
 * Détail par collaborateur des congés consommés sur la période — Espace
 * Suivre > sous-rubrique "Export paie", visible manager + admin (comme le
 * reste de `/suivre`, bloqué pour les salarié·es dans `proxy.ts`). Période
 * par défaut 25→24 (`periodePaieParDefaut`, cycle de transmission à la
 * comptable), modifiable via les deux champs date. Export CSV côté client
 * (Blob + téléchargement), pas d'appel serveur.
 */
export function CongesPaiePage() {
  const defaut = periodePaieParDefaut();
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);
  const { demandes, loading, error, refetch } = useCongesConsommes(debut, fin);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [validesUniquement, setValidesUniquement] = useState(false);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);

  const demandesAffichees = validesUniquement
    ? demandes.filter((d) => d.statut === "validé")
    : demandes;
  const lignes = grouperParCollaborateur(demandesAffichees);
  const selection = demandes.find((d) => d.id === selectionId) ?? null;

  function exporter() {
    const csv = genererCsv(lignes);
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conges-paie_${debut}_${fin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function valider(commentaire: string) {
    if (!selection) return;
    await validerDemande(selection.id, commentaire);
    refetch();
  }

  async function refuser(commentaire: string) {
    if (!selection) return;
    await refuserDemande(selection.id, commentaire);
    refetch();
  }

  async function regulariser(commentaire: string) {
    if (!selection) return;
    await regulariserDemande(selection.id, commentaire);
    refetch();
  }

  async function annulerValidation(id: string) {
    await remettreEnAttenteDemande(id);
    refetch();
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0">
      <h1 className="text-ink-900 px-1 text-2xl font-semibold">Export paie</h1>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div
          className={`bg-surface-card w-full shadow-sm xl:min-w-0 ${selection ? "xl:flex-1" : "md:max-w-[900px]"}`}
        >
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <InputFiltrePill
              type="date"
              aria-label="Du"
              value={debut}
              onChange={(e) => setDebut(e.target.value)}
              disabled={enCours}
            />
            <InputFiltrePill
              type="date"
              aria-label="Au"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              disabled={enCours}
            />
            <label className="text-ink-500 flex items-center gap-1.5 text-xs font-semibold">
              <input
                type="checkbox"
                checked={validesUniquement}
                onChange={(e) => setValidesUniquement(e.target.checked)}
                disabled={enCours}
                className="accent-mint h-4 w-4"
              />
              Validés uniquement
            </label>
            <Button
              onClick={exporter}
              disabled={lignes.length === 0}
              className="ml-auto rounded-full px-4 py-2"
            >
              <Download size={16} />
              Exporter (CSV)
            </Button>
          </div>

          {error && (
            <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 mb-3 px-3 py-2.5 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
          ) : lignes.length === 0 ? (
            <EmptyRow text="Aucun congé validé sur cette période." />
          ) : (
            <div className="border-ink-300/60 w-full overflow-x-auto border-t">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
                    <th className="px-3 py-3 text-center">Collaborateur</th>
                    {TYPES.map((t) => (
                      <th key={t} className="px-3 py-3 text-center">
                        {LABEL_TYPE[t]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne) => (
                    <tr key={ligne.id} className="border-ink-300/60 border-b last:border-b-0">
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <Avatar initiales={ligne.initiales} />
                          <span className="text-ink-900 text-sm font-semibold">{ligne.nom}</span>
                        </div>
                      </td>
                      {TYPES.map((t) => {
                        const c = ligne.parType[t];
                        return (
                          <td key={t} className="px-3 py-3 align-top">
                            {c.dates.length > 0 ? (
                              <div className="grid grid-cols-[auto_1fr] items-start gap-x-1.5 gap-y-1">
                                <span className="text-ink-900 w-10 shrink-0 text-right font-bold whitespace-nowrap">
                                  {c.jours > 0 ? `${formatJours(c.jours)} j` : ""}
                                </span>
                                <div className="flex flex-col gap-1">
                                  {c.dates.map((date, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => setSelectionId(date.id)}
                                      disabled={enCours}
                                      className={`bg-surface-app text-ink-900 flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition-opacity duration-150 hover:opacity-70 disabled:pointer-events-none disabled:opacity-40 ${classeBordureTypeBadge(t)} ${date.id === selectionId ? "ring-mint ring-2" : ""}`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                          date.statut === "annulé" || date.statut === "refusé"
                                            ? "bg-status-danger-fg"
                                            : date.statut === "validé"
                                              ? "bg-status-success-fg"
                                              : "bg-status-warning-fg"
                                        }`}
                                      />
                                      {date.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selection && (
          <DetailCongePanel
            key={selection.id}
            selection={selection}
            onClose={() => setSelectionId(null)}
            onValider={valider}
            onRefuser={refuser}
            onRegulariser={regulariser}
            onEnCoursChange={setEnCours}
            onValiderSucces={(id, message) => setToast({ id, message })}
          />
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          actionLabel="Annuler"
          onAction={() => {
            annulerValidation(toast.id);
            setToast(null);
          }}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
