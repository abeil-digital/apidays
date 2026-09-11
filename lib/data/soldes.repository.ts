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
import { getAujourdhui } from "@/lib/aujourdhui";
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
 *   transmis en paie ET confirmé "pris en compte"** (`export_paie_lignes`
 *   d'un export dont `exports_paie.pris_en_compte = true`, voir
 *   `sommeTransmis`), pas le statut `validee` des demandes. C'est le
 *   référentiel de Delphine pour "Vérifier les fiches de paie" : ce nombre
 *   doit correspondre à ce qui est écrit sur la fiche de paie du comptable.
 *   Il retarde naturellement sur la validation tant qu'un export n'a pas été
 *   généré, PUIS tant que cet export n'a pas été confirmé "pris en compte"
 *   (11/09/2026 — avant cette date, une simple transmission suffisait ;
 *   resserré pour que le solde réel ne bouge qu'une fois la fiche de paie
 *   reçue effectivement vérifiée, pas dès l'envoi).
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
 *
 * `moisLimite` (04/09/2026, "Fin de contrat") — mois ("YYYY-MM") du dernier
 * mois d'acquisition, ou `null` si aucune fin de contrat définie. Un mois
 * postérieur ne doit plus rien acquérir : le collaborateur ne travaille
 * plus. Le mois de `moisLimite` lui-même compte encore (parti en cours de
 * mois, il a quand même travaillé une partie du mois — pas de proratisation
 * journalière ailleurs dans ce moteur, on garde la même granularité).
 */
function resolverTauxActiviteEffectif(
  historique: EntreeTauxActivite[],
  tauxActuel: number,
  anneeMoisIso: string,
  moisLimite: string | null,
): number {
  if (moisLimite !== null && anneeMoisIso > moisLimite) return 0;
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
 * pas recalculer rétroactivement un mois déjà acquis à l'ancien taux.
 * `moisLimite` : voir `resolverTauxActiviteEffectif`. */
/** Table de gel de l'acquisition mensuelle RTT/CPA, clé "AAAA-MM" (voir
 * `acquisitions_gelees`, table gelée à la validation d'un export paie). */
type AcquisitionsGelees = Map<string, number>;

async function fetchAcquisitionsGelees(
  supabase: SupabaseClient,
  utilisateurId: string,
  typeAbsenceId: string,
  isAnticipation: boolean,
  cleDebut: string,
  cleFin: string,
): Promise<AcquisitionsGelees> {
  const carte: AcquisitionsGelees = new Map();
  if (cleDebut > cleFin) return carte;
  const { data } = await supabase
    .from("acquisitions_gelees")
    .select("mois, jours")
    .eq("utilisateur_id", utilisateurId)
    .eq("type_absence_id", typeAbsenceId)
    .eq("is_anticipation", isAnticipation)
    .gte("mois", `${cleDebut}-01`)
    .lte("mois", `${cleFin}-01`);
  for (const row of data ?? []) {
    carte.set(row.mois.slice(0, 7), Number(row.jours));
  }
  return carte;
}

/** Montant d'acquisition d'UN mois — gelé (export paie validé, voir
 * `geleAcquisitionsPourExport`) s'il en existe un, sinon calculé au taux
 * ACTUEL comme avant (11/09/2026, remplace l'ancien `accrualMensuelSomme`
 * "à taux toujours actuel" — voir le commentaire de `acquisitions_gelees`
 * dans schema.sql pour le bug que ça corrige). */
function montantAcquisitionMois(
  gelees: AcquisitionsGelees,
  tauxAcquisitionMensuel: number,
  historique: EntreeTauxActivite[],
  tauxActuel: number,
  cle: string,
  moisLimite: string | null,
): number {
  const gele = gelees.get(cle);
  if (gele !== undefined) return gele;
  return (
    tauxAcquisitionMensuel * (resolverTauxActiviteEffectif(historique, tauxActuel, cle, moisLimite) / 100)
  );
}

/** Même somme que l'ancien `accrualMensuelSomme`, mais un mois déjà figé
 * renvoie son montant gelé au lieu d'être recalculé au taux d'acquisition
 * ACTUEL — remplace tous les usages de `accrualMensuelSomme` (11/09/2026). */
async function accrualMensuelSommeAvecGel(
  supabase: SupabaseClient,
  utilisateurId: string,
  typeAbsenceId: string,
  isAnticipation: boolean,
  tauxAcquisitionMensuel: number,
  historique: EntreeTauxActivite[],
  tauxActuel: number,
  periodeDebut: Date,
  nbMois: number,
  moisLimite: string | null,
): Promise<number> {
  if (nbMois <= 0) return 0;
  const cles: string[] = [];
  for (let i = 0; i < nbMois; i++) {
    const dateMois = new Date(
      Date.UTC(periodeDebut.getUTCFullYear(), periodeDebut.getUTCMonth() + i, 1),
    );
    cles.push(`${dateMois.getUTCFullYear()}-${String(dateMois.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const gelees = await fetchAcquisitionsGelees(
    supabase,
    utilisateurId,
    typeAbsenceId,
    isAnticipation,
    cles[0],
    cles[cles.length - 1],
  );
  return cles.reduce(
    (total, cle) =>
      total +
      montantAcquisitionMois(gelees, tauxAcquisitionMensuel, historique, tauxActuel, cle, moisLimite),
    0,
  );
}

/**
 * Gèle l'acquisition mensuelle RTT/CPA de tous les collaborateurs actifs de
 * l'entreprise, sur les mois calendaires couverts par [periodeDebut,
 * periodeFin] (11/09/2026, "chaque export paie validé = un point de gel" —
 * demande explicite de Vincent). Appelée depuis `validerExportPaie` : la
 * fiche de paie confirmée devient le fait qui fige l'acquisition du mois, au
 * même titre qu'elle fige déjà la consommation (`exports_paie.pris_en_compte`).
 * Idempotent (`upsert` avec `ignoreDuplicates`) : revalider un export déjà
 * pris en compte ne réécrit rien.
 */
export async function geleAcquisitionsPourExport(
  supabase: SupabaseClient,
  entrepriseId: string,
  periodeDebut: string,
  periodeFin: string,
  auteurId: string,
): Promise<void> {
  const [reglesAcquisition, { data: utilisateurs, error }] = await Promise.all([
    fetchReglesAcquisition(),
    supabase
      .from("utilisateurs")
      .select("id, taux_activite, date_fin_contrat")
      .eq("entreprise_id", entrepriseId)
      .eq("statut", "actif"),
  ]);
  if (error) throw new Error("Impossible de figer l'acquisition du mois.");

  const regleRTT = reglesAcquisition.find((r) => r.typeAbsence === "RTT");
  const regleCP = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const typeRttId = regleRTT ? await getTypeAbsenceId(supabase, "RTT") : null;
  const typeCpId = regleCP ? await getTypeAbsenceId(supabase, "CP") : null;
  if ((!regleRTT || !typeRttId) && (!regleCP || !typeCpId)) return;

  // Mois calendaires entièrement contenus dans [periodeDebut, periodeFin].
  const cles: string[] = [];
  {
    let curseur = new Date(`${periodeDebut}T00:00:00Z`);
    curseur = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth(), 1));
    const fin = new Date(`${periodeFin}T00:00:00Z`);
    while (curseur <= fin) {
      cles.push(`${curseur.getUTCFullYear()}-${String(curseur.getUTCMonth() + 1).padStart(2, "0")}`);
      curseur = new Date(Date.UTC(curseur.getUTCFullYear(), curseur.getUTCMonth() + 1, 1));
    }
  }
  if (cles.length === 0) return;

  const lignes: {
    entreprise_id: string;
    utilisateur_id: string;
    type_absence_id: string;
    is_anticipation: boolean;
    mois: string;
    jours: number;
    figee_par: string;
  }[] = [];

  for (const u of utilisateurs ?? []) {
    const historiqueTaux = await fetchHistoriqueTauxActivite(u.id);
    const tauxActuel = Number(u.taux_activite ?? 100);
    const moisLimite: string | null = u.date_fin_contrat ? u.date_fin_contrat.slice(0, 7) : null;

    for (const cle of cles) {
      if (moisLimite && cle > moisLimite) continue;
      const tauxEffectif = resolverTauxActiviteEffectif(historiqueTaux, tauxActuel, cle, moisLimite);
      if (regleRTT && typeRttId) {
        lignes.push({
          entreprise_id: entrepriseId,
          utilisateur_id: u.id,
          type_absence_id: typeRttId,
          is_anticipation: false,
          mois: `${cle}-01`,
          jours: regleRTT.tauxAcquisitionMensuel * (tauxEffectif / 100),
          figee_par: auteurId,
        });
      }
      if (regleCP && typeCpId) {
        lignes.push({
          entreprise_id: entrepriseId,
          utilisateur_id: u.id,
          type_absence_id: typeCpId,
          is_anticipation: true,
          mois: `${cle}-01`,
          jours: regleCP.tauxAcquisitionMensuel * (tauxEffectif / 100),
          figee_par: auteurId,
        });
      }
    }
  }

  if (lignes.length === 0) return;
  const { error: erreurUpsert } = await supabase.from("acquisitions_gelees").upsert(lignes, {
    onConflict: "utilisateur_id,type_absence_id,is_anticipation,mois",
    ignoreDuplicates: true,
  });
  if (erreurUpsert) throw new Error("Impossible de figer l'acquisition du mois.");
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


interface RegleAcquisitionMinimal {
  tauxAcquisitionMensuel: number;
  reportAutorise: boolean;
  periodeDebutMois: number;
  periodeDebutJour: number;
}

/**
 * Capital d'ouverture CP d'une période — source de vérité UNIQUE (11/09/2026,
 * refonte du moteur de calcul, cadre posé avec Vincent le même jour, voir
 * CONTEXTE.md/Backlog.md). Remplace les deux calculs indépendants qui
 * devaient jusque-là coïncider par construction (capital "direct" de la
 * période en cours d'un côté, accrual CPA de la période précédente de
 * l'autre, synchronisés à coups de hacks type "dernier jour de la
 * période") : une seule formule, appelée aussi bien pour la période en
 * cours que pour toute période antérieure.
 *
 * = solde_initial.cp si sa date de référence gouverne cette période
 * sinon = report de la période précédente (récursif)
 *      + transfert CPA (accrual complet de CETTE période, tel qu'accumulé
 *        pendant la précédente — mêmes dates de référence que l'ancien
 *        `capitalBase`, comportement numériquement inchangé — moins ce qui
 *        en a déjà été consommé par anticipation)
 *      + bonus d'ancienneté (évalué au début de CETTE période — un jour de
 *        CP comme un autre, calculé UNE SEULE FOIS ici, jamais dans
 *        l'accrual CPA affiché à l'utilisateur, voir plus bas)
 *
 * **Mémoïsation** (`soldes_periode`) : toute période dont la fin est déjà
 * passée voit son résultat figé au premier calcul — plus jamais recalculé
 * ensuite, y compris si les règles d'acquisition changent après coup (choix
 * assumé : un changement de règle ne doit pas réécrire rétroactivement un
 * capital déjà acquis). La période EN COURS (celle qui contient
 * `ctx.aujourdhui`) n'est jamais figée : elle reste recalculée à chaque
 * appel, comme avant.
 *
 * Récursif sur `periodePrecedente` — en pratique s'arrête presque toujours
 * après 1 niveau (une période déjà gelée, ou `soldes_initiaux`).
 */
async function resolverCapitalOuvertureCp(
  supabase: SupabaseClient,
  utilisateurId: string,
  periode: Periode,
  ctx: {
    regleCP: RegleAcquisitionMinimal;
    historiqueTaux: EntreeTauxActivite[];
    tauxActuel: number;
    moisLimite: string | null;
    soldeInitial: SoldeInitial | null;
    reglesAnciennete: RegleAnciennete[];
    dateReferenceAnciennete: string;
    aujourdhui: Date;
  },
): Promise<number> {
  const periodePrecedente = decalerPeriode(periode, -1);

  // `soldes_initiaux` gouverne cette période : remplace tout calcul (même
  // règle que l'ancien `resolverCapitalCpTotal`).
  if (ctx.soldeInitial && dateIso(periodePrecedente.fin) <= ctx.soldeInitial.dateReference) {
    return ctx.soldeInitial.cp;
  }

  // Déjà gelée ?
  const { data: geleeRow } = await supabase
    .from("soldes_periode")
    .select("capital_ouverture")
    .eq("utilisateur_id", utilisateurId)
    .eq("periode_debut", dateIso(periode.debut))
    .maybeSingle();
  if (geleeRow) return Number(geleeRow.capital_ouverture);

  // Report de la période précédente (récursif).
  const capitalPrecedent = await resolverCapitalOuvertureCp(
    supabase,
    utilisateurId,
    periodePrecedente,
    ctx,
  );
  const consommePrecedent = await sommeJours(
    supabase,
    utilisateurId,
    "CP",
    ["validee"],
    false,
    periodePrecedente,
    ctx.aujourdhui,
  );
  const report = ctx.regleCP.reportAutorise ? Math.max(0, capitalPrecedent - consommePrecedent) : 0;

  // Transfert CPA (corrigé le 11/09/2026, invariant CP(bascule) =
  // CP(veille) + CPA(veille) cassé par l'ancien calcul, voir CONTEXTE.md) —
  // MÊME formule que la CPA affichée en direct (`resolverPointDepartAccrual`
  // + `moisEntiersEcoules`, voir `fetchHistoriqueCpa`/`fetchSoldes`), mais
  // évaluée au dernier jour de la période précédente plutôt qu'à aujourd'hui
  // : le transfert doit être LITTÉRALEMENT ce que la CPA affichait la veille
  // de la bascule, pas une reconstruction indépendante ("12 mois à partir du
  // 1er jour de la NOUVELLE période" + base solde initial en plus) qui
  // double-comptait dès qu'un solde initial était en jeu (ex. 34j calculés
  // au lieu des 22j réellement affichés — écart de 14j entre CP(bascule) et
  // CP(veille)+CPA(veille), trouvé en testant acme). `periodePrecedente` est
  // garantie close ici (jamais la période en cours, cette branche n'est
  // atteinte que pour une bascule déjà passée) — sûr d'ancrer l'accrual sur
  // sa propre fin plutôt que sur `ctx.aujourdhui`.
  const { debut: debutCpaPrecedent, base: baseCpaPrecedent } = resolverPointDepartAccrual(
    periodePrecedente,
    ctx.soldeInitial,
    "cpa",
  );
  const moisEcoulesCpaPrecedent = moisEntiersEcoules(debutCpaPrecedent, periodePrecedente.fin);
  const typeCpIdPourGel = await getTypeAbsenceId(supabase, "CP");
  const accrualCpaComplet =
    baseCpaPrecedent +
    (await accrualMensuelSommeAvecGel(
      supabase,
      utilisateurId,
      typeCpIdPourGel,
      true,
      ctx.regleCP.tauxAcquisitionMensuel,
      ctx.historiqueTaux,
      ctx.tauxActuel,
      debutCpaPrecedent,
      moisEcoulesCpaPrecedent,
      ctx.moisLimite,
    ));
  // `is_anticipation` reste un bucket stable (11/09/2026, annule le
  // comportement du 10/09 — voir CONTEXTE.md) : un CPA consommé reste
  // décompté du solde CPA jusqu'à ce transfert, pas avant. Fenêtre bornée à
  // la période précédente (même principe que l'accrual ci-dessus) — un CPA
  // daté dans la NOUVELLE période consomme par nature sur le PROCHAIN
  // transfert, pas celui-ci.
  const consommeCpa = await sommeJours(
    supabase,
    utilisateurId,
    "CP",
    ["validee"],
    true,
    { debut: debutCpaPrecedent, fin: periodePrecedente.fin },
    periodePrecedente.fin,
  );
  const transfertCpa = Math.max(0, accrualCpaComplet - consommeCpa);

  const bonus = bonusAnciennete(
    ctx.reglesAnciennete,
    ansAnciennete(ctx.dateReferenceAnciennete, periode.debut),
  );

  const capitalOuverture = report + transfertCpa + bonus;

  // Gel — uniquement si la période est déjà entièrement close (jamais la
  // période en cours).
  if (dateIso(periode.fin) < dateIso(ctx.aujourdhui)) {
    const auteurId = await getUtilisateurIdCourant(supabase).catch(() => null);
    await supabase.from("soldes_periode").upsert(
      {
        utilisateur_id: utilisateurId,
        periode_debut: dateIso(periode.debut),
        periode_fin: dateIso(periode.fin),
        capital_ouverture: capitalOuverture,
        figee_par: auteurId,
      },
      { onConflict: "utilisateur_id,periode_debut", ignoreDuplicates: true },
    );
  }

  return capitalOuverture;
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
 * Résout, pour un jeu de demandes déjà chargées, le statut de chacune **tel
 * qu'il était à `dateReference`**, pas le statut actuel en base (25/08/2026,
 * bug signalé par Vincent : "on ne prend pas en compte les congés
 * exportés ?" — pour un calcul avec une date passée, filtrer sur le statut
 * ACTUEL donnait le même résultat quelle que soit `dateReference`, puisqu'une
 * régularisation ultérieure — ex. Salarié Test, annulée le 25/08 après avoir
 * été validée puis transmise — repassait rétroactivement la demande hors du
 * calcul même pour une date antérieure à cette régularisation, faisant
 * disparaître tout mouvement). Extrait de `sommeJours` le 28/08/2026 pour être
 * réutilisé par `fetchHistoriqueCp`/`fetchHistoriqueRtt`/`fetchHistoriqueCpa`,
 * qui reconstruisaient jusque-là leur propre ledger via un filtre direct sur
 * `demandes_conges.statut` — jamais mis à jour par ce correctif, d'où un
 * solde théorique différent de celui de la home (`fetchSoldes`) dès qu'une
 * demande a une colonne `statut` désynchronisée de sa dernière décision
 * journalisée (ex. une demande retirée par le salarié lui-même, jamais
 * journalisée dans `decisions_demande`, policy insert réservée manager/admin).
 *
 * Statut à `dateReference` = la dernière ligne de `decisions_demande` avec
 * `decide_le <= dateReference` ; à défaut (demande décidée avant
 * l'introduction du journal le 25/08/2026, jamais re-décidée depuis), repli
 * sur le statut actuel si `date_decision <= dateReference`, sinon "en
 * attente" (pas encore décidée à cette date). Pour un appel "maintenant"
 * (`dateReference = aujourd'hui`), résultat identique à l'ancien filtre par
 * statut courant — aucune décision ne peut avoir lieu dans le futur.
 */
async function resoudreStatutsADate(
  supabase: SupabaseClient,
  demandes: { id: string; statut: string; date_decision: string | null }[],
  dateReference: Date,
): Promise<Map<string, string>> {
  const statutsResolus = new Map<string, string>();
  if (demandes.length === 0) return statutsResolus;

  // Fin de journée (28/08/2026, bug trouvé via "Retirer cette demande" — des
  // congés annulés/retirés le jour même apparaissaient comme "en attente")
  // — `dateReference` est construite par les appelants à minuit UTC
  // (`aujourdhui`, pour les calculs de période), mais `decide_le`/
  // `date_decision` sont des timestamps avec heure. Comparer contre minuit
  // excluait à tort toute décision prise plus tard dans la même journée
  // (autrement dit : quasi toute décision "d'aujourd'hui"), qui retombait
  // alors sur le repli "en attente" par défaut. Même convention que
  // `sommeTransmis` (`exports_paie.genere_le`, plus haut dans ce fichier).
  const dateReferenceIso = `${dateIso(dateReference)}T23:59:59.999Z`;
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

  for (const d of demandes) {
    const decisionJournal = derniereDecisionParDemande.get(d.id);
    const statutAReference: string =
      decisionJournal ??
      (d.date_decision && d.date_decision <= dateReferenceIso
        ? (d.statut ?? "en_attente")
        : "en_attente");
    statutsResolus.set(d.id, statutAReference);
  }
  return statutsResolus;
}

/**
 * Somme en jours des demandes d'un type/statut donné dont `date_debut` tombe
 * dans la période — le statut pris en compte est celui résolu à
 * `dateReference` (voir `resoudreStatutsADate`), pas le statut actuel en base.
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

  const statutsResolus = await resoudreStatutsADate(supabase, demandes, dateReference);

  let total = 0;
  for (const d of demandes) {
    const statutAReference = statutsResolus.get(d.id) ?? "en_attente";
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
      "jours_inclus, demandes_conges!inner(utilisateur_id, type_absence_id, is_anticipation, date_debut), exports_paie!inner(genere_le, pris_en_compte)",
    )
    .eq("demandes_conges.utilisateur_id", utilisateurId)
    .eq("demandes_conges.type_absence_id", typeAbsenceId)
    .gte("demandes_conges.date_debut", dateIso(periode.debut))
    .lte("demandes_conges.date_debut", dateIso(periode.fin))
    .lte("exports_paie.genere_le", `${dateIso(dateReference)}T23:59:59.999Z`)
    // "Pris en compte" (11/09/2026) — un congé transmis mais pas encore
    // confirmé conforme à la fiche de paie ne se déduit pas (encore) du
    // solde réel, voir la doc en tête de fichier.
    .eq("exports_paie.pris_en_compte", true);

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
  conge_impose_id: string | null;
}

/**
 * Lignes `export_paie_lignes` déjà transmises pour un type/période, avec les
 * dates de la demande portée — base des mouvements "réel" de
 * `fetchHistoriqueCp`/`fetchHistoriqueRtt` (27/08/2026, refonte du modèle :
 * le réel est ancré sur la transmission effective, pas sur le statut
 * `validee`). Même filtre sur `exports_paie.genere_le`/`pris_en_compte` que
 * `sommeTransmis`.
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
      "id, demande_id, jours_inclus, demandes_conges!inner(date_debut, date_fin, utilisateur_id, type_absence_id, is_anticipation, conge_impose_id), exports_paie!inner(genere_le, pris_en_compte)",
    )
    .eq("demandes_conges.utilisateur_id", utilisateurId)
    .eq("demandes_conges.type_absence_id", typeAbsenceId)
    .gte("demandes_conges.date_debut", dateIso(periode.debut))
    .lte("demandes_conges.date_debut", dateIso(periode.fin))
    .lte("exports_paie.genere_le", `${dateIso(dateReference)}T23:59:59.999Z`)
    .eq("exports_paie.pris_en_compte", true);

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
    ) as { date_debut: string; date_fin: string; conge_impose_id: string | null };
    return {
      id: row.id,
      demande_id: row.demande_id,
      date_debut: demande.date_debut,
      date_fin: demande.date_fin,
      jours_inclus: Number(row.jours_inclus),
      conge_impose_id: demande.conge_impose_id,
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
      .select("date_entree, anciennete_date_reference, taux_activite, date_fin_contrat")
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
  const aujourdhui = new Date(`${dateIso(dateReference ?? getAujourdhui())}T00:00:00Z`);
  const moisLimite: string | null = utilisateurRow.date_fin_contrat
    ? utilisateurRow.date_fin_contrat.slice(0, 7)
    : null;

  const regleCP = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const regleRTT = reglesAcquisition.find((r) => r.typeAbsence === "RTT");

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
    const ctxCapital = {
      regleCP,
      historiqueTaux,
      tauxActuel,
      moisLimite,
      soldeInitial,
      reglesAnciennete,
      dateReferenceAnciennete,
      aujourdhui,
    };

    // Source de vérité unique (11/09/2026, refonte du moteur — voir
    // `resolverCapitalOuvertureCp`) : report + transfert CPA + bonus
    // d'ancienneté, calculés une seule fois et mémoïsés dès qu'une période
    // est close.
    const capitalCpTotal = await resolverCapitalOuvertureCp(
      supabase,
      id,
      periodeEnCours,
      ctxCapital,
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
    const transmisEnCours = await sommeTransmis(
      supabase,
      id,
      "CP",
      false,
      periodeConsoCp,
      aujourdhui,
    );
    const soldeCpValidee = capitalCpTotal - consommeEnCours + ajustementsEnCours;
    const soldeCpTransmis = capitalCpTotal - transmisEnCours + ajustementsEnCours;

    cp = {
      valeur: soldeCpTransmis,
      valeurApresAttente: soldeCpValidee - enAttenteEnCours,
      conditionPrefixe: "À poser avant le",
      conditionAccent: formatDateCourte(periodeEnCours.fin),
    };

    // CPA — préfiguration progressive et honnête de ce que la prochaine
    // bascule transférera en capital CP (11/09/2026) : jamais de bonus
    // d'ancienneté ici (calculé une seule fois, dans
    // `resolverCapitalOuvertureCp`, au moment où le capital CP de la
    // nouvelle période est déterminé — voir CONTEXTE.md/Backlog.md) et plus
    // de hack "dernier jour = mois complet", devenu inutile : le transfert
    // ne dépend plus de faire coïncider ce nombre avec un calcul séparé.
    const { debut: debutCpa, base: baseCpa } = resolverPointDepartAccrual(
      periodeEnCours,
      soldeInitial,
      "cpa",
    );
    const moisEcoulesCpa = moisEntiersEcoules(debutCpa, aujourdhui);
    const typeCpIdPourGel = await getTypeAbsenceId(supabase, "CP");
    const accrualCpa =
      baseCpa +
      (await accrualMensuelSommeAvecGel(
        supabase,
        id,
        typeCpIdPourGel,
        true,
        regleCP.tauxAcquisitionMensuel,
        historiqueTaux,
        tauxActuel,
        debutCpa,
        moisEcoulesCpa,
        moisLimite,
      ));
    // `is_anticipation = true` reste un bucket stable (11/09/2026, annule le
    // comportement du 10/09) — un CPA consommé reste décompté du solde CPA
    // jusqu'à la vraie bascule, jamais reclassé en CP avant, QUELLE QUE SOIT
    // SA DATE. Fenêtre alignée sur `debutCpa` (même point de départ que
    // l'accrual juste au-dessus) plutôt que bornée après la fin de la
    // période en cours (ancien `debutCpaFutur`, 10/09) : un CPA posé sur une
    // date qui tombe dans la période en cours (ex. tenant à période
    // civile) reste un CPA, ne doit pas sortir de cette fenêtre — bug
    // remonté par Vincent le 11/09 ("et le CPA du 30/10-02/11 ?"), qui
    // disparaissait purement et simplement du solde CPA une fois retiré à
    // tort du solde CP.
    const periodeConsoCpaSansPlafond: Periode = {
      debut: debutCpa,
      fin: decalerPeriode(periodeEnCours, 50).fin,
    };
    const consommeCpa = await sommeJours(
      supabase,
      id,
      "CP",
      ["validee"],
      true,
      periodeConsoCpaSansPlafond,
      aujourdhui,
    );
    const enAttenteCpa = await sommeJours(
      supabase,
      id,
      "CP",
      ["en_attente"],
      true,
      periodeConsoCpaSansPlafond,
      aujourdhui,
    );
    const transmisCpa = await sommeTransmis(
      supabase,
      id,
      "CP",
      true,
      periodeConsoCpaSansPlafond,
      aujourdhui,
    );
    const ajustementsCpa = await sommeAjustements(supabase, id, "CP", periodeEnCours, true);
    const soldeCpaValidee = accrualCpa - consommeCpa + ajustementsCpa;
    const soldeCpaTransmis = accrualCpa - transmisCpa + ajustementsCpa;

    cpa = {
      valeur: soldeCpaTransmis,
      valeurApresAttente: soldeCpaValidee - enAttenteCpa,
      conditionPrefixe: "À poser avant le",
      conditionAccent: formatDateCourte(periodeEnCours.fin),
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
    const typeRttIdPourGel = await getTypeAbsenceId(supabase, "RTT");
    const accrual =
      baseRtt +
      (await accrualMensuelSommeAvecGel(
        supabase,
        id,
        typeRttIdPourGel,
        false,
        regleRTT.tauxAcquisitionMensuel,
        historiqueTaux,
        tauxActuel,
        debutRtt,
        moisEcoules,
        moisLimite,
      ));
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
    // Pas de `Math.max(0, ...)` ici (10/09/2026, correctif) — contrairement à
    // CP, qui ne plafonne jamais ses soldes intermédiaires. Un plafond à 0
    // posé sur `soldeValidee` AVANT de soustraire `enAttente` masque un
    // déficit réel dès que la seule consommation validée dépasse déjà
    // l'acquis : une demande en attente affichait correctement le solde
    // négatif (ex. -0,25), mais sa VALIDATION le faisait remonter à tort à 0
    // (le déficit, une fois "absorbé" dans `soldeValidee`, se faisait
    // silencieusement plafonner) — signalé par Vincent sur les données
    // réelles d'Abeil (Delphine).
    const soldeValidee = accrual - consomme + ajustementsRtt;
    const soldeTransmis = accrual - transmis + ajustementsRtt;

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
    supabase.from("utilisateurs").select("taux_activite, date_fin_contrat").eq("id", id).single(),
    fetchReglesAcquisition(),
    fetchHistoriqueTauxActivite(id),
    fetchSoldeInitial(id),
  ]);
  if (erreurUtilisateur || !utilisateurRow) {
    throw new Error("Impossible de charger le profil pour le calcul du solde anticipé.");
  }
  const tauxActuel = Number(utilisateurRow.taux_activite ?? 100);
  const moisLimite: string | null = utilisateurRow.date_fin_contrat
    ? utilisateurRow.date_fin_contrat.slice(0, 7)
    : null;

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
    const typeRttIdPourGel = await getTypeAbsenceId(supabase, "RTT");
    const accrual =
      baseRtt +
      (await accrualMensuelSommeAvecGel(
        supabase,
        id,
        typeRttIdPourGel,
        false,
        regleRTT.tauxAcquisitionMensuel,
        historiqueTaux,
        tauxActuel,
        debutRtt,
        moisEcoules,
        moisLimite,
      ));
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
  // CPA acquiert et se consomme sur la même période CP en cours (au sens de
  // `dateReference`, 08/09/2026 — corrige un bug réel, voir `fetchSoldes`) :
  // un CPA s'utilise dès maintenant, dans la limite de ce qui est déjà/sera
  // acquis à sa date.
  const periodeEnCours = periodeContenant(
    reference,
    regleCP.periodeDebutMois,
    regleCP.periodeDebutJour,
  );
  const { debut: debutCpa, base: baseCpa } = resolverPointDepartAccrual(
    periodeEnCours,
    soldeInitial,
    "cpa",
  );
  const moisEcoulesCpa = moisEntiersEcoules(debutCpa, reference);
  const typeCpIdPourGel = await getTypeAbsenceId(supabase, "CP");
  const accrualCpa =
    baseCpa +
    (await accrualMensuelSommeAvecGel(
      supabase,
      id,
      typeCpIdPourGel,
      true,
      regleCP.tauxAcquisitionMensuel,
      historiqueTaux,
      tauxActuel,
      debutCpa,
      moisEcoulesCpa,
      moisLimite,
    ));
  const consommeCpa = await sommeJours(
    supabase,
    id,
    "CP",
    ["validee"],
    true,
    periodeEnCours,
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
      .select("date_entree, anciennete_date_reference, taux_activite, date_fin_contrat")
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
  const aujourdhui = new Date(`${dateIso(dateReference ?? getAujourdhui())}T00:00:00Z`);
  const moisLimite: string | null = utilisateurRow.date_fin_contrat
    ? utilisateurRow.date_fin_contrat.slice(0, 7)
    : null;

  const periodeEnCours = periodeContenant(
    aujourdhui,
    regleCP.periodeDebutMois,
    regleCP.periodeDebutJour,
  );
  const periodePrecedente = decalerPeriode(periodeEnCours, -1);
  const ctxCapital = {
    regleCP,
    historiqueTaux,
    tauxActuel,
    moisLimite,
    soldeInitial,
    reglesAnciennete,
    dateReferenceAnciennete,
    aujourdhui,
  };

  // Source de vérité unique (11/09/2026, refonte du moteur — voir
  // `resolverCapitalOuvertureCp` dans `fetchSoldes`) : même fonction, même
  // résultat que la carte Accueil, plus de calcul dupliqué à maintenir en
  // synchronisation manuelle.
  const soldeDepart = await resolverCapitalOuvertureCp(
    supabase,
    utilisateurId,
    periodeEnCours,
    ctxCapital,
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
    { data: demandesRows, error: erreurDemandes },
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
    // `is_anticipation = false` (11/09/2026, annule le comportement du
    // 10/09) — bucket stable, un CPA reste un CPA jusqu'à la vraie bascule,
    // n'apparaît plus dans ce feed CP.
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees, statut, date_decision, conge_impose_id")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", false)
      .gte("date_debut", dateIso(periodeConsoCp.debut))
      .lte("date_debut", dateIso(periodeEnCours.fin)),
  ]);

  if (erreurAjustements || erreurDemandes) {
    throw new Error("Impossible de charger l'historique du solde.");
  }

  // Statut résolu à `aujourdhui` (28/08/2026, voir `resoudreStatutsADate`) —
  // remplace les deux requêtes séparées `.eq("statut", ...)` d'origine, qui
  // divergeaient de `fetchSoldes`/`sommeJours` dès qu'une demande avait un
  // statut brut désynchronisé de sa dernière décision journalisée.
  const statutsResolus = await resoudreStatutsADate(supabase, demandesRows ?? [], aujourdhui);
  const enAttenteRows = (demandesRows ?? []).filter(
    (d) => statutsResolus.get(d.id) === "en_attente",
  );
  const demandesValideesRows = (demandesRows ?? []).filter(
    (d) => statutsResolus.get(d.id) === "validee",
  );
  // Demandes annulées (11/09/2026, "où est passé mon CP annulé ?") — restent
  // affichées dans le feed théorique, barrées (`annule: true`), plutôt que de
  // disparaître sans laisser de trace : `jours` porte le montant qu'elles
  // auraient valu, mais ne contribue jamais à `cumulValidee` (voir plus bas).
  const demandesAnnuleesRows = (demandesRows ?? []).filter(
    (d) => statutsResolus.get(d.id) === "annulee",
  );

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
    congeImposeId?: string | null;
    annule?: boolean;
  }

  // "CPI" plutôt que "CP" pour une demande auto-générée par un congé imposé
  // (`conge_impose_id` non nul, `ajouterCongeImpose()` dans
  // `calendrier.repository.ts`) — 10/09/2026, demande explicite de Vincent :
  // même si elle compte dans le solde/l'export paie comme un CP normal (voir
  // CONTEXTE.md), le suivi de solde doit rendre visible que ce mouvement
  // vient d'un congé imposé, pas d'une demande personnelle. Définie avant
  // `mouvementsBruts` (réel) pour être réutilisée par les 3 blocs (réel,
  // théorique, en attente) plutôt que dupliquée.
  function libelleMouvementCp(d: {
    date_debut: string;
    date_fin: string;
    conge_impose_id?: string | null;
  }): string {
    const prefixe = d.conge_impose_id ? "CPI" : "CP";
    return `${prefixe} : ${formatPeriodePillNumerique(d.date_debut, d.date_fin)}`;
  }

  const mouvementsBruts: MouvementBrut[] = [
    ...lignesTransmises.map((l): MouvementBrut => ({
      id: l.id,
      demandeId: l.demande_id,
      type: "demande",
      date: l.date_debut,
      libelle: libelleMouvementCp({
        date_debut: l.date_debut,
        date_fin: l.date_fin,
        conge_impose_id: l.conge_impose_id,
      }),
      jours: -l.jours_inclus,
      congeImposeId: l.conge_impose_id,
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
      libelle: libelleMouvementCp(d),
      jours: -(Number(d.nb_demi_journees) / 2),
      congeImposeId: d.conge_impose_id,
    })),
    // Demandes annulées (11/09/2026) — affichées barrées, `jours` porte le
    // montant qu'elles auraient valu (pour l'affichage), mais n'entre jamais
    // dans `cumulValidee` (voir la boucle plus bas, qui saute `m.annule`).
    ...(demandesAnnuleesRows ?? []).map((d): MouvementBrut => ({
      id: d.id,
      type: "demande",
      date: d.date_debut,
      libelle: libelleMouvementCp(d),
      jours: -(Number(d.nb_demi_journees) / 2),
      congeImposeId: d.conge_impose_id,
      annule: true,
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
    // Une demande annulée reste affichée (barrée) mais ne retire plus rien du
    // solde (11/09/2026) — voir commentaire sur `demandesAnnuleesRows`.
    if (!m.annule) cumulValidee += m.jours;
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
        libelle: libelleMouvementCp(d),
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
    supabase
      .from("utilisateurs")
      .select("taux_activite, date_fin_contrat")
      .eq("id", utilisateurId)
      .single(),
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
  const aujourdhui = new Date(`${dateIso(dateReference ?? getAujourdhui())}T00:00:00Z`);
  const moisLimite: string | null = utilisateurRow.date_fin_contrat
    ? utilisateurRow.date_fin_contrat.slice(0, 7)
    : null;
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
    { data: demandesRows, error: erreurDemandes },
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
      .select("id, date_debut, date_fin, nb_demi_journees, statut, date_decision")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .gte("date_debut", dateIso(periodeConsoRtt.debut))
      .lte("date_debut", dateIso(periodeRtt.fin)),
  ]);

  if (erreurAjustements || erreurDemandes) {
    throw new Error("Impossible de charger l'historique du solde.");
  }

  // Statut résolu à `aujourdhui` — voir `fetchHistoriqueCp`, même correctif.
  const statutsResolus = await resoudreStatutsADate(supabase, demandesRows ?? [], aujourdhui);
  const enAttenteRows = (demandesRows ?? []).filter(
    (d) => statutsResolus.get(d.id) === "en_attente",
  );
  const demandesValideesRows = (demandesRows ?? []).filter(
    (d) => statutsResolus.get(d.id) === "validee",
  );

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

  // Un mois déjà figé (export paie validé, voir `acquisitions_gelees`)
  // affiche son montant gelé plutôt que recalculé au taux ACTUEL — même
  // principe que `accrualMensuelSommeAvecGel` (11/09/2026).
  const clesRtt = Array.from({ length: moisEcoules }, (_, i) => {
    const d = new Date(Date.UTC(debutRtt.getUTCFullYear(), debutRtt.getUTCMonth() + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const acquisitionsGeleesRtt =
    clesRtt.length > 0
      ? await fetchAcquisitionsGelees(
          supabase,
          utilisateurId,
          typeAbsenceId,
          false,
          clesRtt[0],
          clesRtt[clesRtt.length - 1],
        )
      : new Map<string, number>();
  const accrualsBruts: MouvementBrut[] = Array.from({ length: moisEcoules }, (_, i) => {
    const dateMois = new Date(
      Date.UTC(debutRtt.getUTCFullYear(), debutRtt.getUTCMonth() + i, debutRtt.getUTCDate()),
    );
    const cleMois = clesRtt[i];
    return {
      id: `acquisition-${dateIso(dateMois)}`,
      type: "acquisition",
      date: dateIso(dateMois),
      libelle: `Acquisition ${formatMoisAnnee(dateMois)}`,
      jours: montantAcquisitionMois(
        acquisitionsGeleesRtt,
        regleRTT.tauxAcquisitionMensuel,
        historiqueTaux,
        tauxActuel,
        cleMois,
        moisLimite,
      ),
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

  // Pas de `Math.max(0, ...)` (10/09/2026, correctif — même bug que
  // `fetchSoldes`, voir son commentaire) : ce plancher masquait un déficit
  // réel et pouvait afficher un solde théorique différent de celui de la
  // carte Accueil (`fetchSoldes`, qui ne plafonne plus non plus).
  return {
    periodeDebut: dateIso(periodeRtt.debut),
    periodeFin: dateIso(periodeRtt.fin),
    soldeDepart: baseRtt,
    soldeDepartDate,
    mois: moisListe,
    soldeActuel: cumul,
    enAttente,
    soldeTheorique: cumulTheorique,
    mouvementsTheorique,
  };
}

/**
 * Feed d'historique du solde CPA d'un salarié (Espace Suivre, popin ouverte
 * au clic sur le solde CPA) — même principe d'accrual mensuel que RTT (pas de
 * capital connu d'avance, `type: "acquisition"` un événement par mois entier
 * écoulé). L'acquisition reste bornée à la période CP **en cours**
 * (`periodeEnCours`, même horloge que `regleCP`) — la consommation
 * (`is_anticipation = true`) n'a ni plafond haut ni plancher bas
 * (`periodeConsoCpaSansPlafond`, même fenêtre que `fetchSoldes`, alignée sur
 * `debutCpa`) : un CPA/CPI reste décompté et visible dès sa validation quelle
 * que soit sa date — avant, pendant ou après la période en cours — plutôt que
 * de rester invisible tant que sa propre période n'est pas "en cours", ou (11/
 * 09/2026) de disparaître purement et simplement parce que sa date tombe dans
 * la période en cours (bugs réels remontés par Vincent). Historique de cette
 * borne basse : bornée sur la période suivante à l'origine, corrigée le
 * 08/09/2026 pour la période en cours (la consommation ignorait
 * silencieusement toute demande CPA datée dans la période en cours),
 * déplafonnée en haut le 10/09/2026 mais rebornée après la fin de la période
 * en cours par erreur — un CPA daté DANS la période en cours redevenait
 * invisible — corrigé le 11/09/2026 en l'alignant sur `debutCpa`, le même
 * point de départ que l'accrual CPA lui-même. Les clés de mois du
 * feed sont dérivées des dates réelles des mouvements plutôt que d'un simple
 * parcours calendaire borné à aujourd'hui — un mouvement loin dans le futur
 * obtient donc naturellement sa propre clé de mois, sans changement
 * nécessaire à cette partie du code.
 */
export async function fetchHistoriqueCpa(utilisateurId: string): Promise<HistoriqueSolde> {
  const supabase = createClient();

  const [
    { data: utilisateurRow, error: erreurUtilisateur },
    reglesAcquisition,
    historiqueTaux,
    soldeInitial,
  ] = await Promise.all([
    supabase
      .from("utilisateurs")
      .select("date_entree, anciennete_date_reference, taux_activite, date_fin_contrat")
      .eq("id", utilisateurId)
      .single(),
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
  const aujourdhui = new Date(`${dateIso(getAujourdhui())}T00:00:00Z`);
  const moisLimite: string | null = utilisateurRow.date_fin_contrat
    ? utilisateurRow.date_fin_contrat.slice(0, 7)
    : null;
  const periodeEnCours = periodeContenant(
    aujourdhui,
    regleCP.periodeDebutMois,
    regleCP.periodeDebutJour,
  );
  const {
    debut: debutCpa,
    base: baseCpa,
    dateAffichage: soldeDepartDate,
  } = resolverPointDepartAccrual(periodeEnCours, soldeInitial, "cpa");
  // Accrual progressif honnête, jamais de bonus d'ancienneté ici (11/09/2026
  // — un jour de CP comme un autre, calculé une seule fois dans
  // `resolverCapitalOuvertureCp`, au moment où le capital CP de la nouvelle
  // période est déterminé, voir CONTEXTE.md/Backlog.md). Plus de hack
  // "dernier jour = mois complet" : ce feed n'a plus besoin de faire
  // coïncider son total avec un calcul séparé.
  const moisEcoules = moisEntiersEcoules(debutCpa, aujourdhui);

  const typeAbsenceId = await getTypeAbsenceId(supabase, "CP");

  // Même fenêtre que `fetchSoldes` (`periodeConsoCpaSansPlafond`, voir son
  // commentaire) : alignée sur `debutCpa`, pas bornée après la fin de la
  // période en cours — un CPA reste un CPA quelle que soit sa date, il ne
  // "gradue" plus en CP tant que la vraie bascule n'a pas eu lieu.
  const periodeConsoCpaSansPlafond: Periode = {
    debut: debutCpa,
    fin: decalerPeriode(periodeEnCours, 50).fin,
  };

  const [
    lignesTransmises,
    { data: demandesRowsBrutes, error: erreurDemandes },
    { data: ajustementsRows, error: erreurAjustements },
  ] = await Promise.all([
    // Réel = transmis ET pris en compte (11/09/2026, corrige un bug réel
    // trouvé par Vincent sur acme : ce feed n'avait jamais eu de distinction
    // réel/théorique — `mois` ci-dessous provenait de `demandesRows`, c'est-
    // à-dire de TOUT ce qui est validé, transmis ou pas. Un CPA validé mais
    // jamais transmis apparaissait donc à tort comme "passé en paie" dans le
    // mode "Réel" de la popin "Suivre mon solde" — alors que "Suivre les
    // soldes" (admin, `fetchSoldes`) affichait le bon chiffre, lui déjà
    // branché sur `sommeTransmis`/`pris_en_compte`).
    fetchLignesTransmises(
      supabase,
      utilisateurId,
      typeAbsenceId,
      true,
      periodeConsoCpaSansPlafond,
      aujourdhui,
    ),
    supabase
      .from("demandes_conges")
      .select("id, date_debut, date_fin, nb_demi_journees, statut, date_decision, conge_impose_id")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", true)
      .gte("date_debut", dateIso(periodeConsoCpaSansPlafond.debut))
      .lte("date_debut", dateIso(periodeConsoCpaSansPlafond.fin)),
    supabase
      .from("ajustements_solde")
      .select("id, delta_jours, motif, created_at, auteur:utilisateurs!auteur_id(prenom, nom)")
      .eq("utilisateur_id", utilisateurId)
      .eq("type_absence_id", typeAbsenceId)
      .eq("is_anticipation", true)
      .gte("created_at", debutCpa.toISOString())
      .lte("created_at", `${dateIso(aujourdhui)}T23:59:59.999Z`),
  ]);

  if (erreurDemandes || erreurAjustements) {
    throw new Error("Impossible de charger l'historique du solde.");
  }

  // Statut résolu à `aujourdhui` — voir `fetchHistoriqueCp`, même correctif.
  const statutsResolus = await resoudreStatutsADate(supabase, demandesRowsBrutes ?? [], aujourdhui);
  const demandesRows = (demandesRowsBrutes ?? []).filter(
    (d) => statutsResolus.get(d.id) === "validee",
  );
  const enAttenteRows = (demandesRowsBrutes ?? []).filter(
    (d) => statutsResolus.get(d.id) === "en_attente",
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
    congeImposeId?: string | null;
  }

  // "CPI" plutôt que "CPA" pour une consommation anticipée auto-générée par
  // un congé imposé (10/09/2026, même principe que `libelleMouvementCp` côté
  // CP) — désormais atteignable ici depuis que la fenêtre de consommation
  // CPA n'a plus de plafond haut (un CPI daté au-delà de la période en cours
  // devient une demande `is_anticipation = true`, voir
  // `genererDemandesCongeImpose` dans `calendrier.repository.ts`).
  function libelleMouvementCpa(d: {
    date_debut: string;
    date_fin: string;
    conge_impose_id?: string | null;
  }): string {
    const prefixe = d.conge_impose_id ? "CPI" : "CPA";
    return `${prefixe} : ${formatPeriodePillNumerique(d.date_debut, d.date_fin)}`;
  }

  // Un mois déjà figé (export paie validé, voir `acquisitions_gelees`)
  // affiche son montant gelé plutôt que recalculé au taux ACTUEL — même
  // principe que `accrualMensuelSommeAvecGel` (11/09/2026).
  const clesCpa = Array.from({ length: moisEcoules }, (_, i) => {
    const d = new Date(Date.UTC(debutCpa.getUTCFullYear(), debutCpa.getUTCMonth() + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const acquisitionsGeleesCpa =
    clesCpa.length > 0
      ? await fetchAcquisitionsGelees(
          supabase,
          utilisateurId,
          typeAbsenceId,
          true,
          clesCpa[0],
          clesCpa[clesCpa.length - 1],
        )
      : new Map<string, number>();
  const accrualsBruts: MouvementBrut[] = Array.from({ length: moisEcoules }, (_, i) => {
    const dateMois = new Date(
      Date.UTC(debutCpa.getUTCFullYear(), debutCpa.getUTCMonth() + i, debutCpa.getUTCDate()),
    );
    const cleMois = clesCpa[i];
    return {
      id: `acquisition-${dateIso(dateMois)}`,
      type: "acquisition",
      date: dateIso(dateMois),
      libelle: `Acquisition ${formatMoisAnnee(dateMois)}`,
      jours: montantAcquisitionMois(
        acquisitionsGeleesCpa,
        regleCP.tauxAcquisitionMensuel,
        historiqueTaux,
        tauxActuel,
        cleMois,
        moisLimite,
      ),
    };
  });

  // Réel — construit sur `lignesTransmises` (transmis ET pris en compte),
  // jamais sur les demandes simplement validées (voir commentaire sur
  // `lignesTransmises` ci-dessus).
  const mouvementsBruts: MouvementBrut[] = [
    ...accrualsBruts,
    ...lignesTransmises.map((l): MouvementBrut => ({
      id: l.id,
      demandeId: l.demande_id,
      type: "demande",
      date: l.date_debut,
      libelle: libelleMouvementCpa({
        date_debut: l.date_debut,
        date_fin: l.date_fin,
        conge_impose_id: l.conge_impose_id,
      }),
      jours: -l.jours_inclus,
      congeImposeId: l.conge_impose_id,
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

  // Théorique — mêmes accruals, mais TOUTES les demandes validées (transmises
  // ou pas), même principe que `fetchHistoriqueCp`/`mouvementsBrutsTheorique`.
  const mouvementsBrutsTheorique: MouvementBrut[] = [
    ...accrualsBruts,
    ...(demandesRows ?? []).map((d): MouvementBrut => ({
      id: d.id,
      type: "demande",
      date: d.date_debut,
      libelle: libelleMouvementCpa(d),
      jours: -(Number(d.nb_demi_journees) / 2),
      congeImposeId: d.conge_impose_id,
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

  let cumulValidee = baseCpa;
  const mouvementsTheorique: MouvementSolde[] = mouvementsBrutsTheorique.map((m) => {
    cumulValidee += m.jours;
    return { ...m, soldeApres: cumulValidee };
  });

  let cumulTheorique = cumulValidee;
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

  // Pas de `Math.max(0, ...)` ici non plus (10/09/2026, même correctif que
  // `fetchHistoriqueRtt` juste au-dessus).
  return {
    periodeDebut: dateIso(periodeEnCours.debut),
    periodeFin: dateIso(periodeEnCours.fin),
    soldeDepart: baseCpa,
    soldeDepartDate,
    mois: moisListe,
    soldeActuel: cumul,
    enAttente,
    mouvementsTheorique,
    soldeTheorique: cumulTheorique,
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
): Promise<{ id: string; deltaJours: number; motif: string; date: string; auteurNom: string }[]> {
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
