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
 * `regles_acquisition`/`regles_anciennete` (Paramétrer > Congés & RTT), des
 * demandes déjà décidées et des transmissions paie, plutôt que lu/maintenu
 * dans la table `soldes` (pas de job planifié dans cette appli pour la tenir
 * à jour sans risque de désynchronisation). Voir CONTEXTE.md pour le détail
 * de la formule.
 *
 * Deux niveaux de solde exposés par catégorie (27/08/2026, refonte du modèle
 * — voir CONTEXTE.md "Refonte du modèle solde théorique/réel") :
 *
 * - **`valeur` ("solde réel")** = capital − ce qui a été **effectivement
 *   transmis en paie** (`export_paie_lignes`, voir `sommeTransmis`), pas le
 *   statut `validee` des demandes. C'est le référentiel de Delphine pour
 *   "Vérifier les fiches de paie" : ce nombre doit correspondre à ce qui est
 *   écrit sur la fiche de paie du comptable. Il retarde naturellement sur la
 *   validation tant qu'un export n'a pas été généré.
 * - **`valeurApresAttente` ("solde théorique")** = capital − tout ce qui est
 *   validé OU en attente sur la période (même traitement pour les deux,
 *   via `sommeJours`). Répond à "combien il me reste à poser" — c'est le
 *   solde affiché au collaborateur (Accueil) et celui qui plafonne la pose
 *   d'une nouvelle demande.
 *
 * - **CP** : capital fixe pour la période en cours (acquis intégralement
 *   pendant la période précédente), + bonus ancienneté, + report du solde CP
 *   non consommé de la période précédente (un seul niveau de report, pas de
 *   cascade).
 * - **CPA** ("Congés Payés en Acquisition") : accrual mensuel en cours pour
 *   la période CP SUIVANTE (pas encore commencée), avec les mêmes deux
 *   niveaux (`is_anticipation = true`).
 * - **RTT** : accrual mensuel depuis le début de la période RTT en cours.
 *   Pas d'ancienneté, pas de report (perdus à la fin de la période).
 *
 * `ajustements_solde` (régulation manuelle par Delphine, Espace Suivre) est
 * intégrée au calcul CP comme un mouvement de plus sur la période en cours,
 * compté dans les deux niveaux — table indépendante de
 * `soldes`/`historique_soldes` (non exploitées, voir plus haut), pas de
 * risque de désynchronisation.
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

/**
 * Point de départ et base de l'accrual RTT/CPA (21/08/2026, solde initial
 * lancement en prod ; revu le 27/08/2026) — si un solde initial existe et que
 * sa date de référence tombe dans la période en cours de calcul, l'accrual ne
 * repart plus du 1er jour de la période mais du mois de la référence
 * elle-même, avec le solde saisi comme base (au lieu de 0) : le report/accrual
 * automatique n'aurait aucune donnée fiable avant la référence (pas de
 * `demandes_conges` antérieures à l'usage de l'app).
 *
 * `debut = soldeInitial.dateReference` directement (pas le mois suivant) —
 * la saisie du solde initial est maintenant contrainte au mois (sélecteur de
 * mois, pas de jour, voir `UtilisateurFichePage.tsx`) avec la convention
 * explicite "solde = constaté fin du mois précédent" : la référence "01/06"
 * désigne déjà le 1er jour du premier mois non couvert par la valeur saisie —
 * juin est donc le premier mois dont le travail doit générer une acquisition
 * (créditée au 1er juillet, `moisEntiersEcoules` compte juin comme complet dès
 * qu'on atteint juillet), pas un mois à sauter. Un décalage supplémentaire
 * d'un mois (ancien `premierJourMoisSuivant`) sautait cette toute première
 * acquisition (bug remonté par Vincent : "je ne vois pas de RTT/CPA acquis en
 * juin pour Delphine" alors que son solde initial est daté du 01/06).
 *
 * Une fois la référence dans une période antérieure (période suivante
 * entamée), l'app a tout suivi elle-même : comportement normal repris
 * (retombe sur `{ debut: periode.debut, base: 0 }`).
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
      debut: new Date(`${soldeInitial.dateReference}T00:00:00Z`),
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

/**
 * Somme en jours des demandes d'un type/statut donné dont `date_debut` tombe
 * dans la période — le statut pris en compte est celui **tel qu'il était à
 * `dateReference`**, pas le statut actuel en base (25/08/2026, bug signalé
 * par Vincent : "on ne prend pas en compte les congés exportés ?" — pour
 * `fetchSoldes(id, dateReference)` avec une date passée, filtrer sur le
 * statut ACTUEL donnait le même résultat quelle que soit `dateReference`,
 * puisqu'une régularisation ultérieure — ex. Salarié Test, annulée le 25/08
 * après avoir été validée puis transmise — repassait rétroactivement la
 * demande hors du calcul même pour une date antérieure à cette
 * régularisation, faisant disparaître tout mouvement).
 *
 * Statut à `dateReference` = la dernière ligne de `decisions_demande` avec
 * `decide_le <= dateReference` ; à défaut (demande décidée avant
 * l'introduction du journal le 25/08/2026, jamais re-décidée depuis), repli
 * sur le statut actuel si `date_decision <= dateReference`, sinon "en
 * attente" (pas encore décidée à cette date). Pour un appel "maintenant"
 * (`dateReference = aujourd'hui`), résultat identique à l'ancien filtre par
 * statut courant — aucune décision ne peut avoir lieu dans le futur.
 */
async function sommeJours(
  supabase: SupabaseClient,
  utilisateurId: string,
  type: TypeDemande,
  statuts: string[],
  isAnticipation: boolean | null,
  periode: Periode,
  dateReference: Date,
): Promise<number> {
  const typeAbsenceId = await getTypeAbsenceId(supabase, type);

  let query = supabase
    .from("demandes_conges")
    .select("id, nb_demi_journees, statut, date_decision")
    .eq("utilisateur_id", utilisateurId)
    .eq("type_absence_id", typeAbsenceId)
    .gte("date_debut", dateIso(periode.debut))
    .lte("date_debut", dateIso(periode.fin));

  if (isAnticipation !== null) {
    query = query.eq("is_anticipation", isAnticipation);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Impossible de calculer le solde.");
  }

  const demandes = data ?? [];
  if (demandes.length === 0) return 0;

  const dateReferenceIso = dateReference.toISOString();
  const { data: decisions, error: erreurDecisions } = await supabase
    .from("decisions_demande")
    .select("demande_id, statut, decide_le")
    .in(
      "demande_id",
      demandes.map((d) => d.id),
    )
    .lte("decide_le", dateReferenceIso)
    .order("decide_le", { ascending: false });

  if (erreurDecisions) {
    throw new Error("Impossible de calculer le solde.");
  }

  const derniereDecisionParDemande = new Map<string, string>();
  for (const d of decisions ?? []) {
    if (!derniereDecisionParDemande.has(d.demande_id)) {
      derniereDecisionParDemande.set(d.demande_id, d.statut);
    }
  }

  let total = 0;
  for (const d of demandes) {
    const decisionJournal = derniereDecisionParDemande.get(d.id);
    const statutAReference: string =
      decisionJournal ??
      (d.date_decision && d.date_decision <= dateReferenceIso
        ? (d.statut ?? "en_attente")
        : "en_attente");
    if (statuts.includes(statutAReference)) {
      total += Number(d.nb_demi_journees) / 2;
    }
  }
  return total;
}

/**
 * Somme signée des `export_paie_lignes.jours_inclus` déjà transmises en paie
 * pour un type/période, à une date de référence donnée — base du "solde réel"
 * (27/08/2026, refonte du modèle théorique/réel : le réel est ancré sur la
 * transmission effective, pas sur le statut `validee` des demandes comme
 * `sommeJours`). Une ligne positive (transmission normale) réduit le solde,
 * une ligne négative (correction/retro après annulation) le restitue — pas de
 * rejeu de journal nécessaire : une transmission est un fait acquis au moment
 * où elle est générée, pas à la fin de la période qu'elle couvre — d'où le
 * filtre sur `exports_paie.genere_le` (PAS `periode_fin`, bug trouvé le
 * 27/08/2026 : un export généré en cours de mois, ex. le 26/08 pour la
 * période du 01/08 au 31/08, doit compter dès le 26/08, pas seulement à
 * partir du 31/08 — sinon le réel affiché "aujourd'hui" ignore des
 * transmissions pourtant déjà faites).
 */
async function sommeTransmis(
  supabase: SupabaseClient,
  utilisateurId: string,
  type: TypeDemande,
  isAnticipation: boolean | null,
  periode: Periode,
  dateReference: Date,
): Promise<number> {
  const typeAbsenceId = await getTypeAbsenceId(supabase, type);

  let query = supabase
    .from("export_paie_lignes")
    .select(
      "jours_inclus, demandes_conges!inner(utilisateur_id, type_absence_id, is_anticipation, date_debut), exports_paie!inner(genere_le)",
    )
    .eq("demandes_conges.utilisateur_id", utilisateurId)
    .eq("demandes_conges.type_absence_id", typeAbsenceId)
    .gte("demandes_conges.date_debut", dateIso(periode.debut))
    .lte("demandes_conges.date_debut", dateIso(periode.fin))
    .lte("exports_paie.genere_le", `${dateIso(dateReference)}T23:59:59.999Z`);

  if (isAnticipation !== null) {
    query = query.eq("demandes_conges.is_anticipation", isAnticipation);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Impossible de calculer le solde transmis.");
  }

  return (data ?? []).reduce((somme, row) => somme + Number(row.jours_inclus), 0);
}

interface LigneTransmise {
  id: string;
  demande_id: string;
  date_debut: string;
  date_fin: string;
  jours_inclus: number;
}

/**
 * Lignes `export_paie_lignes` déjà transmises pour un type/période, avec les
 * dates de la demande portée — base des mouvements "réel" de
 * `fetchHistoriqueCp`/`fetchHistoriqueRtt` (27/08/2026, refonte du modèle :
 * le réel est ancré sur la transmission effective, pas sur le statut
 * `validee`). Même filtre sur `exports_paie.genere_le` que `sommeTransmis`.
 */
async function fetchLignesTransmises(
  supabase: SupabaseClient,
  utilisateurId: string,
  typeAbsenceId: string,
  isAnticipation: boolean | null,
  periode: Periode,
  dateReference: Date,
): Promise<LigneTransmise[]> {
  let query = supabase
    .from("export_paie_lignes")
    .select(
      "id, demande_id, jours_inclus, demandes_conges!inner(date_debut, date_fin, utilisateur_id, type_absence_id, is_anticipation), exports_paie!inner(genere_le)",
    )
    .eq("demandes_conges.utilisateur_id", utilisateurId)
    .eq("demandes_conges.type_absence_id", typeAbsenceId)
    .gte("demandes_conges.date_debut", dateIso(periode.debut))
    .lte("demandes_conges.date_debut", dateIso(periode.fin))
    .lte("exports_paie.genere_le", `${dateIso(dateReference)}T23:59:59.999Z`);

  if (isAnticipation !== null) {
    query = query.eq("demandes_conges.is_anticipation", isAnticipation);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Impossible de charger les lignes transmises.");
  }

  return (data ?? []).map((row) => {
    const demande = (
      Array.isArray(row.demandes_conges) ? row.demandes_conges[0] : row.demandes_conges
    ) as { date_debut: string; date_fin: string };
    return {
      id: row.id,
      demande_id: row.demande_id,
      date_debut: demande.date_debut,
      date_fin: demande.date_fin,
      jours_inclus: Number(row.jours_inclus),
    };
  });
}

/** Somme des ajustements manuels (régulation Delphine) d'un type sur une période.
 * `isAnticipation` (27/08/2026, extension RTT/CPA) — distingue CP de CPA, qui
 * partagent le même `type_absence_id` (même convention que `demandes_conges`) ;
 * RTT n'a pas cette notion, toujours `false`. */
async function sommeAjustements(
  supabase: SupabaseClient,
  utilisateurId: string,
  type: TypeDemande,
  periode: Periode,
  isAnticipation: boolean,
): Promise<number> {
  const typeAbsenceId = await getTypeAbsenceId(supabase, type);

  const { data, error } = await supabase
    .from("ajustements_solde")
    .select("delta_jours")
    .eq("utilisateur_id", utilisateurId)
    .eq("type_absence_id", typeAbsenceId)
    .eq("is_anticipation", isAnticipation)
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
/**
 * `dateReference` (25/08/2026) — optionnel, défaut `new Date()` (comportement
 * inchangé pour tous les appelants existants). Permet de calculer le solde
 * "tel qu'il était" à une date passée plutôt que toujours "maintenant" — pour
 * "Vérifier les fiches de paie" (Transmissions paie), qui doit comparer le
 * solde de fin de mois précédent/en cours d'une période potentiellement déjà
 * archivée. Le reste du moteur (accrual, ancienneté, report) prenait déjà
 * `reference` en paramètre en interne — seul le point d'entrée figeait la
 * date sur `new Date()`.
 */
export async function fetchSoldes(utilisateurId?: string, dateReference?: Date): Promise<Soldes> {
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
  const aujourdhui = new Date(`${dateIso(dateReference ?? new Date())}T00:00:00Z`);

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
      aujourdhui,
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
      aujourdhui,
    );
    const enAttenteEnCours = await sommeJours(
      supabase,
      id,
      "CP",
      ["en_attente"],
      false,
      periodeConsoCp,
      aujourdhui,
    );
    const ajustementsEnCours = await sommeAjustements(supabase, id, "CP", periodeConsoCp, false);
    const transmisEnCours = await sommeTransmis(supabase, id, "CP", false, periodeConsoCp, aujourdhui);
    const soldeCpValidee = capitalCpTotal - consommeEnCours + ajustementsEnCours;
    const soldeCpTransmis = capitalCpTotal - transmisEnCours + ajustementsEnCours;

    cp = {
      valeur: soldeCpTransmis,
      valeurApresAttente: soldeCpValidee - enAttenteEnCours,
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
    const consommeCpa = await sommeJours(
      supabase,
      id,
      "CP",
      ["validee"],
      true,
      periodeSuivante,
      aujourdhui,
    );
    const enAttenteCpa = await sommeJours(
      supabase,
      id,
      "CP",
      ["en_attente"],
      true,
      periodeSuivante,
      aujourdhui,
    );
    const transmisCpa = await sommeTransmis(supabase, id, "CP", true, periodeSuivante, aujourdhui);
    const ajustementsCpa = await sommeAjustements(supabase, id, "CP", periodeSuivante, true);
    const soldeCpaValidee = Math.max(0, accrualCpa - consommeCpa + ajustementsCpa);
    const soldeCpaTransmis = Math.max(0, accrualCpa - transmisCpa + ajustementsCpa);

    cpa = {
      valeur: soldeCpaTransmis,
      valeurApresAttente: soldeCpaValidee - enAttenteCpa,
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
    const consomme = await sommeJours(
      supabase,
      id,
      "RTT",
      ["validee"],
      null,
      periodeConsoRtt,
      aujourdhui,
    );
    const enAttente = await sommeJours(
      supabase,
      id,
      "RTT",
      ["en_attente"],
      null,
      periodeConsoRtt,
      aujourdhui,
    );
    const transmis = await sommeTransmis(supabase, id, "RTT", null, periodeConsoRtt, aujourdhui);
    const ajustementsRtt = await sommeAjustements(supabase, id, "RTT", periodeConsoRtt, false);
    const soldeValidee = Math.max(0, accrual - consomme + ajustementsRtt);
    const soldeTransmis = Math.max(0, accrual - transmis + ajustementsRtt);

    rtt = {
      valeur: soldeTransmis,
      valeurApresAttente: soldeValidee - enAttente,
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
    const consomme = await sommeJours(
      supabase,
      id,
      "RTT",
      ["validee"],
      null,
      periodeConsoRtt,
      reference,
    );
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
  const consommeCpa = await sommeJours(
    supabase,
    id,
    "CP",
    ["validee"],
    true,
    periodeSuivante,
    reference,
  );
  return Math.max(0, accrualCpa - consommeCpa);
}

/**
 * Feed d'historique du solde CP d'un salarié (Espace Suivre, popin ouverte
 * au clic sur un solde) — solde de départ (capital + report au début de la
 * période en cours), puis chaque CP validé et chaque ajustement manuel,
 * triés chronologiquement avec le solde courant après chaque mouvement.
 * CP uniquement pour l'instant.
 */
/** `dateReference` (25/08/2026) — voir doc de `fetchSoldes`, même principe. */
export async function fetchHistoriqueCp(
  utilisateurId: string,
  dateReference?: Date,
): Promise<HistoriqueSolde> {
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
  const aujourdhui = new Date(`${dateIso(dateReference ?? new Date())}T00:00:00Z`);
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
    aujourdhui,
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
    lignesTransmises,
    { data: ajustementsRows, error: erreurAjustements },
    { data: enAttenteRows, error: erreurEnAttente },
    { data: demandesValideesRows, error: erreurValidees },
  ] = await Promise.all([
    fetchLignesTransmises(
      supabase,
      utilisateurId,
      typeAbsenceId,
      false,
      { debut: periodeConsoCp.debut, fin: periodeEnCours.fin },
      aujourdhui,
    ),
    supabase
      .from("ajustements_solde")
      .select("id, delta_jours, motif, created_at, auteur:utilisateurs!auteur_id(prenom, nom)")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", false)
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
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", false)
      .eq("statut", "validee")
      .gte("date_debut", dateIso(periodeConsoCp.debut))
      .lte("date_debut", dateIso(periodeEnCours.fin)),
  ]);

  if (erreurAjustements || erreurEnAttente || erreurValidees) {
    throw new Error("Impossible de charger l'historique du solde.");
  }

  // Base du solde théorique (27/08/2026) — calculée séparément du "réel"
  // (`cumul`, ci-dessous, qui part désormais des lignes transmises) : le
  // théorique doit toujours retirer tout ce qui est validé, transmis ou non,
  // pas seulement ce qui est déjà passé en paie. `demandesValideesRows`
  // (toutes les demandes validées, pas seulement les transmises) sert à la
  // fois au total et au détail par mouvement (`mouvementsTheorique`).
  const ajustementsTotal = (ajustementsRows ?? []).reduce(
    (somme, a) => somme + Number(a.delta_jours),
    0,
  );
  const consommeValideeTotal = (demandesValideesRows ?? []).reduce(
    (somme, d) => somme + Number(d.nb_demi_journees) / 2,
    0,
  );

  interface MouvementBrut {
    id: string;
    demandeId?: string;
    type: "demande" | "ajustement";
    date: string;
    libelle: string;
    jours: number;
    motif?: string;
    auteurNom?: string;
  }

  const mouvementsBruts: MouvementBrut[] = [
    ...lignesTransmises.map((l): MouvementBrut => ({
      id: l.id,
      demandeId: l.demande_id,
      type: "demande",
      date: l.date_debut,
      libelle: `CP : ${formatPeriodePillNumerique(l.date_debut, l.date_fin)}`,
      jours: -l.jours_inclus,
    })),
    ...(ajustementsRows ?? []).map((a): MouvementBrut => {
      const auteur = Array.isArray(a.auteur) ? a.auteur[0] : a.auteur;
      return {
        id: a.id,
        type: "ajustement",
        date: a.created_at.slice(0, 10),
        libelle: a.motif,
        jours: Number(a.delta_jours),
        motif: a.motif,
        auteurNom: `${auteur?.prenom ?? ""} ${auteur?.nom ?? ""}`.trim(),
      };
    }),
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

  // Mouvements du solde théorique (27/08/2026) — mêmes ajustements que le
  // réel, mais TOUTES les demandes validées (transmises ou non), pas
  // seulement `lignesTransmises` : sans ça, les lignes affichées dans la
  // popin (mode "Théorique") ne totalisaient pas le même montant que
  // `soldeTheorique` — un salarié pouvait voir "Solde N-1 62j, -1j, -1j" puis
  // "Solde actuel 45j", incohérent en apparence (bug remonté par Vincent).
  const mouvementsBrutsTheorique: MouvementBrut[] = [
    ...(demandesValideesRows ?? []).map((d): MouvementBrut => ({
      id: d.id,
      type: "demande",
      date: d.date_debut,
      libelle: `CP : ${formatPeriodePillNumerique(d.date_debut, d.date_fin)}`,
      jours: -(Number(d.nb_demi_journees) / 2),
    })),
    ...(ajustementsRows ?? []).map((a): MouvementBrut => {
      const auteur = Array.isArray(a.auteur) ? a.auteur[0] : a.auteur;
      return {
        id: a.id,
        type: "ajustement",
        date: a.created_at.slice(0, 10),
        libelle: a.motif,
        jours: Number(a.delta_jours),
        motif: a.motif,
        auteurNom: `${auteur?.prenom ?? ""} ${auteur?.nom ?? ""}`.trim(),
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let cumulValidee = soldeDepart;
  const mouvementsTheorique: MouvementSolde[] = mouvementsBrutsTheorique.map((m) => {
    cumulValidee += m.jours;
    return { ...m, soldeApres: cumulValidee };
  });

  let cumulTheorique = soldeDepart - consommeValideeTotal + ajustementsTotal;
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
    mouvementsTheorique,
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
/** `dateReference` (25/08/2026) — voir doc de `fetchSoldes`, même principe. */
export async function fetchHistoriqueRtt(
  utilisateurId: string,
  dateReference?: Date,
): Promise<HistoriqueSolde> {
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
  const aujourdhui = new Date(`${dateIso(dateReference ?? new Date())}T00:00:00Z`);
  const periodeRtt = periodeContenant(
    aujourdhui,
    regleRTT.periodeDebutMois,
    regleRTT.periodeDebutJour,
  );
  const {
    debut: debutRtt,
    base: baseRtt,
    dateAffichage: soldeDepartDate,
  } = resolverPointDepartAccrual(periodeRtt, soldeInitial, "rtt");
  const moisEcoules = moisEntiersEcoules(debutRtt, aujourdhui);
  const periodeConsoRtt = periodeConsommationAccrual(periodeRtt, soldeInitial);

  const typeAbsenceId = await getTypeAbsenceId(supabase, "RTT");

  const [
    lignesTransmises,
    { data: ajustementsRows, error: erreurAjustements },
    { data: enAttenteRows, error: erreurEnAttente },
    { data: demandesValideesRows, error: erreurValidees },
  ] = await Promise.all([
    fetchLignesTransmises(
      supabase,
      utilisateurId,
      typeAbsenceId,
      null,
      { debut: periodeConsoRtt.debut, fin: periodeRtt.fin },
      aujourdhui,
    ),
    supabase
      .from("ajustements_solde")
      .select("id, delta_jours, motif, created_at, auteur:utilisateurs!auteur_id(prenom, nom)")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", false)
      .gte("created_at", periodeConsoRtt.debut.toISOString())
      .lte("created_at", `${dateIso(periodeRtt.fin)}T23:59:59.999Z`),
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("statut", "en_attente")
      .gte("date_debut", dateIso(periodeConsoRtt.debut))
      .lte("date_debut", dateIso(periodeRtt.fin)),
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("statut", "validee")
      .gte("date_debut", dateIso(periodeConsoRtt.debut))
      .lte("date_debut", dateIso(periodeRtt.fin)),
  ]);

  if (erreurAjustements || erreurEnAttente || erreurValidees) {
    throw new Error("Impossible de charger l'historique du solde.");
  }

  // Base du solde théorique (27/08/2026) — voir `fetchHistoriqueCp`, même
  // correctif : indépendante de `cumul` (réel, ancré transmission).
  const ajustementsTotal = (ajustementsRows ?? []).reduce(
    (somme, a) => somme + Number(a.delta_jours),
    0,
  );
  const consommeValideeTotal = (demandesValideesRows ?? []).reduce(
    (somme, d) => somme + Number(d.nb_demi_journees) / 2,
    0,
  );

  interface MouvementBrut {
    id: string;
    demandeId?: string;
    type: "demande" | "acquisition" | "ajustement";
    date: string;
    libelle: string;
    jours: number;
    motif?: string;
    auteurNom?: string;
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
    ...lignesTransmises.map((l): MouvementBrut => ({
      id: l.id,
      demandeId: l.demande_id,
      type: "demande",
      date: l.date_debut,
      libelle: `RTT : ${formatPeriodePillNumerique(l.date_debut, l.date_fin)}`,
      jours: -l.jours_inclus,
    })),
    ...(ajustementsRows ?? []).map((a): MouvementBrut => {
      const auteur = Array.isArray(a.auteur) ? a.auteur[0] : a.auteur;
      return {
        id: a.id,
        type: "ajustement",
        date: a.created_at.slice(0, 10),
        libelle: a.motif,
        jours: Number(a.delta_jours),
        motif: a.motif,
        auteurNom: `${auteur?.prenom ?? ""} ${auteur?.nom ?? ""}`.trim(),
      };
    }),
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

  // Mouvements du solde théorique (27/08/2026) — voir `fetchHistoriqueCp` :
  // mêmes acquisitions, mais TOUTES les demandes validées (transmises ou
  // non), pas seulement `lignesTransmises`.
  const mouvementsBrutsTheorique: MouvementBrut[] = [
    ...accrualsBruts,
    ...(demandesValideesRows ?? []).map((d): MouvementBrut => ({
      id: d.id,
      type: "demande",
      date: d.date_debut,
      libelle: `RTT : ${formatPeriodePillNumerique(d.date_debut, d.date_fin)}`,
      jours: -(Number(d.nb_demi_journees) / 2),
    })),
    ...(ajustementsRows ?? []).map((a): MouvementBrut => {
      const auteur = Array.isArray(a.auteur) ? a.auteur[0] : a.auteur;
      return {
        id: a.id,
        type: "ajustement",
        date: a.created_at.slice(0, 10),
        libelle: a.motif,
        jours: Number(a.delta_jours),
        motif: a.motif,
        auteurNom: `${auteur?.prenom ?? ""} ${auteur?.nom ?? ""}`.trim(),
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let cumulValidee = baseRtt;
  const mouvementsTheorique: MouvementSolde[] = mouvementsBrutsTheorique.map((m) => {
    cumulValidee += m.jours;
    return { ...m, soldeApres: cumulValidee };
  });

  const accrualTotal = accrualsBruts.reduce((somme, a) => somme + a.jours, 0);
  let cumulTheorique = baseRtt + accrualTotal - consommeValideeTotal + ajustementsTotal;
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
    mouvementsTheorique,
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
    { data: ajustementsRows, error: erreurAjustements },
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
      .from("ajustements_solde")
      .select("id, delta_jours, motif, created_at, auteur:utilisateurs!auteur_id(prenom, nom)")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", true)
      .gte("created_at", debutCpa.toISOString())
      .lte("created_at", `${dateIso(aujourdhui)}T23:59:59.999Z`),
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

  if (erreurDemandes || erreurAjustements || erreurEnAttente) {
    throw new Error("Impossible de charger l'historique du solde.");
  }

  interface MouvementBrut {
    id: string;
    demandeId?: string;
    type: "demande" | "acquisition" | "ajustement";
    date: string;
    libelle: string;
    jours: number;
    motif?: string;
    auteurNom?: string;
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
    ...(ajustementsRows ?? []).map((a): MouvementBrut => {
      const auteur = Array.isArray(a.auteur) ? a.auteur[0] : a.auteur;
      return {
        id: a.id,
        type: "ajustement",
        date: a.created_at.slice(0, 10),
        libelle: a.motif,
        jours: Number(a.delta_jours),
        motif: a.motif,
        auteurNom: `${auteur?.prenom ?? ""} ${auteur?.nom ?? ""}`.trim(),
      };
    }),
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

/** Régulation manuelle du solde CP/RTT/CPA par Delphine — RLS réservée à
 * l'admin. `code` (27/08/2026, extension RTT/CPA — était CP uniquement) :
 * CPA partage le `type_absence_id` de CP, distingué par `is_anticipation`
 * (même convention que `demandes_conges`) ; RTT est un type à part entière. */
export async function ajouterAjustementSolde(
  utilisateurId: string,
  input: AjustementSoldeInput,
): Promise<void> {
  const supabase = createClient();

  const [typeAbsenceId, auteurId] = await Promise.all([
    getTypeAbsenceId(supabase, input.code === "RTT" ? "RTT" : "CP"),
    getUtilisateurIdCourant(supabase),
  ]);

  const { error } = await supabase.from("ajustements_solde").insert({
    utilisateur_id: utilisateurId,
    type_absence_id: typeAbsenceId,
    is_anticipation: input.code === "CPA",
    delta_jours: input.deltaJours,
    motif: input.motif,
    auteur_id: auteurId,
  });

  if (error) {
    throw new Error("Impossible d'enregistrer l'ajustement.");
  }
}

/** Liste des ajustements manuels d'un collaborateur/type sur une période
 * (27/08/2026) — pour l'affichage dans la popin "Liste des événements" de
 * "Vérifier les fiches de paie" (`VerifierFichesPaiePage2`), à côté des
 * jours transmis et de l'acquisition. Périmètre volontairement minimal (pas
 * de `Periode`/dates internes) : bornes en ISO, mêmes que `periode` déjà
 * manipulée par cette page. */
export async function fetchAjustementsSolde(
  utilisateurId: string,
  code: "CP" | "RTT" | "CPA",
  periode: { debut: string; fin: string },
): Promise<
  { id: string; deltaJours: number; motif: string; date: string; auteurNom: string }[]
> {
  const supabase = createClient();
  const typeAbsenceId = await getTypeAbsenceId(supabase, code === "RTT" ? "RTT" : "CP");

  const { data, error } = await supabase
    .from("ajustements_solde")
    .select("id, delta_jours, motif, created_at, auteur:utilisateurs!auteur_id(prenom, nom)")
    .eq("utilisateur_id", utilisateurId)
    .eq("type_absence_id", typeAbsenceId)
    .eq("is_anticipation", code === "CPA")
    .gte("created_at", `${periode.debut}T00:00:00.000Z`)
    .lte("created_at", `${periode.fin}T23:59:59.999Z`);

  if (error) {
    throw new Error("Impossible de charger les ajustements.");
  }

  return (data ?? []).map((a) => {
    const auteur = Array.isArray(a.auteur) ? a.auteur[0] : a.auteur;
    return {
      id: a.id,
      deltaJours: Number(a.delta_jours),
      motif: a.motif,
      date: a.created_at.slice(0, 10),
      auteurNom: `${auteur?.prenom ?? ""} ${auteur?.nom ?? ""}`.trim(),
    };
  });
}

/** Un ajustement manuel, toute l'entreprise (27/08/2026) — pour les filtres
 * "Régul CP"/"Régul RTT"/"Régul CPA" de "Suivre les demandes". */
export interface AjustementEquipe {
  id: string;
  utilisateurId: string;
  nomComplet: string;
  code: "CP" | "RTT" | "CPA";
  deltaJours: number;
  motif: string;
  date: string;
  auteurNom: string;
}

/** Ajustements manuels de toute l'équipe (27/08/2026) — même principe que
 * `fetchDemandesEquipe` (pas de filtre `utilisateur_id`, la RLS restreint déjà
 * aux manager/admin). `code` résolu depuis `types_absences.code` +
 * `is_anticipation` (CPA = CP + is_anticipation). Deux FK vers `utilisateurs`
 * (`utilisateur_id`/`auteur_id`) — aliasées explicitement (`utilisateur:`/
 * `auteur:`), sinon PostgREST renvoie les deux sous la même clé `utilisateurs`
 * et écrase l'une avec l'autre (même piège que noté dans BASE-DE-DONNEES.md
 * pour les auto-références). */
export async function fetchAjustementsEquipe(): Promise<AjustementEquipe[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("ajustements_solde")
    .select(
      "id, delta_jours, motif, created_at, is_anticipation, utilisateur_id, utilisateur:utilisateurs!utilisateur_id(prenom, nom), auteur:utilisateurs!auteur_id(prenom, nom), types_absences!type_absence_id(code)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Impossible de charger les ajustements de l'équipe.");
  }

  return (data ?? []).map((row) => {
    const utilisateur = Array.isArray(row.utilisateur) ? row.utilisateur[0] : row.utilisateur;
    const auteur = Array.isArray(row.auteur) ? row.auteur[0] : row.auteur;
    const typeAbsence = Array.isArray(row.types_absences)
      ? row.types_absences[0]
      : row.types_absences;
    const code: "CP" | "RTT" | "CPA" =
      typeAbsence?.code === "RTT" ? "RTT" : row.is_anticipation ? "CPA" : "CP";
    return {
      id: row.id,
      utilisateurId: row.utilisateur_id,
      nomComplet: `${utilisateur?.prenom ?? ""} ${utilisateur?.nom ?? ""}`.trim(),
      code,
      deltaJours: Number(row.delta_jours),
      motif: row.motif,
      date: row.created_at.slice(0, 10),
      auteurNom: `${auteur?.prenom ?? ""} ${auteur?.nom ?? ""}`.trim(),
    };
  });
}
