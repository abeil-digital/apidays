import "server-only";
import { envoyerEmail } from "@/lib/resend/notifications";
import { getSiteUrl } from "@/lib/siteUrl";

const DOMAINE_PLATEFORME = "apidays.citizen-d.fr";

interface EnvoyerInvitationInput {
  email: string;
  prenom: string;
  entrepriseNom: string;
  /** Lien construit par l'appelant à partir de `properties.hashed_token`
   * (`admin.auth.admin.generateLink`) — pas le template Supabase, voir
   * commentaire `app/connexion/confirmer/[type]/page.tsx`. */
  lienAction: string;
  /** `null`/absent ⇒ pas de logo dans l'e-mail (jamais le logo Abeil par
   * défaut pour le compte d'un AUTRE tenant). */
  logoUrlFondClair?: string | null;
}

/**
 * E-mail d'invitation envoyé "maison" via Resend (09/09/2026) — remplace
 * l'envoi natif Supabase Auth (`inviteUserByEmail`), dont le template est
 * unique pour tout le projet et ne peut donc pas refléter le tenant du
 * destinataire. Généré à partir d'un lien produit par
 * `admin.auth.admin.generateLink` (voir `app/admin/actions.ts`/
 * `app/(app)/parametrer/utilisateurs/actions.ts`), qui crée le compte
 * `auth.users` sans envoyer d'e-mail — celui-ci le remplace.
 *
 * Domaine d'expédition dédié à la plateforme (`apidays.citizen-d.fr`),
 * distinct de `abeil-conges.citizen-d.fr` (notifications propres à Abeil) —
 * un e-mail d'invitation pour un AUTRE tenant ne doit pas partir d'un
 * domaine contenant "abeil". Seul le nom d'expéditeur varie par tenant, le
 * domaine reste unique (vérification DKIM/SPF/DMARC par tenant non
 * réaliste à ce stade).
 *
 * Ne lance jamais d'exception — même convention que le reste de
 * `lib/resend/`.
 */
export async function envoyerInvitation(input: EnvoyerInvitationInput): Promise<{ ok: boolean }> {
  const nomExpediteur = input.entrepriseNom.replace(/[\r\n"]/g, "").trim() || "Apidays";
  const expediteur = `"${nomExpediteur}" <notifications@${DOMAINE_PLATEFORME}>`;

  let logoHtml = "";
  if (input.logoUrlFondClair) {
    const logoAbsolu = input.logoUrlFondClair.startsWith("http")
      ? input.logoUrlFondClair
      : `${await getSiteUrl()}${input.logoUrlFondClair}`;
    logoHtml = `<p><img src="${logoAbsolu}" alt="${nomExpediteur}" height="40" style="height:40px;width:auto"></p>`;
  }

  return envoyerEmail({
    destinataires: [input.email],
    sujet: `Bienvenue sur Apidays, ${input.prenom}`,
    expediteur,
    // Clé dédiée, restreinte à ce domaine sur Resend (09/09/2026, correctif
    // — voir doc de `envoyerEmail`) : `RESEND_API_KEY` par défaut est
    // restreinte à `abeil-conges.citizen-d.fr`, incompatible avec ce
    // domaine d'expédition.
    apiKeyEnvVar: "RESEND_API_KEY_INVITATIONS",
    html: `
      ${logoHtml}
      <p>Bonjour ${input.prenom},</p>
      <p>Un compte vous a été créé sur l'Espace Salarié de <strong>${nomExpediteur}</strong>.</p>
      <p><a href="${input.lienAction}">Créer votre mot de passe</a></p>
    `,
  });
}
