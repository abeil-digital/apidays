/**
 * Règle de mot de passe partagée entre la page (retour visuel en direct) et
 * la Server Action (vérification faisant foi) — un seul endroit à faire
 * évoluer si la règle change.
 */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

export const MESSAGE_POLITIQUE_MOT_DE_PASSE =
  "Le mot de passe doit contenir au moins 8 caractères, une majuscule et un caractère spécial.";

export function criteresMotDePasse(motDePasse: string) {
  return {
    longueur: motDePasse.length >= LONGUEUR_MIN_MOT_DE_PASSE,
    majuscule: /[A-Z]/.test(motDePasse),
    caractereSpecial: /[^A-Za-z0-9]/.test(motDePasse),
  };
}

export function respectePolitiqueMotDePasse(motDePasse: string): boolean {
  const criteres = criteresMotDePasse(motDePasse);
  return criteres.longueur && criteres.majuscule && criteres.caractereSpecial;
}
