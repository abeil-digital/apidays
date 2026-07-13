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

export interface Soldes {
  cp: SoldeCategorie;
  rtt: SoldeCategorie;
  cpt: SoldeCategorie;
}

export interface Utilisateur {
  id: string;
  prenom: string;
  nom: string;
  poste: string;
  initiales: string;
}
