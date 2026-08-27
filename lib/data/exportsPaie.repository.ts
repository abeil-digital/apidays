import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CongeATransmettre,
  DemandeEquipe,
  LigneExportPaie,
  NouvelleDemandeInput,
  StatutTransmission,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { getTypeAbsenceId } from "@/lib/data/typesAbsences";
import {
  calculerNbDemiJournees,
  getUtilisateurId,
  mapDemandeEquipeDepuisDb,
  SELECT_DEMANDE_EQUIPE,
  type DemandeEquipeRow,
} from "@/lib/data/demandes.repository";
import { fetchSoldes } from "@/lib/data/soldes.repository";
import { fetchUtilisateursAdmin } from "@/lib/data/utilisateurs.repository";

/**
 * Repository "Transmissions paie" — transmission des congés vers la comptable
 * (`exports_paie`/`export_paie_lignes`, voir BASE-DE-DONNEES.md). Le statut
 * de transmission vit sur une ligne de ledger, pas sur `demandes_conges` :
 * une demande peut être transmise en plusieurs tranches (congé à cheval sur
 * deux périodes de paie, voir `genererExportPaie`).
 */

interface LigneExportPaieRow {
  jours_inclus: number;
  statut: StatutTransmission;
}

interface DemandeAvecLignesRow extends DemandeEquipeRow {
  export_paie_lignes: LigneExportPaieRow[] | null;
}

function soldeTransmission(row: DemandeAvecLignesRow): number {
  return (row.export_paie_lignes ?? []).reduce((total, l) => total + Number(l.jours_inclus), 0);
}

/**
 * Demandes validées ou annulées (CP/RTT/CSS), avec leur solde de
 * transmission déjà calculé (`export_paie_lignes` embarqué) — brique
 * partagée par `fetchCongesATransmettre` (affichage) et `genererExportPaie`
 * (calcul des lignes à créer), aucun filtre de date : le principe même de
 * cet écran est de faire remonter aussi les congés d'une période antérieure
 * jamais transmis (voir discussion du 24/08/2026).
 */
async function fetchDemandesAvecSoldeTransmission(
  supabase: SupabaseClient,
): Promise<{ demande: DemandeEquipe; soldeTransmission: number }[]> {
  const { data, error } = await supabase
    .from("demandes_conges")
    .select(`${SELECT_DEMANDE_EQUIPE}, export_paie_lignes(jours_inclus)`)
    .in("statut", ["validee", "annulee"])
    .order("date_debut", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les congés validés/annulés.");
  }

  return ((data ?? []) as unknown as DemandeAvecLignesRow[])
    .map((row) => ({
      demande: mapDemandeEquipeDepuisDb(row),
      soldeTransmission: soldeTransmission(row),
    }))
    .filter(
      ({ demande }) => demande.type === "CP" || demande.type === "RTT" || demande.type === "CSS",
    );
}

/**
 * Congés en attente pas encore dus (même règle que les validés/annulés,
 * `demande.debut <= periode.fin`, pas de borne basse) — corrigé le
 * 24/08/2026 : un chevauchement strict avec la période (`d.fin >= debut`)
 * faisait disparaître un congé en attente resté non tranché depuis un mois
 * largement passé (ex. posé le 16/07, jamais décidé) de tous les récaps,
 * validé ou pas — alors que c'est justement ce genre d'oubli que l'écran
 * doit faire remonter pour que Delphine le tranche avant transmission.
 */
async function fetchDemandesEnAttenteAvant(
  supabase: SupabaseClient,
  fin: string,
): Promise<DemandeEquipe[]> {
  const { data, error } = await supabase
    .from("demandes_conges")
    .select(SELECT_DEMANDE_EQUIPE)
    .eq("statut", "en_attente")
    .lte("date_debut", fin)
    .order("date_debut", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les congés en attente.");
  }

  return ((data ?? []) as unknown as DemandeEquipeRow[])
    .map(mapDemandeEquipeDepuisDb)
    .filter((d) => d.type === "CP" || d.type === "RTT" || d.type === "CSS");
}

/**
 * Onglet "Quels congés transmettre" — trois catégories fusionnées côté
 * client (pas de filtre de date sur les validés/annulés, c'est tout
 * l'intérêt : un congé de juin jamais transmis doit remonter en août) :
 * - Validés dont il reste des jours à transmettre (`joursRestants > 0`).
 * - Annulés dont le solde de transmission n'a pas encore été corrigé
 *   (`joursRestants < 0` — ligne de correction à venir).
 * - En attente pas encore dues (backlog jamais tranché + anticipation).
 */
export async function fetchCongesATransmettre(periode: {
  debut: string;
  fin: string;
}): Promise<CongeATransmettre[]> {
  const supabase = createClient();

  const [avecSolde, enAttente] = await Promise.all([
    fetchDemandesAvecSoldeTransmission(supabase),
    fetchDemandesEnAttenteAvant(supabase, periode.fin),
  ]);

  const resultat: CongeATransmettre[] = [];

  for (const { demande, soldeTransmission: solde } of avecSolde) {
    // Un congé qui démarre après la fin de la période n'est pas encore dû —
    // il remontera à son tour (décision actée : le récap ne montre que la
    // période courante + le backlog jamais transmis, pas les congés déjà
    // validés pour un mois futur).
    if (demande.debut > periode.fin) continue;
    if (demande.statut === "validé") {
      const joursRestants = demande.nbDemiJournees / 2 - solde;
      if (joursRestants > 0) {
        resultat.push({ ...demande, joursRestants, joursDejaTransmis: solde });
      }
    } else if (demande.statut === "annulé" && solde > 0) {
      resultat.push({ ...demande, joursRestants: -solde, joursDejaTransmis: solde });
    }
  }

  for (const demande of enAttente) {
    resultat.push({ ...demande, joursRestants: demande.nbDemiJournees / 2, joursDejaTransmis: 0 });
  }

  return resultat.sort((a, b) => a.debut.localeCompare(b.debut));
}

/**
 * Jours d'une demande qui tombent entre son début et la fin de la période
 * exportée — même calcul que `calculerNbDemiJournees`, borné à
 * `[max(demande.debut, periode.debut), periode.fin]`. Utilisé uniquement
 * pour un congé qui déborde SUR le mois suivant (à cheval, `demande.fin >
 * periode.fin`) : découpe alors la tranche à transmettre maintenant de
 * celle qui attendra un futur export (notation "2/6" de Vincent). Un congé
 * du backlog (déjà entièrement passé, `demande.fin <= periode.fin`) n'a pas
 * besoin de ce découpage — voir `genererExportPaie`, qui transmet directement
 * tout son reliquat dans ce cas (rattrapage complet, pas de fragmentation
 * supplémentaire).
 */
async function joursDansPeriode(
  supabase: SupabaseClient,
  demande: DemandeEquipe,
  periode: { debut: string; fin: string },
): Promise<number> {
  const debut = demande.debut > periode.debut ? demande.debut : periode.debut;
  const fin = periode.fin;
  if (debut > fin) return 0;

  const demiDebut = debut === demande.debut ? demande.demiDebut : "matin";
  const demiJournees = await calculerNbDemiJournees(supabase, debut, fin, demiDebut, "apres_midi");
  return demiJournees / 2;
}

/**
 * Combien de jours d'un `CongeATransmettre` partiraient RÉELLEMENT si on
 * cliquait "Transmettre" maintenant sur cette période — même calcul que la
 * boucle de `genererExportPaie`, exposé séparément pour l'aperçu (colonne
 * Durée de "Quels congés transmettre", récap par type) sans créer de
 * lignes. Un congé annulé (correction) renvoie directement son reliquat
 * négatif — pas de découpage par date pour une correction, voir
 * `genererExportPaie`. Un congé "en attente" renvoie toujours 0 : ce n'est
 * pas encore une décision accordée, `genererExportPaie` ne le prend jamais
 * en compte (`fetchDemandesAvecSoldeTransmission` ne fetch que
 * validée/annulée) tant qu'il n'a pas été validé — bug corrigé le
 * 25/08/2026, signalé par Vincent : le récap par type comptait à tort ces
 * jours-là dans son total (38 j affichés au lieu de 35, l'écart correspondant
 * exactement aux deux demandes encore en attente de la période).
 */
export async function calculerJoursATransmettreMaintenant(
  conge: CongeATransmettre,
  periode: { debut: string; fin: string },
): Promise<number> {
  if (conge.statut === "en attente") return 0;
  if (conge.statut === "annulé") return conge.joursRestants;
  if (conge.joursRestants <= 0) return 0;
  if (conge.debut > periode.fin) return 0;
  if (conge.fin <= periode.fin) return conge.joursRestants;

  const supabase = createClient();
  const intersection = await joursDansPeriode(supabase, conge, periode);
  return Math.min(intersection, conge.joursRestants);
}

/**
 * L'export déjà généré pour une période, s'il existe — pour savoir si le
 * bouton "Transmettre" doit être désactivé et pour alimenter l'onglet
 * "Vérifier les fiches de paie" (qui a besoin de l'id de l'export).
 */
export async function fetchExportPaie(periode: {
  debut: string;
  fin: string;
}): Promise<{ id: string; genereLe: string } | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("exports_paie")
    .select("id, genere_le")
    .eq("periode_debut", periode.debut)
    .eq("periode_fin", periode.fin)
    .maybeSingle();

  if (error) {
    throw new Error("Impossible de vérifier si cette période a déjà été transmise.");
  }

  return data ? { id: data.id, genereLe: data.genere_le } : null;
}

/**
 * Statut de transmission de plusieurs périodes en un seul aller-retour —
 * pour la liste `/suivre/transmissions-paie` (25/08/2026, repasse technique :
 * la liste n'affichait aucun statut, alors que `exports_paie` le porte
 * depuis le 24/08/2026 — un `fetchExportPaie` par période aurait fait
 * NB_ARCHIVES + 1 aller-retours). Clé du record : `periode.debut` (même
 * convention que l'URL `/suivre/transmissions-paie/[debut]`).
 */
export async function fetchExportsPaie(
  periodes: { debut: string; fin: string }[],
): Promise<Record<string, { id: string; genereLe: string }>> {
  if (periodes.length === 0) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .from("exports_paie")
    .select("id, genere_le, periode_debut")
    .in(
      "periode_debut",
      periodes.map((p) => p.debut),
    );

  if (error) {
    throw new Error("Impossible de vérifier les périodes déjà transmises.");
  }

  const parPeriode: Record<string, { id: string; genereLe: string }> = {};
  for (const row of data ?? []) {
    parPeriode[row.periode_debut] = { id: row.id, genereLe: row.genere_le };
  }
  return parPeriode;
}

/**
 * Action "Transmettre" — crée l'export puis ses lignes :
 * - Congés validés avec un reliquat : seule la portion tombant dans la
 *   période est transmise maintenant (`joursDansPeriode`), plafonnée au
 *   reliquat réel (`joursRestants`) pour ne jamais transmettre plus que ce
 *   qui reste. Le reliquat hors période n'est pas touché, repris par un
 *   futur export.
 * - Congés annulés avec un solde de transmission positif : une seule ligne
 *   de correction négative (`-soldeTransmission`), qui ramène leur solde à
 *   0 d'un coup — les lignes de l'export d'origine ne sont jamais modifiées
 *   (décision actée avec Vincent : pas de réécriture de l'historique).
 *
 * La contrainte unique `exports_paie_periode_unique` empêche un doublon si
 * l'action est rejouée sur une période déjà transmise (erreur Postgres
 * 23505, remontée telle quelle à l'appelant).
 */
export async function genererExportPaie(periode: {
  debut: string;
  fin: string;
}): Promise<{ exportId: string; nbLignes: number }> {
  const supabase = createClient();
  const utilisateurId = await getUtilisateurId(supabase);

  const { data: exportPaie, error: errorExport } = await supabase
    .from("exports_paie")
    .insert({ periode_debut: periode.debut, periode_fin: periode.fin, genere_par: utilisateurId })
    .select("id")
    .single();

  if (errorExport || !exportPaie) {
    if (errorExport?.code === "23505") {
      throw new Error("Un export a déjà été généré pour cette période.");
    }
    throw new Error("Impossible de créer l'export.");
  }

  const avecSolde = await fetchDemandesAvecSoldeTransmission(supabase);
  const lignes: { export_paie_id: string; demande_id: string; jours_inclus: number }[] = [];

  for (const { demande, soldeTransmission: solde } of avecSolde) {
    // Congé pas encore dû (démarre après cette période) — laissé de côté
    // pour un futur export, voir `fetchCongesATransmettre`.
    if (demande.debut > periode.fin) continue;

    if (demande.statut === "validé") {
      const joursRestants = demande.nbDemiJournees / 2 - solde;
      if (joursRestants <= 0) continue;
      // Backlog ou congé entièrement dans la période : rattrapage complet
      // du reliquat, pas de fragmentation (aucun futur export ne le
      // réclamerait sinon). À cheval sur le mois suivant : seule la
      // tranche jusqu'à `periode.fin` part maintenant.
      const joursCettePeriode =
        demande.fin <= periode.fin
          ? joursRestants
          : Math.min(await joursDansPeriode(supabase, demande, periode), joursRestants);
      if (joursCettePeriode > 0) {
        lignes.push({
          export_paie_id: exportPaie.id,
          demande_id: demande.id,
          jours_inclus: joursCettePeriode,
        });
      }
    } else if (demande.statut === "annulé" && solde > 0) {
      lignes.push({ export_paie_id: exportPaie.id, demande_id: demande.id, jours_inclus: -solde });
    }
  }

  if (lignes.length > 0) {
    const { error: errorLignes } = await supabase.from("export_paie_lignes").insert(lignes);
    if (errorLignes) {
      throw new Error("Export créé, mais impossible d'enregistrer les lignes transmises.");
    }
  }

  return { exportId: exportPaie.id, nbLignes: lignes.length };
}

export interface CheckFichePaieCollaborateur {
  utilisateur: { id: string; prenom: string; nom: string };
  totalJours: number;
  lignes: { ligne: LigneExportPaie; demande: DemandeEquipe }[];
}

interface LigneCheckRow extends LigneExportPaieRow {
  id: string;
  demande_id: string;
  motif_ecart: string | null;
  verifie_le: string | null;
  demandes_conges: DemandeEquipeRow | DemandeEquipeRow[] | null;
}

/**
 * Onglet "Vérifier les fiches de paie" — les lignes d'un export, groupées
 * par collaborateur (solde + total transmis, ce qui est littéralement
 * imprimé sur la fiche de paie), avec le détail par congé pour isoler un
 * écart précis (décision actée : "il faut passer en mode détail").
 */
export async function fetchCheckFichesPaie(
  exportId: string,
): Promise<CheckFichePaieCollaborateur[]> {
  const supabase = createClient();

  const { data: exportPaie, error: errorExport } = await supabase
    .from("exports_paie")
    .select("genere_le, periode_debut, periode_fin")
    .eq("id", exportId)
    .single();

  if (errorExport || !exportPaie) {
    throw new Error("Export introuvable.");
  }

  const { data, error } = await supabase
    .from("export_paie_lignes")
    .select(
      `id, demande_id, jours_inclus, statut, motif_ecart, verifie_le, demandes_conges(${SELECT_DEMANDE_EQUIPE})`,
    )
    .eq("export_paie_id", exportId);

  if (error) {
    throw new Error("Impossible de charger les lignes de cet export.");
  }

  const parCollaborateur = new Map<string, CheckFichePaieCollaborateur>();

  for (const row of (data ?? []) as unknown as LigneCheckRow[]) {
    const demandeRow = Array.isArray(row.demandes_conges)
      ? row.demandes_conges[0]
      : row.demandes_conges;
    if (!demandeRow) continue;
    const demande = mapDemandeEquipeDepuisDb(demandeRow);

    const ligne: LigneExportPaie = {
      id: row.id,
      demandeId: row.demande_id,
      joursInclus: Number(row.jours_inclus),
      statut: row.statut,
      motifEcart: row.motif_ecart,
      verifieLe: row.verifie_le,
      genereLe: exportPaie.genere_le,
      periodeDebut: exportPaie.periode_debut,
      periodeFin: exportPaie.periode_fin,
    };

    const existant = parCollaborateur.get(demande.demandeur.id);
    if (existant) {
      existant.totalJours += ligne.joursInclus;
      existant.lignes.push({ ligne, demande });
    } else {
      parCollaborateur.set(demande.demandeur.id, {
        utilisateur: demande.demandeur,
        totalJours: ligne.joursInclus,
        lignes: [{ ligne, demande }],
      });
    }
  }

  return Array.from(parCollaborateur.values()).sort((a, b) =>
    a.utilisateur.nom.localeCompare(b.utilisateur.nom),
  );
}

interface LigneTransmissionRow {
  id: string;
  demande_id: string;
  jours_inclus: number;
  statut: StatutTransmission;
  motif_ecart: string | null;
  verifie_le: string | null;
  exports_paie:
    | { genere_le: string; periode_debut: string; periode_fin: string }
    | { genere_le: string; periode_debut: string; periode_fin: string }[]
    | null;
}

/**
 * Lignes de transmission de plusieurs demandes en un seul aller-retour,
 * groupées par `demande_id` — pour afficher le statut "Transmis"/"En paye"/
 * "Écart" dans "Suivre les demandes" (badge par ligne du tableau) et pour
 * alimenter `DetailCongePanel.lignesTransmission` sans un fetch par demande.
 */
export async function fetchLignesTransmissionParDemande(
  demandeIds: string[],
): Promise<Record<string, LigneExportPaie[]>> {
  if (demandeIds.length === 0) return {};
  const supabase = createClient();

  const { data, error } = await supabase
    .from("export_paie_lignes")
    .select(
      "id, demande_id, jours_inclus, statut, motif_ecart, verifie_le, exports_paie(genere_le, periode_debut, periode_fin)",
    )
    .in("demande_id", demandeIds);

  if (error) {
    throw new Error("Impossible de charger les lignes de transmission.");
  }

  const parDemande: Record<string, LigneExportPaie[]> = {};
  for (const row of (data ?? []) as unknown as LigneTransmissionRow[]) {
    const exportPaie = Array.isArray(row.exports_paie) ? row.exports_paie[0] : row.exports_paie;
    if (!exportPaie) continue;
    const ligne: LigneExportPaie = {
      id: row.id,
      demandeId: row.demande_id,
      joursInclus: Number(row.jours_inclus),
      statut: row.statut,
      motifEcart: row.motif_ecart,
      verifieLe: row.verifie_le,
      genereLe: exportPaie.genere_le,
      periodeDebut: exportPaie.periode_debut,
      periodeFin: exportPaie.periode_fin,
    };
    (parDemande[row.demande_id] ??= []).push(ligne);
  }
  return parDemande;
}

export async function validerCheckPaie(ligneIds: string[]): Promise<void> {
  if (ligneIds.length === 0) return;
  const supabase = createClient();
  const utilisateurId = await getUtilisateurId(supabase);

  const { error } = await supabase
    .from("export_paie_lignes")
    .update({ statut: "en_paye", verifie_le: new Date().toISOString(), verifie_par: utilisateurId })
    .in("id", ligneIds);

  if (error) {
    throw new Error("Impossible de valider ces lignes.");
  }
}

export async function signalerEcart(ligneId: string, motif: string): Promise<void> {
  const supabase = createClient();
  const utilisateurId = await getUtilisateurId(supabase);

  const { error } = await supabase
    .from("export_paie_lignes")
    .update({
      statut: "ecart",
      motif_ecart: motif,
      verifie_le: new Date().toISOString(),
      verifie_par: utilisateurId,
    })
    .eq("id", ligneId);

  if (error) {
    throw new Error("Impossible de signaler cet écart.");
  }
}

/**
 * "Poser pour un collaborateur" — Delphine crée une demande déjà validée au
 * nom d'un collaborateur (oubli du salarié, correction ponctuelle — maladie
 * hors scope, décision actée). Visible dans l'historique du salarié
 * concerné (transparence totale, décision actée) : `commentaire_decision`
 * trace qui l'a ajoutée.
 */
export async function poserCongePourCollaborateur(
  input: NouvelleDemandeInput & { utilisateurId: string },
): Promise<void> {
  const supabase = createClient();
  const auteurId = await getUtilisateurId(supabase);

  const [typeAbsenceId, nbDemiJournees, { data: auteur }] = await Promise.all([
    getTypeAbsenceId(supabase, input.type),
    calculerNbDemiJournees(supabase, input.debut, input.fin, input.demiDebut, input.demiFin),
    supabase.from("utilisateurs").select("prenom, nom").eq("id", auteurId).single(),
  ]);

  const commentaire = auteur
    ? `Ajouté par ${auteur.prenom} ${auteur.nom}${input.note ? " — " + input.note : ""}`
    : input.note || null;

  const { data: demande, error } = await supabase
    .from("demandes_conges")
    .insert({
      utilisateur_id: input.utilisateurId,
      type_absence_id: typeAbsenceId,
      date_debut: input.debut,
      date_fin: input.fin,
      demi_debut: input.demiDebut,
      demi_fin: input.demiFin,
      nb_demi_journees: nbDemiJournees,
      is_anticipation: input.isAnticipation,
      commentaire_salarie: input.note || null,
      statut: "validee",
      validateur_id: auteurId,
      commentaire_decision: commentaire,
      date_decision: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !demande) {
    throw new Error("Impossible d'ajouter ce congé.");
  }

  // Journal des décisions (`decisions_demande`, 25/08/2026) — même principe
  // que `deciderDemande` : best-effort, une erreur ici ne doit pas remonter
  // (le congé est déjà créé et validé).
  await supabase
    .from("decisions_demande")
    .insert({ demande_id: demande.id, statut: "validee", commentaire, decide_par: auteurId })
    .then(({ error: erreurJournal }) => {
      if (erreurJournal) {
        console.error("Impossible d'enregistrer la décision dans le journal.", erreurJournal);
      }
    });
}

export interface SoldeComparaisonCategorie {
  moisPrecedent: number;
  moisEnCours: number;
  mouvement: number;
}

export interface ComparaisonSoldeCollaborateur {
  utilisateur: { id: string; prenom: string; nom: string };
  cp: SoldeComparaisonCategorie;
  rtt: SoldeComparaisonCategorie;
  cpa: SoldeComparaisonCategorie;
}

/** Somme signée des `export_paie_lignes` d'un export, par collaborateur et par
 * type (CP/RTT/CPA) — un `jours_inclus` positif (transmission normale) réduit
 * le solde, un `jours_inclus` négatif (correction/retro) le restitue ; d'où
 * l'inversion de signe (`-total`) pour obtenir un "mouvement de solde"
 * directement comparable à la fiche de paie. */
async function fetchMouvementsExport(
  exportId: string,
): Promise<Record<string, { cp: number; rtt: number; cpa: number }>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("export_paie_lignes")
    .select(`jours_inclus, demandes_conges(utilisateur_id, type_absence_id, is_anticipation)`)
    .eq("export_paie_id", exportId);

  if (error) {
    throw new Error("Impossible de charger les mouvements de cet export.");
  }

  const [idCp, idRtt] = await Promise.all([
    getTypeAbsenceId(supabase, "CP"),
    getTypeAbsenceId(supabase, "RTT"),
  ]);

  const parUtilisateur: Record<string, { cp: number; rtt: number; cpa: number }> = {};
  for (const row of (data ?? []) as unknown as {
    jours_inclus: number;
    demandes_conges:
      | { utilisateur_id: string; type_absence_id: string; is_anticipation: boolean }
      | { utilisateur_id: string; type_absence_id: string; is_anticipation: boolean }[]
      | null;
  }[]) {
    const demande = Array.isArray(row.demandes_conges) ? row.demandes_conges[0] : row.demandes_conges;
    if (!demande) continue;

    const entree = (parUtilisateur[demande.utilisateur_id] ??= { cp: 0, rtt: 0, cpa: 0 });
    const jours = -Number(row.jours_inclus);
    if (demande.type_absence_id === idRtt) {
      entree.rtt += jours;
    } else if (demande.type_absence_id === idCp && demande.is_anticipation) {
      entree.cpa += jours;
    } else if (demande.type_absence_id === idCp) {
      entree.cp += jours;
    }
  }
  return parUtilisateur;
}

/**
 * Comparaison de soldes par collaborateur pour "Vérifier les fiches de
 * paie" (25/08/2026, demande explicite de Vincent) — "Delphine envoie les
 * mouvements de congés qui ont eu lieu pendant le mois au comptable (export
 * CSV) ; le comptable crée les fiches de paie en conséquence, qui contiennent
 * les soldes ; Delphine doit vérifier que les soldes sont ok, que les jours
 * consommés sont bien implémentés et que les jours acquis sont bien pris en
 * compte."
 *
 * **Mise à jour du sens (27/08/2026, refonte du modèle solde théorique/réel,
 * voir CONTEXTE.md)** : `moisPrecedent`/`moisEnCours` viennent de
 * `fetchSoldes(...).valeur`, qui est désormais lui-même ancré sur ce qui a
 * été transmis en paie (`export_paie_lignes`) — ce sont donc DIRECTEMENT les
 * nombres que Delphine doit comparer à la fiche de paie papier du comptable,
 * pas un solde recalculé en direct qu'il faudrait ensuite réconcilier.
 * `mouvement` (`fetchMouvementsExport`) reste calculé mais n'est plus un
 * contrôle indépendant censé "recouper" les deux soldes (par construction,
 * une fois `valeur` ancré transmission, `moisEnCours - moisPrecedent` égale
 * déjà `mouvement` pour un export unique sur la période) — c'est désormais
 * une colonne de détail/lisibilité : "ce qui a précisément été transmis dans
 * CET export" (utile par ex. pour repérer une ligne de correction au sein du
 * total). Le vrai contrôle de cohérence à faire par Delphine est direct :
 * `moisEnCours` correspond-il à ce qui est écrit sur la fiche de paie ?
 *
 * Tous les collaborateurs ACTIFS sont inclus, pas seulement ceux qui ont des
 * lignes transmises sur cet export — "le 0 mouvement est important" (Vincent) :
 * un collaborateur sans aucun mouvement doit apparaître avec 0 explicite,
 * pas être absent de la liste.
 */
export async function fetchComparaisonSoldes(
  periode: { debut: string; fin: string },
  exportId: string | null,
): Promise<ComparaisonSoldeCollaborateur[]> {
  const veilleDebut = new Date(`${periode.debut}T00:00:00Z`);
  veilleDebut.setUTCDate(veilleDebut.getUTCDate() - 1);
  const finMoisPrecedent = veilleDebut;
  const finMoisEnCours = new Date(`${periode.fin}T00:00:00Z`);

  const [utilisateurs, mouvementsParUtilisateur] = await Promise.all([
    fetchUtilisateursAdmin(),
    exportId
      ? fetchMouvementsExport(exportId)
      : Promise.resolve<Record<string, { cp: number; rtt: number; cpa: number }>>({}),
  ]);
  const actifs = utilisateurs.filter((u) => u.statut === "actif");

  return Promise.all(
    actifs.map(async (u) => {
      const [soldesPrecedent, soldesEnCours] = await Promise.all([
        fetchSoldes(u.id, finMoisPrecedent),
        fetchSoldes(u.id, finMoisEnCours),
      ]);
      const mouvements = mouvementsParUtilisateur[u.id] ?? { cp: 0, rtt: 0, cpa: 0 };

      return {
        utilisateur: { id: u.id, prenom: u.prenom, nom: u.nom },
        cp: {
          moisPrecedent: soldesPrecedent.cp.valeur,
          moisEnCours: soldesEnCours.cp.valeur,
          mouvement: mouvements.cp,
        },
        rtt: {
          moisPrecedent: soldesPrecedent.rtt.valeur,
          moisEnCours: soldesEnCours.rtt.valeur,
          mouvement: mouvements.rtt,
        },
        cpa: {
          moisPrecedent: soldesPrecedent.cpa.valeur,
          moisEnCours: soldesEnCours.cpa.valeur,
          mouvement: mouvements.cpa,
        },
      };
    }),
  );
}
