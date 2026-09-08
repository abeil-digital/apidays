const CARACTERES_HTML: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Échappe le texte libre saisi par un utilisateur avant de l'insérer dans
 * un HTML d'email composé par simple concaténation de chaînes (pas de
 * moteur de templating côté Resend) — nécessaire dès qu'un champ comme le
 * commentaire d'une demande de congé est repris dans un email. */
export function echapperHtml(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => CARACTERES_HTML[c]);
}
