import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { envoyerEmail } from "@/lib/resend/notifications";
import { resolverDestinataires } from "@/lib/resend/destinataires";
import { formatPeriodeDemande } from "@/lib/format";
import { LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

// Watermark de garde anti-doublon : tolère un cron raté jusqu'à cette durée
// sans jamais renvoyer deux fois le même récap (voir plan §4).
const TOLERANCE_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * Cron Vercel quotidien (`vercel.json`, 18h UTC — plan Hobby limité à une
 * exécution/jour, un cron horaire est refusé au déploiement). Le
 * jour/heure choisis par l'admin ne peuvent donc plus être comparés à
 * l'égalité : `heureRecap` devient une heure "au plus tôt" (envoi dès que
 * l'unique passage quotidien du cron, tard dans la journée, tombe après
 * cette heure) plutôt qu'une heure exacte — dégradation actée avec Vincent
 * le 08/09/2026 plutôt que bloquer sur un upgrade de plan. Le cron
 * immédiat (`notifierNouvelleDemande`) ne passe pas par cette route.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, erreur: "non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: parametrage } = await admin
    .from("parametrage_notifications")
    .select("frequence, jour_recap, heure_recap, copie_administrateur, dernier_envoi_digest")
    .single();

  if (!parametrage || parametrage.frequence !== "hebdomadaire") {
    return NextResponse.json({ ok: true, envoye: false, raison: "mode immédiat" });
  }

  const maintenant = new Date();
  const jourISO = maintenant.getUTCDay() === 0 ? 7 : maintenant.getUTCDay();
  const heure = maintenant.getUTCHours();

  const dernierEnvoi = parametrage.dernier_envoi_digest
    ? new Date(parametrage.dernier_envoi_digest)
    : null;
  const dejaEnvoyeRecemment =
    dernierEnvoi !== null && maintenant.getTime() - dernierEnvoi.getTime() < TOLERANCE_MS;

  if (jourISO !== parametrage.jour_recap || heure < parametrage.heure_recap) {
    return NextResponse.json({ ok: true, envoye: false, raison: "hors créneau" });
  }
  if (dejaEnvoyeRecemment) {
    return NextResponse.json({ ok: true, envoye: false, raison: "déjà envoyé" });
  }

  const depuis = dernierEnvoi ?? new Date(0);
  const { data: demandes } = await admin
    .from("demandes_conges")
    .select("date_debut, date_fin, types_absences(code), utilisateurs!utilisateur_id(prenom, nom)")
    .eq("statut", "en_attente")
    .gte("created_at", depuis.toISOString());

  if (!demandes || demandes.length === 0) {
    await admin
      .from("parametrage_notifications")
      .update({ dernier_envoi_digest: maintenant.toISOString() })
      .eq("id", "00000000-0000-0000-0000-000000000001");
    return NextResponse.json({ ok: true, envoye: false, raison: "aucune demande" });
  }

  const { managers, administrateurs } = await resolverDestinataires();
  const destinataires = parametrage.copie_administrateur
    ? [...managers, ...administrateurs]
    : managers;

  if (destinataires.length > 0) {
    const lignes = demandes
      .map((demande) => {
        const typeAbsence = Array.isArray(demande.types_absences)
          ? demande.types_absences[0]
          : demande.types_absences;
        const requerant = Array.isArray(demande.utilisateurs)
          ? demande.utilisateurs[0]
          : demande.utilisateurs;
        if (!typeAbsence || !requerant) return "";
        const libelleType = LABEL_LONG[typeAbsence.code as TypeBadgeCode] ?? typeAbsence.code;
        const periode = formatPeriodeDemande(demande.date_debut, demande.date_fin);
        return `<li>${requerant.prenom} ${requerant.nom} — <strong>${libelleType}</strong> — ${periode}</li>`;
      })
      .join("");

    const lienSuivi = `${request.nextUrl.origin}/suivre/demandes?statut=en_attente`;
    await envoyerEmail({
      destinataires,
      sujet: `Récap hebdomadaire — ${demandes.length} demande(s) de congé en attente`,
      html: `<p>Demandes de congé posées cette semaine :</p><ul>${lignes}</ul><p><a href="${lienSuivi}">Voir les demandes</a></p>`,
    });
  }

  await admin
    .from("parametrage_notifications")
    .update({ dernier_envoi_digest: maintenant.toISOString() })
    .eq("id", "00000000-0000-0000-0000-000000000001");

  return NextResponse.json({ ok: true, envoye: destinataires.length > 0, nb: demandes.length });
}
