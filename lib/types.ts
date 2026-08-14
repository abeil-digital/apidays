export type TypeDemande = "CP" | "RTT" | "CSS" | "CE" | "RECUP" | "EVT_FAM";

// Codes techniques supplémentaires de `types_absences`, jamais choisis par le
// salarié (pas une option du formulaire "Nouvelle demande") — servent à
// catégoriser les demi-journées et périodes imposées (Paramétrer > Calendrier).
export type TypeAbsenceCode = TypeDemande | "DJ_IMPOSEE" | "CP_IMPOSE";

export type StatutDemande = "en attente" | "validé" | "refusé" | "annulé";

export interface Demande {
  id: string;
  type: TypeDemande;
  isAnticipation: boolean; // vrai uniquement pour un CP posé contre le solde théorique
  debut: string; // date ISO (YYYY-MM-DD)
  fin: string; // date ISO (YYYY-MM-DD)
  demiDebut: DemiJournee; // 'apres_midi' = demi-journée de début seulement
  demiFin: DemiJournee; // 'matin' = demi-journée de fin seulement
  nbDemiJournees: number; // peut valoir .5 en jours (ex. 3 demi-journées = 1.5 jour)
  datePose: string; // date ISO (YYYY-MM-DD) — date de soumission de la demande
  dateDecision: string | null; // date ISO (YYYY-MM-DD) — date de validation/refus, null si en attente
  statut: StatutDemande;
  note: string;
  commentaireManager: string;
}

// Demande vue côté manager (Espace Suivre) — mêmes champs qu'une `Demande`,
// avec l'identité du demandeur en plus (nécessaire dès qu'on mélange les
// demandes de plusieurs salariés dans une même liste).
export interface DemandeEquipe extends Demande {
  demandeur: {
    id: string;
    prenom: string;
    nom: string;
  };
}

export interface NouvelleDemandeInput {
  type: TypeDemande;
  isAnticipation: boolean;
  debut: string;
  fin: string;
  demiDebut: DemiJournee;
  demiFin: DemiJournee;
  note: string;
}

export interface SoldeCategorie {
  valeur: number; // solde à date : jours acquis moins jours déjà validés (retrait définitif)
  valeurApresAttente: number; // valeur ci-dessus moins les jours en attente de validation (non définitif)
  conditionPrefixe: string;
  conditionAccent: string;
}

// --- Espace Suivre > feed d'historique de solde (Delphine) ---

export interface MouvementSolde {
  id: string;
  type: "demande" | "ajustement";
  date: string; // date ISO — date de la demande (début) ou de l'ajustement
  libelle: string;
  jours: number; // signé : négatif = consommation, positif = recrédit
  soldeApres: number;
  motif?: string; // demande refusée par le salarié (note) ou motif de l'ajustement
}

export interface MoisHistoriqueSolde {
  mois: string; // "YYYY-MM"
  libelle: string; // "Juin 2026"
  mouvements: MouvementSolde[]; // congés posés ce mois-ci, vide si aucun
  soldeFinMois: number;
}

export interface HistoriqueSolde {
  periodeDebut: string; // date ISO
  periodeFin: string; // date ISO
  soldeDepart: number;
  mois: MoisHistoriqueSolde[]; // du 1er mois de la période jusqu'au mois en cours
  soldeActuel: number;
  // Congés CP non validés sur la période de référence — solde "théorique" =
  // solde actuel une fois ces demandes décomptées (indicatif, réversible).
  enAttente: MouvementSolde[];
  soldeTheorique: number;
}

export interface AjustementSoldeInput {
  deltaJours: number; // positif = recrédit, négatif = correction à la baisse
  motif: string;
}

export interface RttImpose {
  date: string; // date ISO (YYYY-MM-DD)
  motif: string;
}

export interface Soldes {
  cp: SoldeCategorie;
  rtt: SoldeCategorie;
  cpa: SoldeCategorie;
  rttImposes: RttImpose[];
}

export type RoleUtilisateur = "salarie" | "manager" | "admin";

export interface Utilisateur {
  id: string;
  prenom: string;
  nom: string;
  poste: string;
  initiales: string;
  role: RoleUtilisateur;
}

// --- Espace Paramétrer > Gestion des utilisateurs ---

export type StatutUtilisateur = "actif" | "archive";

export type NatureContrat = "cdi" | "cdd" | "alternance" | "stage";

export interface UtilisateurAdmin {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  dateEntree: string; // date ISO (YYYY-MM-DD)
  natureContrat: NatureContrat | null; // null sur les profils créés avant ce champ
  tauxActivite: number; // pourcentage, 100 = temps plein (ex. 80, 50, 33.33)
  ancienneteDateReference: string | null; // date ISO, si différente de dateEntree
  role: RoleUtilisateur;
  statut: StatutUtilisateur;
  dateArchivage: string | null; // date ISO, renseignée si statut = "archive"
}

export interface UtilisateurAdminInput {
  prenom: string;
  nom: string;
  email: string;
  dateEntree: string;
  natureContrat: NatureContrat;
  tauxActivite: number;
  ancienneteDateReference: string | null;
  role: RoleUtilisateur;
}

// --- Espace Paramétrer > Congés & RTT ---

export interface RegleAcquisition {
  id: string;
  typeAbsence: TypeDemande;
  periodeDebutMois: number; // 1-12
  periodeDebutJour: number; // 1-31
  tauxAcquisitionMensuel: number; // jours/mois
  reportAutorise: boolean;
  anticipationAutorisee: boolean;
}

export interface RegleAcquisitionInput {
  periodeDebutMois: number;
  periodeDebutJour: number;
  tauxAcquisitionMensuel: number;
  reportAutorise: boolean;
  anticipationAutorisee: boolean;
}

export interface RegleAnciennete {
  id: string;
  seuilAnnees: number;
  joursSupplementaires: number;
}

export interface RegleAncienneteInput {
  seuilAnnees: number;
  joursSupplementaires: number;
}

/** Objectifs annuels de volume CPI/DJI — réglage global (pas par année),
 * consommé par l'écran Calendrier pour les cibles de progression. */
export interface ObjectifsCalendrier {
  cibleJoursCpi: number;
  cibleDemiJourneesDji: number;
}

export interface ObjectifsCalendrierInput {
  cibleJoursCpi: number;
  cibleDemiJourneesDji: number;
}

// --- Espace Paramétrer > Calendrier (DJ imposées, semaine du 15 août, jours fériés) ---

export type DemiJournee = "matin" | "apres_midi";

export interface ParametragePeriode {
  id: string;
  annee: number;
  semaineAoutImposee: string; // date ISO — lundi de la semaine contenant le 15 août
  nbDemiJourneesCible: number; // valeur de configuration, pas figée en dur (16 par défaut)
  jourSemaineDefaut: number; // ISO : 1=lundi … 5=vendredi … 7=dimanche
  valideLe: string | null; // date ISO de publication (null = brouillon, non visible par les collaborateurs)
}

export interface ParametragePeriodeInput {
  annee: number;
  semaineAoutImposee: string;
  nbDemiJourneesCible: number;
  jourSemaineDefaut: number;
}

export interface DjImposee {
  id: string;
  date: string; // date ISO
  demiJournee: DemiJournee;
}

export interface DjImposeeInput {
  date: string;
  demiJournee: DemiJournee;
}

export interface JourFerie {
  id: string;
  date: string; // date ISO
  libelle: string;
}

export interface JourFerieInput {
  date: string;
  libelle: string;
}

export interface CongeImpose {
  id: string;
  debut: string; // date ISO
  fin: string; // date ISO
  demiDebut: DemiJournee; // 'apres_midi' = la période démarre l'après-midi
  demiFin: DemiJournee; // 'matin' = la période s'arrête le matin
}

export interface CongeImposeInput {
  debut: string;
  fin: string;
  demiDebut: DemiJournee;
  demiFin: DemiJournee;
}
