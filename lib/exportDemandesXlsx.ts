import type { Cell, Row } from "write-excel-file/browser";
import {
  COULEUR_TYPE,
  GRIS_BORDURE,
  GRIS_FOND,
  GRIS_TEXTE,
  MARINE,
  eclaircir,
} from "@/lib/exportPaieXlsx";
import { formatDateAction, formatJours, formatPeriodeDemande } from "@/lib/format";
import type { Demande } from "@/lib/types";

// Export Excel de « Suivre les demandes » en vue Liste (22/10/2026, demande de
// Vincent — le bouton « Exporter » imprimait la page en PDF), puis de
// l'Historique du collaborateur (même jour, même demande) : une ligne par
// demande affichée, dans l'ordre de la liste. Mêmes principes que
// `exportPaieXlsx.ts` (module sans React, bibliothèque chargée au clic).

export interface LigneDemandeXlsx {
  collaborateur: string;
  typeCode: string;
  typeLibelle: string;
  dates: string;
  duree: string;
  statut: string;
  poseLe: string;
  decideLe: string;
  validePar: string;
  message: string;
  commentaire: string;
}

const COULEURS_STATUT: Record<string, { fond: string; texte: string }> = {
  validé: { fond: "#dcfae6", texte: "#067647" },
  "en attente": { fond: "#fef0c7", texte: "#93370d" },
  refusé: { fond: "#fee4e2", texte: "#b42318" },
  annulé: { fond: "#f2f4f7", texte: "#475467" },
};

const NB_COLONNES = 10;

/** Ligne d'export d'une demande — partagée par « Suivre les demandes » (nom du
 * demandeur) et l'Historique du collaborateur (son propre nom). */
export function ligneDemandeXlsx(
  d: Demande,
  collaborateur: string,
  labelLong: Record<string, string>,
): LigneDemandeXlsx {
  const code = d.type === "CP" && d.isAnticipation ? "CPA" : d.type;
  const precisions = [
    d.demiDebut === "apres_midi" ? "début après-midi" : "",
    d.demiFin === "matin" ? "fin matin" : "",
  ].filter(Boolean);
  return {
    collaborateur,
    typeCode: code,
    typeLibelle: labelLong[code] ?? code,
    dates:
      formatPeriodeDemande(d.debut, d.fin) +
      (precisions.length > 0 ? ` (${precisions.join(", ")})` : ""),
    duree: `${formatJours(d.nbDemiJournees / 2)} j`,
    statut: d.statut,
    poseLe: formatDateAction(d.datePose),
    decideLe: d.dateDecision ? formatDateAction(d.dateDecision) : "",
    validePar: d.validateur ? `${d.validateur.prenom} ${d.validateur.nom}` : "",
    message: d.note ?? "",
    commentaire: d.commentaireManager ?? "",
  };
}

export interface OptionsXlsxDemandes {
  /** Titre de la feuille (défaut : « Demandes de congés »). */
  titre?: string;
  /** Colonne « Collaborateur » (défaut : oui) — inutile dans l'Historique
   * personnel, où toutes les lignes sont celles de la même personne. */
  avecCollaborateur?: boolean;
}
const VIDE: Cell = { value: "" };
const FUSION = (n: number) => Array.from({ length: n }, () => null as unknown as Cell);

const cellule = (value: string, style: Record<string, unknown> = {}): Cell =>
  ({ value, borderColor: GRIS_BORDURE, ...style }) as Cell;

export async function genererXlsxDemandes(
  lignes: LigneDemandeXlsx[],
  filtres: string[],
  dateExport: string,
  options: OptionsXlsxDemandes = {},
): Promise<Blob> {
  const { titre = "Demandes de congés", avecCollaborateur = true } = options;
  const nbColonnes = avecCollaborateur ? NB_COLONNES : NB_COLONNES - 1;
  const sansCollaborateur = <T>(cellules: T[]): T[] =>
    avecCollaborateur ? cellules : cellules.slice(1);
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const donnees: Row[] = [];

  donnees.push([
    {
      value: titre,
      fontSize: 16,
      fontWeight: "bold",
      textColor: MARINE,
      columnSpan: nbColonnes,
    } as Cell,
    ...FUSION(nbColonnes - 1),
  ]);
  donnees.push([
    {
      value: `Exporté le ${dateExport} — ${lignes.length} demande${lignes.length > 1 ? "s" : ""}`,
      fontSize: 10,
      textColor: GRIS_TEXTE,
      columnSpan: nbColonnes,
    } as Cell,
    ...FUSION(nbColonnes - 1),
  ]);
  donnees.push([
    {
      value: filtres.length > 0 ? `Filtres : ${filtres.join(" · ")}` : "Aucun filtre",
      fontSize: 10,
      textColor: GRIS_TEXTE,
      columnSpan: nbColonnes,
    } as Cell,
    ...FUSION(nbColonnes - 1),
  ]);
  donnees.push(Array.from({ length: nbColonnes }, () => VIDE));

  donnees.push(
    sansCollaborateur([
      "Collaborateur",
      "Type",
      "Dates",
      "Durée",
      "Statut",
      "Posé le",
      "Décidé le",
      "Décidé par",
      "Message du collaborateur",
      "Commentaire du manager",
    ]).map((t) =>
      cellule(t, {
        fontWeight: "bold",
        backgroundColor: GRIS_FOND,
        align: t === "Durée" ? "right" : "left",
      }),
    ),
  );

  for (const l of lignes) {
    const statut = COULEURS_STATUT[l.statut] ?? { fond: "#ffffff", texte: "#000000" };
    donnees.push(
      sansCollaborateur([
        cellule(l.collaborateur, { fontWeight: "bold" }),
        cellule(l.typeLibelle, {
          fontWeight: "bold",
          backgroundColor: eclaircir(COULEUR_TYPE[l.typeCode] ?? "#9ca3af"),
        }),
        cellule(l.dates),
        cellule(l.duree, { align: "right" }),
        cellule(l.statut.charAt(0).toUpperCase() + l.statut.slice(1), {
          fontWeight: "bold",
          backgroundColor: statut.fond,
          textColor: statut.texte,
        }),
        cellule(l.poseLe),
        cellule(l.decideLe),
        cellule(l.validePar),
        cellule(l.message, { wrap: true }),
        cellule(l.commentaire, { wrap: true }),
      ]),
    );
  }

  return writeExcelFile(donnees, {
    sheet: "Demandes",
    columns: sansCollaborateur([
      { width: 26 },
      { width: 24 },
      { width: 30 },
      { width: 10 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 20 },
      { width: 38 },
      { width: 38 },
    ]),
    orientation: "landscape",
    showGridLines: false,
    stickyRowsCount: 5,
  }).toBlob();
}
