"use client";

import { useState, type CSSProperties } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import type { DemandeEquipe, LigneExportPaie } from "@/lib/types";
import { formatJours } from "@/lib/format";
import { useHistoriqueSolde } from "@/hooks/useHistoriqueSolde";
import { fetchDemandeParId } from "@/lib/data/demandes.repository";
import { fetchLignesTransmissionParDemande } from "@/lib/data/exportsPaie.repository";
import { ajouterAjustementSolde } from "@/lib/data/soldes.repository";
import {
  classeBordureTypeBadge,
  classeFondTypeBadge,
  classeTexteTypeBadge,
  TypeBadge,
  TypeBadgePillEnhanced,
} from "@/components/demandes/TypeBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";
import { DetailAjustementPanel } from "@/components/suivre/DetailAjustementPanel";

export type ModeSolde = "reel" | "theorique";
type CodeSoldeDetail = "CP" | "RTT" | "CPA";

// Nom de la variable CSS du token couleur du type — pour foncer une couleur
// déjà pâle (RTT/CPA en particulier) via `color-mix`, plutôt qu'une classe
// Tailwind figée par code (voir `MiniCalendrier.tsx` pour le même procédé).
const VAR_COULEUR: Record<CodeSoldeDetail, string> = {
  CP: "--color-cp",
  RTT: "--color-rtt",
  CPA: "--color-cpa",
};

// Classe `hover:bg-[...]` figée par code, PAS construite avec `${VAR_COULEUR[code]}`
// dans le crochet (20/08/2026, bug réel trouvé en debug) — Tailwind scanne le
// code source littéralement et ne peut pas résoudre une interpolation JS à
// l'intérieur d'une valeur arbitraire : la classe s'affichait bien dans le
// DOM mais sans aucune règle CSS générée, donc sans effet, quel que soit le
// cache. Même procédé que `ActiviteRecenteFeed.tsx`/`PoserDemandeModal.tsx`.
const HOVER_BG_CONGE: Record<CodeSoldeDetail, string> = {
  CP: "hover:bg-[color-mix(in_srgb,var(--color-cp)_15%,white)]",
  RTT: "hover:bg-[color-mix(in_srgb,var(--color-rtt)_15%,white)]",
  CPA: "hover:bg-[color-mix(in_srgb,var(--color-cpa)_15%,white)]",
};

interface SoldeDetailPanelProps {
  code: CodeSoldeDetail;
  utilisateurId: string;
  nomComplet: string;
  onClose: () => void;
  /** Bords arrondis (20/08/2026) — opt-in : utilisé pour la popin overlay
   * d'Accueil (`DashboardPage`), pas pour le docking latéral de "Suivre les
   * soldes" (vue manager, bords carrés contre le bord de l'écran). */
  arrondi?: boolean;
  /** Mode de solde initial (20/08/2026, revu le 27/08/2026) — Accueil (vue
   * salarié, "combien il me reste à poser") démarre sur "théorique". "Suivre
   * les soldes" (vue manager) transmet désormais le mode actuellement
   * sélectionné dans son propre sélecteur réel/théorique (par défaut
   * "théorique") — la popin doit s'ouvrir sur le même chiffre que celui
   * affiché dans le tableau, pas basculer silencieusement sur un autre mode
   * (confusion remontée par Vincent). Le réel/théorique reste bien sûr
   * togglable ensuite dans la popin, indépendamment du tableau. */
  modeParDefaut?: ModeSolde;
  /** En-tête simplifié (20/08/2026) — opt-in : Accueil (vue salarié, "mon
   * solde") remplace l'avatar + nom du collaborateur par le `TypeBadge` du
   * type de congé, le titre devient "Suivre mon solde" et le bandeau coloré
   * plein bord disparaît. "Suivre les soldes" (vue manager, qui a besoin de
   * savoir DE QUI il regarde le solde) garde l'en-tête complet par défaut. */
  headerSimplifie?: boolean;
  /** Détail de congé au clic sur une pill (20/08/2026) — opt-in : ouvre le
   * `DetailCongePanel` de la demande à droite, avec transition de largeur.
   * Seules les pills `type: "demande"` (pas "ajustement"/"acquisition", qui
   * n'ont pas de demande associée) sont cliquables. Expérimental, scopé à
   * Accueil pour l'instant — pas branché sur "Suivre les soldes" (vue
   * manager, docking déjà pris par la table de collaborateurs). */
  avecDetailConge?: boolean;
  /** "Ajuster le solde" (27/08/2026, repris de `PanelJoursMouvement` —
   * "Vérifier les fiches de paie") — opt-in, réservé à la vue manager
   * ("Suivre les soldes 2") : jamais sur Accueil (vue salarié, RLS
   * `ajustements_solde` réservée à l'admin de toute façon, mais l'action ne
   * doit même pas apparaître). Ajoute le lien/formulaire de régulation sous
   * le tableau, et rend les pills "ajustement" cliquables (ouvrent
   * `DetailAjustementPanel`, même mécanique que les pills "demande"). */
  avecAjustement?: boolean;
  /** Style additionnel sur le conteneur racine (27/08/2026, "Suivre les
   * soldes 2") — utilisé pour `marginTop`, calé dynamiquement sur la ligne
   * CP/RTT/CPA cliquée (même mécanique que `VerifierFichesPaiePage2`). */
  style?: CSSProperties;
  /** "Annuler cette demande" pour un admin (28/08/2026, "Suivre les soldes
   * 2") — opt-in, absent partout ailleurs (Accueil collaborateur a déjà son
   * propre "Annuler cette demande" via `/historique`). Signature avec
   * `demandeId` explicite car l'appelant ne connaît pas la demande ouverte
   * À L'INTÉRIEUR de ce panneau — c'est un état interne
   * (`demandeSelectionnee`), contrairement à `DetailCongePanel.onRetirer`
   * qui n'a besoin que du commentaire. */
  onRetirer?: (demandeId: string, commentaire: string) => Promise<void>;
  /** Autorise `onRetirer` même sur un congé déjà transmis en paie (28/08/2026,
   * admin uniquement) — transmis tel quel à `DetailCongePanel`. */
  peutAnnulerDejaTransmis?: boolean;
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
  arrondi = false,
  modeParDefaut = "reel",
  headerSimplifie = false,
  avecDetailConge = false,
  avecAjustement = false,
  style,
  onRetirer,
  peutAnnulerDejaTransmis = false,
}: SoldeDetailPanelProps) {
  const { historique, loading, error, refetch } = useHistoriqueSolde(utilisateurId, code);
  const [mode, setMode] = useState<ModeSolde>(modeParDefaut);
  // `idSelectionne` distinct de `demandeSelectionnee` (20/08/2026) — mis à
  // jour dès le clic, AVANT la résolution du fetch, pour savoir sous quelle
  // ligne afficher `DetailCongePanel` en mobile (y compris pendant le
  // chargement) sans attendre la réponse.
  const [idSelectionne, setIdSelectionne] = useState<string | null>(null);
  const [demandeSelectionnee, setDemandeSelectionnee] = useState<DemandeEquipe | null>(null);
  const [chargementDetail, setChargementDetail] = useState(false);
  // Lignes de transmission de la demande ouverte (28/08/2026, "Annuler cette
  // demande" pour admin) — nécessaire pour que `DetailCongePanel` sache si
  // une demande validée a déjà été transmise en paie (sinon toute demande
  // validée semblerait "non transmise").
  const [lignesTransmission, setLignesTransmission] = useState<LigneExportPaie[]>([]);
  // Ajustement sélectionné (27/08/2026, "Ajuster le solde") — pas de fetch
  // async ici contrairement à `demandeSelectionnee` : la donnée est déjà
  // entièrement dans `evenements` (m.motif/m.auteurNom), pas besoin d'un
  // aller-retour serveur comme pour une demande.
  const [ajustementSelectionne, setAjustementSelectionnee] = useState<{
    date: string;
    jours: number;
    motif: string;
    auteurNom: string;
  } | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [sens, setSens] = useState<"ajouter" | "retirer">("ajouter");
  const [montant, setMontant] = useState("");
  const [motifAjustement, setMotifAjustement] = useState("");
  const [envoiAjustement, setEnvoiAjustement] = useState(false);
  const [erreurAjustement, setErreurAjustement] = useState<string | null>(null);

  async function soumettreAjustement() {
    const valeur = Number(montant.replace(",", "."));
    if (!valeur || valeur <= 0) {
      setErreurAjustement("Indique un nombre de jours supérieur à 0.");
      return;
    }
    if (!motifAjustement.trim()) {
      setErreurAjustement("Un commentaire est requis.");
      return;
    }
    setEnvoiAjustement(true);
    setErreurAjustement(null);
    try {
      await ajouterAjustementSolde(utilisateurId, {
        code,
        deltaJours: sens === "retirer" ? -valeur : valeur,
        motif: motifAjustement.trim(),
      });
      setMontant("");
      setMotifAjustement("");
      setSens("ajouter");
      setFormulaireOuvert(false);
      refetch();
    } catch {
      setErreurAjustement("Impossible d'enregistrer l'ajustement.");
    } finally {
      setEnvoiAjustement(false);
    }
  }
  // Réel : mouvements réellement transmis en paie (`historique.mois`).
  // Théorique (27/08/2026, refonte du modèle) : TOUTES les demandes validées
  // (transmises ou non) via `mouvementsTheorique` — sinon les lignes
  // affichées ne totalisaient pas `soldeTheorique` (bug remonté par Vincent :
  // "Solde N-1 62j, -1j, -1j" mais "Solde actuel 45j", incohérent). CPA n'a
  // pas ce champ (hors scope) : on retombe sur `mois` dans ce cas.
  const evenements =
    mode === "theorique" && historique?.mouvementsTheorique
      ? historique.mouvementsTheorique
      : (historique?.mois.flatMap((m) => m.mouvements) ?? []);
  const enAttente = mode === "theorique" ? (historique?.enAttente ?? []) : [];
  const initiales = nomComplet
    .split(" ")
    .map((mot) => mot.charAt(0))
    .join("")
    .toUpperCase();
  const classeTexte = classeTexteTypeBadge(code);
  const classeBordure = classeBordureTypeBadge(code);
  const libelleDepart = code === "CP" ? "Solde N-1" : "Solde initial";
  const detailOuvert =
    chargementDetail || demandeSelectionnee !== null || ajustementSelectionne !== null;
  const onRetirerDemande =
    onRetirer && demandeSelectionnee
      ? (commentaire: string) => onRetirer(demandeSelectionnee.id, commentaire)
      : undefined;

  async function ouvrirDetail(id: string) {
    // `setDemandeSelectionnee(null)` avant le fetch (20/08/2026) — sinon,
    // en changeant de ligne pendant qu'une autre est déjà ouverte, l'ancien
    // contenu restait affiché (sous la NOUVELLE ligne, via `idSelectionne`
    // déjà à jour) le temps du fetch : flash de contenu incohérent avec la
    // ligne cliquée plutôt qu'un état "chargement" propre.
    setIdSelectionne(id);
    setDemandeSelectionnee(null);
    setAjustementSelectionnee(null);
    setLignesTransmission([]);
    setChargementDetail(true);
    try {
      const [demande, lignesParId] = await Promise.all([
        fetchDemandeParId(id),
        fetchLignesTransmissionParDemande([id]),
      ]);
      setDemandeSelectionnee(demande);
      setLignesTransmission(lignesParId[id] ?? []);
    } catch {
      setDemandeSelectionnee(null);
      setIdSelectionne(null);
    } finally {
      setChargementDetail(false);
    }
  }

  function ouvrirDetailAjustement(m: {
    id: string;
    date: string;
    jours: number;
    motif?: string;
    auteurNom?: string;
  }) {
    setDemandeSelectionnee(null);
    setChargementDetail(false);
    setIdSelectionne((prev) => (prev === m.id ? null : m.id));
    setAjustementSelectionnee((prev) =>
      prev && idSelectionne === m.id
        ? null
        : { date: m.date, jours: m.jours, motif: m.motif ?? "", auteurNom: m.auteurNom ?? "" },
    );
  }

  function fermerDetail() {
    setDemandeSelectionnee(null);
    setAjustementSelectionnee(null);
    setIdSelectionne(null);
  }

  // Ligne supplémentaire du tableau, mobile uniquement (`sm:hidden`, 20/08/2026
  // — "DetailCongePanel doit s'afficher sous la ligne qui le concerne plutôt
  // que sous le tableau" en dessous de `sm:`) : `DetailCongePanel` s'insère
  // directement sous la ligne cliquée via `colSpan`, au lieu d'apparaître en
  // colonne à droite (réservée à `sm:` et plus, voir plus bas).
  function ligneDetailMobile(id: string) {
    if (idSelectionne !== id) return null;
    if (!avecDetailConge && !ajustementSelectionne) return null;
    return (
      <tr key={`${id}-detail-mobile`} className="sm:hidden">
        <td colSpan={3} className="bg-surface-app px-3 py-3">
          {ajustementSelectionne ? (
            <div className="animate-detail-fade-in">
              <DetailAjustementPanel
                ajustement={{
                  code,
                  nomComplet,
                  deltaJours: ajustementSelectionne.jours,
                  date: ajustementSelectionne.date,
                  auteurNom: ajustementSelectionne.auteurNom,
                  motif: ajustementSelectionne.motif,
                }}
                onClose={fermerDetail}
                pleineLargeur
              />
            </div>
          ) : demandeSelectionnee ? (
            <div key={demandeSelectionnee.id} className="animate-detail-fade-in">
              <DetailCongePanel
                selection={demandeSelectionnee}
                onClose={fermerDetail}
                onRetirer={onRetirerDemande}
                peutAnnulerDejaTransmis={peutAnnulerDejaTransmis}
                lignesTransmission={lignesTransmission}
              />
            </div>
          ) : (
            <div className="bg-surface-card border-ink-300/60 text-ink-500 animate-detail-fade-in rounded-xl border p-8 text-center text-sm">
              Chargement…
            </div>
          )}
        </td>
      </tr>
    );
  }

  const headerJsx = (
    <div
      className={`flex items-center justify-between px-4 py-3 ${headerSimplifie ? "" : classeFondTypeBadge(code)}`}
    >
      <div className="flex items-center gap-2.5">
        {headerSimplifie ? (
          <>
            <TypeBadge code={code} />
            <div className="text-ink-900 text-base font-semibold">Suivre mon solde</div>
          </>
        ) : (
          <>
            <Avatar initiales={initiales} />
            <div>
              <div className="text-sm font-bold text-white">{nomComplet}</div>
              <div className="text-xs font-semibold text-white/80">Détail du solde {code}</div>
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className={`shrink-0 ${headerSimplifie ? "text-ink-500 hover:text-ink-900" : "text-white/70 hover:text-white"}`}
        aria-label="Fermer"
      >
        <X size={18} />
      </button>
    </div>
  );

  const bodyJsx = (
    <div className="border-ink-300/60 border-t">
      {loading || !historique ? (
        <div className="text-ink-500 py-8 text-center text-sm">Chargement…</div>
      ) : error ? (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 my-3 px-3 py-2.5 text-sm">
          {error}
        </div>
      ) : (
        // Hauteur plafonnée + scroll interne (20/08/2026) — un historique
        // avec beaucoup d'entrées ne doit pas faire grandir la popin à
        // l'infini. En `vh` plutôt qu'un px fixe (20/08/2026, demande
        // explicite) — proportionnel à la hauteur d'écran plutôt qu'une
        // valeur figée, pour rester cohérent sur petit comme grand écran.
        // En-tête de colonnes ET colonne "Solde" `sticky` (le reste du
        // tableau défile dessous/derrière) pour toujours garder le nom des
        // colonnes et le solde courant visibles pendant le scroll.
        <div className="max-h-[45vh] overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold tracking-wide uppercase">
                <th className="bg-surface-card sticky top-0 z-10 px-4 py-3">Événement</th>
                <th className="bg-surface-card sticky top-0 z-10 px-4 py-3 text-center">Jours</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3">
                  {/* "Solde N-1"/"Solde initial" dissocié visuellement des
                      pills de congé (20/08/2026, affordance pas évidente) :
                      bords carrés, fond plein couleur du type, pas de
                      bordure — contre le style contour arrondi des jours de
                      congé eux-mêmes juste en dessous. Pas d'effet de survol
                      (20/08/2026) : ce n'est pas une pill interactive, plutôt
                      un badge d'information — le survol impliquerait à tort
                      une affordance cliquable. */}
                  <span
                    className={`flex w-fit items-center px-2.5 py-1 text-sm font-semibold text-white ${classeFondTypeBadge(code)}`}
                  >
                    {`${libelleDepart} - ${formatJjMmAa(historique.soldeDepartDate)}`}
                  </span>
                </td>
                <td className="text-ink-900 px-4 py-3 text-center font-semibold">
                  {formatJours(historique.soldeDepart)} j
                </td>
              </tr>
              {evenements.map((m) => {
                const ajustementCliquable = avecAjustement && m.type === "ajustement";
                // `m.demandeId` (27/08/2026) — en mode réel, `m.id` est l'id
                // de la ligne `export_paie_lignes` (pas la demande, pour
                // éviter les collisions quand une demande génère plusieurs
                // lignes de transmission) : `fetchDemandeParId` a besoin de
                // l'id demande, pas de celui de la ligne — sans ce champ, le
                // détail d'un congé ne s'ouvrait jamais en mode réel (bug
                // remonté par Vincent : "la card de détail d'un congé ne
                // s'affiche pas").
                const idDemande = m.demandeId ?? m.id;
                const active =
                  (avecDetailConge && m.type === "demande" && idSelectionne === idDemande) ||
                  (ajustementCliquable && idSelectionne === m.id);
                // Acquisition (accrual mensuel RTT/CPA) dissociée comme
                // "Solde N-1" (20/08/2026, même affordance) : bords carrés,
                // fond plein couleur du type, pas de bordure, jamais
                // cliquable — un badge d'information, pas une pill. Ajustement
                // manuel (27/08/2026, "Pills regul = coins carré" — repris de
                // `PanelJoursMouvement`, "Vérifier les fiches de paie") :
                // contour + coins carrés (PAS `rounded-full` comme la pill
                // congé), cliquable + hover/état "on" quand `avecAjustement`.
                const carre = m.type === "acquisition" || m.type === "ajustement";
                const pill = (
                  <span
                    className={`flex w-fit items-center gap-1 px-2.5 py-1 font-semibold ${
                      m.type === "acquisition"
                        ? `text-sm ${classeFondTypeBadge(code)} text-white`
                        : m.type === "ajustement"
                          ? `border text-xs transition-[scale,background-color,filter] duration-200 ${
                              ajustementCliquable ? "hover:scale-105" : ""
                            } ${
                              active
                                ? `${classeFondTypeBadge(code)} border-transparent text-white hover:brightness-[0.85]`
                                : `bg-surface-card ${classeBordure} ${classeTexte}`
                            }`
                          : `rounded-full border text-xs transition-[scale,background-color,filter] duration-200 hover:scale-105 ${
                              active
                                ? `${classeFondTypeBadge(code)} border-transparent text-white hover:brightness-[0.85]`
                                : `bg-surface-app text-ink-900 ${classeBordure} ${HOVER_BG_CONGE[code]}`
                            }`
                    }`}
                  >
                    {m.type === "acquisition" ? (
                      <Plus size={10} className="shrink-0 text-white" />
                    ) : !carre ? (
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-white" : "bg-status-success-fg"}`}
                      />
                    ) : null}
                    {libelleEvenement(m)}
                  </span>
                );
                return [
                  <tr
                    key={m.id}
                    style={
                      active
                        ? {
                            backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR[code]}) 12%, white)`,
                          }
                        : undefined
                    }
                  >
                    <td className="px-4 py-3">
                      {avecDetailConge && m.type === "demande" ? (
                        <button type="button" onClick={() => ouvrirDetail(idDemande)}>
                          {pill}
                        </button>
                      ) : ajustementCliquable ? (
                        <button
                          type="button"
                          onClick={() =>
                            ouvrirDetailAjustement({
                              id: m.id,
                              date: m.date,
                              jours: m.jours,
                              motif: m.motif,
                              auteurNom: m.auteurNom,
                            })
                          }
                        >
                          {pill}
                        </button>
                      ) : (
                        pill
                      )}
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
                  </tr>,
                  ligneDetailMobile(m.type === "demande" ? idDemande : m.id),
                ];
              })}
              {enAttente.map((m) => {
                const active = avecDetailConge && idSelectionne === m.id;
                const pill = (
                  <span
                    className={`flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-[scale,background-color,filter] duration-200 hover:scale-105 ${
                      active
                        ? `${classeFondTypeBadge(code)} border-transparent text-white hover:brightness-[0.85]`
                        : `bg-surface-app text-ink-900 ${classeBordure} ${HOVER_BG_CONGE[code]}`
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-white" : "bg-status-warning-fg"}`}
                    />
                    {libelleEvenement(m)}
                  </span>
                );
                return [
                  <tr
                    key={m.id}
                    style={
                      active
                        ? {
                            backgroundColor: `color-mix(in srgb, var(${VAR_COULEUR[code]}) 12%, white)`,
                          }
                        : undefined
                    }
                  >
                    <td className="px-4 py-3">
                      {avecDetailConge ? (
                        <button type="button" onClick={() => ouvrirDetail(m.id)}>
                          {pill}
                        </button>
                      ) : (
                        pill
                      )}
                    </td>
                    <td className={`px-4 py-3 text-center font-semibold ${classeTexte}`}>
                      {formatJours(m.jours)} j
                    </td>
                  </tr>,
                  ligneDetailMobile(m.id),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* "Ajuster le solde" (27/08/2026, repris de `PanelJoursMouvement` —
          "Vérifier les fiches de paie") — réservé à `avecAjustement`
          (manager, "Suivre les soldes 2"), jamais sur Accueil. */}
      {avecAjustement &&
        (!formulaireOuvert ? (
          <button
            type="button"
            onClick={() => setFormulaireOuvert(true)}
            className="text-ink-500 hover:text-ink-900 border-ink-300/60 block w-full border-t px-4 py-2.5 text-left text-xs font-semibold underline decoration-dotted underline-offset-2"
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
              value={motifAjustement}
              onChange={(e) => setMotifAjustement(e.target.value)}
              rows={2}
              className="text-sm"
            />
            {erreurAjustement && (
              <p className="text-status-danger-fg text-xs">{erreurAjustement}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                onClick={() => {
                  setFormulaireOuvert(false);
                  setErreurAjustement(null);
                }}
              >
                Annuler
              </Button>
              <Button
                className="px-3 py-1.5 text-xs"
                disabled={envoiAjustement}
                onClick={soumettreAjustement}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        ))}

      {!loading && historique && !avecAjustement && (
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
  );

  const panneau = (
    <div
      style={style}
      className={`bg-surface-card w-full xl:sticky xl:top-4 xl:w-96 ${avecDetailConge ? "max-w-sm shrink-0" : "xl:shrink-0"} ${arrondi ? "overflow-hidden rounded-xl" : ""}`}
    >
      {headerJsx}
      {bodyJsx}
    </div>
  );

  if (!avecDetailConge && !avecAjustement) return panneau;

  // "Suivre les soldes 2" (27/08/2026, "ça ne doit pas être encapsulé dans
  // une popin, réfère-toi au fonctionnement exact de Vérifier les fiches de
  // paie 2") — reprend `PanelJoursMouvement` à l'identique : pas de bandeau
  // ("Détail du solde CP" redondant, le nom est déjà visible sur la card
  // cliquée juste à côté), pas de conteneur arrondi/ombre englobant (`bg-
  // surface-app rounded-2xl shadow-lg`, réservé à "Suivre mon solde" sur
  // Accueil) — juste la card tableau (`bg-surface-card shadow-sm`) et sa
  // colonne détail animée, à plat.
  if (avecAjustement) {
    return (
      <div
        className="flex items-stretch transition-[gap] duration-300 ease-in-out"
        style={{ ...style, gap: detailOuvert ? "5px" : "0px" }}
      >
        <div className="bg-surface-card w-72 shrink-0 overflow-hidden shadow-sm">{bodyJsx}</div>
        <div
          className={`overflow-hidden transition-[width] duration-300 ease-in-out ${detailOuvert ? "w-64" : "w-0"}`}
        >
          <div className="w-64">
            {ajustementSelectionne ? (
              <div className="animate-detail-fade-in">
                <DetailAjustementPanel
                  ajustement={{
                    code,
                    nomComplet,
                    deltaJours: ajustementSelectionne.jours,
                    date: ajustementSelectionne.date,
                    auteurNom: ajustementSelectionne.auteurNom,
                    motif: ajustementSelectionne.motif,
                  }}
                  onClose={fermerDetail}
                  pleineLargeur
                />
              </div>
            ) : demandeSelectionnee ? (
              <div key={demandeSelectionnee.id} className="animate-detail-fade-in">
                <DetailCongePanel
                  selection={demandeSelectionnee}
                  onClose={fermerDetail}
                  pleineLargeur
                  onRetirer={onRetirerDemande}
                  peutAnnulerDejaTransmis={peutAnnulerDejaTransmis}
                  lignesTransmission={lignesTransmission}
                />
              </div>
            ) : chargementDetail ? (
              <div className="bg-surface-card border-ink-300/60 text-ink-500 animate-detail-fade-in p-8 text-center text-sm">
                Chargement…
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Bandeau "Suivre mon solde" étiré sur toute la largeur de la popin
  // (20/08/2026, demande explicite) — sort de `panneau` pour devenir un
  // en-tête commun aux deux colonnes plutôt que cantonné à la colonne de
  // gauche ; les deux colonnes s'alignent alors naturellement sur le haut du
  // tableau juste en dessous, plus besoin d'un décalage manuel.
  //
  // Écart 20px entre le tableau et `DetailCongePanel` (20/08/2026, ramené de
  // 30 à 20px — valeur désormais RÉFÉRENCE pour tout affichage tableau +
  // panneau de détail, déjà celle utilisée par `gap-5` dans
  // `HistoriquePage`/`SuivreDemandesPage`/`SuivreSoldesPage`/`CongesPaiePage`,
  // qui câblent toutes un `DetailCongePanel` de la même façon — ce panneau-ci
  // était l'exception à corriger, pas l'inverse). Largeur de la colonne
  // détail animée en `width` (0 → 256px, calée sur le `xl:w-64` propre à
  // `DetailCongePanel` — un conteneur plus large aurait laissé un vide à
  // droite du panneau) plutôt que `auto`, seule valeur numérique
  // transitionnable en CSS ; `gap` anime avec, les deux à `duration-300` pour
  // rester perçus comme un seul mouvement.
  //
  // Card englobante (`bg-surface-card` + `rounded-2xl` + ombre) —
  // `DetailCongePanel` a ses propres cartes internes (bandeau bleu, etc.)
  // mais flottait EN DEHORS de la popin "Suivre mon solde" une fois ouvert ;
  // ce conteneur partagé les fait apparaître comme une seule et même popin.
  // Mobile (< `sm`, 20/08/2026, "sur mobile c'est inutilisable" — les deux
  // colonnes à largeur fixe px débordaient de l'écran, coupées par
  // l'`overflow-hidden` de la card englobante) : colonnes fixes en px
  // réservées à `sm:` et plus, en dessous tout repasse en `w-full` et les
  // deux blocs s'empilent (`flex-col`) au lieu de se placer côte à côte —
  // `DetailCongePanel` a de toute façon son propre `w-full` sous `xl:`.
  return (
    <div style={style} className="bg-surface-app overflow-hidden rounded-2xl shadow-lg">
      {headerJsx}
      <div
        className="flex flex-col items-stretch p-3 pr-3 transition-[gap] duration-300 ease-in-out sm:flex-row sm:items-start sm:pr-[15px]"
        style={{ gap: detailOuvert ? "20px" : "0px" }}
      >
        {/* Largeur fixe en px à partir de `sm:` (pas `max-w-sm` en %) — la
            card englobante n'a pas de largeur propre (elle s'ajuste au
            contenu), un pourcentage y résout en `auto`/taille intrinsèque du
            tableau plutôt que les 384px voulus, ce qui décalait tout le
            calcul de largeur de la popin (gouttière droite fausse une fois
            `DetailCongePanel` ouvert). `bg-surface-card` + `shadow-sm`
            propres (20/08/2026) — le fond de la popin est passé en gris
            (`bg-surface-app`, même fond que le reste de l'app), le tableau
            doit donc porter son propre fond blanc pour rester une card
            distincte plutôt que de devenir gris avec le reste. */}
        <div className="bg-surface-card w-full overflow-hidden rounded-xl shadow-sm sm:w-[384px] sm:shrink-0">
          {bodyJsx}
        </div>
        {/* `hidden sm:block` (20/08/2026) — sous `sm:`, `DetailCongePanel`
            s'affiche désormais inline sous la ligne concernée
            (`ligneDetailMobile`, dans le tableau) plutôt qu'ici en colonne à
            droite. */}
        <div
          className={`hidden overflow-hidden transition-[width] duration-300 ease-in-out sm:block ${
            detailOuvert ? "sm:w-[256px]" : "sm:w-0"
          }`}
        >
          <div className="sm:w-[256px]">
            {ajustementSelectionne ? (
              <div className="animate-detail-fade-in">
                <DetailAjustementPanel
                  ajustement={{
                    code,
                    nomComplet,
                    deltaJours: ajustementSelectionne.jours,
                    date: ajustementSelectionne.date,
                    auteurNom: ajustementSelectionne.auteurNom,
                    motif: ajustementSelectionne.motif,
                  }}
                  onClose={fermerDetail}
                  pleineLargeur
                />
              </div>
            ) : demandeSelectionnee ? (
              <div key={demandeSelectionnee.id} className="animate-detail-fade-in">
                <DetailCongePanel
                  selection={demandeSelectionnee}
                  onClose={fermerDetail}
                  onRetirer={onRetirerDemande}
                  peutAnnulerDejaTransmis={peutAnnulerDejaTransmis}
                  lignesTransmission={lignesTransmission}
                />
              </div>
            ) : chargementDetail ? (
              <div className="bg-surface-card border-ink-300/60 text-ink-500 animate-detail-fade-in rounded-xl border p-8 text-center text-sm">
                Chargement…
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
