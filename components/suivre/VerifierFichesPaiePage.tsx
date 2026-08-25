"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import {
  fetchCheckFichesPaie,
  fetchComparaisonSoldes,
  signalerEcart,
  validerCheckPaie,
  type CheckFichePaieCollaborateur,
  type ComparaisonSoldeCollaborateur,
} from "@/lib/data/exportsPaie.repository";
import { formatDateAction, formatJours } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { Textarea } from "@/components/ui/Textarea";

/**
 * Formate un mouvement de solde avec son signe explicite ("+2,5"/"-1"/"0") —
 * jamais masqué à 0 (25/08/2026, demande explicite : "le 0 mouvement est
 * important").
 */
function formatMouvement(valeur: number): string {
  if (valeur === 0) return "0";
  return `${valeur > 0 ? "+" : ""}${formatJours(valeur)}`;
}

/**
 * Section "Soldes" — comparaison CP/RTT mois précédent/mois en cours par
 * collaborateur (25/08/2026, demande explicite de Vincent, en plus du
 * contrôle ligne par ligne existant plus bas) : vérifie que le SOLDE qui
 * découle de l'app est bien celui de la fiche de paie du comptable, pas
 * seulement que chaque congé a été transmis. Tous les collaborateurs actifs
 * apparaissent, y compris ceux sans aucun mouvement — "le 0 mouvement est
 * important", un collaborateur absent de la liste ne prouverait rien.
 */
function SectionSoldes({ comparaisons }: { comparaisons: ComparaisonSoldeCollaborateur[] }) {
  if (comparaisons.length === 0) {
    return (
      <div className="bg-surface-card w-full shadow-sm">
        <EmptyRow text="Aucun collaborateur actif." />
      </div>
    );
  }

  return (
    <div className="bg-surface-card w-full overflow-x-auto shadow-sm">
      <div className="px-4 pt-3 pb-1">
        <h2 className="text-ink-900 text-sm font-bold">Soldes</h2>
      </div>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
            <th className="px-3 py-3">Collaborateur</th>
            <th className="px-3 py-3 text-center">Type</th>
            <th className="px-3 py-3 text-center">Mois précédent</th>
            <th className="px-3 py-3 text-center">Mois en cours</th>
            <th className="px-3 py-3 text-center">Mouvement</th>
          </tr>
        </thead>
        <tbody>
          {comparaisons.map((c) => (
            <Fragment key={c.utilisateur.id}>
              <tr className="border-ink-300/60 border-b">
                <td className="px-3 py-3 align-top" rowSpan={3}>
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      initiales={`${c.utilisateur.prenom[0]}${c.utilisateur.nom[0]}`.toUpperCase()}
                    />
                    <span className="text-ink-900 font-semibold">
                      {c.utilisateur.prenom} {c.utilisateur.nom}
                    </span>
                  </div>
                </td>
                <td className="text-ink-500 px-3 py-3 text-center font-semibold">CP</td>
                <td className="px-3 py-3 text-center">{formatJours(c.cp.moisPrecedent)} j</td>
                <td className="px-3 py-3 text-center font-semibold">
                  {formatJours(c.cp.moisEnCours)} j
                </td>
                <td className="px-3 py-3 text-center">{formatMouvement(c.cp.mouvement)} j</td>
              </tr>
              <tr className="border-ink-300/60 border-b">
                <td className="text-ink-500 px-3 py-3 text-center font-semibold">RTT</td>
                <td className="px-3 py-3 text-center">{formatJours(c.rtt.moisPrecedent)} j</td>
                <td className="px-3 py-3 text-center font-semibold">
                  {formatJours(c.rtt.moisEnCours)} j
                </td>
                <td className="px-3 py-3 text-center">{formatMouvement(c.rtt.mouvement)} j</td>
              </tr>
              <tr className="border-ink-300/60 border-b last:border-b-0">
                <td className="text-ink-500 px-3 py-3 text-center font-semibold">CPA</td>
                <td className="px-3 py-3 text-center">{formatJours(c.cpa.moisPrecedent)} j</td>
                <td className="px-3 py-3 text-center font-semibold">
                  {formatJours(c.cpa.moisEnCours)} j
                </td>
                <td className="px-3 py-3 text-center">{formatMouvement(c.cpa.mouvement)} j</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Onglet "Vérifier les fiches de paie" (Transmissions paie, 24/08/2026) — pour
 * chaque collaborateur transmis sur cet export : total de jours transmis
 * (ce qui est littéralement imprimé sur la fiche de paie reçue du
 * comptable) + action "Ça matche" en bloc. Détail par congé disponible en
 * dépli (`voirDetail`) pour isoler un écart précis — décision actée avec
 * Vincent ("il faut passer en mode détail").
 *
 * Section "Soldes" ajoutée le 25/08/2026 (demande explicite) — comparaison
 * CP/RTT mois précédent/mois en cours par collaborateur, contrôle
 * complémentaire "macro" (le solde global est-il le bon) au contrôle "micro"
 * ligne par ligne ci-dessous (ce congé précis a-t-il été transmis). Voir
 * `SectionSoldes`/`fetchComparaisonSoldes`.
 */
export function VerifierFichesPaiePage({
  exportId,
  periode,
}: {
  exportId: string | null;
  periode: { debut: string; fin: string };
}) {
  const [collaborateurs, setCollaborateurs] = useState<CheckFichePaieCollaborateur[]>([]);
  const [comparaisons, setComparaisons] = useState<ComparaisonSoldeCollaborateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [ecartOuvert, setEcartOuvert] = useState<string | null>(null);
  const [motifEcart, setMotifEcart] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchComparaisonSoldes(periode, exportId).then((data) => {
      if (!cancelled) setComparaisons(data);
    });
    return () => {
      cancelled = true;
    };
  }, [periode, exportId]);

  useEffect(() => {
    let cancelled = false;
    const promise = exportId ? fetchCheckFichesPaie(exportId) : Promise.resolve([]);
    promise
      .then((data) => {
        if (!cancelled) {
          setCollaborateurs(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les fiches de paie à vérifier.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exportId, version]);

  function refetch() {
    setVersion((v) => v + 1);
  }

  async function validerCollaborateur(collab: CheckFichePaieCollaborateur) {
    await validerCheckPaie(
      collab.lignes.filter((l) => l.ligne.statut === "transmis").map((l) => l.ligne.id),
    );
    refetch();
  }

  async function validerLigne(ligneId: string) {
    await validerCheckPaie([ligneId]);
    refetch();
  }

  async function confirmerEcart(ligneId: string) {
    if (!motifEcart.trim()) return;
    await signalerEcart(ligneId, motifEcart.trim());
    setEcartOuvert(null);
    setMotifEcart("");
    refetch();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Soldes (25/08/2026) — indépendant de l'export : le solde CP/RTT
          calculé par l'app existe et vaut la peine d'être vérifié même avant
          transmission, contrairement au détail ligne par ligne ci-dessous
          qui n'a de sens qu'une fois un export réellement généré. */}
      <SectionSoldes comparaisons={comparaisons} />

      {!exportId ? (
        <div className="bg-surface-card w-full shadow-sm">
          <EmptyRow text="Aucun export généré pour cette période — rien à vérifier pour l'instant." />
        </div>
      ) : loading ? (
        <div className="bg-surface-card w-full py-20 text-center text-sm shadow-sm">
          <span className="text-ink-500">Chargement…</span>
        </div>
      ) : (
        <>
          {error && (
            <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
              {error}
            </div>
          )}

          {collaborateurs.length === 0 ? (
            <div className="bg-surface-card w-full shadow-sm">
              <EmptyRow text="Aucun congé transmis sur cet export." />
            </div>
          ) : (
            collaborateurs.map((collab) => {
              const enAttente = collab.lignes.filter((l) => l.ligne.statut === "transmis").length;
              const tousValides = enAttente === 0;

              return (
                <div key={collab.utilisateur.id} className="bg-surface-card w-full shadow-sm">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Avatar
                      initiales={`${collab.utilisateur.prenom[0]}${collab.utilisateur.nom[0]}`.toUpperCase()}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-ink-900 font-semibold">
                        {collab.utilisateur.prenom} {collab.utilisateur.nom}
                      </div>
                      <div className="text-ink-500 text-xs">
                        {formatJours(collab.totalJours)} j transmis
                      </div>
                    </div>
                    {tousValides ? (
                      <Badge tone="success">
                        <Check size={12} strokeWidth={2.5} />
                        <span>Vérifié</span>
                      </Badge>
                    ) : (
                      <Button
                        onClick={() => validerCollaborateur(collab)}
                        className="rounded-full px-4 py-2 text-xs"
                      >
                        <Check size={16} />
                        Ça matche
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setOuvert((v) =>
                          v === collab.utilisateur.id ? null : collab.utilisateur.id,
                        )
                      }
                      className="text-ink-500 flex items-center gap-1 text-xs font-semibold"
                    >
                      Détail
                      {ouvert === collab.utilisateur.id ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </div>

                  {ouvert === collab.utilisateur.id && (
                    <div className="border-ink-300/60 border-t">
                      {collab.lignes.map(({ ligne, demande }) => (
                        <div
                          key={ligne.id}
                          className="border-ink-300/60 flex flex-col gap-2 border-b px-4 py-3 last:border-b-0"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm">
                              <span className="text-ink-900 font-semibold">{demande.type}</span>
                              <span className="text-ink-500">
                                {" "}
                                {demande.debut} → {demande.fin} ·{" "}
                                {formatJours(Math.abs(ligne.joursInclus))} j
                                {ligne.joursInclus < 0 ? " (retro)" : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {ligne.statut === "transmis" && (
                                <>
                                  <Button
                                    variant="secondary"
                                    onClick={() => setEcartOuvert(ligne.id)}
                                    className="text-status-danger-fg border-status-danger-fg rounded-full bg-white px-3 py-1.5 text-xs"
                                  >
                                    <TriangleAlert size={14} />
                                    Écart
                                  </Button>
                                  <Button
                                    onClick={() => validerLigne(ligne.id)}
                                    className="rounded-full px-3 py-1.5 text-xs"
                                  >
                                    OK
                                  </Button>
                                </>
                              )}
                              {ligne.statut === "en_paye" && (
                                <Badge tone="success">
                                  <Check size={12} strokeWidth={2.5} />
                                  <span>En paye</span>
                                </Badge>
                              )}
                              {ligne.statut === "ecart" && (
                                <Badge tone="danger">
                                  <TriangleAlert size={12} strokeWidth={2.5} />
                                  <span>Écart</span>
                                </Badge>
                              )}
                            </div>
                          </div>
                          {ligne.statut === "ecart" && ligne.motifEcart && (
                            <div className="text-ink-500 text-xs italic">{ligne.motifEcart}</div>
                          )}
                          {ligne.verifieLe && ligne.statut !== "transmis" && (
                            <div className="text-ink-500 text-[10px]">
                              Vérifié le {formatDateAction(ligne.verifieLe.slice(0, 10))}
                            </div>
                          )}
                          {ecartOuvert === ligne.id && (
                            <div className="flex flex-col gap-2">
                              <Textarea
                                value={motifEcart}
                                onChange={(e) => setMotifEcart(e.target.value)}
                                rows={2}
                                placeholder="Ex. 2 jours manquants sur la fiche…"
                                className="w-full rounded-md text-xs placeholder:text-xs"
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setEcartOuvert(null);
                                    setMotifEcart("");
                                  }}
                                  className="rounded-full px-3 py-1.5 text-xs"
                                >
                                  Annuler
                                </Button>
                                <Button
                                  onClick={() => confirmerEcart(ligne.id)}
                                  disabled={!motifEcart.trim()}
                                  className="rounded-full px-3 py-1.5 text-xs"
                                >
                                  Confirmer
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
