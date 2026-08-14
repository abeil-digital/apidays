"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Download, X } from "lucide-react";
import type { DemandeEquipe, StatutDemande } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { periodePaieParDefaut } from "@/lib/periodePaie";
import { useCongesConsommes } from "@/hooks/useCongesConsommes";
import { refuserDemande, regulariserDemande, validerDemande } from "@/lib/data/demandes.repository";
import { classeBordureTypeBadge } from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { InputFiltrePill } from "@/components/ui/FiltrePill";
import { Textarea } from "@/components/ui/Textarea";
import { SuiviDemandeRow } from "@/components/suivre/SuiviDemandeRow";

type TypeConsomme = "CP" | "RTT" | "CPA" | "CSS";

const TYPES: TypeConsomme[] = ["CP", "RTT", "CPA", "CSS"];

const LABEL_TYPE: Record<TypeConsomme, string> = {
  CP: "CP",
  RTT: "RTT",
  CPA: "Congés anticipés",
  CSS: "Congé sans solde",
};

function formatJjMm(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(d);
}

function libellePeriodeDemande(d: DemandeEquipe): string {
  return d.debut === d.fin ? formatJjMm(d.debut) : `${formatJjMm(d.debut)} - ${formatJjMm(d.fin)}`;
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
// jours annulés (régularisation depuis cette page) restent visibles pour la
// traçabilité, mais ne comptent pas.
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
    if (d.statut !== "annulé") ligne.parType[bucket].jours += d.nbDemiJournees / 2;
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
      const dates = c.dates.filter((d) => d.statut !== "annulé");
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
  const [commentaire, setCommentaire] = useState("");
  const [regularisationOuverte, setRegularisationOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [validesUniquement, setValidesUniquement] = useState(false);

  const demandesAffichees = validesUniquement
    ? demandes.filter((d) => d.statut === "validé")
    : demandes;
  const lignes = grouperParCollaborateur(demandesAffichees);
  const selection = demandes.find((d) => d.id === selectionId) ?? null;

  function selectionner(id: string) {
    setErreurAction(null);
    setCommentaire("");
    setRegularisationOuverte(false);
    setSelectionId(id);
  }

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

  async function valider() {
    if (!selection) return;
    setEnCours(true);
    setErreurAction(null);
    try {
      await validerDemande(selection.id, commentaire.trim());
      refetch();
      setSelectionId(null);
    } catch {
      setErreurAction("Impossible de valider cette demande.");
    } finally {
      setEnCours(false);
    }
  }

  async function refuser() {
    if (!selection) return;
    setEnCours(true);
    setErreurAction(null);
    try {
      await refuserDemande(selection.id, commentaire.trim());
      refetch();
      setSelectionId(null);
    } catch {
      setErreurAction("Impossible de refuser cette demande.");
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    if (!selection) return;
    setEnCours(true);
    setErreurAction(null);
    try {
      await regulariserDemande(selection.id, commentaire.trim());
      refetch();
      setSelectionId(null);
    } catch {
      setErreurAction("Impossible de supprimer cette demande.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-6xl md:pt-0">
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
                  <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold">
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
                                      onClick={() => selectionner(date.id)}
                                      disabled={enCours}
                                      className={`bg-surface-app text-ink-900 flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition-opacity duration-150 hover:opacity-70 disabled:pointer-events-none disabled:opacity-40 ${classeBordureTypeBadge(t)} ${date.id === selectionId ? "ring-mint ring-2" : ""}`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                          date.statut === "annulé"
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
          <div className="rounded-card bg-surface-card w-full shadow-sm xl:sticky xl:top-4 xl:w-80 xl:shrink-0">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-ink-900 text-sm font-bold">Détail du congé</div>
              <button
                type="button"
                onClick={() => setSelectionId(null)}
                disabled={enCours}
                className="text-ink-500 shrink-0 disabled:opacity-40"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-ink-300/60 border-t">
              <div className="text-ink-500 px-4 pt-3 text-xs font-semibold">
                {selection.demandeur.prenom} {selection.demandeur.nom}
              </div>
              <SuiviDemandeRow demande={selection} isLast />
            </div>

            {selection.statut === "validé" || selection.statut === "annulé" ? (
              <div className="pb-4">
                <button
                  type="button"
                  onClick={() => setRegularisationOuverte((v) => !v)}
                  className="text-ink-500 flex items-center gap-1 px-4 pt-3 text-xs font-semibold"
                >
                  Régularisation
                  {regularisationOuverte ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {regularisationOuverte && (
                  <div className="pt-2">
                    <div className="px-4 pb-2">
                      <label
                        htmlFor="commentaire-decision"
                        className="text-ink-500 mb-1.5 block text-[11px]"
                      >
                        Commentaire (motif, traçabilité)
                      </label>
                      <Textarea
                        id="commentaire-decision"
                        value={commentaire}
                        onChange={(e) => setCommentaire(e.target.value)}
                        rows={2}
                        placeholder={
                          selection.statut === "validé"
                            ? "Ex. congé finalement non pris…"
                            : "Ex. annulation faite par erreur…"
                        }
                        className="w-full rounded-none text-xs placeholder:text-xs"
                      />
                    </div>

                    {erreurAction && (
                      <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 mb-3 px-3 py-2.5 text-xs">
                        {erreurAction}
                      </div>
                    )}

                    <div className="px-4">
                      {selection.statut === "validé" ? (
                        <Button
                          variant="secondary"
                          onClick={supprimer}
                          disabled={enCours}
                          className="text-status-danger-fg border-status-danger-fg w-full justify-center rounded-full px-4 py-2 text-xs"
                        >
                          Supprimer
                        </Button>
                      ) : (
                        <Button
                          onClick={valider}
                          disabled={enCours}
                          className="w-full justify-center rounded-full px-4 py-2 text-xs"
                        >
                          <Check size={16} />
                          Restaurer
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="px-4 pt-3 pb-2">
                  <label
                    htmlFor="commentaire-decision"
                    className="text-ink-500 mb-1.5 block text-[11px]"
                  >
                    Commentaire (motif, traçabilité)
                  </label>
                  <Textarea
                    id="commentaire-decision"
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    rows={2}
                    placeholder="Ex. régularisation confirmée par le salarié…"
                    className="w-full rounded-none text-xs placeholder:text-xs"
                  />
                </div>

                {erreurAction && (
                  <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 mb-3 px-3 py-2.5 text-xs">
                    {erreurAction}
                  </div>
                )}

                <div className="flex gap-2 px-4 pb-4">
                  <Button
                    variant="secondary"
                    onClick={refuser}
                    disabled={enCours}
                    className="text-status-danger-fg border-status-danger-fg flex-1 justify-center rounded-full px-4 py-2 text-xs"
                  >
                    Refuser
                  </Button>
                  <Button
                    onClick={valider}
                    disabled={enCours}
                    className="flex-1 justify-center rounded-full px-4 py-2 text-xs"
                  >
                    <Check size={16} />
                    Valider
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
