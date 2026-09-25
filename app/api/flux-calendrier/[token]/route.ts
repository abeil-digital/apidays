import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { genererFluxIcs, type AbsenceIcs } from "@/lib/calendrier/ics";
import { LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";

/**
 * Flux ICS des absences (25/09/2026, abonnement Proton/Google/Outlook) —
 * route publique (exclue de l'authentification, voir `proxy.ts`) : le token
 * de l'URL est le seul secret. Résolu via `parametrage_notifications`
 * (`flux_calendrier_token`, `flux_calendrier_actif`) ; toute la lecture passe
 * ensuite par le service_role, donc chaque requête filtre EXPLICITEMENT par
 * `entreprise_id` (le service_role contourne la RLS). Un token inconnu ou un
 * flux désactivé renvoie le même 404, sans rien révéler.
 *
 * Absences validées ET en attente, tous types avec leur libellé (décision de
 * Vincent, 25/09/2026) ; les jours collectifs (congé imposé, demi-journée
 * imposée) sont exclus — un évènement par collaborateur encombrerait le
 * calendrier pour un jour où tout le monde est absent. Fenêtre : 90 jours
 * passés à 18 mois à venir.
 */
const TYPES_COLLECTIFS = ["DJ_IMPOSEE", "CP_IMPOSE"];

function decaler(jours: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const introuvable = () => new NextResponse("Introuvable", { status: 404 });

  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token.replace(/\.ics$/, ""))) return introuvable();
  const jeton = token.replace(/\.ics$/, "");

  const admin = createAdminClient();

  const { data: flux } = await admin
    .from("parametrage_notifications")
    .select("entreprise_id, flux_calendrier_actif")
    .eq("flux_calendrier_token", jeton)
    .maybeSingle();
  if (!flux || !flux.flux_calendrier_actif) return introuvable();

  const [{ data: entreprise }, { data: demandes, error }] = await Promise.all([
    admin.from("entreprises").select("nom").eq("id", flux.entreprise_id).single(),
    admin
      .from("demandes_conges")
      .select(
        "id, date_debut, demi_debut, date_fin, demi_fin, statut, updated_at, types_absences(code), utilisateurs!utilisateur_id(prenom, nom)",
      )
      .eq("entreprise_id", flux.entreprise_id)
      .in("statut", ["validee", "en_attente"])
      .gte("date_fin", decaler(-90))
      .lte("date_debut", decaler(548))
      .order("date_debut"),
  ]);
  if (error) return new NextResponse("Erreur", { status: 500 });

  const absences: AbsenceIcs[] = [];
  for (const d of demandes ?? []) {
    const type = Array.isArray(d.types_absences) ? d.types_absences[0] : d.types_absences;
    const personne = Array.isArray(d.utilisateurs) ? d.utilisateurs[0] : d.utilisateurs;
    if (!type || !personne || TYPES_COLLECTIFS.includes(type.code)) continue;
    absences.push({
      id: d.id,
      prenom: personne.prenom,
      nom: personne.nom,
      libelleType: LABEL_LONG[type.code as TypeBadgeCode] ?? type.code,
      enAttente: d.statut === "en_attente",
      dateDebut: d.date_debut,
      demiDebut: d.demi_debut,
      dateFin: d.date_fin,
      demiFin: d.demi_fin,
      modifieLe: d.updated_at,
    });
  }

  const corps = genererFluxIcs(absences, {
    nomCalendrier: `Absences ${entreprise?.nom ?? ""}`.trim(),
    domaine: new URL(request.url).hostname,
  });

  return new NextResponse(corps, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}
