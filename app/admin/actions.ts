"use server";

import { assertSuperAdmin } from "@/lib/supabase/superAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/siteUrl";
import { todayISO } from "@/lib/format";
import { envoyerInvitation } from "@/lib/resend/invitation";
import type { NatureContrat } from "@/lib/types";

export interface CreerTenantInput {
  nom: string;
  slug: string;
  /** "À partir de quand Apidays fait foi" pour ce tenant (11/09/2026,
   * Backlog #73) — obligatoire à la création (pour les tenants existants,
   * créés avant ce champ, `null` en base). Voir `supabase/schema.sql`. */
  dateDebutUtilisation: string;
  couleurNavy?: string;
  couleurJaune?: string;
  logoUrl?: string;
  logoUrlFondClair?: string;
  logoUrlSigne?: string;
  prenomAdmin: string;
  nomAdmin: string;
  emailAdmin: string;
  /** Fiche complète de l'admin, optionnelle (11/09/2026, demande explicite —
   * éviter de devoir ressaisir la fiche après coup) : défauts inchangés
   * (aujourd'hui/CDI/100%) si non fournis. Pas de date de référence
   * ancienneté ici — retirée de la fiche "Nouvel utilisateur" classique
   * depuis le 02/09/2026 ("pas un besoin Abeil actuellement"), même
   * principe ici. */
  dateEntreeAdmin?: string;
  natureContratAdmin?: NatureContrat;
  tauxActiviteAdmin?: number;
  /** Solde initial (facultatif) de l'admin — même mécanisme que la fiche
   * "Nouvel utilisateur" classique (`soldes_initiaux`, report de la
   * dernière fiche de paie). Les 4 champs vont ensemble : `dateReference`
   * vide ⇒ aucun solde initial créé, comportement inchangé. */
  soldeInitialAdmin?: { dateReference: string; cp: number; rtt: number; cpa: number };
}

export interface CreerTenantState {
  ok: boolean;
  erreur?: string;
  /** Tenant créé mais l'e-mail d'invitation n'a pas pu être envoyé (Resend
   * indisponible, domaine `apidays.citizen-d.fr` pas encore vérifié...) —
   * pas un échec de la création elle-même (`ok: true` quand même), juste un
   * avertissement à afficher (09/09/2026). */
  avertissement?: string;
}

const REGEX_SLUG = /^[a-z0-9-]+$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Abeil = seul tenant réel aujourd'hui (`supabase/schema.sql`) — jamais
// supprimable depuis cet écran, même par erreur.
const ID_ABEIL = "c52b18b8-73b0-403c-990c-b2b4894acb92";

/** Supprime les deux lignes singleton d'un tenant (`objectifs_calendrier`,
 * `parametrage_notifications`) — ordre imposé par la contrainte FK (pas de
 * `on delete cascade`) avant toute suppression de `entreprises`, que ce
 * soit un rollback (`creerTenant`) ou une vraie suppression
 * (`supprimerTenant`). */
async function supprimerLignesSingleton(
  admin: ReturnType<typeof createAdminClient>,
  entrepriseId: string,
) {
  await admin.from("objectifs_calendrier").delete().eq("entreprise_id", entrepriseId);
  await admin.from("parametrage_notifications").delete().eq("entreprise_id", entrepriseId);
}

/**
 * Crée un tenant (`entreprises`) + son premier admin (`utilisateurs`,
 * invité via un lien généré par `generateLink` puis envoyé "maison" via
 * Resend — `lib/resend/invitation.ts`, 09/09/2026 : l'e-mail natif
 * Supabase Auth ne peut pas refléter le tenant du destinataire, template
 * unique pour tout le projet) — flux d'onboarding, remplace les scripts
 * `service_role` jetables utilisés jusqu'ici pour les tenants de test.
 * `assertSuperAdmin()` revérifie l'autorité avant tout accès `service_role`
 * (même rigueur que la sécurisation des points RLS-bypass du chantier
 * multi-tenant) — `proxy.ts` n'est qu'une première ligne de défense côté
 * route.
 *
 * Best-effort de nettoyage si la création de l'admin ou l'invitation
 * échoue après que l'entreprise a été créée : supprime la ligne
 * `entreprises` pour éviter un tenant orphelin. Pas une vraie transaction
 * (le reste de l'app n'en utilise pas non plus), juste évite
 * l'incohérence la plus probable.
 */
export async function creerTenant(input: CreerTenantInput): Promise<CreerTenantState> {
  await assertSuperAdmin();

  const nom = input.nom.trim();
  const slug = input.slug.trim().toLowerCase();
  const dateDebutUtilisation = input.dateDebutUtilisation.trim();
  const prenomAdmin = input.prenomAdmin.trim();
  const nomAdmin = input.nomAdmin.trim();
  const emailAdmin = input.emailAdmin.trim();

  if (!nom || !slug || !dateDebutUtilisation || !prenomAdmin || !nomAdmin || !emailAdmin) {
    return { ok: false, erreur: "champs_manquants" };
  }
  if (!REGEX_SLUG.test(slug)) {
    return { ok: false, erreur: "slug_invalide" };
  }
  if (!REGEX_EMAIL.test(emailAdmin)) {
    return { ok: false, erreur: "email_invalide" };
  }

  const admin = createAdminClient();

  const entrepriseInsert: Record<string, string> = {
    nom,
    slug,
    date_debut_utilisation: dateDebutUtilisation,
  };
  if (input.couleurNavy) entrepriseInsert.couleur_navy = input.couleurNavy;
  if (input.couleurJaune) entrepriseInsert.couleur_yellow = input.couleurJaune;
  if (input.logoUrl) entrepriseInsert.logo_url = input.logoUrl;
  if (input.logoUrlFondClair) entrepriseInsert.logo_url_fond_clair = input.logoUrlFondClair;
  if (input.logoUrlSigne) entrepriseInsert.logo_url_signe = input.logoUrlSigne;

  const { data: entreprise, error: erreurEntreprise } = await admin
    .from("entreprises")
    .insert(entrepriseInsert)
    .select("id, logo_url_fond_clair")
    .single();

  if (erreurEntreprise || !entreprise) {
    if (erreurEntreprise?.code === "23505") {
      return { ok: false, erreur: "slug_deja_utilise" };
    }
    return { ok: false, erreur: "creation_entreprise_echouee" };
  }

  // `objectifs_calendrier`/`parametrage_notifications` sont des tables
  // singleton — une ligne PAR ENTREPRISE, clé primaire `entreprise_id`
  // (09/09/2026, fondations multi-tenant). Seule la ligne Abeil existait
  // (seedée à la main dans schema.sql) ; sans celle-ci pour un nouveau
  // tenant, Paramétrer > Congés & RTT/Notifications échoue immédiatement
  // ("Impossible de charger…") — bug réel trouvé en testant "test3".
  // Toutes les autres colonnes ont un défaut DB, `entreprise_id` suffit.
  const { error: erreurObjectifs } = await admin
    .from("objectifs_calendrier")
    .insert({ entreprise_id: entreprise.id });
  const { error: erreurNotifications } = await admin
    .from("parametrage_notifications")
    .insert({ entreprise_id: entreprise.id });

  if (erreurObjectifs || erreurNotifications) {
    await supprimerLignesSingleton(admin, entreprise.id);
    await admin.from("entreprises").delete().eq("id", entreprise.id);
    return { ok: false, erreur: "creation_entreprise_echouee" };
  }

  const { data: utilisateur, error: erreurUtilisateur } = await admin
    .from("utilisateurs")
    .insert({
      entreprise_id: entreprise.id,
      prenom: prenomAdmin,
      nom: nomAdmin,
      email: emailAdmin,
      role: "admin",
      date_entree: input.dateEntreeAdmin || todayISO(),
      // "Non précisé" à l'écran sinon (09/09/2026, remarque de Vincent en
      // testant) — CDI reste le défaut si le champ n'est pas renseigné.
      nature_contrat: input.natureContratAdmin || "cdi",
      taux_activite: input.tauxActiviteAdmin ?? 100,
      statut: "actif",
    })
    .select("id")
    .single();

  if (erreurUtilisateur || !utilisateur) {
    await supprimerLignesSingleton(admin, entreprise.id);
    await admin.from("entreprises").delete().eq("id", entreprise.id);
    if (erreurUtilisateur?.code === "23505") {
      return { ok: false, erreur: "email_deja_utilise" };
    }
    return { ok: false, erreur: "creation_admin_echouee" };
  }

  if (input.soldeInitialAdmin) {
    const { error: erreurSoldeInitial } = await admin.from("soldes_initiaux").insert({
      entreprise_id: entreprise.id,
      utilisateur_id: utilisateur.id,
      date_reference: input.soldeInitialAdmin.dateReference,
      cp: input.soldeInitialAdmin.cp,
      rtt: input.soldeInitialAdmin.rtt,
      cpa: input.soldeInitialAdmin.cpa,
    });
    if (erreurSoldeInitial) {
      await admin.from("utilisateurs").delete().eq("id", utilisateur.id);
      await supprimerLignesSingleton(admin, entreprise.id);
      await admin.from("entreprises").delete().eq("id", entreprise.id);
      return { ok: false, erreur: "creation_admin_echouee" };
    }
  }

  const redirectTo = `${await getSiteUrl()}/connexion/confirmer/invite`;
  const { data: lien, error: erreurLien } = await admin.auth.admin.generateLink({
    type: "invite",
    email: emailAdmin,
    options: { redirectTo },
  });

  if (erreurLien || !lien.user || !lien.properties?.hashed_token) {
    await admin.from("utilisateurs").delete().eq("id", utilisateur.id);
    await supprimerLignesSingleton(admin, entreprise.id);
    await admin.from("entreprises").delete().eq("id", entreprise.id);
    return { ok: false, erreur: "invite_echouee" };
  }

  const { error: erreurLiaison } = await admin
    .from("utilisateurs")
    .update({ auth_id: lien.user.id })
    .eq("id", utilisateur.id);

  if (erreurLiaison) {
    await admin.from("utilisateurs").delete().eq("id", utilisateur.id);
    await supprimerLignesSingleton(admin, entreprise.id);
    await admin.from("entreprises").delete().eq("id", entreprise.id);
    return { ok: false, erreur: "liaison_echouee" };
  }

  // E-mail envoyé "maison" via Resend, brandé au nom du tenant (09/09/2026)
  // — remplace l'e-mail natif Supabase (template unique pour tout le
  // projet). Échec de l'envoi : le tenant/compte restent créés (valides,
  // fonctionnels), juste un avertissement plutôt qu'un rollback complet —
  // supprimer un compte qui marche à cause d'un e-mail non envoyé serait
  // pire que le problème.
  const lienAction = `${redirectTo}?token_hash=${lien.properties.hashed_token}&slug=${encodeURIComponent(slug)}`;
  const { ok: emailEnvoye } = await envoyerInvitation({
    email: emailAdmin,
    prenom: prenomAdmin,
    entrepriseNom: nom,
    lienAction,
    logoUrlFondClair: entreprise.logo_url_fond_clair,
  });

  return emailEnvoye ? { ok: true } : { ok: true, avertissement: "invitation_email_echouee" };
}

export interface SupprimerTenantState {
  ok: boolean;
  erreur?: string;
}

/**
 * Supprime un tenant de test et son(ses) compte(s) — 09/09/2026, ajouté
 * après le premier test réel de `creerTenant` (Vincent a besoin de
 * nettoyer ce qu'il crée). `assertSuperAdmin()` revérifié comme partout
 * ailleurs dans ce fichier. Abeil (seul tenant réel) est protégée en dur —
 * jamais supprimable depuis cet écran.
 *
 * Ordre imposé par les contraintes FK (pas de `on delete cascade`) : les
 * comptes `auth.users`, puis les lignes `utilisateurs`, puis les deux
 * lignes singleton (`objectifs_calendrier`/`parametrage_notifications`,
 * voir `supprimerLignesSingleton`), avant la ligne `entreprises`.
 */
export async function supprimerTenant(entrepriseId: string): Promise<SupprimerTenantState> {
  await assertSuperAdmin();

  if (entrepriseId === ID_ABEIL) {
    return { ok: false, erreur: "abeil_protegee" };
  }

  const admin = createAdminClient();

  const { data: utilisateurs } = await admin
    .from("utilisateurs")
    .select("id, auth_id")
    .eq("entreprise_id", entrepriseId);

  for (const u of utilisateurs ?? []) {
    if (u.auth_id) {
      await admin.auth.admin.deleteUser(u.auth_id);
    }
  }

  await admin.from("utilisateurs").delete().eq("entreprise_id", entrepriseId);
  await supprimerLignesSingleton(admin, entrepriseId);

  const { error } = await admin.from("entreprises").delete().eq("id", entrepriseId);

  if (error) {
    return { ok: false, erreur: "suppression_echouee" };
  }

  return { ok: true };
}
