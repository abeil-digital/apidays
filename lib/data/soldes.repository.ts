import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AjustementSoldeInput,
  HistoriqueSolde,
  MoisHistoriqueSolde,
  MouvementSolde,
  RegleAnciennete,
  Soldes,
  SoldeCategorie,
  SoldeInitial,
  TypeDemande,
} from "@/lib/types";
import { formatPeriodePillNumerique, moisEffet } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { getTypeAbsenceId } from "@/lib/data/typesAbsences";
import { fetchReglesAcquisition, fetchReglesAnciennete } from "@/lib/data/reglesConges.repository";
import { fetchHistoriqueUtilisateur, fetchSoldeInitial } from "@/lib/data/utilisateurs.repository";

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

interface EntreeTauxActivite {
  ancienneValeur: string | null;
  nouvelleValeur: string;
  dateEffet: string;
}

async function fetchHistoriqueTauxActivite(utilisateurId: string): Promise<EntreeTauxActivite[]> {
  const historique = await fetchHistoriqueUtilisateur(utilisateurId);
  return historique
    .filter((h) => h.champ === "taux_activite")
    .map((h) => ({
      ancienneValeur: h.ancienneValeur,
      nouvelleValeur: h.nouvelleValeur,
      dateEffet: h.dateEffet,
    }));
}

/**
 * Résout le taux d'activité en vigueur pour un mois donné (`anneeMoisIso`,
 * format YYYY-MM) — prorata mensuel plutôt que recalcul rétroactif plat, voir
 * CONTEXTE.md (21/08/2026). Sans historique (ou pour un mois antérieur à la
 * première entrée), retombe sur `tauxActuel`/`ancienneValeur` : un profil sans
 * changement de taux calcule un solde identique à avant cette fonctionnalité.
 */
function resolverTauxActiviteEffectif(
  historique: EntreeTauxActivite[],
  tauxActuel: number,
  anneeMoisIso: string,
): number {
  if (historique.length === 0) return tauxActuel;

  const trie = [...historique].sort((a, b) => a.dateEffet.localeCompare(b.dateEffet));
  let resultat: number | null = null;
  for (const entree of trie) {
    if (moisEffet(entree.dateEffet) <= anneeMoisIso) {
      resultat = Number(entree.nouvelleValeur);
    } else {
      break;
    }
  }
  if (resultat !== null) return resultat;

  const premiere = trie[0];
  return premiere.ancienneValeur !== null ? Number(premiere.ancienneValeur) : tauxActuel;
}

/** Somme, mois par mois depuis `periodeDebut`, de l'acquisition mensuelle
 * (`tauxAcquisitionMensuel * tauxEffectif/100`) sur `nbMois` mois — remplace
 * la multiplication plate `nbMois * tauxAcquisitionMensuel * prorata` pour ne
 * pas recalculer rétroactivement un mois déjà acquis à l'ancien taux. */
function accrualMensuelSomme(
  tauxAcquisitionMensuel: number,
  historique: EntreeTauxActivite[],
  tauxActuel: number,
  periodeDebut: Date,
  nbMois: number,
): number {
  let total = 0;
  for (let i = 0; i < nbMois; i++) {
    const dateMois = new Date(
      Date.UTC(periodeDebut.getUTCFullYear(), periodeDebut.getUTCMonth() + i, 1),
    );
    const cle = `${dateMois.getUTCFullYear()}-${String(dateMois.getUTCMonth() + 1).padStart(2, "0")}`;
    total +=
      tauxAcquisitionMensuel * (resolverTauxActiviteEffectif(historique, tauxActuel, cle) / 100);
  }
  return total;
}

/** 1er jour du mois suivant `dateIsoRef` — toujours le mois d'après, même si
 * `dateIsoRef` est déjà un 1er (le solde saisi "à date" est supposé inclure
 * l'acquisition du mois en cours, l'accrual ne doit repartir qu'au mois
 * suivant). Utilisé par `resolverPointDepartAccrual` (solde initial). */
function premierJourMoisSuivant(dateIsoRef: string): Date {
  const d = new Date(`${dateIsoRef}T00:00:00Z`);
  let annee = d.getUTCFullYear();
  let mois = d.getUTCMonth() + 1;
  if (mois > 11) {
    mois = 0;
    annee += 1;
  }
  return new Date(Date.UTC(annee, mois, 1));
}

/**
 * Point de départ et base de l'accrual RTT/CPA (21/08/2026, solde initial
 * lancement en prod) — si un solde initial existe et que sa date de
 * référence tombe dans la période en cours de calcul, l'accrual ne repart
 * plus du 1er jour de la période mais du mois suivant la référence, avec le
 * solde saisi comme base (au lieu de 0) : le report/accrual automatique
 * n'aurait aucune donnée fiable avant la référence (pas de `demandes_conges`
 * antérieures à l'usage de l'app). Une fois la référence dans une période
 * antérieure (période suivante entamée), l'app a tout suivi elle-même :
 * comportement normal repris (retombe sur `{ debut: periode.debut, base: 0 }`).
 */
function resolverPointDepartAccrual(
  periode: Periode,
  soldeInitial: SoldeInitial | null,
  champ: "rtt" | "cpa",
): { debut: Date; base: number; dateAffichage: string } {
  if (
    soldeInitial &&
    soldeInitial.dateReference >= dateIso(periode.debut) &&
    soldeInitial.dateReference <= dateIso(periode.fin)
  ) {
    return {
      debut: premierJourMoisSuivant(soldeInitial.dateReference),
      base: soldeInitial[champ],
      dateAffichage: soldeInitial.dateReference,
    };
  }
  return { debut: periode.debut, base: 0, dateAffichage: dateIso(periode.debut) };
}

/**
 * Capital CP total effectif pour la période en cours (21/08/2026, solde
 * initial) — le CP est un capital figé, acquis en une fois pour toute la
 * période (1er juin au 31 mai par ex.), pas recalculé mois par mois (décision
 * Vincent, 21/08/2026). Si un solde initial existe et que la période
 * précédente s'est terminée avant ou à sa date de référence, la valeur CP
 * saisie **remplace entièrement** `capitalBase + reportAutomatique` — pas
 * uniquement le report : la fiche de paie donne un solde total à cette date,
 * pas un simple reliquat auquel il faudrait encore ajouter un nouveau capital
 * calculé par l'app (qui ferait double emploi avec l'historique réel déjà
 * incorporé dans la valeur saisie). Sinon (référence plus ancienne qu'une
 * période déjà entièrement suivie par l'app, ou pas de solde initial) :
 * calcul automatique inchangé.
 */
function resolverCapitalCpTotal(
  capitalBase: number,
  periodePrecedente: Periode,
  soldeInitial: SoldeInitial | null,
  reportAutomatique: number,
): number {
  if (soldeInitial && dateIso(periodePrecedente.fin) <= soldeInitial.dateReference) {
    return soldeInitial.cp;
  }
  return capitalBase + reportAutomatique;
}

/**
 * Restreint la borne basse d'une période de CONSOMMATION (validée, en
 * attente, ajustements) à la date de référence du solde initial quand celui-
 * ci s'applique (21/08/2026, correctif) — sans ça, la consommation déjà
 * comptée dans le solde saisi (une fiche de paie donne un solde déjà net de
 * ce qui a été pris) se retrouvait déduite une seconde fois via les
 * `demandes_conges` réellement enregistrées dans l'app avant la date de
 * référence, faisant apparaître un solde faussement négatif. Utilisée pour le
 * remplacement complet côté CP (`resolverCapitalCpTotal`, condition sur
 * `periodePrecedente`) — la fenêtre de conso CPA restant sur la période
 * SUIVANTE n'a pas besoin de ce correctif, la référence n'y tombe jamais.
 */
function periodeConsommationCp(
  periodeEnCours: Periode,
  periodePrecedente: Periode,
  soldeInitial: SoldeInitial | null,
): Periode {
  if (soldeInitial && dateIso(periodePrecedente.fin) <= soldeInitial.dateReference) {
    return { debut: new Date(`${soldeInitial.dateReference}T00:00:00Z`), fin: periodeEnCours.fin };
  }
  return periodeEnCours;
}

/** Même principe que `periodeConsommationCp`, pour la fenêtre de conso
 * RTT/CPA (accrual mensuel, condition sur l'appartenance à la période plutôt
 * que sur `periodePrecedente` — voir `resolverPointDepartAccrual`). */
function periodeConsommationAccrual(periode: Periode, soldeInitial: SoldeInitial | null): Periode {
  if (
    soldeInitial &&
    soldeInitial.dateReference >= dateIso(periode.debut) &&
    soldeInitial.dateReference <= dateIso(periode.fin)
  ) {
    return { debut: new Date(`${soldeInitial.dateReference}T00:00:00Z`), fin: periode.fin };
  }
  return periode;
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

  const [
    { data: utilisateurRow, error: erreurUtilisateur },
    reglesAcquisition,
    reglesAnciennete,
    historiqueTaux,
    soldeInitial,
  ] = await Promise.all([
    supabase
      .from("utilisateurs")
      .select("date_entree, anciennete_date_reference, taux_activite")
      .eq("id", id)
      .single(),
    fetchReglesAcquisition(),
    fetchReglesAnciennete(),
    fetchHistoriqueTauxActivite(id),
    fetchSoldeInitial(id),
  ]);

  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour le calcul du solde.");
  }

  const tauxActuel = Number(utilisateurRow.taux_activite ?? 100);
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

    const capitalBase =
      accrualMensuelSomme(
        regleCP.tauxAcquisitionMensuel,
        historiqueTaux,
        tauxActuel,
        periodeEnCours.debut,
        12,
      ) + bonus;
    const consommePeriodePrecedente = await sommeJours(
      supabase,
      id,
      "CP",
      ["validee"],
      false,
      periodePrecedente,
    );
    const reportAutomatique = regleCP.reportAutorise
      ? Math.max(0, capitalBase - consommePeriodePrecedente)
      : 0;
    const capitalCpTotal = resolverCapitalCpTotal(
      capitalBase,
      periodePrecedente,
      soldeInitial,
      reportAutomatique,
    );
    const periodeConsoCp = periodeConsommationCp(periodeEnCours, periodePrecedente, soldeInitial);

    const consommeEnCours = await sommeJours(
      supabase,
      id,
      "CP",
      ["validee"],
      false,
      periodeConsoCp,
    );
    const enAttenteEnCours = await sommeJours(
      supabase,
      id,
      "CP",
      ["en_attente"],
      false,
      periodeConsoCp,
    );
    const ajustementsEnCours = await sommeAjustements(supabase, id, "CP", periodeConsoCp);
    const soldeCp = capitalCpTotal - consommeEnCours + ajustementsEnCours;

    cp = {
      valeur: soldeCp,
      valeurApresAttente: soldeCp - enAttenteEnCours,
      conditionPrefixe: "À poser avant le",
      conditionAccent: formatDateCourte(periodeEnCours.fin),
    };

    const { debut: debutCpa, base: baseCpa } = resolverPointDepartAccrual(
      periodeEnCours,
      soldeInitial,
      "cpa",
    );
    const moisEcoulesCpa = moisEntiersEcoules(debutCpa, aujourdhui);
    const accrualCpa =
      baseCpa +
      accrualMensuelSomme(
        regleCP.tauxAcquisitionMensuel,
        historiqueTaux,
        tauxActuel,
        debutCpa,
        moisEcoulesCpa,
      );
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
    const { debut: debutRtt, base: baseRtt } = resolverPointDepartAccrual(
      periodeRtt,
      soldeInitial,
      "rtt",
    );
    const moisEcoules = moisEntiersEcoules(debutRtt, aujourdhui);
    const accrual =
      baseRtt +
      accrualMensuelSomme(
        regleRTT.tauxAcquisitionMensuel,
        historiqueTaux,
        tauxActuel,
        debutRtt,
        moisEcoules,
      );
    const periodeConsoRtt = periodeConsommationAccrual(periodeRtt, soldeInitial);
    const consomme = await sommeJours(supabase, id, "RTT", ["validee"], null, periodeConsoRtt);
    const enAttente = await sommeJours(supabase, id, "RTT", ["en_attente"], null, periodeConsoRtt);
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

  const [
    { data: utilisateurRow, error: erreurUtilisateur },
    reglesAcquisition,
    historiqueTaux,
    soldeInitial,
  ] = await Promise.all([
    supabase.from("utilisateurs").select("taux_activite").eq("id", id).single(),
    fetchReglesAcquisition(),
    fetchHistoriqueTauxActivite(id),
    fetchSoldeInitial(id),
  ]);
  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour le calcul du solde anticipé.");
  }
  const tauxActuel = Number(utilisateurRow.taux_activite ?? 100);

  if (type === "RTT") {
    const regleRTT = reglesAcquisition.find((r) => r.typeAbsence === "RTT");
    if (!regleRTT) return 0;
    const periodeRtt = periodeContenant(
      reference,
      regleRTT.periodeDebutMois,
      regleRTT.periodeDebutJour,
    );
    const { debut: debutRtt, base: baseRtt } = resolverPointDepartAccrual(
      periodeRtt,
      soldeInitial,
      "rtt",
    );
    const moisEcoules = moisEntiersEcoules(debutRtt, reference);
    const accrual =
      baseRtt +
      accrualMensuelSomme(
        regleRTT.tauxAcquisitionMensuel,
        historiqueTaux,
        tauxActuel,
        debutRtt,
        moisEcoules,
      );
    const periodeConsoRtt = periodeConsommationAccrual(periodeRtt, soldeInitial);
    const consomme = await sommeJours(supabase, id, "RTT", ["validee"], null, periodeConsoRtt);
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
  const { debut: debutCpa, base: baseCpa } = resolverPointDepartAccrual(
    periodeEnCours,
    soldeInitial,
    "cpa",
  );
  const moisEcoulesCpa = moisEntiersEcoules(debutCpa, reference);
  const accrualCpa =
    baseCpa +
    accrualMensuelSomme(
      regleCP.tauxAcquisitionMensuel,
      historiqueTaux,
      tauxActuel,
      debutCpa,
      moisEcoulesCpa,
    );
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

  const [
    { data: utilisateurRow, error: erreurUtilisateur },
    reglesAcquisition,
    reglesAnciennete,
    historiqueTaux,
    soldeInitial,
  ] = await Promise.all([
    supabase
      .from("utilisateurs")
      .select("date_entree, anciennete_date_reference, taux_activite")
      .eq("id", utilisateurId)
      .single(),
    fetchReglesAcquisition(),
    fetchReglesAnciennete(),
    fetchHistoriqueTauxActivite(utilisateurId),
    fetchSoldeInitial(utilisateurId),
  ]);

  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour l'historique du solde.");
  }

  const regleCP = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  if (!regleCP) {
    throw new Error("Aucune règle d'acquisition CP paramétrée.");
  }

  const tauxActuel = Number(utilisateurRow.taux_activite ?? 100);
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

  const capitalBase =
    accrualMensuelSomme(
      regleCP.tauxAcquisitionMensuel,
      historiqueTaux,
      tauxActuel,
      periodeEnCours.debut,
      12,
    ) + bonus;
  const consommePeriodePrecedente = await sommeJours(
    supabase,
    utilisateurId,
    "CP",
    ["validee"],
    false,
    periodePrecedente,
  );
  const reportAutomatique = regleCP.reportAutorise
    ? Math.max(0, capitalBase - consommePeriodePrecedente)
    : 0;
  const soldeDepart = resolverCapitalCpTotal(
    capitalBase,
    periodePrecedente,
    soldeInitial,
    reportAutomatique,
  );
  const soldeDepartDate =
    soldeInitial && dateIso(periodePrecedente.fin) <= soldeInitial.dateReference
      ? soldeInitial.dateReference
      : dateIso(periodeEnCours.debut);
  const periodeConsoCp = periodeConsommationCp(periodeEnCours, periodePrecedente, soldeInitial);

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
      .gte("date_debut", dateIso(periodeConsoCp.debut))
      .lte("date_debut", dateIso(periodeEnCours.fin)),
    supabase
      .from("ajustements_solde")
      .select("id, delta_jours, motif, created_at")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .gte("created_at", periodeConsoCp.debut.toISOString())
      .lte("created_at", `${dateIso(periodeEnCours.fin)}T23:59:59.999Z`),
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", false)
      .eq("statut", "en_attente")
      .gte("date_debut", dateIso(periodeConsoCp.debut))
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
      libelle: `CP : ${formatPeriodePillNumerique(d.date_debut, d.date_fin)}`,
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
        libelle: `CP : ${formatPeriodePillNumerique(d.date_debut, d.date_fin)}`,
        jours: -(Number(d.nb_demi_journees) / 2),
        soldeApres: cumulTheorique,
      };
    });

  return {
    periodeDebut: dateIso(periodeEnCours.debut),
    periodeFin: dateIso(periodeEnCours.fin),
    soldeDepart,
    soldeDepartDate,
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

  const [
    { data: utilisateurRow, error: erreurUtilisateur },
    reglesAcquisition,
    historiqueTaux,
    soldeInitial,
  ] = await Promise.all([
    supabase.from("utilisateurs").select("taux_activite").eq("id", utilisateurId).single(),
    fetchReglesAcquisition(),
    fetchHistoriqueTauxActivite(utilisateurId),
    fetchSoldeInitial(utilisateurId),
  ]);

  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour l'historique du solde.");
  }

  const regleRTT = reglesAcquisition.find((r) => r.typeAbsence === "RTT");
  if (!regleRTT) {
    throw new Error("Aucune règle d'acquisition RTT paramétrée.");
  }

  const tauxActuel = Number(utilisateurRow.taux_activite ?? 100);
  const aujourdhui = new Date(`${dateIso(new Date())}T00:00:00Z`);
  const periodeRtt = periodeContenant(
    aujourdhui,
    regleRTT.periodeDebutMois,
    regleRTT.periodeDebutJour,
  );
  const {
    debut: debutRtt,
    base: baseRtt,
    dateAffichage: soldeDepartDate,
  } = resolverPointDepartAccrual(
    periodeRtt,
    soldeInitial,
    "rtt",
  );
  const moisEcoules = moisEntiersEcoules(debutRtt, aujourdhui);
  const periodeConsoRtt = periodeConsommationAccrual(periodeRtt, soldeInitial);

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
      .gte("date_debut", dateIso(periodeConsoRtt.debut))
      .lte("date_debut", dateIso(periodeRtt.fin)),
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("statut", "en_attente")
      .gte("date_debut", dateIso(periodeConsoRtt.debut))
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

  const accrualsBruts: MouvementBrut[] = Array.from({ length: moisEcoules }, (_, i) => {
    const dateMois = new Date(
      Date.UTC(debutRtt.getUTCFullYear(), debutRtt.getUTCMonth() + i, debutRtt.getUTCDate()),
    );
    const cleMois = `${dateMois.getUTCFullYear()}-${String(dateMois.getUTCMonth() + 1).padStart(2, "0")}`;
    const tauxEffectif = resolverTauxActiviteEffectif(historiqueTaux, tauxActuel, cleMois);
    return {
      id: `acquisition-${dateIso(dateMois)}`,
      type: "acquisition",
      date: dateIso(dateMois),
      libelle: `Acquisition ${formatMoisAnnee(dateMois)}`,
      jours: regleRTT.tauxAcquisitionMensuel * (tauxEffectif / 100),
    };
  });

  const mouvementsBruts: MouvementBrut[] = [
    ...accrualsBruts,
    ...(demandesRows ?? []).map((d): MouvementBrut => ({
      id: d.id,
      type: "demande",
      date: d.date_debut,
      libelle: `RTT : ${formatPeriodePillNumerique(d.date_debut, d.date_fin)}`,
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

  let cumul = baseRtt;
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
        libelle: `RTT : ${formatPeriodePillNumerique(d.date_debut, d.date_fin)}`,
        jours: -(Number(d.nb_demi_journees) / 2),
        soldeApres: cumulTheorique,
      };
    });

  return {
    periodeDebut: dateIso(periodeRtt.debut),
    periodeFin: dateIso(periodeRtt.fin),
    soldeDepart: baseRtt,
    soldeDepartDate,
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

  const [
    { data: utilisateurRow, error: erreurUtilisateur },
    reglesAcquisition,
    historiqueTaux,
    soldeInitial,
  ] = await Promise.all([
    supabase.from("utilisateurs").select("taux_activite").eq("id", utilisateurId).single(),
    fetchReglesAcquisition(),
    fetchHistoriqueTauxActivite(utilisateurId),
    fetchSoldeInitial(utilisateurId),
  ]);

  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour l'historique du solde.");
  }

  const regleCP = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  if (!regleCP) {
    throw new Error("Aucune règle d'acquisition CP paramétrée.");
  }

  const tauxActuel = Number(utilisateurRow.taux_activite ?? 100);
  const aujourdhui = new Date(`${dateIso(new Date())}T00:00:00Z`);
  const periodeEnCours = periodeContenant(
    aujourdhui,
    regleCP.periodeDebutMois,
    regleCP.periodeDebutJour,
  );
  const periodeSuivante = decalerPeriode(periodeEnCours, 1);
  const {
    debut: debutCpa,
    base: baseCpa,
    dateAffichage: soldeDepartDate,
  } = resolverPointDepartAccrual(periodeEnCours, soldeInitial, "cpa");
  const moisEcoules = moisEntiersEcoules(debutCpa, aujourdhui);

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

  const accrualsBruts: MouvementBrut[] = Array.from({ length: moisEcoules }, (_, i) => {
    const dateMois = new Date(
      Date.UTC(debutCpa.getUTCFullYear(), debutCpa.getUTCMonth() + i, debutCpa.getUTCDate()),
    );
    const cleMois = `${dateMois.getUTCFullYear()}-${String(dateMois.getUTCMonth() + 1).padStart(2, "0")}`;
    const tauxEffectif = resolverTauxActiviteEffectif(historiqueTaux, tauxActuel, cleMois);
    return {
      id: `acquisition-${dateIso(dateMois)}`,
      type: "acquisition",
      date: dateIso(dateMois),
      libelle: `Acquisition ${formatMoisAnnee(dateMois)}`,
      jours: regleCP.tauxAcquisitionMensuel * (tauxEffectif / 100),
    };
  });

  const mouvementsBruts: MouvementBrut[] = [
    ...accrualsBruts,
    ...(demandesRows ?? []).map((d): MouvementBrut => ({
      id: d.id,
      type: "demande",
      date: d.date_debut,
      libelle: `CPA : ${formatPeriodePillNumerique(d.date_debut, d.date_fin)}`,
      jours: -(Number(d.nb_demi_journees) / 2),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const cles = [...new Set(mouvementsBruts.map((m) => m.date.slice(0, 7)))].sort();

  let cumul = baseCpa;
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
        libelle: `CPA : ${formatPeriodePillNumerique(d.date_debut, d.date_fin)}`,
        jours: -(Number(d.nb_demi_journees) / 2),
        soldeApres: cumulTheorique,
      };
    });

  return {
    periodeDebut: dateIso(periodeEnCours.debut),
    periodeFin: dateIso(periodeEnCours.fin),
    soldeDepart: baseCpa,
    soldeDepartDate,
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
