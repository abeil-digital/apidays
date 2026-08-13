import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegleAnciennete, Soldes, SoldeCategorie, TypeDemande } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { getTypeAbsenceId } from "@/lib/data/typesAbsences";
import { fetchReglesAcquisition, fetchReglesAnciennete } from "@/lib/data/reglesConges.repository";

/**
 * Repository des soldes de congés/RTT — calculé à la volée à partir de
 * `regles_acquisition`/`regles_anciennete` (Paramétrer > Congés & RTT) et des
 * demandes déjà décidées, plutôt que lu/maintenu dans la table `soldes` (pas
 * de job planifié dans cette appli pour la tenir à jour sans risque de
 * désynchronisation). Voir CONTEXTE.md pour le détail de la formule.
 *
 * - **CP** : capital fixe pour la période en cours (acquis intégralement
 *   pendant la période précédente), + bonus ancienneté, + report du solde CP
 *   non consommé de la période précédente (un seul niveau de report, pas de
 *   cascade), − CP validés consommés sur la période en cours.
 * - **CPA** ("Congés Payés en Acquisition") : accrual mensuel en cours pour
 *   la période CP SUIVANTE (pas encore commencée) − CP anticipés déjà
 *   validés dessus (`is_anticipation = true`).
 * - **RTT** : accrual mensuel depuis le début de la période RTT en cours −
 *   RTT validés sur cette période. Pas d'ancienneté, pas de report (perdus à
 *   la fin de la période).
 *
 * Chaque catégorie expose aussi `valeurApresAttente` (le solde ci-dessus
 * moins les jours encore en attente de validation) — indicatif, pas un
 * retrait définitif tant que la demande n'est pas décidée.
 */

interface Periode {
  debut: Date;
  fin: Date;
}

function dateIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Période [debut, fin] de 12 mois (jour inclus des deux côtés) contenant `reference`. */
function periodeContenant(reference: Date, moisDebut: number, jourDebut: number): Periode {
  const annee = reference.getUTCFullYear();
  let debut = new Date(Date.UTC(annee, moisDebut - 1, jourDebut));
  if (reference < debut) {
    debut = new Date(Date.UTC(annee - 1, moisDebut - 1, jourDebut));
  }
  const fin = new Date(Date.UTC(debut.getUTCFullYear() + 1, moisDebut - 1, jourDebut));
  fin.setUTCDate(fin.getUTCDate() - 1);
  return { debut, fin };
}

function decalerPeriode(periode: Periode, ans: number): Periode {
  return {
    debut: new Date(
      Date.UTC(
        periode.debut.getUTCFullYear() + ans,
        periode.debut.getUTCMonth(),
        periode.debut.getUTCDate(),
      ),
    ),
    fin: new Date(
      Date.UTC(
        periode.fin.getUTCFullYear() + ans,
        periode.fin.getUTCMonth(),
        periode.fin.getUTCDate(),
      ),
    ),
  };
}

// Mois entiers écoulés depuis `debut`, plafonné à 12 (durée d'une période) —
// pas de dixième de mois, juste des mois calendaires complets.
function moisEntiersEcoules(debut: Date, reference: Date): number {
  const bornee = reference < debut ? debut : reference;
  let mois =
    (bornee.getUTCFullYear() - debut.getUTCFullYear()) * 12 +
    (bornee.getUTCMonth() - debut.getUTCMonth());
  if (bornee.getUTCDate() < debut.getUTCDate()) mois -= 1;
  return Math.min(12, Math.max(0, mois));
}

function ansAnciennete(dateReferenceIso: string, reference: Date): number {
  const debut = new Date(`${dateReferenceIso}T00:00:00Z`);
  let ans = reference.getUTCFullYear() - debut.getUTCFullYear();
  const anniversairePasse =
    reference.getUTCMonth() > debut.getUTCMonth() ||
    (reference.getUTCMonth() === debut.getUTCMonth() &&
      reference.getUTCDate() >= debut.getUTCDate());
  if (!anniversairePasse) ans -= 1;
  return Math.max(0, ans);
}

// Plusieurs seuils d'ancienneté peuvent être atteints en même temps — seul le
// plus favorable s'applique (pas cumulable), voir BASE-DE-DONNEES.md.
function bonusAnciennete(regles: RegleAnciennete[], ans: number): number {
  const eligibles = regles.filter((r) => ans >= r.seuilAnnees);
  if (eligibles.length === 0) return 0;
  return Math.max(...eligibles.map((r) => r.joursSupplementaires));
}

async function getUtilisateurIdCourant(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("my_utilisateur_id");
  if (error || !data) {
    throw new Error("Utilisateur non identifié.");
  }
  return data;
}

/** Somme en jours des demandes d'un type/statut donné dont `date_debut` tombe dans la période. */
async function sommeJours(
  supabase: SupabaseClient,
  utilisateurId: string,
  type: TypeDemande,
  statuts: string[],
  isAnticipation: boolean | null,
  periode: Periode,
): Promise<number> {
  const typeAbsenceId = await getTypeAbsenceId(supabase, type);

  let query = supabase
    .from("demandes_conges")
    .select("nb_demi_journees")
    .eq("utilisateur_id", utilisateurId)
    .eq("type_absence_id", typeAbsenceId)
    .in("statut", statuts)
    .gte("date_debut", dateIso(periode.debut))
    .lte("date_debut", dateIso(periode.fin));

  if (isAnticipation !== null) {
    query = query.eq("is_anticipation", isAnticipation);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Impossible de calculer le solde.");
  }

  return (data ?? []).reduce((somme, row) => somme + Number(row.nb_demi_journees) / 2, 0);
}

function formatDateCourte(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function formatMoisAnnee(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
}

/**
 * @param utilisateurId Solde d'un salarié donné (Espace Suivre). Sans
 * argument : solde du salarié connecté (Accueil).
 */
export async function fetchSoldes(utilisateurId?: string): Promise<Soldes> {
  const supabase = createClient();
  const id = utilisateurId ?? (await getUtilisateurIdCourant(supabase));

  const [{ data: utilisateurRow, error: erreurUtilisateur }, reglesAcquisition, reglesAnciennete] =
    await Promise.all([
      supabase
        .from("utilisateurs")
        .select("date_entree, anciennete_date_reference, taux_activite")
        .eq("id", id)
        .single(),
      fetchReglesAcquisition(),
      fetchReglesAnciennete(),
    ]);

  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour le calcul du solde.");
  }

  const prorata = Number(utilisateurRow.taux_activite ?? 100) / 100;
  const dateReferenceAnciennete: string =
    utilisateurRow.anciennete_date_reference ?? utilisateurRow.date_entree;
  const aujourdhui = new Date(`${dateIso(new Date())}T00:00:00Z`);

  const regleCP = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const regleRTT = reglesAcquisition.find((r) => r.typeAbsence === "RTT");
  const bonus = bonusAnciennete(
    reglesAnciennete,
    ansAnciennete(dateReferenceAnciennete, aujourdhui),
  );

  let cp: SoldeCategorie = {
    valeur: 0,
    valeurApresAttente: 0,
    conditionPrefixe: "",
    conditionAccent: "",
  };
  let cpa: SoldeCategorie = {
    valeur: 0,
    valeurApresAttente: 0,
    conditionPrefixe: "",
    conditionAccent: "",
  };

  if (regleCP) {
    const periodeEnCours = periodeContenant(
      aujourdhui,
      regleCP.periodeDebutMois,
      regleCP.periodeDebutJour,
    );
    const periodePrecedente = decalerPeriode(periodeEnCours, -1);
    const periodeSuivante = decalerPeriode(periodeEnCours, 1);

    const capitalBase = 12 * regleCP.tauxAcquisitionMensuel * prorata + bonus;
    const consommePeriodePrecedente = await sommeJours(
      supabase,
      id,
      "CP",
      ["validee"],
      false,
      periodePrecedente,
    );
    const report = regleCP.reportAutorise
      ? Math.max(0, capitalBase - consommePeriodePrecedente)
      : 0;

    const consommeEnCours = await sommeJours(
      supabase,
      id,
      "CP",
      ["validee"],
      false,
      periodeEnCours,
    );
    const enAttenteEnCours = await sommeJours(
      supabase,
      id,
      "CP",
      ["en_attente"],
      false,
      periodeEnCours,
    );
    const soldeCp = capitalBase + report - consommeEnCours;

    cp = {
      valeur: soldeCp,
      valeurApresAttente: soldeCp - enAttenteEnCours,
      conditionPrefixe: "À poser avant le",
      conditionAccent: formatDateCourte(periodeEnCours.fin),
    };

    const moisEcoulesCpa = moisEntiersEcoules(periodeEnCours.debut, aujourdhui);
    const accrualCpa = moisEcoulesCpa * regleCP.tauxAcquisitionMensuel * prorata;
    const consommeCpa = await sommeJours(supabase, id, "CP", ["validee"], true, periodeSuivante);
    const enAttenteCpa = await sommeJours(
      supabase,
      id,
      "CP",
      ["en_attente"],
      true,
      periodeSuivante,
    );
    const soldeCpa = Math.max(0, accrualCpa - consommeCpa);

    cpa = {
      valeur: soldeCpa,
      valeurApresAttente: soldeCpa - enAttenteCpa,
      conditionPrefixe: "En cours d'acquisition, à poser à partir de",
      conditionAccent: formatMoisAnnee(periodeSuivante.debut),
    };
  }

  let rtt: SoldeCategorie = {
    valeur: 0,
    valeurApresAttente: 0,
    conditionPrefixe: "",
    conditionAccent: "",
  };

  if (regleRTT) {
    const periodeRtt = periodeContenant(
      aujourdhui,
      regleRTT.periodeDebutMois,
      regleRTT.periodeDebutJour,
    );
    const moisEcoules = moisEntiersEcoules(periodeRtt.debut, aujourdhui);
    const accrual = moisEcoules * regleRTT.tauxAcquisitionMensuel * prorata;
    const consomme = await sommeJours(supabase, id, "RTT", ["validee"], null, periodeRtt);
    const enAttente = await sommeJours(supabase, id, "RTT", ["en_attente"], null, periodeRtt);
    const solde = Math.max(0, accrual - consomme);

    rtt = {
      valeur: solde,
      valeurApresAttente: solde - enAttente,
      conditionPrefixe: "À poser avant le",
      conditionAccent: formatDateCourte(periodeRtt.fin),
    };
  }

  return { cp, rtt, cpa, rttImposes: [] };
}
