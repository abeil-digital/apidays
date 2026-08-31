"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Plus, SquareSplitHorizontal } from "lucide-react";
import {
  fetchCheckFichesPaie,
  fetchComparaisonSoldes,
  type CheckFichePaieCollaborateur,
  type ComparaisonSoldeCollaborateur,
} from "@/lib/data/exportsPaie.repository";
import { ajouterAjustementSolde, fetchAjustementsSolde } from "@/lib/data/soldes.repository";
import { formatJours, formatPeriodePillNumerique } from "@/lib/format";
import type { DemandeEquipe, LigneExportPaie } from "@/lib/types";
import {
  classeBordureTypeBadge,
  classeFondActifTypeBadge,
  classeFondSurvolTypeBadge,
  classeFondTypeBadge,
  classeTexteTypeBadge,
  TypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";
import { DetailAjustementPanel } from "@/components/suivre/DetailAjustementPanel";

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

// Abrégés (28/08/2026, demande explicite) — seuls les mois dont le nom
// complet déborde des colonnes serrées de `CardSoldeCollaborateur` (75px) le
// sont ; les autres (juin, juillet, août, mai...) restent en toutes lettres.
const MOIS_ABREGES: Record<number, string> = {
  8: "sept.",
  9: "oct.",
  10: "nov.",
  11: "déc.",
};

/** Nom du mois en toutes lettres (ex. "juillet"), abrégé pour les mois trop
 * longs (`MOIS_ABREGES`) — colonnes "Solde <mois>" de `SectionSoldes`
 * (27/08/2026, demande explicite : remplacer les libellés génériques "Mois
 * précédent"/"Mois en cours" par le nom réel du mois). */
function nomMois(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const abrege = MOIS_ABREGES[date.getUTCMonth()];
  if (abrege) return abrege;
  return new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(date);
}

function moisPrecedentIso(periodeDebutIso: string): string {
  const d = new Date(`${periodeDebutIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** "Acquisition {mois} {année}" (27/08/2026) — même libellé que
 * `formatMoisAnnee` de `soldes.repository.ts` (non exporté, réécrit ici). */
function nomMoisAnnee(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(`${dateIso}T00:00:00Z`),
  );
}

/** "31/08" — libellé court de la date d'un ajustement manuel (27/08/2026),
 * même format que `formatJjMm` de `SoldeDetailPanel.tsx` (non exporté). */
function formatJjMmAjustement(dateIso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(
    new Date(`${dateIso}T00:00:00Z`),
  );
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
 * Card "Soldes" d'un collaborateur (27/08/2026, demande explicite — "on va
 * faire une card par employé au lieu du tableau global") : mini-tableau
 * CP/RTT/CPA propre à ce collaborateur, header avec avatar + nom (remplace
 * la colonne "Collaborateur"/`rowSpan` de l'ancien tableau unique). Une card
 * par collaborateur actif plutôt qu'une seule table géante.
 *
 * Colonnes nommées par le mois réel (27/08/2026, "Solde juillet"/"Solde
 * août" plutôt que "Mois précédent"/"Mois en cours" génériques) —
 * `nomMois`/`moisPrecedentIso`, dérivés de `periode.debut`.
 *
 * "Mouvement" cliquable (27/08/2026, revu le même jour — retour au
 * dispositif en cascade : tableau → clic sur un mouvement → liste des
 * événements du mois → clic sur un événement → son feed) : ouvre
 * `PanelJoursMouvement` (voir plus bas), remplace la colonne "Jours" inline
 * qui s'est révélée illisible/cassée une fois combinée au clic vers le feed
 * ("c'est affreux").
 */
function CardSoldeCollaborateur({
  c,
  periode,
  selection,
  onSelect,
}: {
  c: ComparaisonSoldeCollaborateur;
  periode: { debut: string; fin: string };
  selection: SelectionMouvement | null;
  onSelect: (utilisateurId: string, code: TypeBadgeCode) => void;
}) {
  const libelleMoisPrecedent = nomMois(moisPrecedentIso(periode.debut));
  const libelleMoisEnCours = nomMois(periode.debut);

  return (
    <div className="flex w-fit flex-col">
      <div className="text-ink-500 flex w-fit items-stretch text-xs font-semibold tracking-wide uppercase">
        <div className="w-[150px] shrink-0" />
        <div className="grid flex-1 grid-cols-[4.5rem_75px_75px_75px_90px]">
          <span className="px-4 py-2" />
          <span className="px-2 py-2 text-center">{libelleMoisPrecedent}</span>
          <span className="px-2 py-2 text-center">{libelleMoisEnCours}</span>
          <span className="px-2 py-2 text-center">Mvt</span>
          <span className="px-2 py-2 text-center">En paie</span>
        </div>
      </div>
      <div
        data-carte-collaborateur={c.utilisateur.id}
        className="bg-surface-card flex w-fit items-stretch overflow-hidden shadow-sm"
      >
        <div className="border-ink-300/60 flex w-[150px] shrink-0 flex-col items-start justify-center gap-1 border-r px-3 py-3 text-left">
          <Avatar initiales={`${c.utilisateur.prenom[0]}${c.utilisateur.nom[0]}`.toUpperCase()} />
          <span className="text-ink-900 text-base font-semibold">{c.utilisateur.prenom}</span>
          <span className="text-ink-900 text-base font-semibold">{c.utilisateur.nom}</span>
        </div>
        <div className="flex-1">
          {TYPES_SOLDE.map((code) => {
            const categorie = categorieSolde(c, code);
            const active = selection?.utilisateurId === c.utilisateur.id && selection.code === code;
            return (
              <button
                type="button"
                key={code}
                data-mouvement-row={`${c.utilisateur.id}:${code}`}
                onClick={() => onSelect(c.utilisateur.id, code)}
                className={`border-ink-300/60 grid w-full grid-cols-[4.5rem_75px_75px_75px_90px] items-center border-b text-left transition-colors duration-150 last:border-b-0 ${active ? classeFondActifTypeBadge(code) : classeFondSurvolTypeBadge(code)}`}
              >
                <div className={`px-4 py-2.5 text-sm font-bold ${classeTexteTypeBadge(code)}`}>
                  {code}
                </div>
                <div
                  className={`px-2 py-2.5 text-center text-sm font-bold ${classeTexteTypeBadge(code)}`}
                >
                  {formatJours(categorie.moisPrecedent)} j
                </div>
                <div className="px-2 py-2.5 text-center">
                  <TypeBadge
                    code={code}
                    variant="pill"
                    label={`${formatJours(categorie.moisEnCours)} j`}
                  />
                </div>
                <div className="px-2 py-2.5 text-center">
                  <span
                    className={`rounded-control text-xs font-bold underline decoration-dotted underline-offset-2 ${classeTexteTypeBadge(code)}`}
                  >
                    {formatMouvement(categorie.moisEnCours - categorie.moisPrecedent)} j
                  </span>
                </div>
                <div className="px-2 py-2.5 text-center">
                  <span className="text-status-success-fg inline-flex items-center gap-1 text-sm font-semibold">
                    <Check size={14} />
                    ok
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Titre "Soldes réels" — affiché une seule fois, pleine largeur, au-dessus
 * de la liste des cards (27/08/2026). Intitulés de colonnes repris dans le
 * header de chaque card (28/08/2026, style "Suivre les soldes 2").
 */
function EnTeteSoldes() {
  return <h2 className="text-ink-900 mb-2 px-1 text-sm font-bold">Soldes réels</h2>;
}

/**
 * Panneau "liste des événements" du mouvement cliqué (27/08/2026, dispositif
 * en cascade repris de la référence "Suivre les soldes"/`SoldeDetailPanel`) :
 * colonnes ÉVÉNEMENT / JOURS / SOLDE — solde recalculé de façon cumulative
 * événement après événement, en partant de `soldeDepart` (pas de colonne
 * "Type" ici, déjà porté par la bannière colorée). Clic sur un événement →
 * 3e colonne, animée en largeur (0 → 256px), avec le feed complet
 * (`DetailCongePanel`) de la demande — même principe d'empilement que
 * `SoldeDetailPanel` ("Suivre mon solde").
 *
 * "Jours" ET "événements" : les jours viennent de `export_paie_lignes` (déjà
 * fetchés par `fetchCheckFichesPaie`) ; l'acquisition RTT/CPA n'a pas de
 * ligne dédiée — déduite par résidu (`mouvementTotal` − somme des jours de
 * ligne).
 */
function PanelJoursMouvement({
  code,
  periode,
  soldeDepart,
  mouvementTotal,
  lignes,
  topOffset,
  utilisateurId,
  nomComplet,
  onAjustementCree,
}: {
  code: TypeBadgeCode;
  periode: { debut: string; fin: string };
  soldeDepart: number;
  mouvementTotal: number;
  lignes: { ligne: LigneExportPaie; demande: DemandeEquipe }[];
  topOffset: number;
  utilisateurId: string;
  nomComplet: string;
  onAjustementCree: () => void;
}) {
  const [demandeOuverte, setDemandeOuverte] = useState<DemandeEquipe | null>(null);
  const [ajustementOuvert, setAjustementOuvert] = useState<{
    id: string;
    deltaJours: number;
    motif: string;
    date: string;
    auteurNom: string;
  } | null>(null);
  const libelleMoisPrecedent = `Solde ${nomMois(moisPrecedentIso(periode.debut))}`;

  const sommeJoursLignes = lignes.reduce((somme, { ligne }) => somme - ligne.joursInclus, 0);
  const acquisition = Math.round((mouvementTotal - sommeJoursLignes) * 100) / 100;

  // Ajustements manuels (27/08/2026, "Ajuster le solde") — chargés à part
  // (pas dans `lignes`, propres à `export_paie_lignes`) : refetchés au
  // montage et après chaque création, pour rester à jour sans dépendre du
  // refresh (souvent différé) des données parent.
  // `code` est toujours CP/RTT/CPA ici (voir `TYPES_SOLDE`) — TypeBadgeCode
  // couvre aussi CSS/CE/etc., hors du périmètre de l'ajustement manuel.
  const codeAjustement = code as "CP" | "RTT" | "CPA";

  const [ajustements, setAjustements] = useState<
    { id: string; deltaJours: number; motif: string; date: string; auteurNom: string }[]
  >([]);
  useEffect(() => {
    let cancelled = false;
    fetchAjustementsSolde(utilisateurId, codeAjustement, periode).then((data) => {
      if (!cancelled) setAjustements(data);
    });
    return () => {
      cancelled = true;
    };
  }, [utilisateurId, codeAjustement, periode]);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [sens, setSens] = useState<"ajouter" | "retirer">("ajouter");
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettreAjustement() {
    const valeur = Number(montant.replace(",", "."));
    if (!valeur || valeur <= 0) {
      setErreur("Indique un nombre de jours supérieur à 0.");
      return;
    }
    if (!motif.trim()) {
      setErreur("Un commentaire est requis.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await ajouterAjustementSolde(utilisateurId, {
        code: codeAjustement,
        deltaJours: sens === "retirer" ? -valeur : valeur,
        motif: motif.trim(),
      });
      setMontant("");
      setMotif("");
      setSens("ajouter");
      setFormulaireOuvert(false);
      const data = await fetchAjustementsSolde(utilisateurId, codeAjustement, periode);
      setAjustements(data);
      onAjustementCree();
    } catch {
      setErreur("Impossible d'enregistrer l'ajustement.");
    } finally {
      setEnvoi(false);
    }
  }

  const aucunEvenement = lignes.length === 0 && acquisition === 0 && ajustements.length === 0;

  return (
    // Position initiale calée sur le bord haut de la CARD du collaborateur
    // cliqué (27/08/2026, demande explicite) — `marginTop` (pas `top`) : un
    // `top` sticky ne prend effet QU'AU SCROLL (comparé au bord de
    // l'ancêtre scrollable, pas au conteneur de la grille) et ne repositionne
    // donc rien tant que la page n'a pas défilé — d'où le bug "ça ne
    // s'aligne pas" malgré un calcul d'offset correct. `marginTop` pousse
    // réellement le panneau en flux, aligné dès l'affichage ; `xl:top-4`
    // (16px) reste sur le `sticky` pour garder le panneau visible une fois
    // qu'on scrolle plus bas que sa position initiale.
    <div
      className="flex items-stretch transition-[gap] duration-300 ease-in-out xl:sticky xl:top-4 xl:shrink-0"
      style={{ gap: demandeOuverte ? "5px" : "0px", marginTop: topOffset }}
    >
      <div className="bg-surface-card w-72 shrink-0 overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
              <th className="px-4 py-2">Événement</th>
              <th className="px-2 py-2 text-center">Jours</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-ink-300/60 border-b">
              <td className="px-4 py-2.5">
                <span
                  className={`flex w-fit items-center px-2.5 py-1 text-xs font-semibold text-white ${classeFondTypeBadge(code)}`}
                >
                  {libelleMoisPrecedent}
                </span>
              </td>
              <td className="text-ink-900 px-2 py-2.5 text-center font-semibold">
                {formatJours(soldeDepart)} j
              </td>
            </tr>
            {lignes.map(({ ligne, demande }) => {
              const active = demandeOuverte?.id === demande.id;
              return (
                <tr key={ligne.id} className="border-ink-300/60 border-b last:border-b-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAjustementOuvert(null);
                          setDemandeOuverte(active ? null : demande);
                        }}
                        className={`flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-[scale,background-color] duration-200 hover:scale-105 ${
                          active
                            ? `${classeFondTypeBadge(code)} border-transparent text-white`
                            : `${classeBordureTypeBadge(code)} bg-surface-app text-ink-900`
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-white" : "bg-status-success-fg"}`}
                        />
                        {formatPeriodePillNumerique(demande.debut, demande.fin)}
                      </button>
                      {demande.fin > periode.fin && (
                        <span
                          title="Transmission partielle"
                          className="bg-status-warning-fg flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full"
                        >
                          <SquareSplitHorizontal
                            size={10}
                            strokeWidth={2.5}
                            className="text-white"
                          />
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className={`px-2 py-2.5 text-center font-semibold ${classeTexteTypeBadge(code)}`}
                  >
                    {ligne.joursInclus < 0 ? "+" : "-"}
                    {formatJours(Math.abs(ligne.joursInclus))}
                  </td>
                </tr>
              );
            })}
            {acquisition !== 0 && (
              <tr className="border-ink-300/60 border-b last:border-b-0">
                <td className="px-4 py-2.5">
                  <span
                    className={`flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white ${classeFondTypeBadge(code)}`}
                  >
                    <Plus size={10} className="shrink-0 text-white" />
                    Acquisition {nomMoisAnnee(periode.debut)}
                  </span>
                </td>
                <td
                  className={`px-2 py-2.5 text-center font-semibold ${classeTexteTypeBadge(code)}`}
                >
                  {acquisition > 0 ? "+" : ""}
                  {formatJours(acquisition)}
                </td>
              </tr>
            )}
            {ajustements.map((a) => {
              const active = ajustementOuvert?.id === a.id;
              return (
                <tr key={a.id} className="border-ink-300/60 border-b last:border-b-0">
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      title={a.motif}
                      onClick={() => {
                        setDemandeOuverte(null);
                        setAjustementOuvert(active ? null : a);
                      }}
                      className={`flex w-fit items-center gap-1 border px-2.5 py-1 text-xs font-semibold transition-[scale,background-color] duration-200 hover:scale-105 ${
                        active
                          ? `${classeFondTypeBadge(code)} border-transparent text-white`
                          : `bg-surface-card ${classeBordureTypeBadge(code)} ${classeTexteTypeBadge(code)}`
                      }`}
                    >
                      Régul ({formatJjMmAjustement(a.date)})
                    </button>
                  </td>
                  <td
                    className={`px-2 py-2.5 text-center font-semibold ${classeTexteTypeBadge(code)}`}
                  >
                    {a.deltaJours > 0 ? "+" : ""}
                    {formatJours(a.deltaJours)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {aucunEvenement && <EmptyRow text="Aucun jour ni acquisition sur cette période." />}
        {!formulaireOuvert ? (
          <button
            type="button"
            onClick={() => setFormulaireOuvert(true)}
            className="text-ink-500 hover:text-ink-900 block w-full px-4 py-2.5 text-left text-xs font-semibold underline decoration-dotted underline-offset-2"
          >
            Ajuster le solde
          </button>
        ) : (
          <div className="border-ink-300/60 flex flex-col gap-2 border-t px-4 py-3">
            <div className="flex gap-3 text-xs font-semibold">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={sens === "ajouter"}
                  onChange={() => setSens("ajouter")}
                />
                Ajouter
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={sens === "retirer"}
                  onChange={() => setSens("retirer")}
                />
                Retirer
              </label>
            </div>
            <Input
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              placeholder="Nombre de jours"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="text-sm"
            />
            <Textarea
              placeholder="Commentaire"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={2}
              className="text-sm"
            />
            {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                onClick={() => {
                  setFormulaireOuvert(false);
                  setErreur(null);
                }}
              >
                Annuler
              </Button>
              <Button
                className="px-3 py-1.5 text-xs"
                disabled={envoi}
                onClick={soumettreAjustement}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </div>
      <div
        className={`overflow-hidden transition-[width] duration-300 ease-in-out ${demandeOuverte || ajustementOuvert ? "w-64" : "w-0"}`}
      >
        <div className="w-64">
          {demandeOuverte && (
            <div key={demandeOuverte.id} className="animate-detail-fade-in">
              <DetailCongePanel
                selection={demandeOuverte}
                onClose={() => setDemandeOuverte(null)}
                pleineLargeur
              />
            </div>
          )}
          {ajustementOuvert && (
            <div key={ajustementOuvert.id} className="animate-detail-fade-in">
              <DetailAjustementPanel
                ajustement={{
                  code: codeAjustement,
                  nomComplet,
                  deltaJours: ajustementOuvert.deltaJours,
                  date: ajustementOuvert.date,
                  auteurNom: ajustementOuvert.auteurNom,
                  motif: ajustementOuvert.motif,
                }}
                onClose={() => setAjustementOuvert(null)}
                pleineLargeur
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Duplication expérimentale de `VerifierFichesPaiePage` (27/08/2026, demande
 * explicite de Vincent — "on va bosser sur l'UI du truc et la logique
 * globale", point de départ : dupliquer la page pour itérer sans risquer de
 * casser la version utilisée pour la vraie vérification de paie). Câblée à
 * la place de l'originale sur l'onglet "Vérifier les fiches de paie" (voir
 * `TransmissionsPaiePage.tsx`) — l'original reste dans `VerifierFichesPaiePage.tsx`,
 * non branché, comme référence/point de retour en cas de besoin.
 */
export function VerifierFichesPaiePage2({
  exportId,
  periode,
}: {
  exportId: string | null;
  periode: { debut: string; fin: string };
}) {
  const [collaborateurs, setCollaborateurs] = useState<CheckFichePaieCollaborateur[]>([]);
  const [comparaisons, setComparaisons] = useState<ComparaisonSoldeCollaborateur[]>([]);
  // `loadingComparaisons` (27/08/2026, "chargement progressif") — distingue
  // "pas encore chargé" de "vraiment aucun collaborateur actif" : sans ça,
  // `comparaisons` démarre à `[]` et affiche un flash "Aucun collaborateur
  // actif." avant que le premier fetch ne résolve (signalé par Vincent).
  const [loadingComparaisons, setLoadingComparaisons] = useState(true);
  const [selectionMouvement, setSelectionMouvement] = useState<SelectionMouvement | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [panelTop, setPanelTop] = useState(0);

  // Panneau calé sur le bord haut de la CARD du collaborateur cliqué, pas en
  // haut de la liste de cards (27/08/2026, demande explicite, revu deux fois
  // le même jour — d'abord calé sur la ligne CP/RTT/CPA elle-même, puis sur
  // la card entière) — mesuré via `data-carte-collaborateur`. Appliqué en
  // `marginTop` (voir `PanelJoursMouvement`), pas en `top` sticky : un `top`
  // sticky ne repositionne rien tant qu'on n'a pas scrollé.
  useLayoutEffect(() => {
    if (!selectionMouvement || !cardsRef.current) {
      setPanelTop(0);
      return;
    }
    const carte = cardsRef.current.querySelector(
      `[data-carte-collaborateur="${selectionMouvement.utilisateurId}"]`,
    );
    if (!carte) return;
    const carteRect = carte.getBoundingClientRect();
    const containerRect = cardsRef.current.getBoundingClientRect();
    setPanelTop(carteRect.top - containerRect.top);
  }, [selectionMouvement, comparaisons]);

  // Scroll auto en transition (27/08/2026, demande explicite) — au clic sur
  // un mouvement, la card+panneau ne sont pas forcément visibles (liste
  // longue) : on scrolle la card cliquée dans le viewport, en douceur.
  // Dépend uniquement de `selectionMouvement` (pas de `comparaisons`) pour ne
  // scroller qu'au clic, pas à chaque rafraîchissement des données.
  useEffect(() => {
    if (!selectionMouvement || !cardsRef.current) return;
    const carte = cardsRef.current.querySelector(
      `[data-carte-collaborateur="${selectionMouvement.utilisateurId}"]`,
    );
    carte?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectionMouvement]);

  useEffect(() => {
    let cancelled = false;
    fetchComparaisonSoldes(periode, exportId).then((data) => {
      if (!cancelled) {
        setComparaisons(data);
        setLoadingComparaisons(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [periode, exportId]);

  useEffect(() => {
    let cancelled = false;
    const promise = exportId ? fetchCheckFichesPaie(exportId) : Promise.resolve([]);
    promise.then((data) => {
      if (!cancelled) setCollaborateurs(data);
    });
    return () => {
      cancelled = true;
    };
  }, [exportId]);

  // Rafraîchit "Solde {mois}"/"Mouvement" après un ajustement manuel
  // (27/08/2026) — l'ajustement modifie le solde réel calculé, pas juste la
  // liste des événements de la popin.
  function rafraichirDonnees() {
    fetchComparaisonSoldes(periode, exportId).then(setComparaisons);
  }

  const comparaisonSelection = selectionMouvement
    ? (comparaisons.find((c) => c.utilisateur.id === selectionMouvement.utilisateurId) ?? null)
    : null;
  const categorieSelection =
    comparaisonSelection && selectionMouvement
      ? categorieSolde(comparaisonSelection, selectionMouvement.code)
      : null;
  const lignesSelection = selectionMouvement
    ? (collaborateurs
        .find((c) => c.utilisateur.id === selectionMouvement.utilisateurId)
        ?.lignes.filter((l) => typeBadgeDeDemande(l.demande) === selectionMouvement.code) ?? [])
    : [];

  return (
    <div className="flex flex-col gap-3">
      {loadingComparaisons ? (
        <div className="bg-surface-card w-full shadow-sm">
          <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
        </div>
      ) : comparaisons.length === 0 ? (
        <div className="bg-surface-card w-full shadow-sm">
          <EmptyRow text="Aucun collaborateur actif." />
        </div>
      ) : (
        <>
          <EnTeteSoldes />
          <div
            className={`animate-stagger-in grid grid-cols-1 items-start gap-[5px] ${selectionMouvement ? "xl:grid-cols-[max-content_max-content]" : ""}`}
          >
            <div ref={cardsRef} className="flex min-w-0 flex-col gap-3">
              {comparaisons.map((c) => (
                <CardSoldeCollaborateur
                  key={c.utilisateur.id}
                  c={c}
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
              ))}
            </div>
            {selectionMouvement && categorieSelection && (
              <PanelJoursMouvement
                key={`${selectionMouvement.utilisateurId}-${selectionMouvement.code}`}
                code={selectionMouvement.code}
                periode={periode}
                soldeDepart={categorieSelection.moisPrecedent}
                mouvementTotal={categorieSelection.moisEnCours - categorieSelection.moisPrecedent}
                lignes={lignesSelection}
                topOffset={panelTop}
                utilisateurId={selectionMouvement.utilisateurId}
                nomComplet={`${comparaisonSelection?.utilisateur.prenom ?? ""} ${comparaisonSelection?.utilisateur.nom ?? ""}`.trim()}
                onAjustementCree={rafraichirDonnees}
              />
            )}
          </div>
        </>
      )}
      {/* Bandeau sticky global + CTA "Valider" (27/08/2026, demande
          explicite) — même convention que le bandeau sticky bas de
          `TransmissionsPaiePage`/`CongesPaiePage` (card blanche, ombre vers
          le haut, bouton plein à droite). Action réelle pas encore tranchée
          (discussion en pause avec Vincent : "on valide par défaut... on
          signifie une erreur") — bouton câblé à vide pour l'instant, pure
          conception d'interface. */}
      <div className="bg-surface-card border-ink-300/60 sticky bottom-0 z-10 flex items-center justify-between gap-4 rounded-xl border-t px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <span className="text-ink-500 text-sm">
          {comparaisons.length} collaborateur{comparaisons.length > 1 ? "s" : ""} vérifié
          {comparaisons.length > 1 ? "s" : ""}
        </span>
        <Button className="rounded-full px-5 py-2.5 text-sm">
          <Check size={16} />
          Valider
        </Button>
      </div>
    </div>
  );
}
