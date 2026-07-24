import type { Utilisateur } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Repository de l'utilisateur courant.
 *
 * Branché sur Supabase Auth : la session réelle (proxy.ts garantit qu'elle
 * existe pour toute route hors /connexion) est jointe à la table
 * `utilisateurs` via `auth_id`. La RLS ("utilisateurs: lecture de son propre
 * profil") limite déjà la lecture à la ligne de l'utilisateur connecté.
 */

// Le schéma n'a pas (encore) de champ "poste" (intitulé de fonction) — en
// attendant qu'il soit modélisé, on affiche un libellé dérivé du rôle.
const POSTE_PAR_ROLE: Record<string, string> = {
  salarie: "Salarié·e",
  manager: "Manager",
  admin: "Administratrice",
};

export async function fetchUtilisateurCourant(): Promise<Utilisateur> {
  const supabase = createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error("Aucune session active.");
  }

  const { data, error } = await supabase
    .from("utilisateurs")
    .select("id, prenom, nom, role")
    .eq("auth_id", authUser.id)
    .single();

  if (error || !data) {
    throw new Error("Impossible de charger l'utilisateur.");
  }

  return {
    id: data.id,
    prenom: data.prenom,
    nom: data.nom,
    poste: POSTE_PAR_ROLE[data.role] ?? data.role,
    initiales: `${data.prenom.charAt(0)}${data.nom.charAt(0)}`.toUpperCase(),
  };
}
