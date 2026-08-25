import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Demande,
  DemandeEquipe,
  DemiJournee,
  NouvelleDemandeInput,
  StatutDemande,
  TypeDemande,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { getTypeAbsenceId } from "@/lib/data/typesAbsences";

/**
 * Repository des demandes de congés/RTT.
 *
 * Branché sur Supabase (`demandes_conges`). La RLS limite déjà la lecture et
 * l'écriture aux demandes de l'utilisateur connecté — voir
 * BASE-DE-DONNEES.md. Le contrat (fonctions async retournant des `Demande[]`)
 * ne change pas, donc aucun hook ni composant n'est touché.
 */

interface DemandeRow {
  id: string;
  date_debut: string;
  date_fin: string;
  demi_debut: DemiJournee;
  demi_fin: DemiJournee;
  nb_demi_journees: number;
  created_at: string;
  statut: string;
  is_anticipation: boolean;
  commentaire_salarie: string | null;
  commentaire_decision: string | null;
  date_decision: string | null;
  vu: boolean;
  types_absences: { code: TypeDemande } | { code: TypeDemande }[] | null;
  validateur:
    | { id: string; prenom: string; nom: string }
    | { id: string; prenom: string; nom: string }[]
    | null;
}

// `validateur:` alias l'embed vers `utilisateurs!validateur_id` (désambiguïse
// des 3 FK de `demandes_conges` vers `utilisateurs`) — inclus dès la requête
// de base pour que le feed "Activité récente" du collaborateur (ses propres
// demandes) puisse nommer qui a validé/refusé, pas seulement l'Espace Suivre.
const SELECT_DEMANDE =
  "id, date_debut, date_fin, demi_debut, demi_fin, nb_demi_journees, created_at, statut, is_anticipation, commentaire_salarie, commentaire_decision, date_decision, vu, types_absences(code), validateur:utilisateurs!validateur_id(id, prenom, nom)";

// Exporté pour `exportsPaie.repository.ts` (étend ce type localement avec
// `export_paie_lignes`).
export interface DemandeEquipeRow extends DemandeRow {
  utilisateur_id: string;
  utilisateurs:
    | { id: string; prenom: string; nom: string }
    | { id: string; prenom: string; nom: string }[]
    | null;
}

// `demandes_conges` a 3 FK vers `utilisateurs` (utilisateur_id, validateur_id,
// devalidee_par) — PostgREST refuse d'embarquer sans préciser laquelle
// désambiguïser via `!utilisateur_id` (le `validateur` est déjà dans
// `SELECT_DEMANDE`, voir plus haut).
// Exporté pour `exportsPaie.repository.ts`, qui a besoin du même embed de
// base + `export_paie_lignes` en plus.
export const SELECT_DEMANDE_EQUIPE = `${SELECT_DEMANDE}, utilisateur_id, utilisateurs!utilisateur_id(id, prenom, nom)`;

const STATUT_DEPUIS_DB: Record<string, StatutDemande> = {
  en_attente: "en attente",
  validee: "validé",
  refusee: "refusé",
  annulee: "annulé",
};

function mapDemandeDepuisDb(row: DemandeRow): Demande {
  const typeAbsence = Array.isArray(row.types_absences)
    ? row.types_absences[0]
    : row.types_absences;
  const validateur = Array.isArray(row.validateur) ? row.validateur[0] : row.validateur;

  return {
    id: row.id,
    type: typeAbsence?.code ?? "CP",
    isAnticipation: row.is_anticipation,
    debut: row.date_debut,
    fin: row.date_fin,
    demiDebut: row.demi_debut,
    demiFin: row.demi_fin,
    nbDemiJournees: Number(row.nb_demi_journees),
    datePose: row.created_at.slice(0, 10),
    dateDecision: row.date_decision ? row.date_decision.slice(0, 10) : null,
    statut: STATUT_DEPUIS_DB[row.statut] ?? "en attente",
    note: row.commentaire_salarie ?? "",
    commentaireManager: row.commentaire_decision ?? "",
    validateur: validateur ?? null,
    vu: row.vu,
  };
}

// Exporté pour `exportsPaie.repository.ts` (génération de l'export paie —
// besoin du même id que "qui a créé/décidé la demande").
export async function getUtilisateurId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("my_utilisateur_id");
  if (error || !data) {
    throw new Error("Utilisateur non identifié.");
  }
  return data;
}

// Une demi-journée (`demi`) d'un jour (`iso`) fait-elle partie d'une période
// [debutP, finP] ? Vrai sur toute la période SAUF sur la demi-journée exclue
// à chaque borne (`demiDebutP === "apres_midi"` exclut le matin du premier
// jour, `demiFinP === "matin"` exclut l'après-midi du dernier) — même logique
// que `demiCouvertePeriode` côté client (`PoserDemandeModal.tsx`), dupliquée
// ici faute de module partagé entre code serveur et composant.
function demiCouvertePeriode(
  iso: string,
  demi: DemiJournee,
  debutP: string,
  finP: string,
  demiDebutP: DemiJournee,
  demiFinP: DemiJournee,
): boolean {
  if (iso < debutP || iso > finP) return false;
  if (iso === debutP && demiDebutP === "apres_midi" && demi === "matin") return false;
  if (iso === finP && demiFinP === "matin" && demi === "apres_midi") return false;
  return true;
}

/**
 * Nombre de demi-journées entre deux dates (incluses), jours fériés et
 * weekends exclus — voir BASE-DE-DONNEES.md. Chaque jour ouvré compte pour 2
 * demi-journées, sauf : le premier jour si `demiDebut = "apres_midi"` (matin
 * non posé) et le dernier jour si `demiFin = "matin"` (après-midi non posé) —
 * l'ajustement ne s'applique que si ce jour est effectivement un jour ouvré
 * du décompte (sinon demande sur un jour férié/weekend n'a pas de sens) ; et
 * toute demi-journée déjà couverte par un congé imposé (CPI,
 * `conges_imposes`) ou une demi-journée imposée (DJI,
 * `demi_journees_imposees`) dans la période, qui n'est jamais disponible pour
 * cette demande — corrigé le 18/08/2026 : ce calcul serveur ne déduisait ni
 * l'un ni l'autre, contrairement à l'aperçu client de la popin "Nouvelle
 * demande" (`typeOccupantDemiJour`), d'où des écarts observés côté Suivre les
 * demandes (DJI : 5j affichés au lieu de 4,5j ; CPI : une période 14→24 août
 * chevauchant 5 jours de CPI enregistrée pour 7j au lieu des 2j réellement
 * disponibles).
 */
// Exporté pour `exportsPaie.repository.ts` (`genererExportPaie` doit compter
// les jours d'une demande qui tombent dans l'intersection avec la période
// exportée — même calcul, bornes différentes).
export async function calculerNbDemiJournees(
  supabase: SupabaseClient,
  debut: string,
  fin: string,
  demiDebut: DemiJournee,
  demiFin: DemiJournee,
): Promise<number> {
  const [{ data: feries }, { data: djis }, { data: cpis }] = await Promise.all([
    supabase.from("jours_feries").select("date").gte("date", debut).lte("date", fin),
    supabase
      .from("demi_journees_imposees")
      .select("date, demi_journee")
      .gte("date", debut)
      .lte("date", fin),
    supabase
      .from("conges_imposes")
      .select("date_debut, date_fin, demi_debut, demi_fin")
      .lte("date_debut", fin)
      .gte("date_fin", debut),
  ]);
  const joursFeries = new Set((feries ?? []).map((f: { date: string }) => f.date));
  const djiParDemiJour = new Set(
    (djis ?? []).map(
      (d: { date: string; demi_journee: DemiJournee }) => `${d.date}_${d.demi_journee}`,
    ),
  );
  const congesImposes = (cpis ?? []) as {
    date_debut: string;
    date_fin: string;
    demi_debut: DemiJournee;
    demi_fin: DemiJournee;
  }[];

  // Dates manipulées en UTC (Date.UTC) pour éviter tout décalage de fuseau
  // horaire côté navigateur — un `new Date(iso + "T00:00:00")` en UTC+1/+2
  // décale silencieusement le curseur d'un jour (minuit local = veille en UTC).
  const joursOuvres: string[] = [];
  const cursor = new Date(`${debut}T00:00:00Z`);
  const finDate = new Date(`${fin}T00:00:00Z`);

  while (cursor <= finDate) {
    const jourSemaine = cursor.getUTCDay();
    const iso = cursor.toISOString().slice(0, 10);
    if (jourSemaine !== 0 && jourSemaine !== 6 && !joursFeries.has(iso)) {
      joursOuvres.push(iso);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  function demiOccupeeParCpi(iso: string, demi: DemiJournee): boolean {
    return congesImposes.some((c) =>
      demiCouvertePeriode(iso, demi, c.date_debut, c.date_fin, c.demi_debut, c.demi_fin),
    );
  }

  let total = 0;
  joursOuvres.forEach((iso, index) => {
    const matinDemande = !(index === 0 && demiDebut === "apres_midi");
    const apresMidiDemande = !(index === joursOuvres.length - 1 && demiFin === "matin");
    if (matinDemande && !djiParDemiJour.has(`${iso}_matin`) && !demiOccupeeParCpi(iso, "matin")) {
      total += 1;
    }
    if (
      apresMidiDemande &&
      !djiParDemiJour.has(`${iso}_apres_midi`) &&
      !demiOccupeeParCpi(iso, "apres_midi")
    ) {
      total += 1;
    }
  });

  return total;
}

/**
 * Demandes du salarié connecté (Accueil, Historique). Filtre explicitement
 * par `utilisateur_id` — la RLS seule ne suffit pas : la policy "manager lit
 * toutes les demandes" (les managers sont les directeurs, autorité globale)
 * s'ajoute en OR à celle du salarié sur ses propres demandes, donc un
 * manager sans ce filtre récupérerait aussi les demandes de toute
 * l'entreprise et les verrait affichées comme les siennes.
 *
 * `utilisateurId` optionnel (24/08/2026, même principe que `fetchSoldes`) :
 * sans argument, l'utilisateur connecté ; avec, n'importe quel collaborateur
 * — utilisé par `/suivre/calendrier` (manager/admin consultant le calendrier
 * d'un collaborateur), la RLS élargie manager/admin l'autorise déjà.
 *
 * Inclut les demandes `annulee` depuis le 25/08/2026 (le filtre `.neq`
 * excluait auparavant TOUTE demande annulée, y compris une régularisation
 * Delphine d'un congé déjà validé — invisible pour le salarié concerné,
 * qui ne pouvait ni la voir dans son historique ni être notifié du
 * changement ; signalé par Vincent avec Olivier comme exemple concret).
 * `annulerDemande` (retrait par le salarié lui-même d'une demande encore en
 * attente) n'a pour l'instant aucun appelant dans l'UI, donc en pratique
 * toute demande `annulee` remontée ici est une régularisation, traçable via
 * `dateDecision`/`validateur`.
 */
export async function fetchDemandes(utilisateurId?: string): Promise<Demande[]> {
  const supabase = createClient();

  const id = utilisateurId ?? (await getUtilisateurId(supabase));

  const { data, error } = await supabase
    .from("demandes_conges")
    .select(SELECT_DEMANDE)
    .eq("utilisateur_id", id)
    .order("date_debut", { ascending: false });

  if (error) {
    throw new Error("Impossible de charger les demandes.");
  }

  return (data ?? []).map(mapDemandeDepuisDb);
}

/**
 * Une demande par id, avec collaborateur (`DemandeEquipe`) — pour le clic sur
 * une pill CP/RTT/CPA de `SoldeDetailPanel` (20/08/2026), qui n'a que l'id de
 * la demande via `MouvementSolde.id` (les mouvements "demande" seulement, pas
 * "ajustement"/"acquisition" qui n'ont pas de demande associée), pas la
 * demande entière nécessaire pour `DetailCongePanel`. Pas de filtre RLS
 * supplémentaire ici : la RLS de `demandes_conges` s'applique déjà (salarié
 * ne voit que les siennes, manager voit tout).
 */
export async function fetchDemandeParId(id: string): Promise<DemandeEquipe> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("demandes_conges")
    .select(SELECT_DEMANDE_EQUIPE)
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error("Impossible de charger le détail de la demande.");
  }

  return mapDemandeEquipeDepuisDb(data as unknown as DemandeEquipeRow);
}

export async function creerDemande(input: NouvelleDemandeInput): Promise<Demande> {
  const supabase = createClient();

  const [utilisateurId, typeAbsenceId, nbDemiJournees] = await Promise.all([
    getUtilisateurId(supabase),
    getTypeAbsenceId(supabase, input.type),
    calculerNbDemiJournees(supabase, input.debut, input.fin, input.demiDebut, input.demiFin),
  ]);

  const { data, error } = await supabase
    .from("demandes_conges")
    .insert({
      utilisateur_id: utilisateurId,
      type_absence_id: typeAbsenceId,
      date_debut: input.debut,
      date_fin: input.fin,
      demi_debut: input.demiDebut,
      demi_fin: input.demiFin,
      nb_demi_journees: nbDemiJournees,
      is_anticipation: input.isAnticipation,
      commentaire_salarie: input.note || null,
    })
    .select(SELECT_DEMANDE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer la demande.");
  }

  return mapDemandeDepuisDb(data);
}

/**
 * Annule une demande en attente (retrait par le salarié lui-même). La policy
 * RLS "demandes: salarié modifie une demande en attente" n'autorise déjà que
 * ça — pas de vérification de statut à refaire ici. `.select().single()`
 * force une erreur si la ligne n'a pas été affectée (déjà traitée par un
 * manager, id inconnu...), au lieu du succès silencieux à 0 ligne que
 * renverrait un `update()` filtré par la RLS.
 *
 * Pas encore appelée par un hook/composant (aucune UI d'annulation pour
 * l'instant) — prête pour quand cette fonctionnalité sera spécifiée.
 */
export async function annulerDemande(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("demandes_conges")
    .update({ statut: "annulee" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error("Impossible d'annuler la demande (déjà traitée, ou introuvable).");
  }
}

// Exporté pour `exportsPaie.repository.ts`.
export function mapDemandeEquipeDepuisDb(row: DemandeEquipeRow): DemandeEquipe {
  const demandeur = Array.isArray(row.utilisateurs) ? row.utilisateurs[0] : row.utilisateurs;

  // `validateur` est déjà mappé par `mapDemandeDepuisDb` (présent dans
  // `DemandeRow` depuis le select de base, voir `SELECT_DEMANDE`).
  return {
    ...mapDemandeDepuisDb(row),
    demandeur: demandeur ?? { id: row.utilisateur_id, prenom: "", nom: "" },
  };
}

/**
 * Toutes les demandes de l'entreprise pour l'Espace Suivre — "manager"
 * désigne les directeurs, autorité globale, pas une équipe rattachée.
 * Inclut aussi les propres demandes du manager connecté : personne d'autre
 * n'est au-dessus pour les valider, donc un manager doit pouvoir
 * s'auto-valider ses propres congés depuis cet écran.
 *
 * Inclut les demandes `annulee` depuis le 25/08/2026 (même correction que
 * `fetchDemandes`) — une régularisation qui n'a jamais été transmise (donc
 * jamais listée dans "Transmissions paie > Congés passés en paye mais
 * annulés", qui ne montre que les corrections à faire) n'avait plus aucun
 * endroit où Delphine pouvait la retrouver pour vérifier sa traçabilité.
 */
export async function fetchDemandesEquipe(): Promise<DemandeEquipe[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("demandes_conges")
    .select(SELECT_DEMANDE_EQUIPE)
    .order("date_debut", { ascending: false });

  if (error) {
    throw new Error("Impossible de charger les demandes de l'équipe.");
  }

  return (data ?? []).map((row) => mapDemandeEquipeDepuisDb(row as unknown as DemandeEquipeRow));
}

/**
 * Congés (validés, en attente, refusés, ou annulés depuis cette page —
 * régularisation) dont `date_debut` tombe dans la période donnée (Espace
 * Suivre > récap paie) — CP, RTT, CSS. Les "en attente" comptent dans le
 * total (cas à la marge de régularisation), les "refusés" et les "annulés"
 * restent visibles/traçables dans le tableau mais sont exclus du total (voir
 * `grouperParCollaborateur` dans `CongesPaiePage`) — un refus n'a jamais été
 * accordé, une annulation corrige un congé qui l'avait été, mais ni l'un ni
 * l'autre ne doit compter dans les jours consommés transmis à la comptable
 * (bug corrigé le 15/08/2026 : "refusee" manquait de ce filtre, une demande
 * refusée depuis cet écran disparaissait entièrement du tableau au lieu d'y
 * rester visible avec 0 jour compté). Filtre sur `date_debut` uniquement,
 * comme le reste de l'app (voir `soldes.repository.ts`) — une demande à
 * cheval sur deux périodes n'est pas traitée finement.
 */
export async function fetchCongesConsommesPeriode(
  debut: string,
  fin: string,
): Promise<DemandeEquipe[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("demandes_conges")
    .select(SELECT_DEMANDE_EQUIPE)
    .in("statut", ["validee", "en_attente", "annulee", "refusee"])
    .gte("date_debut", debut)
    .lte("date_debut", fin)
    .order("date_debut", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les congés de la période.");
  }

  return (data ?? [])
    .map((row) => mapDemandeEquipeDepuisDb(row as unknown as DemandeEquipeRow))
    .filter((d) => d.type === "CP" || d.type === "RTT" || d.type === "CSS");
}

async function deciderDemande(
  id: string,
  statut: "validee" | "refusee" | "annulee",
  commentaire: string,
): Promise<void> {
  const supabase = createClient();

  const utilisateurId = await getUtilisateurId(supabase);

  const { error } = await supabase
    .from("demandes_conges")
    .update({
      statut,
      validateur_id: utilisateurId,
      commentaire_decision: commentaire || null,
      date_decision: new Date().toISOString(),
      // `vu` repasse à false à chaque changement de statut — une décision
      // (ou un changement de décision) est une nouvelle information à
      // consulter, même si une précédente avait déjà été vue (ex. demande
      // remise en attente puis re-décidée).
      vu: false,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error("Impossible d'enregistrer la décision (demande déjà traitée, ou introuvable).");
  }

  // Journal complet des décisions (25/08/2026, `decisions_demande`) — ne
  // remplace jamais une ligne précédente, contrairement aux colonnes
  // `demandes_conges.statut`/`date_decision` mises à jour ci-dessus (qui ne
  // gardent que la décision courante). Best-effort : une erreur d'écriture
  // ici ne doit pas faire échouer la décision elle-même, déjà actée sur
  // `demandes_conges` — juste une entrée manquante dans le feed détaillé.
  await supabase
    .from("decisions_demande")
    .insert({ demande_id: id, statut, commentaire: commentaire || null, decide_par: utilisateurId })
    .then(({ error: erreurJournal }) => {
      if (erreurJournal) {
        console.error("Impossible d'enregistrer la décision dans le journal.", erreurJournal);
      }
    });
}

export async function validerDemande(id: string, commentaire = ""): Promise<void> {
  await deciderDemande(id, "validee", commentaire);
}

export async function refuserDemande(id: string, commentaire = ""): Promise<void> {
  await deciderDemande(id, "refusee", commentaire);
}

/**
 * Supprime (annule) une demande déjà validée — régularisation exceptionnelle
 * depuis "Export paie" (ex. congé finalement non pris, erreur de saisie).
 * Trace l'auteur/motif via les mêmes colonnes de décision que valider/refuser
 * plutôt que d'ajouter des colonnes dédiées à ce cas rare.
 */
export async function regulariserDemande(id: string, commentaire = ""): Promise<void> {
  await deciderDemande(id, "annulee", commentaire);
}

/**
 * Annule une validation qui vient d'être faite par erreur — bouton "Annuler"
 * du bandeau de confirmation post-validation. Repasse la demande "en
 * attente" et efface la décision (contrairement à `regulariserDemande`, qui
 * marque "annulé" : ici on veut vraiment revenir à l'état d'avant l'action,
 * pas ajouter une nouvelle décision).
 */
export async function remettreEnAttenteDemande(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("demandes_conges")
    .update({
      statut: "en_attente",
      validateur_id: null,
      commentaire_decision: null,
      date_decision: null,
      vu: false, // changement de statut — voir deciderDemande
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error("Impossible d'annuler cette validation.");
  }
}

/**
 * Marque une demande décidée (validée/refusée) comme vue par le salarié —
 * passe par le RPC `marquer_demande_vue` (voir supabase/schema.sql) plutôt
 * qu'un `update()` direct : la policy UPDATE du salarié ne couvre que les
 * demandes 'en_attente', l'élargir aux demandes décidées exposerait aussi
 * les autres colonnes (dates, statut...) à une modification côté client.
 */
export async function marquerDemandeVue(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.rpc("marquer_demande_vue", { p_demande_id: id });

  if (error) {
    throw new Error("Impossible de marquer la demande comme vue.");
  }
}

export interface DecisionHistorique {
  id: string;
  statut: StatutDemande;
  commentaire: string | null;
  decidePar: { prenom: string; nom: string } | null;
  decideLe: string; // timestamptz ISO
}

interface DecisionDemandeRow {
  id: string;
  statut: string;
  commentaire: string | null;
  decide_le: string;
  decide_par:
    | { prenom: string; nom: string }
    | { prenom: string; nom: string }[]
    | null;
}

/**
 * Journal complet des décisions d'une demande (`decisions_demande`,
 * 25/08/2026) — chronologique, une entrée par valider/refuser/régulariser/
 * restaurer. Alimente le feed de `DetailCongePanel` : `Validé le`/`Annulé
 * le`/etc. affichés dans l'ordre réel, plutôt que la seule décision
 * courante (`demandes_conges.date_decision`, écrasée à chaque changement).
 * Best-effort : une demande décidée avant l'introduction de cette table n'a
 * aucune ligne ici, l'appelant retombe alors sur l'affichage à partir de
 * `selection.dateDecision` (voir `DetailCongePanel`).
 */
export async function fetchHistoriqueDecisions(demandeId: string): Promise<DecisionHistorique[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("decisions_demande")
    .select("id, statut, commentaire, decide_le, decide_par:utilisateurs!decide_par(prenom, nom)")
    .eq("demande_id", demandeId)
    .order("decide_le", { ascending: true });

  if (error) {
    return [];
  }

  return ((data ?? []) as unknown as DecisionDemandeRow[]).map((row) => {
    const decidePar = Array.isArray(row.decide_par) ? row.decide_par[0] : row.decide_par;
    return {
      id: row.id,
      statut: STATUT_DEPUIS_DB[row.statut] ?? "en attente",
      commentaire: row.commentaire,
      decidePar: decidePar ?? null,
      decideLe: row.decide_le,
    };
  });
}
