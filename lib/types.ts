export type TypeDemande = "CP" | "RTT";

export type StatutDemande = "en attente" | "validé" | "refusé";

export interface Demande {
  id: string;
  type: TypeDemande;
  debut: string; // date ISO (YYYY-MM-DD)
  fin: string; // date ISO (YYYY-MM-DD)
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

export interface Soldes {
  cpReel: number;
  cpTheorique: number;
  rttLibresRestant: number;
  rttLibresTotal: number;
  rttImposesRestant: number;
  rttImposesTotal: number;
}

export interface Utilisateur {
  id: string;
  prenom: string;
  nom: string;
  poste: string;
  initiales: string;
}
