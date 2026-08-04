export type TypeDemande = "CP" | "RTT" | "CSS" | "CE" | "RECUP" | "EVT_FAM";

export type StatutDemande = "en attente" | "validé" | "refusé";

export interface Demande {
  id: string;
  type: TypeDemande;
  isAnticipation: boolean; // vrai uniquement pour un CP posé contre le solde théorique
  debut: string; // date ISO (YYYY-MM-DD)
  fin: string; // date ISO (YYYY-MM-DD)
  datePose: string; // date ISO (YYYY-MM-DD) — date de soumission de la demande
  statut: StatutDemande;
  note: string;
  commentaireManager: string;
}

export interface NouvelleDemandeInput {
  type: TypeDemande;
  isAnticipation: boolean;
  debut: string;
  fin: string;
  note: string;
}

export interface SoldeCategorie {
  valeur: number;
  conditionPrefixe: string;
  conditionAccent: string;
}

export interface RttImpose {
  date: string; // date ISO (YYYY-MM-DD)
  motif: string;
}

export interface Soldes {
  cp: SoldeCategorie;
  rtt: SoldeCategorie;
  cpt: SoldeCategorie;
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
