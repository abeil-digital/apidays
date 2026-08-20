export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Format jj/mm/aaaa — règle : toute date de demande ou d'action (posé le,
 * publié le, décidé le...) s'affiche ainsi, jamais en "13 août 2026". Les
 * dates de période de congé (début/fin d'une demande) restent sur
 * `formatDate`/`formatPeriodeDemande`.
 */
export function formatDateAction(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatJourMois(iso: string, avecAnnee: boolean): string {
  const d = new Date(`${iso}T00:00:00`);
  const jour = d.getDate();
  const jourTexte = jour === 1 ? "1er" : String(jour);
  const mois = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d);
  return avecAnnee ? `${jourTexte} ${mois} ${d.getFullYear()}` : `${jourTexte} ${mois}`;
}

/**
 * Période d'une demande. Un seul jour : juste la date. Sinon "{début} au {fin}" —
 * l'année du début n'est répétée que si la période chevauche deux années civiles.
 */
export function formatPeriodeDemande(debut: string, fin: string): string {
  if (debut === fin) return formatDate(debut);

  const d1 = new Date(`${debut}T00:00:00`);
  const d2 = new Date(`${fin}T00:00:00`);
  const sameYear = d1.getFullYear() === d2.getFullYear();

  if (sameYear) {
    return `${formatJourMois(debut, false)} au ${formatJourMois(fin, true)}`;
  }

  return `${formatJourMois(debut, true)} au ${formatJourMois(fin, true)}`;
}

/**
 * Période au format numérique jj/mm/aa — pills type "CP : 16/09/26" ou "CP :
 * 21/09 au 25/09/26" (distinct de `formatPeriodeDemande`, qui reste en texte
 * "13 août"). Règle (20/08/2026, cas des périodes à cheval sur deux années
 * civiles) :
 *   - 1 jour : jj/mm/aa
 *   - plusieurs jours, même année : jj/mm au jj/mm/aa
 *   - plusieurs jours, à cheval sur deux années : jj/mm/aa au jj/mm/aa
 * Pas de "du" en tête (20/08/2026 — superflu dans une pill, contrairement à
 * une phrase). À appliquer à tout pill CP/RTT/CPA affichant une période sous
 * cette forme compacte, partout dans l'app.
 */
export function formatPeriodePillNumerique(debut: string, fin: string): string {
  const d1 = new Date(`${debut}T00:00:00`);
  const d2 = new Date(`${fin}T00:00:00`);
  const jjMmAa = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(
      d,
    );
  const jjMm = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(d);

  if (debut === fin) return jjMmAa(d1);
  if (d1.getFullYear() === d2.getFullYear()) return `${jjMm(d1)} au ${jjMmAa(d2)}`;
  return `${jjMmAa(d1)} au ${jjMmAa(d2)}`;
}

const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Nom du jour de semaine (ex. "Vendredi") — pour la pastille `JourBadge`
 * (abréviation via `.slice(0, 2)`) accolée à une date dans les listes/popins
 * référentielles (CPI/DJI/Fériés, `SuiviDemandeRow`). */
export function nomJourSemaine(iso: string): string {
  const jourSemaine = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return JOURS_SEMAINE[(jourSemaine + 6) % 7];
}

export function nombreJours(debut: string, fin: string): number {
  const d1 = new Date(`${debut}T00:00:00`);
  const d2 = new Date(`${fin}T00:00:00`);
  return Math.round((d2.getTime() - d1.getTime()) / 86_400_000) + 1;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatJours(valeur: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(valeur);
}
