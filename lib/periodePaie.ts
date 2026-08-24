/**
 * Période de transmission paie — du 25 du mois M-1 au 24 du mois M, cycle
 * décrit par Delphine : vers le 20 elle transmet la période en cours à la
 * comptable, du 20 au 24 la comptable émet les fiches, du 24 au 1er Delphine
 * vérifie. Modifiable dans l'UI (Espace Suivre > récap paie) — ceci ne sert
 * qu'à calculer la valeur par défaut à l'ouverture.
 */
export function periodePaieParDefaut(reference: Date = new Date()): {
  debut: string;
  fin: string;
} {
  const jour = reference.getDate();
  let annee = reference.getFullYear();
  let mois = reference.getMonth(); // 0-indexé

  if (jour < 25) {
    mois -= 1;
    if (mois < 0) {
      mois = 11;
      annee -= 1;
    }
  }

  const debut = new Date(annee, mois, 25);
  const fin = new Date(annee, mois + 1, 24);

  return { debut: toIso(debut), fin: toIso(fin) };
}

function toIso(d: Date): string {
  const annee = d.getFullYear();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/** Fin d'une période (le 24 du mois suivant) à partir de son début (le 25
 * d'un mois donné) — pour reconstruire une période complète à partir du seul
 * `debut` porté dans l'URL (`/suivre/cloture-paie/[debut]`). */
export function finDePeriode(debut: string): string {
  const d = new Date(`${debut}T00:00:00`);
  return toIso(new Date(d.getFullYear(), d.getMonth() + 1, 24));
}

/** Les `n` périodes précédant celle en cours (la plus récente d'abord),
 * pour la liste d'archives de `/suivre/cloture-paie` — chacune calculée en
 * décalant la date de référence d'`periodePaieParDefaut` d'un mois de plus à
 * chaque itération (25 => toujours dans le mois M-1, jamais dans le mois
 * suivant, peu importe le jour actuel). */
export function periodesPrecedentes(
  n: number,
  reference: Date = new Date(),
): { debut: string; fin: string }[] {
  const courante = periodePaieParDefaut(reference);
  const periodes: { debut: string; fin: string }[] = [];
  let debutCourant = new Date(`${courante.debut}T00:00:00`);

  for (let i = 0; i < n; i++) {
    debutCourant = new Date(debutCourant.getFullYear(), debutCourant.getMonth() - 1, 25);
    periodes.push({ debut: toIso(debutCourant), fin: finDePeriode(toIso(debutCourant)) });
  }

  return periodes;
}

/** "Août 2026" — libellé d'une période 25→24, nommée d'après le mois de FIN
 * (celui dont elle alimente la fiche de paie), pas celui de début. */
export function libellePeriode(periode: { debut: string; fin: string }): string {
  const fin = new Date(`${periode.fin}T00:00:00`);
  const texte = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(fin);
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
