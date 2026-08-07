export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
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
