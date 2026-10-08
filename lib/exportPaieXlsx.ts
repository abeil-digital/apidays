import type { Cell, Row } from "write-excel-file/browser";
import { formatDateAction } from "@/lib/format";
import {
  construireRangeesSection,
  formatJoursSigne,
  nomMoisAnnee,
  type AjustementCsv,
  type LigneCsv,
  type TypeCsv,
} from "@/lib/exportPaieCsv";

// Export Excel (.xlsx) de l'export paie (08/10/2026, test demandé par Vincent
// en parallèle du CSV, qui reste disponible). Mêmes données, mêmes lignes que
// le CSV (`construireRangeesSection`) ; seule la mise en forme change :
// couleurs de la charte (bleu marine Abeil, couleurs de type de congé du
// calendrier), tailles de police, largeurs de colonnes, bordures. La
// bibliothèque (`write-excel-file`, MIT) n'est chargée qu'au clic.

const MARINE = "#001e32"; // --color-brand-primary
const GRIS_TEXTE = "#6b7280";
const GRIS_FOND = "#e5e7eb";
const GRIS_BORDURE = "#d1d5db";
const ROUGE = "#b42318";

// Couleurs de type de congé (app/globals.css), éclaircies pour garder le texte lisible.
const COULEUR_TYPE: Record<string, string> = {
  CP: "#5b8def",
  RTT: "#7fbf8f",
  CPA: "#9db4c4",
  CSS: "#a89f96",
  CE: "#d9a35c",
  RECUP: "#d98ca6",
  EVT_FAM: "#d98ca6",
};

function eclaircir(hex: string, part = 0.7): string {
  const n = parseInt(hex.slice(1), 16);
  const m = (c: number) => Math.round(c + (255 - c) * part);
  const r = m((n >> 16) & 255);
  const g = m((n >> 8) & 255);
  const b = m(n & 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const NB_COLONNES = 5;
const VIDE: Cell = { value: "" };

const cellule = (value: string, style: Record<string, unknown> = {}): Cell =>
  ({ value, borderColor: GRIS_BORDURE, ...style }) as Cell;

function ligneComplete(cellules: Cell[]): Row {
  return [...cellules, ...Array.from({ length: NB_COLONNES - cellules.length }, () => VIDE)];
}

export async function genererXlsxExportPaie(
  periode: { debut: string; fin: string },
  sections: { titre: string; lignes: LigneCsv[] }[],
  ajustements: AjustementCsv[],
  types: TypeCsv[],
): Promise<Blob> {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const donnees: Row[] = [];

  donnees.push([
    {
      value: `Export congés ${nomMoisAnnee(periode.debut)}`,
      fontSize: 16,
      fontWeight: "bold",
      textColor: MARINE,
      columnSpan: NB_COLONNES,
    } as Cell,
    ...Array.from({ length: NB_COLONNES - 1 }, () => null as unknown as Cell),
  ]);
  donnees.push([
    {
      value: `Période de prise en compte : ${formatDateAction(periode.debut)} - ${formatDateAction(periode.fin)}`,
      fontSize: 10,
      textColor: GRIS_TEXTE,
      columnSpan: NB_COLONNES,
    } as Cell,
    ...Array.from({ length: NB_COLONNES - 1 }, () => null as unknown as Cell),
  ]);
  donnees.push(ligneComplete([]));

  for (const section of sections) {
    // Bandeau de section : fond marine, texte blanc, sur toute la largeur du tableau.
    donnees.push([
      {
        value: section.titre,
        fontSize: 12,
        fontWeight: "bold",
        textColor: "#ffffff",
        backgroundColor: MARINE,
        columnSpan: 4,
      } as Cell,
      null as unknown as Cell,
      null as unknown as Cell,
      null as unknown as Cell,
      VIDE,
    ]);
    const rangees = construireRangeesSection(section.lignes, types);
    if (rangees.length === 0) {
      donnees.push(
        ligneComplete([cellule("Aucun congé", { textColor: GRIS_TEXTE, fontStyle: "italic" })]),
      );
      donnees.push(ligneComplete([]));
      continue;
    }
    donnees.push(
      ligneComplete(
        ["Collaborateur", "Type de congé", "Congé", "Total"].map((t) =>
          cellule(t, { fontWeight: "bold", backgroundColor: GRIS_FOND }),
        ),
      ),
    );
    for (const r of rangees) {
      const filet = r.premierDuCollaborateur ? { topBorderColor: "#9ca3af" } : {};
      const couleurTexte = r.negatif ? { textColor: ROUGE } : {};
      donnees.push(
        ligneComplete([
          cellule(r.nom, { fontWeight: "bold", ...filet }),
          cellule(
            r.type,
            r.type
              ? {
                  fontWeight: "bold",
                  backgroundColor: eclaircir(COULEUR_TYPE[r.typeCode] ?? "#9ca3af"),
                  ...filet,
                }
              : filet,
          ),
          cellule(r.conge, { ...couleurTexte, ...filet }),
          cellule(r.total, { fontWeight: "bold", align: "right", ...couleurTexte, ...filet }),
        ]),
      );
    }
    donnees.push(ligneComplete([]));
  }

  donnees.push([
    {
      value: "Régularisations",
      fontSize: 12,
      fontWeight: "bold",
      textColor: "#ffffff",
      backgroundColor: MARINE,
      columnSpan: NB_COLONNES,
    } as Cell,
    ...Array.from({ length: NB_COLONNES - 1 }, () => null as unknown as Cell),
  ]);
  donnees.push(
    ["Collaborateur", "Type", "Date", "Jours", "Motif"].map((t) =>
      cellule(t, { fontWeight: "bold", backgroundColor: GRIS_FOND }),
    ),
  );
  const tries = [...ajustements].sort(
    (a, b) => a.nomComplet.localeCompare(b.nomComplet) || a.date.localeCompare(b.date),
  );
  if (tries.length === 0) {
    donnees.push(
      ligneComplete([
        cellule("Aucune régularisation", { textColor: GRIS_TEXTE, fontStyle: "italic" }),
      ]),
    );
  }
  for (const a of tries) {
    donnees.push([
      cellule(a.nomComplet, { fontWeight: "bold" }),
      cellule(a.code),
      cellule(formatDateAction(a.date)),
      cellule(formatJoursSigne(a.deltaJours), {
        align: "right",
        ...(a.deltaJours < 0 ? { textColor: ROUGE } : {}),
      }),
      cellule(a.motif, { wrap: true }),
    ]);
  }

  return writeExcelFile(donnees, {
    sheet: "Export paie",
    columns: [{ width: 30 }, { width: 22 }, { width: 34 }, { width: 12 }, { width: 40 }],
    orientation: "landscape",
    showGridLines: false,
  }).toBlob();
}
