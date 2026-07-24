"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check } from "lucide-react";
import type {
  RoleUtilisateur,
  TypeContrat,
  UtilisateurAdmin,
  UtilisateurAdminInput,
} from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useUtilisateurAdmin } from "@/hooks/useUtilisateurAdmin";
import { BackHeader } from "@/components/ui/BackHeader";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Modal } from "@/components/ui/Modal";

interface UtilisateurFichePageProps {
  id?: string; // absent = mode création
}

const CHAMPS_VIDES: UtilisateurAdminInput = {
  prenom: "",
  nom: "",
  email: "",
  dateEntree: "",
  typeContrat: "temps_plein",
  tauxTempsPartiel: null,
  ancienneteDateReference: null,
  role: "salarie",
};

interface FormulaireProps {
  id?: string;
  initial: UtilisateurAdminInput;
  statut?: UtilisateurAdmin["statut"];
  creer: (input: UtilisateurAdminInput) => Promise<UtilisateurAdmin>;
  modifier: (input: UtilisateurAdminInput) => Promise<UtilisateurAdmin>;
  archiver: () => Promise<void>;
}

/**
 * Formulaire proprement dit — un composant à part pour que son état
 * (`champs`) puisse s'initialiser directement depuis `initial` sans passer
 * par un effect de synchronisation : `UtilisateurFichePage` ne le monte
 * (avec une `key`) qu'une fois les données prêtes (ou vides, en création).
 */
function Formulaire({ id, initial, statut, creer, modifier, archiver }: FormulaireProps) {
  const router = useRouter();
  const [champs, setChamps] = useState<UtilisateurAdminInput>(initial);
  const [tauxAffiche, setTauxAffiche] = useState(
    initial.tauxTempsPartiel !== null ? String(Math.round(initial.tauxTempsPartiel * 100)) : "",
  );
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [confirmArchivage, setConfirmArchivage] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!champs.prenom || !champs.nom || !champs.email || !champs.dateEntree) {
      setErreur("Merci de compléter tous les champs obligatoires.");
      return;
    }

    setErreur("");
    setEnvoi(true);
    try {
      const resultat = id ? await modifier(champs) : await creer(champs);
      router.push(`/parametrer/utilisateurs/${resultat.id}`);
    } catch {
      setErreur(
        id ? "Impossible d'enregistrer les modifications." : "Impossible de créer ce profil.",
      );
    } finally {
      setEnvoi(false);
    }
  }

  async function handleArchiver() {
    setConfirmArchivage(false);
    try {
      await archiver();
    } catch {
      setErreur("Impossible d'archiver ce profil.");
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="prenom">Prénom</FieldLabel>
            <input
              id="prenom"
              value={champs.prenom}
              onChange={(e) => setChamps({ ...champs, prenom: e.target.value })}
              className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <FieldLabel htmlFor="nom">Nom</FieldLabel>
            <input
              id="nom"
              value={champs.nom}
              onChange={(e) => setChamps({ ...champs, nom: e.target.value })}
              className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <input
            id="email"
            type="email"
            value={champs.email}
            onChange={(e) => setChamps({ ...champs, email: e.target.value })}
            className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="dateEntree">Date d&rsquo;entrée</FieldLabel>
            <input
              id="dateEntree"
              type="date"
              value={champs.dateEntree}
              onChange={(e) => setChamps({ ...champs, dateEntree: e.target.value })}
              className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <FieldLabel htmlFor="role">Rôle</FieldLabel>
            <select
              id="role"
              value={champs.role}
              onChange={(e) => setChamps({ ...champs, role: e.target.value as RoleUtilisateur })}
              className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
            >
              <option value="salarie">Salarié·e</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="typeContrat">Contrat</FieldLabel>
            <select
              id="typeContrat"
              value={champs.typeContrat}
              onChange={(e) => {
                const typeContrat = e.target.value as TypeContrat;
                setChamps({
                  ...champs,
                  typeContrat,
                  tauxTempsPartiel: typeContrat === "temps_plein" ? null : champs.tauxTempsPartiel,
                });
                if (typeContrat === "temps_plein") setTauxAffiche("");
              }}
              className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
            >
              <option value="temps_plein">Temps plein</option>
              <option value="temps_partiel">Temps partiel</option>
            </select>
          </div>
          {champs.typeContrat === "temps_partiel" && (
            <div>
              <FieldLabel htmlFor="taux">Taux (%)</FieldLabel>
              <input
                id="taux"
                type="number"
                min={1}
                max={100}
                value={tauxAffiche}
                onChange={(e) => {
                  const valeur = e.target.value;
                  setTauxAffiche(valeur);
                  const n = Number(valeur);
                  setChamps({
                    ...champs,
                    tauxTempsPartiel: valeur && !Number.isNaN(n) ? n / 100 : null,
                  });
                }}
                className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
              />
            </div>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="anciennete">
            Date de référence ancienneté{" "}
            <span className="text-ink-500 font-normal">
              (si différente de la date d&rsquo;entrée)
            </span>
          </FieldLabel>
          <input
            id="anciennete"
            type="date"
            value={champs.ancienneteDateReference ?? ""}
            onChange={(e) =>
              setChamps({ ...champs, ancienneteDateReference: e.target.value || null })
            }
            className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
          />
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        <button
          type="submit"
          disabled={envoi}
          className="rounded-card bg-brand text-brand-foreground flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold disabled:opacity-60"
        >
          <Check size={16} />
          {id ? "Enregistrer" : "Créer le profil"}
        </button>
      </form>

      {id && statut === "actif" && (
        <button
          type="button"
          onClick={() => setConfirmArchivage(true)}
          className="text-status-danger-fg mt-2 flex items-center gap-1.5 self-start px-1 text-xs font-medium"
        >
          <Archive size={12} />
          Archiver ce profil
        </button>
      )}

      {confirmArchivage && (
        <Modal title="Archiver ce profil ?" onClose={() => setConfirmArchivage(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-ink-500 text-sm">
              Cette action coupe l&rsquo;accès de{" "}
              <span className="text-ink-900 font-semibold">
                {champs.prenom} {champs.nom}
              </span>{" "}
              à l&rsquo;outil. Confirmer ?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmArchivage(false)}
                className="text-ink-900 rounded-full px-4 py-2 text-sm font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleArchiver}
                className="bg-status-danger-fg rounded-full px-4 py-2 text-sm font-semibold text-white"
              >
                Archiver
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function UtilisateurFichePage({ id }: UtilisateurFichePageProps) {
  const {
    utilisateur,
    loading,
    error: erreurChargement,
    creer,
    modifier,
    archiver,
  } = useUtilisateurAdmin(id);

  if (id && loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  if (id && erreurChargement) {
    return (
      <div className="text-status-danger-fg py-20 text-center text-sm">{erreurChargement}</div>
    );
  }

  const initial: UtilisateurAdminInput = utilisateur
    ? {
        prenom: utilisateur.prenom,
        nom: utilisateur.nom,
        email: utilisateur.email,
        dateEntree: utilisateur.dateEntree,
        typeContrat: utilisateur.typeContrat,
        tauxTempsPartiel: utilisateur.tauxTempsPartiel,
        ancienneteDateReference: utilisateur.ancienneteDateReference,
        role: utilisateur.role,
      }
    : CHAMPS_VIDES;

  const titre = utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : "Créer un profil";

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0">
      <BackHeader href="/parametrer/utilisateurs" title={titre} />

      {utilisateur?.statut === "archive" && (
        <div className="rounded-control bg-ink-300/40 text-ink-500 px-3.5 py-2.5 text-xs">
          Profil archivé
          {utilisateur.dateArchivage ? ` le ${formatDate(utilisateur.dateArchivage)}` : ""}.
        </div>
      )}

      <Formulaire
        key={id ?? "nouveau"}
        id={id}
        initial={initial}
        statut={utilisateur?.statut}
        creer={creer}
        modifier={modifier}
        archiver={archiver}
      />
    </div>
  );
}
