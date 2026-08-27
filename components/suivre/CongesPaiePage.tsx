"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Download, SquareSplitHorizontal } from "lucide-react";
import type { CongeATransmettre, DemandeEquipe, LigneExportPaie, StatutDemande } from "@/lib/types";
import { formatJours, formatPeriodePillNumerique } from "@/lib/format";
import { periodePaieParDefaut } from "@/lib/periodePaie";
import { useCongesConsommes } from "@/hooks/useCongesConsommes";
import {
  refuserDemande,
  regulariserDemande,
  remettreEnAttenteDemande,
  validerDemande,
} from "@/lib/data/demandes.repository";
import {
  calculerJoursATransmettreMaintenant,
  fetchCheckFichesPaie,
  fetchLignesTransmissionParDemande,
} from "@/lib/data/exportsPaie.repository";
import { classeBordureTypeBadge } from "@/components/demandes/TypeBadge";
import { fetchAjustementsEquipe, type AjustementEquipe } from "@/lib/data/soldes.repository";
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

/**
 * Période affichée, bornée à la période en cours (25/08/2026, "on affiche
 * dans le tableau export que les jours pris en compte" — Vincent, exemple
 * donné : un congé du 31/08 au 11/09 doit afficher "31/08" en août, pas
 * "31/08 au 11/09/26"). Ne borne QUE la fin, quand elle dépasse la période
 * (même condition que `estACheval`) — jamais le début : un congé de
 * repêchage/correction démarre par définition avant la période (`d.fin <
 * debutPeriode`), le borner produirait un intervalle inversé (bug constaté :
 * "01/08 au 30/07/26"). Le détail complet (`DetailCongePanel`) continue
 * d'utiliser `selection.debut`/`fin`, jamais cette version tronquée.
 */
function libellePeriodeAffichee(d: DemandeEquipe, finPeriode: string): string {
  const finAffiche = d.fin > finPeriode ? finPeriode : d.fin;
  return formatPeriodePillNumerique(d.debut, finAffiche);
}

interface DatePeriode {
  id: string;
  label: string;
  statut: StatutDemande;
  /** Congé "à cheval" sur cette période et la suivante (25/08/2026, demande
   * explicite) — le reste du congé sera transmis sur un futur export, pas
   * celui-ci. Affiché via une pastille ronde orange dédiée à côté de la date
   * (`SquareSplitHorizontal`), en plus du libellé de date déjà borné à la
   * période (`libellePeriodeAffichee`) et du chiffre en tête de colonne déjà
   * limité aux jours comptés. */
  aCheval: boolean;
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
// jours refusés restent visibles pour la traçabilité, mais ne comptent pas —
// un refus n'a jamais été un congé réellement accordé.
//
// `joursPour` (25/08/2026) — par défaut la durée totale de la demande
// (`nbDemiJournees / 2`). En mode `sourceTransmission` (voir
// `CongesPaiePage`), les demandes reçues sont des `CongeATransmettre` : un
// congé à cheval sur deux périodes déjà partiellement transmis ne doit
// compter QUE la portion effectivement prise en compte pour cette
// transmission (`joursATransmettreParId`, positif ou négatif pour une
// correction), pas sa durée totale ni le solde complet — sinon les jours
// déjà transmis lors d'un export précédent seraient recomptés en double
// dans ce récap/CSV (bug signalé le 25/08/2026). Le détail complet de la
// demande (période entière, solde avant/après) reste visible dans
// `DetailCongePanel`, ouvert au clic sur une pastille de date — seul ce
// tableau se limite aux jours comptés.
//
// `inclureAnnuleDansTotal` (25/08/2026) — un congé "annulé" ne compte
// normalement pas dans le total (cas par défaut, ci-dessus). Exception :
// le tableau "Congés passés en paye mais annulés" (`CongesPaiePage`)
// regroupe justement des demandes 100% annulées, dont le `joursPour` renvoie
// la correction négative à transmettre — sans cette option, leur total
// resterait à 0 (exclu par la même règle), la ligne comme les dates
// resteraient affichées mais vides de jours.
function grouperParCollaborateur(
  demandes: DemandeEquipe[],
  joursPour: (d: DemandeEquipe) => number = (d) => d.nbDemiJournees / 2,
  inclureAnnuleDansTotal = false,
  estACheval: (d: DemandeEquipe) => boolean = () => false,
  libelle: (d: DemandeEquipe) => string = libellePeriodeDemande,
): LigneCollab[] {
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
    if (d.statut !== "refusé" && (inclureAnnuleDansTotal || d.statut !== "annulé")) {
      ligne.parType[bucket].jours += joursPour(d);
    }
    ligne.parType[bucket].dates.push({
      id: d.id,
      label: libelle(d),
      statut: d.statut,
      aCheval: estACheval(d),
    });
  }

  return [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

/**
 * Même regroupement que `grouperParCollaborateur`, mais pour les
 * régularisations manuelles (27/08/2026, "Ajuster le solde") — pas des
 * `DemandeEquipe` (pas de statut de validation), `statut: "validé"` fixe pour
 * un point vert (une régularisation est un fait acquis, jamais "en attente"/
 * "refusé"). Pas de notion "à cheval" ni de détail associé (pas de
 * `DetailCongePanel` pour un ajustement) : `onSelect` de
 * `TableauCollaborateurType` reste un no-op pour ce tableau, voir l'appelant.
 */
function grouperAjustementsParCollaborateur(ajustements: AjustementEquipe[]): LigneCollab[] {
  const parId = new Map<string, LigneCollab>();

  for (const a of ajustements) {
    if (!parId.has(a.utilisateurId)) {
      const [prenom = "", nom = ""] = a.nomComplet.split(" ");
      parId.set(a.utilisateurId, {
        id: a.utilisateurId,
        nom: a.nomComplet,
        initiales: `${prenom[0] ?? ""}${nom[0] ?? ""}`.toUpperCase(),
        parType: ligneVide(),
      });
    }
    const ligne = parId.get(a.utilisateurId)!;
    ligne.parType[a.code].jours += a.deltaJours;
    ligne.parType[a.code].dates.push({
      id: a.id,
      label: `Régul (${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(`${a.date}T00:00:00Z`))})`,
      statut: "validé",
      aCheval: false,
    });
  }

  return [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

/**
 * Grille collaborateur × type — même rendu pour les 3 tableaux de
 * "Générer l'export" (25/08/2026, demande explicite : "les tableaux 2 et 3
 * doivent prendre le même format que le tableau 1"). `c.jours` (déjà
 * calculé en amont par `grouperParCollaborateur`) reflète uniquement la
 * portion effectivement prise en compte pour cette transmission — jamais la
 * durée totale d'un congé à cheval ; le détail complet de la demande reste
 * à un clic, via `DetailCongePanel`.
 */
function TableauCollaborateurType({
  lignes,
  selectionId,
  onSelect,
  enCours,
  emptyText,
}: {
  lignes: LigneCollab[];
  selectionId: string | null;
  onSelect: (id: string) => void;
  enCours: boolean;
  emptyText: string;
}) {
  if (lignes.length === 0) return <EmptyRow text={emptyText} />;

  return (
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
                          {c.jours !== 0 ? `${formatJours(c.jours)} j` : ""}
                        </span>
                        <div className="flex flex-col gap-1">
                          {c.dates.map((date, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onSelect(date.id)}
                                disabled={enCours}
                                title={date.aCheval ? "Transmission partielle" : undefined}
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
                              {date.aCheval && (
                                <span
                                  title="Transmission partielle"
                                  className="bg-status-warning-fg flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full"
                                >
                                  <SquareSplitHorizontal size={10} strokeWidth={2.5} className="text-white" />
                                </span>
                              )}
                            </div>
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
  );
}

/**
 * Fusionne plusieurs listes `LigneCollab` (une par tableau — période en
 * cours/repêchage/corrections, 25/08/2026) en une seule, par collaborateur ×
 * type. Alimente le CSV : "l'export CSV il est incomplet on doit retrouver
 * les 3 tableaux" (Vincent) — l'export ne montrait jusqu'ici que le récap de
 * la période en cours, plus les deux tableaux ajoutés ensuite pour la
 * parité visuelle, alors que ce sont ces 3 tableaux réunis qui composent ce
 * que "Transmettre" envoie réellement.
 */
function fusionnerLignes(...groupes: LigneCollab[][]): LigneCollab[] {
  const parId = new Map<string, LigneCollab>();
  for (const groupe of groupes) {
    for (const ligne of groupe) {
      if (!parId.has(ligne.id)) {
        parId.set(ligne.id, { ...ligne, parType: ligneVide() });
      }
      const cible = parId.get(ligne.id)!;
      for (const t of TYPES) {
        cible.parType[t].jours += ligne.parType[t].jours;
        cible.parType[t].dates.push(...ligne.parType[t].dates);
      }
    }
  }
  return [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

function genererCsv(lignes: LigneCollab[]): string {
  const entetes = ["Collaborateur", ...TYPES.map((t) => LABEL_TYPE[t])];
  const rangs = lignes.map((ligne) => [
    ligne.nom,
    ...TYPES.map((t) => {
      const c = ligne.parType[t];
      const dates = c.dates.filter((d) => d.statut !== "refusé");
      return c.jours !== 0
        ? `${formatJours(c.jours)} j (${dates.map((d) => d.label).join(", ")})`
        : "0";
    }),
  ]);

  return [entetes, ...rangs]
    .map((rang) => rang.map((valeur) => `"${valeur.replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

/**
 * Détail par collaborateur des congés consommés sur la période — utilisé par
 * l'onglet "Générer l'export" de `TransmissionsPaiePage` (25/08/2026,
 * seul appelant depuis la suppression de l'ancien écran autonome
 * `/suivre/paie` "Export paie"), visible manager + admin (comme le reste de
 * `/suivre`, bloqué pour les salarié·es dans `proxy.ts`). Période par défaut
 * le mois calendaire en cours (`periodePaieParDefaut`), modifiable via les
 * deux champs date — sauf en mode `sourceTransmission`, où elle est figée
 * (voir plus bas). Export CSV côté client (Blob + téléchargement), pas
 * d'appel serveur.
 *
 * `masquerTitre` (24/08/2026) — opt-in : masque le `<h1>` "Export paie" et
 * réduit le padding vertical d'origine, pour un usage imbriqué dans un autre
 * écran qui porte déjà son propre titre (`TransmissionsPaiePage`, onglet "Générer
 * l'export" — reprend ce composant tel quel plutôt que de dupliquer sa
 * logique — seul appelant restant depuis la suppression de l'écran
 * `/suivre/paie` autonome, 25/08/2026).
 *
 * `periodeInitiale` (24/08/2026) — override du calcul par défaut
 * (`periodePaieParDefaut()`), pour ouvrir directement sur une période
 * précise (mois d'archive choisi sur `/suivre/transmissions-paie`) plutôt que
 * toujours la période en cours. Reste modifiable ensuite via les mêmes
 * champs date, comme le calcul par défaut.
 *
 * `validesUniquement` (25/08/2026) — opt-in : masque la case à cocher
 * "Validés uniquement" et applique le filtre en permanence, plutôt que de la
 * laisser en option. Utilisé par l'onglet "Générer l'export" de
 * `TransmissionsPaiePage` (demande explicite : cette vue ne doit prendre en
 * compte que les congés validés, pas de choix à faire à cet endroit).
 *
 * `sourceTransmission` (25/08/2026) — opt-in : bascule `useCongesConsommes`
 * sur `fetchCongesATransmettre` (backlog inclus) plutôt que le filtre par
 * date strict habituel — pour que cet aperçu/le CSV corresponde exactement
 * à ce que "Transmettre" enverra réellement (même fonction). Utilisé par
 * l'onglet "Générer l'export" de `TransmissionsPaiePage`, aux côtés de
 * `validesUniquement`. Active aussi (25/08/2026, continuité avec "Quels
 * congés transmettre") : la période Du/Au n'est plus éditable (affichée en
 * texte figé plutôt qu'en champs date — cet onglet transmet exactement la
 * période choisie sur la liste, pas question de la changer ici), le bouton
 * "Exporter (CSV)" disparaît du bandeau du haut (déplacé dans le bandeau
 * sticky du parent, voir `exporter()` ci-dessous), et deux tableaux
 * supplémentaires apparaissent sous le récap collaborateur × type, dans le
 * MÊME format grille collaborateur × type (`TableauCollaborateurType`,
 * 25/08/2026 — "les tableaux 2 et 3 doivent prendre le même format que le
 * tableau 1", pas le rendu ligne-par-ligne `HistoriqueTable` initialement
 * utilisé) : "Congés consommés non passés sur des périodes précédentes"
 * (`lignesRepechage`) et "Congés passés en paye mais annulés"
 * (`lignesCorrections`, `grouperParCollaborateur(..., inclureAnnuleDansTotal:
 * true)` pour que leur total reflète la correction négative plutôt que 0).
 * Le récap collaborateur × type exclut désormais ce repêchage
 * (`demandesAffichees` filtré sur `fin >= debut`) pour ne pas compter deux
 * fois les mêmes jours à l'écran. Chaque cellule n'affiche QUE les jours
 * effectivement pris en compte pour cette transmission (`joursPourTransmission`,
 * pas la durée totale d'un congé à cheval) — le détail complet de la
 * demande (période entière, solde avant/après) reste dans
 * `DetailCongePanel`, au clic sur une pastille de date.
 *
 * Expose `exporter()` via `ref` (25/08/2026,
 * `useImperativeHandle`) — pour que le bandeau sticky de `GenererExport`
 * (lien texte "Exporter (CSV)", juste avant "Transmettre") puisse déclencher
 * le téléchargement du CSV sans dupliquer la génération (`genererCsv`/
 * `lignes`, internes à ce composant).
 */
export interface CongesPaiePageHandle {
  exporter: () => void;
}

export const CongesPaiePage = forwardRef<
  CongesPaiePageHandle,
  {
    masquerTitre?: boolean;
    periodeInitiale?: { debut: string; fin: string };
    validesUniquement?: boolean;
    sourceTransmission?: boolean;
    exportId?: string | null;
  }
>(function CongesPaiePage(
  {
    masquerTitre = false,
    periodeInitiale,
    validesUniquement: validesUniquementForce = false,
    sourceTransmission = false,
    exportId = null,
  },
  ref,
) {
  const defaut = periodeInitiale ?? periodePaieParDefaut();
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);
  const { demandes, loading, error, refetch } = useCongesConsommes(debut, fin, sourceTransmission);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [validesUniquement, setValidesUniquement] = useState(false);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);
  const [joursATransmettreParId, setJoursATransmettreParId] = useState<Record<string, number>>({});
  const [lignesTransmissionParId, setLignesTransmissionParId] = useState<
    Record<string, LigneExportPaie[]>
  >({});

  // Régularisations manuelles de la période (27/08/2026, "faut prévoir une
  // catégorie régulation aussi") — équipe entière, filtrées côté client sur
  // `debut`/`fin` (liste légère, pas de requête serveur dédiée par période).
  // `sourceTransmission` uniquement : pas pertinent sur l'export personnel
  // "Congés & RTT" du collaborateur (hors scope de cette page-là).
  const [ajustementsEquipe, setAjustementsEquipe] = useState<AjustementEquipe[]>([]);
  useEffect(() => {
    if (!sourceTransmission) return;
    let cancelled = false;
    fetchAjustementsEquipe().then((data) => {
      if (!cancelled) setAjustementsEquipe(data);
    });
    return () => {
      cancelled = true;
    };
  }, [sourceTransmission]);

  // Contenu figé de l'export réel (25/08/2026, bug signalé : "la demi journée
  // d'Olivier est quand même affichée dans l'export de juillet" — une fois
  // une période transmise, cet écran continuait d'afficher le backlog LIVE
  // (`fetchCongesATransmettre`, ce qui reste à transmettre MAINTENANT),
  // désynchronisé du contenu réel de l'export déjà généré à l'époque, qui
  // peut évoluer après coup — ex. une demande validée après la transmission).
  // Décision actée : une fois `exportId` connu, les 3 tableaux/le CSV
  // reflètent exactement `export_paie_lignes` de cet export, plus jamais la
  // liste live.
  const figeParExport = sourceTransmission && Boolean(exportId);
  const [demandesFigees, setDemandesFigees] = useState<DemandeEquipe[]>([]);
  const [joursParDemandeFigee, setJoursParDemandeFigee] = useState<Record<string, number>>({});
  // Initialisé directement sur `figeParExport` plutôt que mis à jour dans
  // l'effet ci-dessous pour le cas "pas de mode figé" — `figeParExport` est
  // stable pour toute la durée de vie de cette instance (le parent force un
  // remount via `key` au changement d'export, voir `TransmissionsPaiePage`).
  const [chargementFige, setChargementFige] = useState(figeParExport);

  useEffect(() => {
    if (!figeParExport || !exportId) return;
    let cancelled = false;
    fetchCheckFichesPaie(exportId).then((collaborateurs) => {
      if (cancelled) return;
      const demandesVues: DemandeEquipe[] = [];
      const jours: Record<string, number> = {};
      for (const collab of collaborateurs) {
        for (const { ligne, demande } of collab.lignes) {
          demandesVues.push(demande);
          jours[demande.id] = (jours[demande.id] ?? 0) + ligne.joursInclus;
        }
      }
      setDemandesFigees(demandesVues);
      setJoursParDemandeFigee(jours);
      setChargementFige(false);
    });
    return () => {
      cancelled = true;
    };
  }, [exportId, figeParExport]);

  const demandesPourFeed = figeParExport ? demandesFigees : demandes;

  // Même calcul que "Quels congés transmettre" (`TransmissionsPaiePage`) —
  // combien de jours partiraient réellement pour chaque ligne si on
  // transmettait maintenant, pas le solde restant complet (25/08/2026 :
  // sans ça, un congé à cheval encore réapparaissait ici avec son reliquat
  // total au lieu de la portion qui sera effectivement transmise). Sans
  // objet une fois `figeParExport` — il n'y a plus de "si on transmettait
  // maintenant" à prévisualiser, c'est déjà transmis.
  useEffect(() => {
    if (!sourceTransmission || figeParExport) return;
    let cancelled = false;
    Promise.all(
      (demandes as CongeATransmettre[]).map(
        async (d) => [d.id, await calculerJoursATransmettreMaintenant(d, { debut, fin })] as const,
      ),
    ).then((entrees) => {
      if (!cancelled) setJoursATransmettreParId(Object.fromEntries(entrees));
    });
    return () => {
      cancelled = true;
    };
  }, [demandes, sourceTransmission, figeParExport, debut, fin]);

  // Lignes de transmission réelles (`export_paie_lignes`), même logique que
  // "Quels congés transmettre" — alimente le feed "Transmis le"/"En paye le"
  // du panneau de détail (25/08/2026). Sourcé sur `demandesPourFeed` pour
  // rester correct en mode figé (sinon basé sur le backlog live, potentiellement
  // vide/différent des demandes réellement affichées).
  useEffect(() => {
    if (!sourceTransmission) return;
    let cancelled = false;
    fetchLignesTransmissionParDemande(demandesPourFeed.map((d) => d.id)).then((data) => {
      if (!cancelled) setLignesTransmissionParId(data);
    });
    return () => {
      cancelled = true;
    };
  }, [demandesPourFeed, sourceTransmission]);

  const demandesValidesFiltrees = validesUniquementForce || validesUniquement
    ? demandes.filter((d) => d.statut === "validé")
    : demandes;
  // En mode transmission (25/08/2026), le repêchage (congés d'une période
  // antérieure jamais transmis) a désormais son propre tableau ci-dessous —
  // exclu d'ici pour ne pas compter les mêmes jours deux fois à l'écran
  // (les corrections, statut "annulé", sont déjà hors de ce filtre puisque
  // "validés uniquement" est forcé sur cet onglet).
  const demandesAffichees = figeParExport
    ? demandesFigees.filter((d) => joursParDemandeFigee[d.id] >= 0 && d.fin >= debut)
    : sourceTransmission
      ? demandesValidesFiltrees.filter((d) => d.fin >= debut)
      : demandesValidesFiltrees;
  const joursPourTransmission = (d: DemandeEquipe) =>
    figeParExport
      ? (joursParDemandeFigee[d.id] ?? 0)
      : (joursATransmettreParId[d.id] ?? (d as CongeATransmettre).joursRestants);
  // Congé "à cheval" sur cette période et la suivante (25/08/2026, "j'insiste
  // sur le cheval" — Vincent) : sa fin dépasse la borne haute de la période
  // en cours, donc seule une partie de son solde est prise en compte ici, le
  // reste attendra un futur export. Signalé par une icône dédiée sur la
  // pastille de date plutôt que seulement déductible du chiffre en tête de
  // colonne (déjà limité aux jours comptés, `joursPourTransmission`).
  const estACheval = (d: DemandeEquipe) => d.fin > fin;
  const libelleAffiche = (d: DemandeEquipe) => libellePeriodeAffichee(d, fin);
  const lignes = grouperParCollaborateur(
    demandesAffichees,
    sourceTransmission ? joursPourTransmission : undefined,
    // En mode figé (25/08/2026), le statut LIVE de la demande n'a plus voix
    // au chapitre pour décider si ses jours comptent — seule compte la
    // ligne réellement transmise (déjà catégorisée en amont via le signe de
    // `joursParDemandeFigee`). Sans ce `true`, une demande transmise "en
    // positif" puis régularisée depuis (statut actuel "annulé") voyait ses
    // jours retombés à 0 dans ce tableau, alors que l'export réel les
    // contenait bien (bug constaté : "la demi journée d'Olivier est quand
    // même affichée dans l'export de juillet" — même famille de bug, ici sur
    // le nombre de jours plutôt que sur la présence de la ligne).
    figeParExport,
    sourceTransmission ? estACheval : undefined,
    sourceTransmission ? libelleAffiche : undefined,
  );
  const selection = demandesPourFeed.find((d) => d.id === selectionId) ?? null;

  // Tableaux "équivalents" à "Quels congés transmettre" (25/08/2026, demande
  // explicite) — même répartition collaborateur × type que le récap
  // principal ci-dessus, pour que "Générer l'export" montre exactement ce
  // qui compose le CSV/la transmission, pas seulement le récap de la période
  // en cours ("les tableaux 2 et 3 doivent prendre le même format que le
  // tableau 1" — Vincent). En mode figé, la répartition repêchage/corrections
  // se fait sur le contenu réel de l'export (`joursParDemandeFigee`, signé —
  // négatif = correction) plutôt que sur le statut live de la demande, qui
  // peut avoir changé depuis (ex. re-régularisée) sans que l'export d'origine
  // en soit affecté.
  const lignesRepechage = figeParExport
    ? grouperParCollaborateur(
        demandesFigees.filter((d) => joursParDemandeFigee[d.id] >= 0 && d.fin < debut),
        joursPourTransmission,
        true,
        estACheval,
        libelleAffiche,
      )
    : sourceTransmission
      ? grouperParCollaborateur(
          (demandes as CongeATransmettre[]).filter((d) => d.statut !== "annulé" && d.fin < debut),
          joursPourTransmission,
          false,
          estACheval,
          libelleAffiche,
        )
      : [];
  const lignesCorrections = figeParExport
    ? grouperParCollaborateur(
        demandesFigees.filter((d) => joursParDemandeFigee[d.id] < 0),
        joursPourTransmission,
        true,
        estACheval,
        libelleAffiche,
      )
    : sourceTransmission
      ? grouperParCollaborateur(
          (demandes as CongeATransmettre[]).filter((d) => d.statut === "annulé"),
          joursPourTransmission,
          true,
          estACheval,
          libelleAffiche,
        )
      : [];

  const lignesRegularisations = sourceTransmission
    ? grouperAjustementsParCollaborateur(
        ajustementsEquipe.filter((a) => a.date >= debut && a.date <= fin),
      )
    : [];

  function exporter() {
    const csv = genererCsv(
      fusionnerLignes(lignes, lignesRepechage, lignesCorrections, lignesRegularisations),
    );
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conges-paie_${debut}_${fin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useImperativeHandle(ref, () => ({ exporter }));

  const chargementAffiche = figeParExport ? chargementFige : loading;

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
    <div
      className={`flex w-full max-w-md flex-col gap-5 md:max-w-none ${masquerTitre ? "" : "pt-5 pb-4 md:pt-0"}`}
    >
      {!masquerTitre && <h1 className="text-ink-900 px-1 text-2xl font-semibold">Export paie</h1>}

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div
          className={`flex w-full min-w-0 flex-col gap-5 ${selection ? "xl:flex-1" : "md:max-w-[900px]"}`}
        >
          <div className="bg-surface-card w-full shadow-sm">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              {sourceTransmission ? (
                // Période figée (25/08/2026, demande explicite) — cet onglet
                // ("Générer l'export") transmet exactement la période choisie
                // sur la liste `/suivre/transmissions-paie`, plus de champs
                // Du/Au éditables qui pourraient désynchroniser l'aperçu de ce
                // qui sera réellement transmis.
                <span className="text-ink-900 rounded-full border border-ink-300/60 px-3 py-1.5 text-sm font-semibold">
                  {formatPeriodePillNumerique(debut, fin)}
                </span>
              ) : (
                <>
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
                </>
              )}
              {!validesUniquementForce && (
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
              )}
              {!sourceTransmission && (
                <Button
                  onClick={exporter}
                  disabled={lignes.length === 0}
                  className="ml-auto rounded-full px-4 py-2"
                >
                  <Download size={16} />
                  Exporter (CSV)
                </Button>
              )}
            </div>

            {error && (
              <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 mb-3 px-3 py-2.5 text-sm">
                {error}
              </div>
            )}

            {chargementAffiche ? (
              <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
            ) : (
              <TableauCollaborateurType
                lignes={lignes}
                selectionId={selectionId}
                onSelect={setSelectionId}
                enCours={enCours}
                emptyText="Aucun congé validé sur cette période."
              />
            )}
          </div>

          {sourceTransmission && (
            <div className="bg-surface-card w-full shadow-sm">
              <div className="px-4 pt-3 pb-1">
                <h2 className="text-ink-900 text-sm font-bold">
                  Congés consommés non passés sur des périodes précédentes
                </h2>
              </div>
              {chargementAffiche ? (
                <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
              ) : (
                <TableauCollaborateurType
                  lignes={lignesRepechage}
                  selectionId={selectionId}
                  onSelect={setSelectionId}
                  enCours={enCours}
                  emptyText="Aucun congé en repêchage."
                />
              )}
            </div>
          )}

          {sourceTransmission && (
            <div className="bg-surface-card w-full shadow-sm">
              <div className="px-4 pt-3 pb-1">
                <h2 className="text-ink-900 text-sm font-bold">Congés passés en paye mais annulés</h2>
              </div>
              {chargementAffiche ? (
                <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
              ) : (
                <TableauCollaborateurType
                  lignes={lignesCorrections}
                  selectionId={selectionId}
                  onSelect={setSelectionId}
                  enCours={enCours}
                  emptyText="Aucune correction à transmettre."
                />
              )}
            </div>
          )}

          {sourceTransmission && (
            <div className="bg-surface-card w-full shadow-sm">
              <div className="px-4 pt-3 pb-1">
                <h2 className="text-ink-900 text-sm font-bold">Régularisations</h2>
              </div>
              <TableauCollaborateurType
                lignes={lignesRegularisations}
                selectionId={null}
                onSelect={() => {}}
                enCours={enCours}
                emptyText="Aucune régularisation sur cette période."
              />
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
            lignesTransmission={sourceTransmission ? lignesTransmissionParId[selection.id] : undefined}
            previsionTransmission={
              sourceTransmission && !figeParExport
                ? {
                    jours: joursATransmettreParId[selection.id] ?? 0,
                    total: selection.nbDemiJournees / 2,
                  }
                : undefined
            }
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
});
