import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CongeImpose,
  CongeImposeInput,
  DemiJournee,
  DjImposee,
  DjImposeeInput,
  JourFerie,
  JourFerieInput,
  ParametragePeriode,
  ParametragePeriodeInput,
} from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { getTypeAbsenceId } from "@/lib/data/typesAbsences";
import {
  calculerNbDemiJournees,
  getUtilisateurId,
  retirerDemande,
} from "@/lib/data/demandes.repository";
import { fetchUtilisateursAdmin } from "@/lib/data/utilisateurs.repository";
import { fetchReglesAcquisition } from "@/lib/data/reglesConges.repository";
import { periodeReferenceCp } from "@/lib/periodeReferenceCp";
import { getAujourdhui } from "@/lib/aujourdhui";

/**
 * Repository de l'écran Paramétrer > Calendrier (`parametrage_periode`,
 * `demi_journees_imposees`, `jours_feries`). Les demi-journées imposées sont
 * un mécanisme indépendant du moteur de calcul de solde RTT paramétré dans
 * Congés & RTT (`regles_acquisition`) — catégorisées sous le code technique
 * `DJ_IMPOSEE` dans `types_absences`, jamais choisi par le salarié.
 */

interface ParametragePeriodeRow {
  id: string;
  annee: number;
  semaine_aout_imposee: string;
  nb_demi_journees_cible: number;
  jour_semaine_defaut: number;
  valide_le: string | null;
}

const SELECT_PARAMETRAGE_PERIODE =
  "id, annee, semaine_aout_imposee, nb_demi_journees_cible, jour_semaine_defaut, valide_le";

function mapParametragePeriodeDepuisDb(row: ParametragePeriodeRow): ParametragePeriode {
  return {
    id: row.id,
    annee: row.annee,
    semaineAoutImposee: row.semaine_aout_imposee,
    nbDemiJourneesCible: row.nb_demi_journees_cible,
    jourSemaineDefaut: row.jour_semaine_defaut,
    valideLe: row.valide_le,
  };
}

/**
 * Toutes les années paramétrées de l'entreprise (année + statut de
 * publication uniquement — pas le détail complet) (10/09/2026) — pilote la
 * liste d'onglets dynamique de `Calendrier2Page` (archivées / année en
 * cours / brouillon(s)), voir son commentaire pour le détail de la règle.
 */
export async function fetchAnneesParametrage(): Promise<
  { annee: number; valideLe: string | null }[]
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("parametrage_periode")
    .select("annee, valide_le")
    .order("annee");

  if (error) {
    throw new Error("Impossible de charger les années paramétrées.");
  }

  return (data ?? []).map((row) => ({ annee: row.annee, valideLe: row.valide_le }));
}

export async function fetchParametragePeriode(annee: number): Promise<ParametragePeriode | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("parametrage_periode")
    .select(SELECT_PARAMETRAGE_PERIODE)
    .eq("annee", annee)
    .maybeSingle();

  if (error) {
    throw new Error("Impossible de charger le paramétrage de l'année.");
  }

  return data ? mapParametragePeriodeDepuisDb(data) : null;
}

export async function enregistrerParametragePeriode(
  input: ParametragePeriodeInput,
): Promise<ParametragePeriode> {
  // `onConflict` doit correspondre EXACTEMENT à la contrainte unique en base
  // — `unique (entreprise_id, annee)` depuis le passage multi-tenant
  // (09/09/2026), pas `annee` seule (bug : `onConflict: "annee"` ne
  // correspondait plus à aucune contrainte, PostgREST rejetait l'upsert
  // avec 42P10, bloquant tout paramétrage d'une année encore vierge — donc
  // aussi la création du premier DJI/congé imposé de l'année, qui appelle
  // cette fonction en préambule).
  const supabase = createClient();

  const { data: utilisateurId } = await supabase.rpc("my_utilisateur_id");

  const { data, error } = await supabase
    .from("parametrage_periode")
    .upsert(
      {
        annee: input.annee,
        semaine_aout_imposee: input.semaineAoutImposee,
        nb_demi_journees_cible: input.nbDemiJourneesCible,
        jour_semaine_defaut: input.jourSemaineDefaut,
        defini_par: utilisateurId ?? null,
      },
      { onConflict: "entreprise_id,annee" },
    )
    .select(SELECT_PARAMETRAGE_PERIODE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'enregistrer le paramétrage de l'année.");
  }

  return mapParametragePeriodeDepuisDb(data);
}

/**
 * Publie le paramétrage de l'année — et génère, pour CHAQUE congé imposé
 * (CPI) déjà posé sur cette année, les demandes `CP` manquantes (une par
 * collaborateur actif) — 10/09/2026, refonte : voir le commentaire de
 * `genererDemandesCongeImpose` plus bas pour le "pourquoi" (aligner l'impact
 * sur le solde avec le moment où le calendrier devient réellement visible
 * aux collaborateurs, pas la date de création du CPI). "Manquantes" :
 * rattrape les CPI ajoutés pendant que le calendrier était encore en
 * brouillon — `genererDemandesCongeImpose` est idempotente, sans effet sur
 * un CPI déjà doté de ses demandes (ex. ajouté APRÈS une publication
 * précédente, voir `ajouterCongeImpose`).
 */
export async function publierParametragePeriode(id: string): Promise<ParametragePeriode> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("parametrage_periode")
    .update({ valide_le: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_PARAMETRAGE_PERIODE)
    .single();

  if (error || !data) {
    throw new Error("Impossible de publier le paramétrage de l'année.");
  }

  const { data: congesImposes, error: erreurConges } = await supabase
    .from("conges_imposes")
    .select(SELECT_CONGE_IMPOSE)
    .eq("parametrage_periode_id", id);

  if (erreurConges) {
    throw new Error(
      "Calendrier publié, mais impossible de charger ses congés imposés pour générer les demandes associées.",
    );
  }

  for (const c of congesImposes ?? []) {
    await genererDemandesCongeImpose(supabase, mapCongeImposeDepuisDb(c));
  }

  return mapParametragePeriodeDepuisDb(data);
}

/**
 * Annule la publication du paramétrage de l'année — repasse en brouillon.
 * Symétrique de `publierParametragePeriode` (10/09/2026) : annule aussi
 * (statut → `annulé`, via `retirerDemande` — jamais un hard delete, gère
 * déjà correctement le cas d'une demande entre-temps transmise en paie) les
 * demandes `CP` générées par les CPI de cette année, encore validées. Sans
 * ça, dépublier ne faisait que masquer la visibilité collaborateur sans
 * annuler son effet déjà pris sur le solde — la publication redeviendrait
 * incohérente avec le solde réel du collaborateur.
 */
export async function depublierParametragePeriode(id: string): Promise<ParametragePeriode> {
  const supabase = createClient();

  const { data: congesImposes, error: erreurConges } = await supabase
    .from("conges_imposes")
    .select("id")
    .eq("parametrage_periode_id", id);

  if (erreurConges) {
    throw new Error("Impossible d'annuler la publication du paramétrage de l'année.");
  }

  const congeImposeIds = (congesImposes ?? []).map((c) => c.id);
  if (congeImposeIds.length > 0) {
    const { data: demandesLiees, error: erreurDemandes } = await supabase
      .from("demandes_conges")
      .select("id")
      .in("conge_impose_id", congeImposeIds)
      .eq("statut", "validee");

    if (erreurDemandes) {
      throw new Error("Impossible d'annuler la publication du paramétrage de l'année.");
    }

    for (const d of demandesLiees ?? []) {
      await retirerDemande(d.id, "Publication du calendrier annulée");
    }
  }

  const { data, error } = await supabase
    .from("parametrage_periode")
    .update({ valide_le: null })
    .eq("id", id)
    .select(SELECT_PARAMETRAGE_PERIODE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'annuler la publication du paramétrage de l'année.");
  }

  return mapParametragePeriodeDepuisDb(data);
}

interface DjImposeeRow {
  id: string;
  date: string;
  demi_journee: DemiJournee;
}

const SELECT_DJ_IMPOSEE = "id, date, demi_journee";

function mapDjImposeeDepuisDb(row: DjImposeeRow): DjImposee {
  return { id: row.id, date: row.date, demiJournee: row.demi_journee };
}

export async function fetchDjImposees(parametragePeriodeId: string): Promise<DjImposee[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("demi_journees_imposees")
    .select(SELECT_DJ_IMPOSEE)
    .eq("parametrage_periode_id", parametragePeriodeId)
    .order("date", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les demi-journées imposées.");
  }

  return (data ?? []).map(mapDjImposeeDepuisDb);
}

export async function ajouterDjImposee(
  parametragePeriodeId: string,
  input: DjImposeeInput,
): Promise<DjImposee> {
  const supabase = createClient();
  const typeAbsenceId = await getTypeAbsenceId(supabase, "DJ_IMPOSEE");

  const { data, error } = await supabase
    .from("demi_journees_imposees")
    .insert({
      parametrage_periode_id: parametragePeriodeId,
      type_absence_id: typeAbsenceId,
      date: input.date,
      demi_journee: input.demiJournee,
    })
    .select(SELECT_DJ_IMPOSEE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'ajouter cette demi-journée imposée.");
  }

  return mapDjImposeeDepuisDb(data);
}

export async function supprimerDjImposee(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("demi_journees_imposees").delete().eq("id", id);

  if (error) {
    throw new Error("Impossible de supprimer cette demi-journée imposée.");
  }
}

interface CongeImposeRow {
  id: string;
  date_debut: string;
  date_fin: string;
  demi_debut: DemiJournee;
  demi_fin: DemiJournee;
}

const SELECT_CONGE_IMPOSE = "id, date_debut, date_fin, demi_debut, demi_fin";

function mapCongeImposeDepuisDb(row: CongeImposeRow): CongeImpose {
  return {
    id: row.id,
    debut: row.date_debut,
    fin: row.date_fin,
    demiDebut: row.demi_debut,
    demiFin: row.demi_fin,
  };
}

export async function fetchCongesImposes(parametragePeriodeId: string): Promise<CongeImpose[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("conges_imposes")
    .select(SELECT_CONGE_IMPOSE)
    .eq("parametrage_periode_id", parametragePeriodeId)
    .order("date_debut", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les congés imposés.");
  }

  return (data ?? []).map(mapCongeImposeDepuisDb);
}

/**
 * Génère, pour un congé imposé (CPI) déjà en base, les demandes `CP`
 * manquantes (une par collaborateur actif, liée via `conge_impose_id`) —
 * 10/09/2026, extrait de l'ancien `ajouterCongeImpose` (voir CONTEXTE.md,
 * "CPI : la date de décompte suit la publication du calendrier, pas la
 * création").
 *
 * Idempotente : ne génère rien pour un collaborateur qui a déjà une demande
 * pour ce CPI (`demandes_conges.conge_impose_id`) — permet de rappeler cette
 * fonction sans risque de doublon (ex. `publierParametragePeriode`, qui la
 * rejoue pour TOUS les CPI de l'année, y compris ceux déjà traités par un
 * appel précédent de `ajouterCongeImpose` si le calendrier était déjà
 * publié à ce moment-là).
 *
 * `excludeCongeImposeId` sur `calculerNbDemiJournees` (voir sa doc) :
 * indispensable ici, ce CPI est TOUJOURS déjà en base au moment de l'appel
 * (jamais avant, contrairement à l'ancien `ajouterCongeImpose`).
 *
 * `is_anticipation` (10/09/2026, demande explicite de Vincent) : un CPI dont
 * la date tombe APRÈS la fin de la période de référence CP en cours (ex. un
 * CPI d'août 2027 paramétré alors qu'on est encore dans la période
 * 01/06/2026 → 31/05/2027) doit être décompté en CPA, pas en CP — même
 * logique que l'option "Congés anticipés" du formulaire personnel
 * (`PoserDemandeModal.tsx`), mais choisie ici automatiquement (pas de
 * collaborateur pour la sélectionner sur un CPI). Comparaison sur
 * `congeImpose.debut` uniquement (un CPI à cheval sur la frontière reste un
 * cas limite non géré, comme pour une demande personnelle).
 */
async function genererDemandesCongeImpose(
  supabase: SupabaseClient,
  congeImpose: CongeImpose,
): Promise<void> {
  const [
    typeCpId,
    nbDemiJournees,
    auteurId,
    utilisateurs,
    { data: dejaGenerees, error: erreurDejaGenerees },
    reglesAcquisition,
  ] = await Promise.all([
    getTypeAbsenceId(supabase, "CP"),
    calculerNbDemiJournees(
      supabase,
      congeImpose.debut,
      congeImpose.fin,
      congeImpose.demiDebut,
      congeImpose.demiFin,
      congeImpose.id,
    ),
    getUtilisateurId(supabase),
    fetchUtilisateursAdmin(),
    supabase.from("demandes_conges").select("utilisateur_id").eq("conge_impose_id", congeImpose.id),
    fetchReglesAcquisition(),
  ]);

  if (erreurDejaGenerees) {
    throw new Error("Impossible de générer les demandes associées à ce congé imposé.");
  }

  const idsDejaGeneres = new Set((dejaGenerees ?? []).map((d) => d.utilisateur_id));
  const actifs = utilisateurs.filter((u) => u.statut === "actif" && !idsDejaGeneres.has(u.id));
  if (actifs.length === 0) return;

  const regleCp = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const periodeActuelle = periodeReferenceCp(regleCp, getAujourdhui());
  const estAnticipation = congeImpose.debut > periodeActuelle.fin;

  const commentaire = `Congé imposé du ${congeImpose.debut} au ${congeImpose.fin}`;

  const { error: errorDemandes } = await supabase.from("demandes_conges").insert(
    actifs.map((u) => ({
      utilisateur_id: u.id,
      type_absence_id: typeCpId,
      date_debut: congeImpose.debut,
      date_fin: congeImpose.fin,
      demi_debut: congeImpose.demiDebut,
      demi_fin: congeImpose.demiFin,
      nb_demi_journees: nbDemiJournees,
      is_anticipation: estAnticipation,
      statut: "validee",
      validateur_id: auteurId,
      commentaire_decision: commentaire,
      date_decision: new Date().toISOString(),
      conge_impose_id: congeImpose.id,
    })),
  );

  if (errorDemandes) {
    throw new Error(
      "Congé imposé créé mais impossible de générer les demandes associées aux collaborateurs.",
    );
  }
}

/**
 * Ajoute une période de congés imposés — sans effet immédiat sur le solde
 * des collaborateurs (10/09/2026, revu — voir CONTEXTE.md) : les demandes
 * `CP` associées (une par collaborateur actif, "mêmes règles de gestion
 * qu'un CP normal" depuis le 29/08/2026) ne sont générées QUE si le
 * calendrier de cette année est DÉJÀ publié (`valide_le` non nul) — sinon,
 * `publierParametragePeriode` s'en chargera pour tous les CPI de l'année
 * d'un coup, au moment où le calendrier devient réellement visible aux
 * collaborateurs — évite un solde qui bouge silencieusement pendant qu'un
 * CPI est encore en brouillon, sans que rien n'explique pourquoi côté
 * collaborateur (bug réel trouvé en testant, voir CONTEXTE.md).
 */
export async function ajouterCongeImpose(
  parametragePeriodeId: string,
  input: CongeImposeInput,
): Promise<CongeImpose> {
  const supabase = createClient();
  const [typeAbsenceId, { data: parametrage, error: erreurParametrage }] = await Promise.all([
    getTypeAbsenceId(supabase, "CP_IMPOSE"),
    supabase
      .from("parametrage_periode")
      .select("valide_le")
      .eq("id", parametragePeriodeId)
      .single(),
  ]);

  if (erreurParametrage) {
    throw new Error("Impossible d'ajouter cette période de congés imposés.");
  }

  const { data, error } = await supabase
    .from("conges_imposes")
    .insert({
      parametrage_periode_id: parametragePeriodeId,
      type_absence_id: typeAbsenceId,
      date_debut: input.debut,
      date_fin: input.fin,
      demi_debut: input.demiDebut,
      demi_fin: input.demiFin,
    })
    .select(SELECT_CONGE_IMPOSE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'ajouter cette période de congés imposés.");
  }

  const congeImpose = mapCongeImposeDepuisDb(data);

  // Calendrier déjà publié : ce nouveau CPI doit avoir un effet immédiat,
  // comme s'il avait toujours fait partie du paramétrage déjà visible —
  // sinon (encore en brouillon), rien à faire ici, `publierParametragePeriode`
  // le rattrapera.
  if (parametrage?.valide_le) {
    await genererDemandesCongeImpose(supabase, congeImpose);
  }

  return congeImpose;
}

/**
 * Supprime une période de congés imposés — annule d'abord (statut →
 * `annulé`, via `retirerDemande`, jamais un hard delete) toutes les
 * demandes générées pour cette période qui sont encore validées ; la
 * correction est générée automatiquement au prochain export si l'une
 * d'elles était déjà transmise (même mécanisme que l'annulation d'un CP
 * normal déjà transmis, voir `DetailCongePanel`/`peutAnnulerDejaTransmis`).
 */
export async function supprimerCongeImpose(id: string): Promise<void> {
  const supabase = createClient();

  const { data: demandesLiees, error: errorSelect } = await supabase
    .from("demandes_conges")
    .select("id")
    .eq("conge_impose_id", id)
    .eq("statut", "validee");

  if (errorSelect) {
    throw new Error("Impossible de supprimer cette période de congés imposés.");
  }

  for (const demande of demandesLiees ?? []) {
    await retirerDemande(demande.id, "Congé imposé supprimé");
  }

  // Pas de `.select().single()` après le delete : ça exigerait exactement
  // une ligne renvoyée et lèverait une erreur si la période a déjà été
  // supprimée (double-clic, état local pas encore resynchronisé) — un delete
  // qui ne trouve rien n'est pas une erreur en soi.
  const { error } = await supabase.from("conges_imposes").delete().eq("id", id);

  if (error) {
    throw new Error("Impossible de supprimer cette période de congés imposés.");
  }
}

interface JourFerieRow {
  id: string;
  date: string;
  libelle: string;
}

const SELECT_JOUR_FERIE = "id, date, libelle";

function mapJourFerieDepuisDb(row: JourFerieRow): JourFerie {
  return { id: row.id, date: row.date, libelle: row.libelle };
}

export async function fetchJoursFeries(annee: number): Promise<JourFerie[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("jours_feries")
    .select(SELECT_JOUR_FERIE)
    .gte("date", `${annee}-01-01`)
    .lte("date", `${annee}-12-31`)
    .order("date", { ascending: true });

  if (error) {
    throw new Error("Impossible de charger les jours fériés.");
  }

  return (data ?? []).map(mapJourFerieDepuisDb);
}

export async function ajouterJourFerie(input: JourFerieInput): Promise<JourFerie> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("jours_feries")
    .insert({ date: input.date, libelle: input.libelle })
    .select(SELECT_JOUR_FERIE)
    .single();

  if (error || !data) {
    throw new Error("Impossible d'ajouter ce jour férié (déjà existant ?).");
  }

  return mapJourFerieDepuisDb(data);
}

export async function supprimerJourFerie(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("jours_feries").delete().eq("id", id);

  if (error) {
    throw new Error("Impossible de supprimer ce jour férié.");
  }
}

/**
 * Pré-remplit les jours fériés légaux manquants pour une année (calcul
 * incluant Pâques mobile, voir `lib/joursFeries.ts`) — insertion silencieuse
 * des seules dates absentes, sans écraser un libellé personnalisé existant.
 */
export async function preRemplirJoursFeriesLegaux(
  annee: number,
  legaux: { date: string; libelle: string }[],
): Promise<JourFerie[]> {
  const supabase = createClient();
  const existants = await fetchJoursFeries(annee);
  const datesExistantes = new Set(existants.map((j) => j.date));
  const manquants = legaux.filter((j) => !datesExistantes.has(j.date));

  if (manquants.length === 0) {
    return existants;
  }

  const { data, error } = await supabase
    .from("jours_feries")
    .insert(manquants)
    .select(SELECT_JOUR_FERIE);

  if (error || !data) {
    throw new Error("Impossible de pré-remplir les jours fériés.");
  }

  return [...existants, ...data.map(mapJourFerieDepuisDb)].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
