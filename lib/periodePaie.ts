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
