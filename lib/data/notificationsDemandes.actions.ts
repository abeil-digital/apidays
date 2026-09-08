"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { envoyerEmail } from "@/lib/resend/notifications";
import { resolverDestinataires } from "@/lib/resend/destinataires";
import { getSiteUrl } from "@/lib/siteUrl";
import { formatPeriodeDemande } from "@/lib/format";
import { LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

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
        "date_debut, date_fin, types_absences(code), utilisateurs!utilisateur_id(prenom, nom)",
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

    await envoyerEmail({
      destinataires,
      sujet: `Nouvelle demande de congé — ${nomRequerant}`,
      html: `
        <p>${nomRequerant} a posé une nouvelle demande de congé.</p>
        <p><strong>${libelleType}</strong><br>${periode}</p>
        <p><a href="${siteUrl}/suivre/demandes">Voir la demande</a></p>
      `,
    });
  } catch {
    // best-effort — jamais remonté à l'appelant
  }
}
