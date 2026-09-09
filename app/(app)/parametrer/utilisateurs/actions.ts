"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/siteUrl";
import { fetchBrandingCourant } from "@/lib/data/branding.repository";
import { envoyerInvitation } from "@/lib/resend/invitation";

export interface InviterUtilisateurState {
  ok: boolean;
  erreur?: string;
}

/**
 * Appelée juste après `creerUtilisateurAdmin` (insert `public.utilisateurs`,
 * toujours côté navigateur/anon — inchangé) et depuis le bouton "Renvoyer
 * l'invitation" en vue fiche. Génère le lien d'invitation via l'API Admin
 * (service_role, `generateLink` plutôt que `inviteUserByEmail` — ne
 * déclenche pas l'envoi natif Supabase, voir `lib/resend/invitation.ts`)
 * puis relie `auth_id` sur la ligne déjà créée avec le client de session
 * normal de l'admin connecté (RLS "utilisateurs: admin modifie les
 * profils") — le service_role reste cantonné au seul appel qui l'exige
 * réellement.
 *
 * E-mail envoyé "maison" via Resend (09/09/2026), brandé au nom du tenant
 * de l'admin qui invite (`fetchBrandingCourant()`, RLS-scopée à sa propre
 * entreprise — l'admin est forcément membre du tenant du collaborateur
 * qu'il invite) — remplace le template Supabase unique pour tout le projet.
 */
export async function inviterUtilisateur(
  utilisateurId: string,
  email: string,
  prenom: string,
): Promise<InviterUtilisateurState> {
  // Ne jamais laisser une exception remonter jusqu'à l'appelant (07/09/2026,
  // corrigé le 08/09/2026 après un cas réel en prod) — le profil
  // `utilisateurs` est déjà créé au moment où cette fonction est appelée
  // (voir `Formulaire.handleSubmit`) ; si `createAdminClient()` ou l'appel
  // Admin API plante (ex. `SUPABASE_SERVICE_ROLE_KEY` absente en prod),
  // l'appelant doit recevoir un échec propre `{ ok: false }` pour afficher
  // "profil créé, invitation à renvoyer" — pas une exception qui ferait
  // croire à un échec total de la création.
  try {
    const supabase = await createClient();
    const branding = await fetchBrandingCourant();

    const admin = createAdminClient();
    const redirectTo = `${await getSiteUrl()}/connexion/confirmer/invite`;

    const { data: lien, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

    if (error || !lien.user || !lien.properties?.hashed_token) {
      return { ok: false, erreur: "invite_echouee" };
    }

    const { error: updateError } = await supabase
      .from("utilisateurs")
      .update({ auth_id: lien.user.id })
      .eq("id", utilisateurId);

    if (updateError) {
      return { ok: false, erreur: "liaison_echouee" };
    }

    const lienAction = `${redirectTo}?token_hash=${lien.properties.hashed_token}&slug=${encodeURIComponent(branding.slug)}`;
    const { ok: emailEnvoye } = await envoyerInvitation({
      email,
      prenom,
      entrepriseNom: branding.nom,
      lienAction,
      logoUrlFondClair: branding.logoUrlFondClair,
    });

    return emailEnvoye ? { ok: true } : { ok: false, erreur: "invite_echouee" };
  } catch {
    return { ok: false, erreur: "invite_echouee" };
  }
}

/**
 * Bouton "Envoyer un lien de réinitialisation" en vue fiche (07/09/2026) —
 * complète le "Renvoyer l'invitation" ci-dessus : celui-ci ne s'affiche que
 * tant que le compte n'a jamais été activé (`auth_id` vide), celui-là une
 * fois activé (le collaborateur a déjà un mot de passe à réinitialiser).
 * Même client anon que le parcours self-service
 * (`app/connexion/mot-de-passe-oublie/actions.ts`) — pas besoin du
 * service_role ici, `resetPasswordForEmail` est une opération publique par
 * conception. Contrairement au flux self-service, pas d'anti-énumération à
 * observer : l'admin sait déjà que ce compte existe.
 */
export async function envoyerLienReinitialisation(email: string): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await getSiteUrl()}/connexion/confirmer/recovery`,
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/**
 * Appelée par `Formulaire.handleSubmit` (fiche utilisateur) juste avant
 * `modifier()`, uniquement quand l'email saisi diffère de l'email chargé —
 * corrige un bug réel (08/09/2026, manager bloqué à la connexion en prod
 * après un changement d'email depuis la fiche) : modifier `utilisateurs`
 * seul ne touchait jamais le compte `auth.users` réellement utilisé pour se
 * connecter, les deux divergeaient silencieusement. `email_confirm: true`
 * applique le changement immédiatement (l'admin modifiant la fiche d'un
 * collaborateur sait déjà que ce compte est légitime — pas de double
 * opt-in à faire attendre le collaborateur, contrairement à un changement
 * d'email en self-service qui n'existe pas dans cette app).
 *
 * Ne throw jamais (service_role/API Auth peuvent échouer) — l'appelant doit
 * bloquer l'enregistrement de la fiche si `ok` est faux, pour ne jamais
 * laisser `utilisateurs.email` diverger de `auth.users.email`.
 */
export async function synchroniserEmailAuth(
  authId: string,
  nouvelEmail: string,
): Promise<{ ok: boolean }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(authId, {
      email: nouvelEmail,
      email_confirm: true,
    });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
