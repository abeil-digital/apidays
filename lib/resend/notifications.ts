import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";
const EXPEDITEUR = "Abeil Congés <notifications@abeil-conges.citizen-d.fr>";

interface EnvoyerEmailInput {
  destinataires: string[];
  sujet: string;
  html: string;
  /** Expéditeur custom (09/09/2026, e-mails d'invitation brandés par
   * tenant, voir `lib/resend/invitation.ts`) — défaut inchangé pour les
   * appelants existants (notifications de demandes de congés, Abeil). */
  expediteur?: string;
}

/**
 * Envoi d'e-mail via l'API HTTP Resend (fetch direct, pas de SDK — cohérent
 * avec la philosophie minimal-dependency du projet). Domaine
 * `abeil-conges.citizen-d.fr` déjà vérifié (DKIM/SPF/DMARC) pour les
 * e-mails Supabase Auth — réutilisé ici pour les e-mails déclenchés par
 * l'application elle-même (première fois, 08/09/2026), via une clé
 * `RESEND_API_KEY` distincte de celle utilisée comme mot de passe SMTP côté
 * dashboard Supabase.
 *
 * Ne lance jamais d'exception : retourne `{ ok }`, charge à l'appelant de
 * décider si l'échec doit être surfacé ou ignoré silencieusement.
 */
export async function envoyerEmail(input: EnvoyerEmailInput): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || input.destinataires.length === 0) {
    return { ok: false };
  }

  try {
    const reponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.expediteur ?? EXPEDITEUR,
        to: input.destinataires,
        subject: input.sujet,
        html: input.html,
      }),
    });
    // Erreur Resend jamais remontée à l'appelant (voir doc ci-dessus) mais
    // journalisée (09/09/2026, correctif) — sans ça, un échec d'envoi ne
    // laisse aucune trace exploitable (les logs Vercel `info` ne montrent
    // que la requête entrante, pas le corps de la réponse Resend).
    if (!reponse.ok) {
      console.error("[resend] échec d'envoi", reponse.status, await reponse.text());
    }
    return { ok: reponse.ok };
  } catch (err) {
    console.error("[resend] exception à l'envoi", err);
    return { ok: false };
  }
}
