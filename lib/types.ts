export type TypeDemande = "CP" | "RTT";

export type StatutDemande = "en attente" | "validé" | "refusé";

export interface Demande {
  id: string;
  type: TypeDemande;
  debut: string; // date ISO (YYYY-MM-DD)
  fin: string; // date ISO (YYYY-MM-DD)
  datePose: string; // date ISO (YYYY-MM-DD) — date de soumission de la demande
  statut: StatutDemande;
  note: string;
  commentaireManager: string;
}

export interface NouvelleDemandeInput {
  type: TypeDemande;
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

export type TypeContrat = "temps_plein" | "temps_partiel";

export interface UtilisateurAdmin {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  dateEntree: string; // date ISO (YYYY-MM-DD)
  typeContrat: TypeContrat;
  tauxTempsPartiel: number | null; // 0-1 (ex. 0.8 pour 80%), null si temps plein
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
  typeContrat: TypeContrat;
  tauxTempsPartiel: number | null;
  ancienneteDateReference: string | null;
  role: RoleUtilisateur;
}
