/**
 * Calcul des jours fériés légaux français et des dates utilitaires pour
 * l'écran Paramétrer > Calendrier. Toutes les dates sont manipulées en UTC
 * (`Date.UTC`) pour éviter tout décalage de fuseau horaire côté navigateur —
 * seule la partie YYYY-MM-DD du résultat compte.
 */

function isoDate(annee: number, moisIndex: number, jour: number): string {
  return new Date(Date.UTC(annee, moisIndex, jour)).toISOString().slice(0, 10);
}

function ajouterJours(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Dimanche de Pâques (calendrier grégorien) — algorithme de Meeus/Jones/Butcher.
 */
function datePaques(annee: number): string {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(annee, mois - 1, jour);
}

/**
 * Les 11 jours fériés légaux français pour une année donnée — 7 dates fixes
 * + 3 dates mobiles calculées à partir de Pâques (lundi de Pâques,
 * Ascension, lundi de Pentecôte).
 */
export function joursFeriesLegaux(annee: number): { date: string; libelle: string }[] {
  const paques = datePaques(annee);

  return [
    { date: isoDate(annee, 0, 1), libelle: "Jour de l'an" },
    { date: ajouterJours(paques, 1), libelle: "Lundi de Pâques" },
    { date: isoDate(annee, 4, 1), libelle: "Fête du Travail" },
    { date: isoDate(annee, 4, 8), libelle: "Victoire 1945" },
    { date: ajouterJours(paques, 39), libelle: "Ascension" },
    { date: ajouterJours(paques, 50), libelle: "Lundi de Pentecôte" },
    { date: isoDate(annee, 6, 14), libelle: "Fête nationale" },
    { date: isoDate(annee, 7, 15), libelle: "Assomption" },
    { date: isoDate(annee, 10, 1), libelle: "Toussaint" },
    { date: isoDate(annee, 10, 11), libelle: "Armistice" },
    { date: isoDate(annee, 11, 25), libelle: "Noël" },
  ];
}

/**
 * Toutes les dates d'un jour de la semaine donné (ISO : 1=lundi … 7=dimanche)
 * sur une année civile — utilisé pour lister les vendredis par défaut.
 */
export function datesDuJourDeLaSemaine(annee: number, jourIso: number): string[] {
  const dates: string[] = [];
  let cursor = isoDate(annee, 0, 1);

  while (Number(cursor.slice(0, 4)) === annee) {
    const d = new Date(`${cursor}T00:00:00Z`);
    const jourSemaine = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (jourSemaine === jourIso) {
      dates.push(cursor);
    }
    cursor = ajouterJours(cursor, 1);
  }

  return dates;
}

/**
 * Lundi de la semaine calendaire contenant le 15 août d'une année donnée.
 */
export function lundiSemaineDu15Aout(annee: number): string {
  const quinzeAout = isoDate(annee, 7, 15);
  const d = new Date(`${quinzeAout}T00:00:00Z`);
  const jourSemaine = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return ajouterJours(quinzeAout, -(jourSemaine - 1));
}
