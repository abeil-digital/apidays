import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { envoyerEmail } from "@/lib/resend/notifications";
import { resolverDestinataires } from "@/lib/resend/destinataires";
import { formatPeriodeDemande } from "@/lib/format";
import { LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { echapperHtml } from "@/lib/html";

// Watermark de garde anti-doublon : tolère un cron raté jusqu'à cette durée
// sans jamais renvoyer deux fois le même récap (voir plan §4).
const TOLERANCE_MS = 6 * 24 * 60 * 60 * 1000;

interface Parametrage {
  entreprise_id: string;
  jour_recap: number;
  heure_recap: number;
  copie_administrateur: boolean;
  dernier_envoi_digest: string | null;
}

/**
 * Traite le digest d'une seule entreprise — factorisé hors de `GET` car le
 * cron (09/09/2026, fondations multi-tenant) boucle désormais sur toutes
 * les entreprises en mode hebdomadaire plutôt que de supposer un unique
 * tenant. `service_role` contourne la RLS, donc chaque requête ici filtre
 * explicitement sur `entreprise_id` — sans ça, une entreprise recevrait le
 * récap d'une autre.
 */
async function traiterDigestEntreprise(
  admin: SupabaseClient,
  parametrage: Parametrage,
  maintenant: Date,
  jourISO: number,
  heure: number,
  origin: string,
) {
  const dernierEnvoi = parametrage.dernier_envoi_digest
    ? new Date(parametrage.dernier_envoi_digest)
    : null;
  const dejaEnvoyeRecemment =
    dernierEnvoi !== null && maintenant.getTime() - dernierEnvoi.getTime() < TOLERANCE_MS;

  if (jourISO !== parametrage.jour_recap || heure < parametrage.heure_recap) {
    return { entrepriseId: parametrage.entreprise_id, envoye: false, raison: "hors créneau" };
  }
  if (dejaEnvoyeRecemment) {
    return { entrepriseId: parametrage.entreprise_id, envoye: false, raison: "déjà envoyé" };
  }

  const depuis = dernierEnvoi ?? new Date(0);
  const { data: demandes } = await admin
    .from("demandes_conges")
    .select(
      "date_debut, date_fin, commentaire_salarie, types_absences(code), utilisateurs!utilisateur_id(prenom, nom)",
    )
    .eq("entreprise_id", parametrage.entreprise_id)
    .eq("statut", "en_attente")
    .gte("created_at", depuis.toISOString());

  if (!demandes || demandes.length === 0) {
    await admin
      .from("parametrage_notifications")
      .update({ dernier_envoi_digest: maintenant.toISOString() })
      .eq("entreprise_id", parametrage.entreprise_id);
    return { entrepriseId: parametrage.entreprise_id, envoye: false, raison: "aucune demande" };
  }

  const { managers, administrateurs } = await resolverDestinataires(parametrage.entreprise_id);
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

    const lienSuivi = `${origin}/suivre/demandes?statut=en_attente`;
    await envoyerEmail({
      destinataires,
      sujet: `Récap hebdomadaire — ${demandes.length} demande(s) de congé en attente`,
      html: `<p>Demandes de congé posées cette semaine :</p><ul>${lignes}</ul><p><a href="${lienSuivi}">Voir les demandes</a></p>`,
    });
  }

  await admin
    .from("parametrage_notifications")
    .update({ dernier_envoi_digest: maintenant.toISOString() })
    .eq("entreprise_id", parametrage.entreprise_id);

  return {
    entrepriseId: parametrage.entreprise_id,
    envoye: destinataires.length > 0,
    nb: demandes.length,
  };
}

/**
 * Cron Vercel quotidien (`vercel.json`, 18h UTC — plan Hobby limité à une
 * exécution/jour, un cron horaire est refusé au déploiement). Le
 * jour/heure choisis par l'admin ne peuvent donc plus être comparés à
 * l'égalité : `heureRecap` devient une heure "au plus tôt" (envoi dès que
 * l'unique passage quotidien du cron, tard dans la journée, tombe après
 * cette heure) plutôt qu'une heure exacte — dégradation actée avec Vincent
 * le 08/09/2026 plutôt que bloquer sur un upgrade de plan. Le cron
 * immédiat (`notifierNouvelleDemande`) ne passe pas par cette route.
 *
 * Boucle sur toutes les entreprises en mode hebdomadaire (09/09/2026,
 * fondations multi-tenant) — un job planifié n'a pas de "tenant courant"
 * comme une requête authentifiée, donc `service_role` (hors RLS) doit
 * traiter chaque entreprise explicitement plutôt que de supposer un unique
 * tenant.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, erreur: "non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: parametrages } = await admin
    .from("parametrage_notifications")
    .select("entreprise_id, jour_recap, heure_recap, copie_administrateur, dernier_envoi_digest")
    .eq("frequence", "hebdomadaire");

  if (!parametrages || parametrages.length === 0) {
    return NextResponse.json({ ok: true, entreprises: 0 });
  }

  const maintenant = new Date();
  const jourISO = maintenant.getUTCDay() === 0 ? 7 : maintenant.getUTCDay();
  const heure = maintenant.getUTCHours();

  const resultats = [];
  for (const parametrage of parametrages) {
    resultats.push(
      await traiterDigestEntreprise(
        admin,
        parametrage,
        maintenant,
        jourISO,
        heure,
        request.nextUrl.origin,
      ),
    );
  }

  return NextResponse.json({ ok: true, resultats });
}
