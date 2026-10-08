import { formatDateAction, formatJours } from "@/lib/format";

// Génération du CSV de l'export paie (08/10/2026, demande de Vincent — "une
// ligne par collaborateur et par type, une cellule par congé"). Module pur
// (aucun React, aucune donnée chargée ici) pour pouvoir le tester hors
// navigateur ; `TransmissionsPaiePage.tsx` lui passe ses données déjà
// regroupées par collaborateur.

export interface CongeCsv {
  /** Dates du congé, ex. "10/08 - 28/08" (`formatPeriodePillNumerique`). */
  label: string;
  /** Début ISO (AAAA-MM-JJ), sert uniquement à trier les congés d'une ligne. */
  debut: string;
  /** Jours pris en compte par CET export (portion transmise pour un congé à cheval). */
  jours: number;
  statut: string;
}

export interface LigneCsv {
  nom: string;
  parType: Record<string, { jours: number; dates: CongeCsv[] }>;
}

export interface AjustementCsv {
  nomComplet: string;
  code: string;
  date: string;
  deltaJours: number;
  motif: string;
}

export interface TypeCsv {
  code: string;
  libelle: string;
}

export function csvLigne(champs: string[]): string {
  return champs.map((valeur) => `"${valeur.replace(/"/g, '""')}"`).join(";");
}

export function nomMoisAnnee(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(`${iso}T00:00:00`),
  );
}

/** Une cellule par congé : "Dates – Durée" (ex. "10/08 - 28/08 – 15 j"). Le
 * signe moins d'une correction est un vrai "−" (U+2212), pour ne pas
 * l'accoler au tiret de séparation ("– -0,5 j"). */
function celluleConge(conge: CongeCsv): string {
  return `${conge.label} – ${formatJoursSigne(conge.jours)} j`;
}

export function formatJoursSigne(jours: number): string {
  return formatJours(jours).replace(/^-/, "−");
}

export interface RangeeSection {
  /** Nom du collaborateur, vide hors de sa première ligne. */
  nom: string;
  /** Vrai sur la première ligne d'un collaborateur. */
  premierDuCollaborateur: boolean;
  typeCode: string;
  /** Libellé du type, vide hors de la première ligne du groupe. */
  type: string;
  /** "Dates – Durée". */
  conge: string;
  /** Total de jours du groupe (collaborateur + type), vide hors de sa première ligne. */
  total: string;
  /** Vrai pour une correction (jours négatifs). */
  negatif: boolean;
}

/**
 * Lignes d'un tableau de section, UNE PAR CONGÉ. Le nom du collaborateur n'est
 * écrit qu'une fois (sur sa première ligne) et le type qu'une fois par
 * groupe, avec le total de jours de ce type pour ce collaborateur (même
 * valeur que le total affiché à l'écran) sur la première ligne du groupe.
 * Ordre : collaborateur (déjà trié par l'appelant), puis type dans l'ordre
 * de `types`, puis date de début. Types sans jour et congés refusés exclus.
 * Partagé par le CSV et l'Excel (`exportPaieXlsx.ts`).
 */
export function construireRangeesSection(lignes: LigneCsv[], types: TypeCsv[]): RangeeSection[] {
  const rangees: RangeeSection[] = [];
  for (const ligne of lignes) {
    let nomDejaEcrit = false;
    for (const type of types) {
      const entree = ligne.parType[type.code];
      if (!entree || entree.jours === 0) continue;
      const conges = entree.dates
        .filter((d) => d.statut !== "refusé")
        .sort((a, b) => a.debut.localeCompare(b.debut));
      conges.forEach((conge, i) => {
        rangees.push({
          nom: nomDejaEcrit ? "" : ligne.nom,
          premierDuCollaborateur: !nomDejaEcrit,
          typeCode: type.code,
          type: i === 0 ? type.libelle : "",
          conge: celluleConge(conge),
          total: i === 0 ? `${formatJoursSigne(entree.jours)} j` : "",
          negatif: conge.jours < 0,
        });
        nomDejaEcrit = true;
      });
    }
  }
  return rangees;
}

function genererTableauSection(lignes: LigneCsv[], types: TypeCsv[]): string[] {
  const rangees = construireRangeesSection(lignes, types);
  if (rangees.length === 0) return [];
  return [
    csvLigne(["Collaborateur", "Type de congé", "Congé", "Total"]),
    ...rangees.map((r) => csvLigne([r.nom, r.type, r.conge, r.total])),
    "",
  ];
}

export function genererCsvExportPaie(
  periode: { debut: string; fin: string },
  sections: { titre: string; lignes: LigneCsv[] }[],
  ajustements: AjustementCsv[],
  types: TypeCsv[],
): string {
  const corps: string[] = [
    csvLigne([`Export congés ${nomMoisAnnee(periode.debut)}`]),
    csvLigne([
      `Période de prise en compte : ${formatDateAction(periode.debut)} - ${formatDateAction(periode.fin)}`,
    ]),
    "",
  ];

  for (const section of sections) {
    corps.push(csvLigne([section.titre]), "", ...genererTableauSection(section.lignes, types));
  }

  corps.push(csvLigne(["Régularisations"]), "");
  corps.push(csvLigne(["Collaborateur", "Type", "Date", "Jours", "Motif"]));
  const ajustementsTries = [...ajustements].sort(
    (a, b) => a.nomComplet.localeCompare(b.nomComplet) || a.date.localeCompare(b.date),
  );
  for (const a of ajustementsTries) {
    corps.push(
      csvLigne([
        a.nomComplet,
        a.code,
        formatDateAction(a.date),
        formatJoursSigne(a.deltaJours),
        a.motif,
      ]),
    );
  }

  return corps.join("\n");
}
