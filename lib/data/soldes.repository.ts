import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AjustementSoldeInput,
  HistoriqueSolde,
  MoisHistoriqueSolde,
  MouvementSolde,
  RegleAnciennete,
  Soldes,
  SoldeCategorie,
  TypeDemande,
} from "@/lib/types";
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
 *
 * `ajustements_solde` (régulation manuelle par Delphine, Espace Suivre) est
 * intégrée au calcul CP comme un mouvement de plus sur la période en cours —
 * table indépendante de `soldes`/`historique_soldes` (non exploitées, voir
 * plus haut), pas de risque de désynchronisation.
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

/** Somme des ajustements manuels (régulation Delphine) d'un type sur une période. */
async function sommeAjustements(
  supabase: SupabaseClient,
  utilisateurId: string,
  type: TypeDemande,
  periode: Periode,
): Promise<number> {
  const typeAbsenceId = await getTypeAbsenceId(supabase, type);

  const { data, error } = await supabase
    .from("ajustements_solde")
    .select("delta_jours")
    .eq("utilisateur_id", utilisateurId)
    .eq("type_absence_id", typeAbsenceId)
    .gte("created_at", periode.debut.toISOString())
    .lte("created_at", `${dateIso(periode.fin)}T23:59:59.999Z`);

  if (error) {
    throw new Error("Impossible de charger les ajustements.");
  }

  return (data ?? []).reduce((somme, row) => somme + Number(row.delta_jours), 0);
}

function formatJjMm(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(d);
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
    const ajustementsEnCours = await sommeAjustements(supabase, id, "CP", periodeEnCours);
    const soldeCp = capitalBase + report - consommeEnCours + ajustementsEnCours;

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
      conditionPrefixe: "À poser à partir de",
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

/**
 * Solde RTT/CPA "anticipé" à `dateReference` (typiquement la date de début
 * d'une demande future, pour "Poser un jour") — même formule que `fetchSoldes`,
 * mais l'accrual est calculé jusqu'à `dateReference` plutôt que jusqu'à
 * aujourd'hui, pour refléter les jours qui auront été acquis d'ici là.
 * N'existe que pour RTT/CPA : CP a un capital connu dès le 1er jour de la
 * période (+ report), la notion de "anticipé" n'a pas de sens pour lui — son
 * solde ne dépend pas de la date à laquelle on le consulte.
 */
export async function fetchSoldeAnticipe(
  type: "RTT" | "CPA",
  dateReference: string,
): Promise<number> {
  const supabase = createClient();
  const id = await getUtilisateurIdCourant(supabase);
  const reference = new Date(`${dateReference}T00:00:00Z`);

  const [{ data: utilisateurRow, error: erreurUtilisateur }, reglesAcquisition] = await Promise.all(
    [
      supabase.from("utilisateurs").select("taux_activite").eq("id", id).single(),
      fetchReglesAcquisition(),
    ],
  );
  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour le calcul du solde anticipé.");
  }
  const prorata = Number(utilisateurRow.taux_activite ?? 100) / 100;

  if (type === "RTT") {
    const regleRTT = reglesAcquisition.find((r) => r.typeAbsence === "RTT");
    if (!regleRTT) return 0;
    const periodeRtt = periodeContenant(
      reference,
      regleRTT.periodeDebutMois,
      regleRTT.periodeDebutJour,
    );
    const moisEcoules = moisEntiersEcoules(periodeRtt.debut, reference);
    const accrual = moisEcoules * regleRTT.tauxAcquisitionMensuel * prorata;
    const consomme = await sommeJours(supabase, id, "RTT", ["validee"], null, periodeRtt);
    return Math.max(0, accrual - consomme);
  }

  const regleCP = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  if (!regleCP) return 0;
  // CPA acquiert sur la période CP en cours (au sens de `dateReference`), pour
  // financer des congés anticipés dont les dates tombent dans la période
  // suivante — même logique que `fetchSoldes`.
  const periodeEnCours = periodeContenant(
    reference,
    regleCP.periodeDebutMois,
    regleCP.periodeDebutJour,
  );
  const periodeSuivante = decalerPeriode(periodeEnCours, 1);
  const moisEcoulesCpa = moisEntiersEcoules(periodeEnCours.debut, reference);
  const accrualCpa = moisEcoulesCpa * regleCP.tauxAcquisitionMensuel * prorata;
  const consommeCpa = await sommeJours(supabase, id, "CP", ["validee"], true, periodeSuivante);
  return Math.max(0, accrualCpa - consommeCpa);
}

/**
 * Feed d'historique du solde CP d'un salarié (Espace Suivre, popin ouverte
 * au clic sur un solde) — solde de départ (capital + report au début de la
 * période en cours), puis chaque CP validé et chaque ajustement manuel,
 * triés chronologiquement avec le solde courant après chaque mouvement.
 * CP uniquement pour l'instant.
 */
export async function fetchHistoriqueCp(utilisateurId: string): Promise<HistoriqueSolde> {
  const supabase = createClient();

  const [{ data: utilisateurRow, error: erreurUtilisateur }, reglesAcquisition, reglesAnciennete] =
    await Promise.all([
      supabase
        .from("utilisateurs")
        .select("date_entree, anciennete_date_reference, taux_activite")
        .eq("id", utilisateurId)
        .single(),
      fetchReglesAcquisition(),
      fetchReglesAnciennete(),
    ]);

  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour l'historique du solde.");
  }

  const regleCP = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  if (!regleCP) {
    throw new Error("Aucune règle d'acquisition CP paramétrée.");
  }

  const prorata = Number(utilisateurRow.taux_activite ?? 100) / 100;
  const dateReferenceAnciennete: string =
    utilisateurRow.anciennete_date_reference ?? utilisateurRow.date_entree;
  const aujourdhui = new Date(`${dateIso(new Date())}T00:00:00Z`);
  const bonus = bonusAnciennete(
    reglesAnciennete,
    ansAnciennete(dateReferenceAnciennete, aujourdhui),
  );

  const periodeEnCours = periodeContenant(
    aujourdhui,
    regleCP.periodeDebutMois,
    regleCP.periodeDebutJour,
  );
  const periodePrecedente = decalerPeriode(periodeEnCours, -1);

  const capitalBase = 12 * regleCP.tauxAcquisitionMensuel * prorata + bonus;
  const consommePeriodePrecedente = await sommeJours(
    supabase,
    utilisateurId,
    "CP",
    ["validee"],
    false,
    periodePrecedente,
  );
  const report = regleCP.reportAutorise ? Math.max(0, capitalBase - consommePeriodePrecedente) : 0;
  const soldeDepart = capitalBase + report;

  const typeAbsenceId = await getTypeAbsenceId(supabase, "CP");

  const [
    { data: demandesRows, error: erreurDemandes },
    { data: ajustementsRows, error: erreurAjustements },
    { data: enAttenteRows, error: erreurEnAttente },
  ] = await Promise.all([
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", false)
      .eq("statut", "validee")
      .gte("date_debut", dateIso(periodeEnCours.debut))
      .lte("date_debut", dateIso(periodeEnCours.fin)),
    supabase
      .from("ajustements_solde")
      .select("id, delta_jours, motif, created_at")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .gte("created_at", periodeEnCours.debut.toISOString())
      .lte("created_at", `${dateIso(periodeEnCours.fin)}T23:59:59.999Z`),
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", false)
      .eq("statut", "en_attente")
      .gte("date_debut", dateIso(periodeEnCours.debut))
      .lte("date_debut", dateIso(periodeEnCours.fin)),
  ]);

  if (erreurDemandes || erreurAjustements || erreurEnAttente) {
    throw new Error("Impossible de charger l'historique du solde.");
  }

  interface MouvementBrut {
    id: string;
    type: "demande" | "ajustement";
    date: string;
    libelle: string;
    jours: number;
    motif?: string;
  }

  const mouvementsBruts: MouvementBrut[] = [
    ...(demandesRows ?? []).map((d): MouvementBrut => ({
      id: d.id,
      type: "demande",
      date: d.date_debut,
      libelle: `CP : du ${formatJjMm(d.date_debut)} au ${formatJjMm(d.date_fin)}`,
      jours: -(Number(d.nb_demi_journees) / 2),
    })),
    ...(ajustementsRows ?? []).map((a): MouvementBrut => ({
      id: a.id,
      type: "ajustement",
      date: a.created_at.slice(0, 10),
      libelle: a.motif,
      jours: Number(a.delta_jours),
      motif: a.motif,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Un bloc par mois, du 1er mois de la période jusqu'au mois en cours —
  // même sans mouvement, pour garder la continuité visuelle mois par mois.
  // Borne haute = le plus tardif entre aujourd'hui et le dernier mouvement
  // (`mouvementsBruts`, déjà trié par date croissante) : une demande validée
  // par avance sur un mois futur de la période (ex. novembre alors qu'on est
  // en août) doit rester dans la liste plutôt que d'être silencieusement
  // exclue faute de clé de mois correspondante — bug corrigé le 18/08/2026,
  // provoquait un delta entre ce feed et le badge `fetchSoldes` (qui, lui,
  // somme sur toute la période sans plafonner à "aujourd'hui").
  const cles: string[] = [];
  {
    let annee = periodeEnCours.debut.getUTCFullYear();
    let mois = periodeEnCours.debut.getUTCMonth();
    const dernierMouvement = mouvementsBruts[mouvementsBruts.length - 1];
    const borneFin =
      dernierMouvement && dernierMouvement.date > dateIso(aujourdhui)
        ? new Date(`${dernierMouvement.date}T00:00:00Z`)
        : aujourdhui;
    const anneeFin = borneFin.getUTCFullYear();
    const moisFin = borneFin.getUTCMonth();
    while (annee < anneeFin || (annee === anneeFin && mois <= moisFin)) {
      cles.push(`${annee}-${String(mois + 1).padStart(2, "0")}`);
      mois += 1;
      if (mois > 11) {
        mois = 0;
        annee += 1;
      }
    }
  }

  let cumul = soldeDepart;
  const moisListe: MoisHistoriqueSolde[] = cles.map((cle) => {
    const mouvementsDuMois: MouvementSolde[] = mouvementsBruts
      .filter((m) => m.date.slice(0, 7) === cle)
      .map((m) => {
        cumul += m.jours;
        return { ...m, soldeApres: cumul };
      });

    return {
      mois: cle,
      libelle: formatMoisAnnee(new Date(`${cle}-01T00:00:00Z`)),
      mouvements: mouvementsDuMois,
      soldeFinMois: cumul,
    };
  });

  let cumulTheorique = cumul;
  const enAttente: MouvementSolde[] = (enAttenteRows ?? [])
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut))
    .map((d) => {
      cumulTheorique -= Number(d.nb_demi_journees) / 2;
      return {
        id: d.id,
        type: "demande",
        date: d.date_debut,
        libelle: `CP : du ${formatJjMm(d.date_debut)} au ${formatJjMm(d.date_fin)}`,
        jours: -(Number(d.nb_demi_journees) / 2),
        soldeApres: cumulTheorique,
      };
    });

  return {
    periodeDebut: dateIso(periodeEnCours.debut),
    periodeFin: dateIso(periodeEnCours.fin),
    soldeDepart,
    mois: moisListe,
    soldeActuel: cumul,
    enAttente,
    soldeTheorique: cumulTheorique,
  };
}

/**
 * Feed d'historique du solde RTT d'un salarié (Espace Suivre, popin ouverte
 * au clic sur le solde RTT) — même gabarit que `fetchHistoriqueCp`, mais
 * formule différente : période de référence = **l'année** (pas de report
 * d'une période à l'autre, perdu en fin de période), et le solde ne part pas
 * d'un capital connu à l'avance : il se **construit mois après mois**
 * (accrual mensuel, `regleRTT.tauxAcquisitionMensuel`). Le feed reflète donc
 * ces accruals comme des événements positifs à part entière (type
 * `"acquisition"`), un par mois entier écoulé depuis le début de la période —
 * contrairement à CP où seule la consommation apparaît (le capital est déjà
 * tout acquis au 1er jour de la période).
 */
export async function fetchHistoriqueRtt(utilisateurId: string): Promise<HistoriqueSolde> {
  const supabase = createClient();

  const [{ data: utilisateurRow, error: erreurUtilisateur }, reglesAcquisition] = await Promise.all(
    [
      supabase.from("utilisateurs").select("taux_activite").eq("id", utilisateurId).single(),
      fetchReglesAcquisition(),
    ],
  );

  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour l'historique du solde.");
  }

  const regleRTT = reglesAcquisition.find((r) => r.typeAbsence === "RTT");
  if (!regleRTT) {
    throw new Error("Aucune règle d'acquisition RTT paramétrée.");
  }

  const prorata = Number(utilisateurRow.taux_activite ?? 100) / 100;
  const aujourdhui = new Date(`${dateIso(new Date())}T00:00:00Z`);
  const periodeRtt = periodeContenant(
    aujourdhui,
    regleRTT.periodeDebutMois,
    regleRTT.periodeDebutJour,
  );
  const moisEcoules = moisEntiersEcoules(periodeRtt.debut, aujourdhui);

  const typeAbsenceId = await getTypeAbsenceId(supabase, "RTT");

  const [
    { data: demandesRows, error: erreurDemandes },
    { data: enAttenteRows, error: erreurEnAttente },
  ] = await Promise.all([
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("statut", "validee")
      .gte("date_debut", dateIso(periodeRtt.debut))
      .lte("date_debut", dateIso(periodeRtt.fin)),
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("statut", "en_attente")
      .gte("date_debut", dateIso(periodeRtt.debut))
      .lte("date_debut", dateIso(periodeRtt.fin)),
  ]);

  if (erreurDemandes || erreurEnAttente) {
    throw new Error("Impossible de charger l'historique du solde.");
  }

  interface MouvementBrut {
    id: string;
    type: "demande" | "acquisition";
    date: string;
    libelle: string;
    jours: number;
  }

  const accrualMensuel = regleRTT.tauxAcquisitionMensuel * prorata;
  const accrualsBruts: MouvementBrut[] = Array.from({ length: moisEcoules }, (_, i) => {
    const dateMois = new Date(
      Date.UTC(
        periodeRtt.debut.getUTCFullYear(),
        periodeRtt.debut.getUTCMonth() + i,
        periodeRtt.debut.getUTCDate(),
      ),
    );
    return {
      id: `acquisition-${dateIso(dateMois)}`,
      type: "acquisition",
      date: dateIso(dateMois),
      libelle: `Acquisition ${formatMoisAnnee(dateMois)}`,
      jours: accrualMensuel,
    };
  });

  const mouvementsBruts: MouvementBrut[] = [
    ...accrualsBruts,
    ...(demandesRows ?? []).map((d): MouvementBrut => ({
      id: d.id,
      type: "demande",
      date: d.date_debut,
      libelle: `RTT : du ${formatJjMm(d.date_debut)} au ${formatJjMm(d.date_fin)}`,
      jours: -(Number(d.nb_demi_journees) / 2),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Voir `fetchHistoriqueCp` — même correctif (18/08/2026) : borne haute au
  // plus tardif entre aujourd'hui et le dernier mouvement, pas seulement
  // "aujourd'hui", pour ne pas exclure une demande validée sur un mois futur.
  const cles: string[] = [];
  {
    let annee = periodeRtt.debut.getUTCFullYear();
    let mois = periodeRtt.debut.getUTCMonth();
    const dernierMouvement = mouvementsBruts[mouvementsBruts.length - 1];
    const borneFin =
      dernierMouvement && dernierMouvement.date > dateIso(aujourdhui)
        ? new Date(`${dernierMouvement.date}T00:00:00Z`)
        : aujourdhui;
    const anneeFin = borneFin.getUTCFullYear();
    const moisFin = borneFin.getUTCMonth();
    while (annee < anneeFin || (annee === anneeFin && mois <= moisFin)) {
      cles.push(`${annee}-${String(mois + 1).padStart(2, "0")}`);
      mois += 1;
      if (mois > 11) {
        mois = 0;
        annee += 1;
      }
    }
  }

  let cumul = 0;
  const moisListe: MoisHistoriqueSolde[] = cles.map((cle) => {
    const mouvementsDuMois: MouvementSolde[] = mouvementsBruts
      .filter((m) => m.date.slice(0, 7) === cle)
      .map((m) => {
        cumul += m.jours;
        return { ...m, soldeApres: cumul };
      });

    return {
      mois: cle,
      libelle: formatMoisAnnee(new Date(`${cle}-01T00:00:00Z`)),
      mouvements: mouvementsDuMois,
      soldeFinMois: cumul,
    };
  });

  let cumulTheorique = cumul;
  const enAttente: MouvementSolde[] = (enAttenteRows ?? [])
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut))
    .map((d) => {
      cumulTheorique -= Number(d.nb_demi_journees) / 2;
      return {
        id: d.id,
        type: "demande",
        date: d.date_debut,
        libelle: `RTT : du ${formatJjMm(d.date_debut)} au ${formatJjMm(d.date_fin)}`,
        jours: -(Number(d.nb_demi_journees) / 2),
        soldeApres: cumulTheorique,
      };
    });

  return {
    periodeDebut: dateIso(periodeRtt.debut),
    periodeFin: dateIso(periodeRtt.fin),
    soldeDepart: 0,
    mois: moisListe,
    soldeActuel: Math.max(0, cumul),
    enAttente,
    soldeTheorique: Math.max(0, cumulTheorique),
  };
}

/**
 * Feed d'historique du solde CPA d'un salarié (Espace Suivre, popin ouverte
 * au clic sur le solde CPA) — même principe d'accrual mensuel que RTT (pas de
 * capital connu d'avance, `type: "acquisition"` un événement par mois entier
 * écoulé), mais sur une fenêtre temporelle **décalée** : l'acquisition se
 * déroule sur la période CP **en cours** (`periodeEnCours`, même horloge que
 * `regleCP`), pendant qu'elle finance des congés anticipés dont les dates
 * tombent, elles, dans la période **suivante** (`periodeSuivante`,
 * `is_anticipation = true` — même logique que `fetchSoldes`). Les clés de
 * mois du feed sont donc dérivées des dates réelles des mouvements plutôt
 * que d'un simple parcours calendaire borné à aujourd'hui : un événement de
 * consommation tombant dans la période suivante (donc hors de la fenêtre
 * d'acquisition) ne doit pas être silencieusement perdu.
 */
export async function fetchHistoriqueCpa(utilisateurId: string): Promise<HistoriqueSolde> {
  const supabase = createClient();

  const [{ data: utilisateurRow, error: erreurUtilisateur }, reglesAcquisition] = await Promise.all(
    [
      supabase.from("utilisateurs").select("taux_activite").eq("id", utilisateurId).single(),
      fetchReglesAcquisition(),
    ],
  );

  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour l'historique du solde.");
  }

  const regleCP = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  if (!regleCP) {
    throw new Error("Aucune règle d'acquisition CP paramétrée.");
  }

  const prorata = Number(utilisateurRow.taux_activite ?? 100) / 100;
  const aujourdhui = new Date(`${dateIso(new Date())}T00:00:00Z`);
  const periodeEnCours = periodeContenant(
    aujourdhui,
    regleCP.periodeDebutMois,
    regleCP.periodeDebutJour,
  );
  const periodeSuivante = decalerPeriode(periodeEnCours, 1);
  const moisEcoules = moisEntiersEcoules(periodeEnCours.debut, aujourdhui);

  const typeAbsenceId = await getTypeAbsenceId(supabase, "CP");

  const [
    { data: demandesRows, error: erreurDemandes },
    { data: enAttenteRows, error: erreurEnAttente },
  ] = await Promise.all([
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", true)
      .eq("statut", "validee")
      .gte("date_debut", dateIso(periodeSuivante.debut))
      .lte("date_debut", dateIso(periodeSuivante.fin)),
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", true)
      .eq("statut", "en_attente")
      .gte("date_debut", dateIso(periodeSuivante.debut))
      .lte("date_debut", dateIso(periodeSuivante.fin)),
  ]);

  if (erreurDemandes || erreurEnAttente) {
    throw new Error("Impossible de charger l'historique du solde.");
  }

  interface MouvementBrut {
    id: string;
    type: "demande" | "acquisition";
    date: string;
    libelle: string;
    jours: number;
  }

  const accrualMensuel = regleCP.tauxAcquisitionMensuel * prorata;
  const accrualsBruts: MouvementBrut[] = Array.from({ length: moisEcoules }, (_, i) => {
    const dateMois = new Date(
      Date.UTC(
        periodeEnCours.debut.getUTCFullYear(),
        periodeEnCours.debut.getUTCMonth() + i,
        periodeEnCours.debut.getUTCDate(),
      ),
    );
    return {
      id: `acquisition-${dateIso(dateMois)}`,
      type: "acquisition",
      date: dateIso(dateMois),
      libelle: `Acquisition ${formatMoisAnnee(dateMois)}`,
      jours: accrualMensuel,
    };
  });

  const mouvementsBruts: MouvementBrut[] = [
    ...accrualsBruts,
    ...(demandesRows ?? []).map((d): MouvementBrut => ({
      id: d.id,
      type: "demande",
      date: d.date_debut,
      libelle: `CPA : du ${formatJjMm(d.date_debut)} au ${formatJjMm(d.date_fin)}`,
      jours: -(Number(d.nb_demi_journees) / 2),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const cles = [...new Set(mouvementsBruts.map((m) => m.date.slice(0, 7)))].sort();

  let cumul = 0;
  const moisListe: MoisHistoriqueSolde[] = cles.map((cle) => {
    const mouvementsDuMois: MouvementSolde[] = mouvementsBruts
      .filter((m) => m.date.slice(0, 7) === cle)
      .map((m) => {
        cumul += m.jours;
        return { ...m, soldeApres: cumul };
      });

    return {
      mois: cle,
      libelle: formatMoisAnnee(new Date(`${cle}-01T00:00:00Z`)),
      mouvements: mouvementsDuMois,
      soldeFinMois: cumul,
    };
  });

  let cumulTheorique = cumul;
  const enAttente: MouvementSolde[] = (enAttenteRows ?? [])
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut))
    .map((d) => {
      cumulTheorique -= Number(d.nb_demi_journees) / 2;
      return {
        id: d.id,
        type: "demande",
        date: d.date_debut,
        libelle: `CPA : du ${formatJjMm(d.date_debut)} au ${formatJjMm(d.date_fin)}`,
        jours: -(Number(d.nb_demi_journees) / 2),
        soldeApres: cumulTheorique,
      };
    });

  return {
    periodeDebut: dateIso(periodeEnCours.debut),
    periodeFin: dateIso(periodeEnCours.fin),
    soldeDepart: 0,
    mois: moisListe,
    soldeActuel: Math.max(0, cumul),
    enAttente,
    soldeTheorique: Math.max(0, cumulTheorique),
  };
}

/** Régulation manuelle du solde CP par Delphine — RLS réservée à l'admin. */
export async function ajouterAjustementSolde(
  utilisateurId: string,
  input: AjustementSoldeInput,
): Promise<void> {
  const supabase = createClient();

  const [typeAbsenceId, auteurId] = await Promise.all([
    getTypeAbsenceId(supabase, "CP"),
    getUtilisateurIdCourant(supabase),
  ]);

  const { error } = await supabase.from("ajustements_solde").insert({
    utilisateur_id: utilisateurId,
    type_absence_id: typeAbsenceId,
    delta_jours: input.deltaJours,
    motif: input.motif,
    auteur_id: auteurId,
  });

  if (error) {
    throw new Error("Impossible d'enregistrer l'ajustement.");
  }
}
