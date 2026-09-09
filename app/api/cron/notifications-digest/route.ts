import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { envoyerEmail } from "@/lib/resend/notifications";
import { resolverDestinataires } from "@/lib/resend/destinataires";
import { formatPeriodeDemande } from "@/lib/format";
import { LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { echapperHtml } from "@/lib/html";

// Watermark de garde anti-doublon : tolère un cron raté jusqu'à cette durée
// sans jamais renvoyer deux fois le même récap (voir plan §4).
const TOLERANCE_MS = 6 * 24 * 60 * 60 * 1000;

// Unique tenant réel aujourd'hui (fondations multi-tenant, 09/09/2026) —
// voir le commentaire plus bas sur les deux `.eq("entreprise_id", ...)`.
const ABEIL_ENTREPRISE_ID = "c52b18b8-73b0-403c-990c-b2b4894acb92";

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
    .select(
      "date_debut, date_fin, commentaire_salarie, types_absences(code), utilisateurs!utilisateur_id(prenom, nom)",
    )
    .eq("statut", "en_attente")
    .gte("created_at", depuis.toISOString());

  if (!demandes || demandes.length === 0) {
    await admin
      .from("parametrage_notifications")
      .update({ dernier_envoi_digest: maintenant.toISOString() })
      .eq("entreprise_id", ABEIL_ENTREPRISE_ID); // voir commentaire plus bas
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
        const commentaire = demande.commentaire_salarie?.trim();
        return `<li>${requerant.prenom} ${requerant.nom} — <strong>${libelleType}</strong> — ${periode}${commentaire ? ` — «&nbsp;${echapperHtml(commentaire)}&nbsp;»` : ""}</li>`;
      })
      .join("");

    const lienSuivi = `${request.nextUrl.origin}/suivre/demandes?statut=en_attente`;
    await envoyerEmail({
      destinataires,
      sujet: `Récap hebdomadaire — ${demandes.length} demande(s) de congé en attente`,
      html: `<p>Demandes de congé posées cette semaine :</p><ul>${lignes}</ul><p><a href="${lienSuivi}">Voir les demandes</a></p>`,
    });
  }

  // 09/09/2026, fondations multi-tenant : `parametrage_notifications` a
  // maintenant `entreprise_id` comme clé primaire (plus de `id` fixe). Ce
  // fichier tourne en `service_role` (hors RLS), donc encore en dur sur
  // l'unique tenant réel — filtrer proprement par tenant résolu fait partie
  // du chantier "sécuriser les points RLS-bypass" (Backlog, explicitement
  // hors scope de ce correctif).
  await admin
    .from("parametrage_notifications")
    .update({ dernier_envoi_digest: maintenant.toISOString() })
    .eq("entreprise_id", ABEIL_ENTREPRISE_ID);

  return NextResponse.json({ ok: true, envoye: destinataires.length > 0, nb: demandes.length });
}
