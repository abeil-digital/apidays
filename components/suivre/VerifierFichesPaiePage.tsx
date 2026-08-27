"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, TriangleAlert, X } from "lucide-react";
import {
  fetchCheckFichesPaie,
  fetchComparaisonSoldes,
  signalerEcart,
  validerCheckPaie,
  type CheckFichePaieCollaborateur,
  type ComparaisonSoldeCollaborateur,
} from "@/lib/data/exportsPaie.repository";
import { formatDateAction, formatJours } from "@/lib/format";
import type { DemandeEquipe, LigneExportPaie } from "@/lib/types";
import {
  classeFondActifTypeBadge,
  classeFondSurvolTypeBadge,
  classeFondTypeBadge,
  classeTexteTypeBadge,
  TypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { Textarea } from "@/components/ui/Textarea";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";

// Les 3 catégories suivies par ce comparatif (25/08/2026) — dans cet ordre,
// même convention que "Suivre les soldes"/le récap collaborateur × type de
// "Générer l'export".
const TYPES_SOLDE: TypeBadgeCode[] = ["CP", "RTT", "CPA"];

/**
 * Formate un mouvement de solde avec son signe explicite ("+2,5"/"-1"/"0") —
 * jamais masqué à 0 (25/08/2026, demande explicite : "le 0 mouvement est
 * important").
 */
function formatMouvement(valeur: number): string {
  if (valeur === 0) return "0";
  return `${valeur > 0 ? "+" : ""}${formatJours(valeur)}`;
}

function categorieSolde(c: ComparaisonSoldeCollaborateur, code: TypeBadgeCode) {
  if (code === "RTT") return c.rtt;
  if (code === "CPA") return c.cpa;
  return c.cp;
}

/** Nom du mois en toutes lettres (ex. "juillet") — colonnes "Solde <mois>"
 * de `SectionSoldes` (27/08/2026, demande explicite : remplacer les libellés
 * génériques "Mois précédent"/"Mois en cours" par le nom réel du mois). */
function nomMois(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date(`${dateIso}T00:00:00Z`));
}

function moisPrecedentIso(periodeDebutIso: string): string {
  const d = new Date(`${periodeDebutIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** CP anticipé (`is_anticipation`) affiché sous le code CPA, pas CP — même
 * convention que partout ailleurs dans l'app (`SoldeDetailPanel`, feed de
 * détail de "Générer l'export"...). */
function typeBadgeDeDemande(demande: DemandeEquipe): TypeBadgeCode {
  if (demande.type === "CP" && demande.isAnticipation) return "CPA";
  return demande.type as TypeBadgeCode;
}

interface SelectionMouvement {
  utilisateurId: string;
  code: TypeBadgeCode;
}

/**
 * Section "Soldes" — comparaison CP/RTT/CPA mois précédent/mois en cours par
 * collaborateur (25/08/2026, demande explicite de Vincent, en plus du
 * contrôle ligne par ligne existant plus bas) : vérifie que le SOLDE qui
 * découle de l'app est bien celui de la fiche de paie du comptable, pas
 * seulement que chaque congé a été transmis. Tous les collaborateurs actifs
 * apparaissent, y compris ceux sans aucun mouvement — "le 0 mouvement est
 * important", un collaborateur absent de la liste ne prouverait rien.
 *
 * Colonnes nommées par le mois réel (27/08/2026, "Solde juillet"/"Solde
 * août" plutôt que "Mois précédent"/"Mois en cours" génériques) —
 * `nomMois`/`moisPrecedentIso`, dérivés de `periode.debut` (même bornes que
 * `fetchComparaisonSoldes`).
 *
 * Représentation par type (25/08/2026, mise en cohérence avec le design
 * system — "Suivre les soldes"/le récap collaborateur × type de "Générer
 * l'export") : le type n'est plus un libellé texte brut mais une pastille
 * `TypeBadge` colorée (même code couleur partout dans l'app), les valeurs
 * "Mois en cours"/"Mouvement" reprennent cette couleur (`classeTexteTypeBadge`)
 * plutôt que du gris générique, et chaque ligne se teinte légèrement au
 * survol (`classeFondSurvolTypeBadge`, même mécanique que `HistoriqueTable`).
 */
function SectionSoldes({
  comparaisons,
  periode,
  selection,
  onSelect,
}: {
  comparaisons: ComparaisonSoldeCollaborateur[];
  periode: { debut: string; fin: string };
  selection: SelectionMouvement | null;
  onSelect: (utilisateurId: string, code: TypeBadgeCode) => void;
}) {
  if (comparaisons.length === 0) {
    return (
      <div className="bg-surface-card w-full shadow-sm">
        <EmptyRow text="Aucun collaborateur actif." />
      </div>
    );
  }

  const libelleMoisPrecedent = `Solde ${nomMois(moisPrecedentIso(periode.debut))}`;
  const libelleMoisEnCours = `Solde ${nomMois(periode.debut)}`;

  return (
    <div className="bg-surface-card w-full min-w-0 overflow-x-auto shadow-sm">
      <div className="px-4 pt-3 pb-1">
        <h2 className="text-ink-900 text-sm font-bold">Soldes réels</h2>
      </div>
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
            <th className="px-2 py-3">Collaborateur</th>
            <th className="px-2 py-3 text-center">Type</th>
            <th className="px-2 py-3 text-center">{libelleMoisPrecedent}</th>
            <th className="px-2 py-3 text-center">{libelleMoisEnCours}</th>
            <th className="px-2 py-3 text-center">Mouvement</th>
          </tr>
        </thead>
        <tbody>
          {comparaisons.map((c) => (
            <Fragment key={c.utilisateur.id}>
              {TYPES_SOLDE.map((code, i) => {
                const categorie = categorieSolde(c, code);
                const active = selection?.utilisateurId === c.utilisateur.id && selection.code === code;
                return (
                  <tr
                    key={code}
                    className={`border-ink-300/60 border-b transition-colors duration-150 last:border-b-0 ${active ? classeFondActifTypeBadge(code) : classeFondSurvolTypeBadge(code)}`}
                  >
                    {i === 0 && (
                      <td className="px-2 py-3 align-top" rowSpan={TYPES_SOLDE.length}>
                        <div className="flex items-center gap-1.5">
                          <Avatar
                            initiales={`${c.utilisateur.prenom[0]}${c.utilisateur.nom[0]}`.toUpperCase()}
                          />
                          <span className="text-ink-900 font-semibold">
                            {c.utilisateur.prenom} {c.utilisateur.nom}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-2 py-3 text-center">
                      <TypeBadge code={code} variant="pill" />
                    </td>
                    <td className="text-ink-500 px-2 py-3 text-center">
                      {formatJours(categorie.moisPrecedent)} j
                    </td>
                    <td
                      className={`px-2 py-3 text-center font-semibold ${classeTexteTypeBadge(code)}`}
                    >
                      {formatJours(categorie.moisEnCours)} j
                    </td>
                    <td className="px-2 py-3 text-center">
                      {/* Mouvement cliquable (27/08/2026, demande explicite) —
                          ouvre le détail des jours de la période dans le
                          panneau latéral (`PanelJoursMouvement`) ; table
                          resserrée pour lui laisser la place. */}
                      <button
                        type="button"
                        onClick={() => onSelect(c.utilisateur.id, code)}
                        className={`rounded-control font-semibold underline decoration-dotted underline-offset-2 transition-opacity duration-150 hover:opacity-70 ${classeTexteTypeBadge(code)}`}
                      >
                        {formatMouvement(categorie.mouvement)} j
                      </button>
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Panneau latéral "jours du mouvement" (27/08/2026, demande explicite —
 * "on réduit à balle la largeur du tableau actuel de façon à pouvoir
 * afficher au clic sur le côté une popin ... la liste des jours
 * correspondant au mouvement") : ouvert au clic sur la valeur "Mouvement"
 * d'une ligne de `SectionSoldes`, liste les lignes `export_paie_lignes` de CET
 * export pour ce collaborateur/type — pas de nouvelle donnée à charger, juste
 * un filtre sur `collaborateurs` (déjà fetché par `fetchCheckFichesPaie` pour
 * le contrôle ligne par ligne plus bas). Cliquer un jour ouvre `DetailCongePanel`
 * en ligne, juste en dessous (pas de 3e colonne : le panneau est déjà étroit).
 */
function PanelJoursMouvement({
  utilisateur,
  code,
  lignes,
  onClose,
}: {
  utilisateur: { id: string; prenom: string; nom: string };
  code: TypeBadgeCode;
  lignes: { ligne: LigneExportPaie; demande: DemandeEquipe }[];
  onClose: () => void;
}) {
  const [demandeOuverte, setDemandeOuverte] = useState<string | null>(null);
  const initiales = `${utilisateur.prenom[0]}${utilisateur.nom[0]}`.toUpperCase();

  return (
    <div className="bg-surface-card w-full overflow-hidden shadow-sm xl:sticky xl:top-4 xl:w-96 xl:shrink-0">
      <div className={`flex items-center justify-between px-4 py-3 ${classeFondTypeBadge(code)}`}>
        <div className="flex items-center gap-2.5">
          <Avatar initiales={initiales} />
          <div>
            <div className="text-sm font-bold text-white">
              {utilisateur.prenom} {utilisateur.nom}
            </div>
            <div className="text-xs font-semibold text-white/80">
              Jours {code} — mouvement de la période
            </div>
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
        {lignes.length === 0 ? (
          <EmptyRow text="Aucun jour transmis sur cette période." />
        ) : (
          lignes.map(({ ligne, demande }) => {
            const ouverte = demandeOuverte === demande.id;
            return (
              <div key={ligne.id} className="border-ink-300/60 border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => setDemandeOuverte(ouverte ? null : demande.id)}
                  className="hover:bg-ink-300/30 flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors duration-150"
                >
                  <span className="text-ink-900 text-sm">
                    {demande.debut} → {demande.fin}
                  </span>
                  <span className={`text-sm font-semibold ${classeTexteTypeBadge(code)}`}>
                    {ligne.joursInclus < 0 ? "+" : "-"}
                    {formatJours(Math.abs(ligne.joursInclus))} j
                  </span>
                </button>
                {ouverte && (
                  <div className="bg-surface-app px-3 pb-3">
                    <div className="animate-detail-fade-in">
                      <DetailCongePanel
                        selection={demande}
                        onClose={() => setDemandeOuverte(null)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
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
  const [selectionMouvement, setSelectionMouvement] = useState<SelectionMouvement | null>(null);

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

  const utilisateurSelection = selectionMouvement
    ? (comparaisons.find((c) => c.utilisateur.id === selectionMouvement.utilisateurId)?.utilisateur ??
      null)
    : null;
  const lignesSelection = selectionMouvement
    ? (collaborateurs
        .find((c) => c.utilisateur.id === selectionMouvement.utilisateurId)
        ?.lignes.filter((l) => typeBadgeDeDemande(l.demande) === selectionMouvement.code) ?? [])
    : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Soldes (25/08/2026) — indépendant de l'export : le solde CP/RTT
          calculé par l'app existe et vaut la peine d'être vérifié même avant
          transmission, contrairement au détail ligne par ligne ci-dessous
          qui n'a de sens qu'une fois un export réellement généré. Tableau
          resserré + panneau latéral (27/08/2026, voir `PanelJoursMouvement`)
          — la grille ne s'active que si un mouvement est sélectionné, pour
          ne pas gêner l'affichage quand le panneau est fermé. */}
      <div
        className={`grid grid-cols-1 items-start gap-5 ${selectionMouvement ? "xl:grid-cols-[minmax(0,560px)_24rem]" : ""}`}
      >
        <SectionSoldes
          comparaisons={comparaisons}
          periode={periode}
          selection={selectionMouvement}
          onSelect={(utilisateurId, code) =>
            setSelectionMouvement((prev) =>
              prev?.utilisateurId === utilisateurId && prev.code === code
                ? null
                : { utilisateurId, code },
            )
          }
        />
        {selectionMouvement && utilisateurSelection && (
          <PanelJoursMouvement
            key={`${selectionMouvement.utilisateurId}-${selectionMouvement.code}`}
            utilisateur={utilisateurSelection}
            code={selectionMouvement.code}
            lignes={lignesSelection}
            onClose={() => setSelectionMouvement(null)}
          />
        )}
      </div>

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
                            <div className="flex items-center gap-2 text-sm">
                              <TypeBadge
                                code={
                                  demande.type === "CP" && demande.isAnticipation
                                    ? "CPA"
                                    : (demande.type as TypeBadgeCode)
                                }
                                variant="pill"
                              />
                              <span className="text-ink-500">
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
