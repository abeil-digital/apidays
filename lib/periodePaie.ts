/**
 * Période de transmission paie — mois calendaire complet (01 → dernier
 * jour), 25/08/2026 : remplace le cycle 25→24 initial (Delphine transmettait
 * vers le 20, la comptable émettait les fiches jusqu'au 24) — décision
 * actée avec Vincent pour aligner la période affichée aux filtres Du/Au sur
 * la période réellement prise en compte par "Transmettre"
 * (`genererExportPaie`), plutôt que de garder les deux notions différentes.
 * Modifiable dans l'UI (Espace Suivre > Transmissions paie) — ceci ne sert
 * qu'à calculer la valeur par défaut à l'ouverture.
 */
export function periodePaieParDefaut(reference: Date = new Date()): {
  debut: string;
  fin: string;
} {
  const debut = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const fin = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);

  return { debut: toIso(debut), fin: toIso(fin) };
}

function toIso(d: Date): string {
  const annee = d.getFullYear();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/** Fin d'une période (le dernier jour du même mois) à partir de son début
 * (le 1er d'un mois donné) — pour reconstruire une période complète à partir
 * du seul `debut` porté dans l'URL (`/suivre/transmissions-paie/[debut]`). */
export function finDePeriode(debut: string): string {
  const d = new Date(`${debut}T00:00:00`);
  return toIso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Les `n` périodes précédant celle en cours (la plus récente d'abord),
 * pour la liste d'archives de `/suivre/transmissions-paie` — chacune calculée en
 * décalant la date de référence d'`periodePaieParDefaut` d'un mois de plus à
 * chaque itération. */
export function periodesPrecedentes(
  n: number,
  reference: Date = new Date(),
): { debut: string; fin: string }[] {
  const courante = periodePaieParDefaut(reference);
  const periodes: { debut: string; fin: string }[] = [];
  let debutCourant = new Date(`${courante.debut}T00:00:00`);

  for (let i = 0; i < n; i++) {
    debutCourant = new Date(debutCourant.getFullYear(), debutCourant.getMonth() - 1, 1);
    periodes.push({ debut: toIso(debutCourant), fin: finDePeriode(toIso(debutCourant)) });
  }

  return periodes;
}

/** "Août 2026" — libellé d'une période (mois calendaire), nommée d'après le
 * mois de FIN (celui dont elle alimente la fiche de paie), pas celui de
 * début — les deux tombent de toute façon dans le même mois calendaire. */
export function libellePeriode(periode: { debut: string; fin: string }): string {
  const fin = new Date(`${periode.fin}T00:00:00`);
  const texte = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(fin);
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
