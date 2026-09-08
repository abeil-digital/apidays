"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { envoyerEmail } from "@/lib/resend/notifications";
import { resolverDestinataires } from "@/lib/resend/destinataires";
import { getSiteUrl } from "@/lib/siteUrl";
import { formatPeriodeDemande } from "@/lib/format";
import { LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { echapperHtml } from "@/lib/html";

/**
 * Déclenchée en fire-and-forget juste après la création d'une demande
 * (`hooks/useDemandes.ts`, `ajouterDemande`). Ne doit JAMAIS faire échouer la
 * création de la demande ni surfacer une erreur au collaborateur (différent
 * d'`inviterUtilisateur`, où l'échec est montré à l'admin) — toute erreur est
 * avalée silencieusement. Ne fait rien si le mode est "hebdomadaire" (repris
 * par le cron digest, voir `app/api/cron/notifications-digest`).
 */
export async function notifierNouvelleDemande(demandeId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: parametrage } = await admin
      .from("parametrage_notifications")
      .select("frequence, copie_administrateur")
      .single();
    if (!parametrage || parametrage.frequence !== "immediate") return;

    const { data: demande } = await admin
      .from("demandes_conges")
      .select(
        "date_debut, date_fin, commentaire_salarie, types_absences(code), utilisateurs!utilisateur_id(prenom, nom)",
      )
      .eq("id", demandeId)
      .single();
    if (!demande) return;

    const { managers, administrateurs } = await resolverDestinataires();
    const destinataires = parametrage.copie_administrateur
      ? [...managers, ...administrateurs]
      : managers;
    if (destinataires.length === 0) return;

    const typeAbsence = Array.isArray(demande.types_absences)
      ? demande.types_absences[0]
      : demande.types_absences;
    const requerant = Array.isArray(demande.utilisateurs)
      ? demande.utilisateurs[0]
      : demande.utilisateurs;
    if (!typeAbsence || !requerant) return;

    const libelleType = LABEL_LONG[typeAbsence.code as TypeBadgeCode] ?? typeAbsence.code;
    const periode = formatPeriodeDemande(demande.date_debut, demande.date_fin);
    const nomRequerant = `${requerant.prenom} ${requerant.nom}`;
    const siteUrl = await getSiteUrl();

    const commentaire = demande.commentaire_salarie?.trim();

    await envoyerEmail({
      destinataires,
      sujet: `Nouvelle demande de congé — ${nomRequerant}`,
      html: `
        <p>${nomRequerant} a posé une nouvelle demande de congé.</p>
        <p><strong>${libelleType}</strong><br>${periode}</p>
        ${commentaire ? `<p>&laquo;&nbsp;${echapperHtml(commentaire)}&nbsp;&raquo;</p>` : ""}
        <p><a href="${siteUrl}/suivre/demandes?statut=en_attente">Voir la demande</a></p>
      `,
    });
  } catch {
    // best-effort — jamais remonté à l'appelant
  }
}

/**
 * Déclenchée en fire-and-forget juste après une validation/un refus
 * (`hooks/useDemandesEquipe.ts`, `valider`/`refuser`) — deuxième volet de
 * Paramétrer > Notifications (08/09/2026, demande explicite de Vincent).
 * Même principe fire-and-forget que `notifierNouvelleDemande` : n'échoue
 * jamais visiblement pour le manager qui vient de décider.
 */
export async function notifierDecisionDemande(
  demandeId: string,
  statut: "validee" | "refusee",
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: parametrage } = await admin
      .from("parametrage_notifications")
      .select("notif_decision_collaborateur")
      .single();
    if (!parametrage) return;
    if (parametrage.notif_decision_collaborateur === "aucune") return;
    if (parametrage.notif_decision_collaborateur === "refus_uniquement" && statut !== "refusee") {
      return;
    }

    const { data: demande } = await admin
      .from("demandes_conges")
      .select(
        "date_debut, date_fin, commentaire_decision, types_absences(code), utilisateurs!utilisateur_id(email, prenom)",
      )
      .eq("id", demandeId)
      .single();
    if (!demande) return;

    const typeAbsence = Array.isArray(demande.types_absences)
      ? demande.types_absences[0]
      : demande.types_absences;
    const requerant = Array.isArray(demande.utilisateurs)
      ? demande.utilisateurs[0]
      : demande.utilisateurs;
    if (!typeAbsence || !requerant?.email) return;

    const libelleType = LABEL_LONG[typeAbsence.code as TypeBadgeCode] ?? typeAbsence.code;
    const periode = formatPeriodeDemande(demande.date_debut, demande.date_fin);
    const siteUrl = await getSiteUrl();
    const commentaire = demande.commentaire_decision?.trim();
    const estValidee = statut === "validee";

    await envoyerEmail({
      destinataires: [requerant.email],
      sujet: estValidee ? "Votre demande de congé a été validée" : "Votre demande de congé a été refusée",
      html: `
        <p>Bonjour ${requerant.prenom},</p>
        <p>Votre demande <strong>${libelleType}</strong> (${periode}) a été
        ${estValidee ? "<strong>validée</strong>" : "<strong>refusée</strong>"}.</p>
        ${commentaire ? `<p>&laquo;&nbsp;${echapperHtml(commentaire)}&nbsp;&raquo;</p>` : ""}
        <p><a href="${siteUrl}/">Voir sur Apidays</a></p>
      `,
    });
  } catch {
    // best-effort — jamais remonté à l'appelant
  }
}
