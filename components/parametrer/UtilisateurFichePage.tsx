"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check } from "lucide-react";
import type {
  NatureContrat,
  RoleUtilisateur,
  UtilisateurAdmin,
  UtilisateurAdminInput,
} from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useUtilisateurAdmin } from "@/hooks/useUtilisateurAdmin";
import { BackHeader } from "@/components/ui/BackHeader";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";

interface UtilisateurFichePageProps {
  id?: string; // absent = mode création
}

const CHAMPS_VIDES: UtilisateurAdminInput = {
  prenom: "",
  nom: "",
  email: "",
  dateEntree: "",
  natureContrat: "cdi",
  tauxActivite: 100,
  ancienneteDateReference: null,
  role: "salarie",
};

const PRESETS_DUREE: { value: string; label: string }[] = [
  { value: "100", label: "Temps plein (100 %)" },
  { value: "80", label: "80 %" },
  { value: "50", label: "Mi-temps (50 %)" },
  { value: "33.33", label: "Tiers-temps (33,33 %)" },
];

function presetPourTaux(taux: number): string {
  const preset = PRESETS_DUREE.find((p) => Number(p.value) === taux);
  return preset ? preset.value : "autre";
}

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
  const [dureeSelection, setDureeSelection] = useState(() => presetPourTaux(initial.tauxActivite));
  const [tauxAutre, setTauxAutre] = useState(() =>
    presetPourTaux(initial.tauxActivite) === "autre" ? String(initial.tauxActivite) : "",
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
            <Input
              id="prenom"
              value={champs.prenom}
              onChange={(e) => setChamps({ ...champs, prenom: e.target.value })}
              className="mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel htmlFor="nom">Nom</FieldLabel>
            <Input
              id="nom"
              value={champs.nom}
              onChange={(e) => setChamps({ ...champs, nom: e.target.value })}
              className="mt-2 w-full"
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={champs.email}
            onChange={(e) => setChamps({ ...champs, email: e.target.value })}
            className="mt-2 w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="dateEntree">Date d&rsquo;entrée</FieldLabel>
            <Input
              id="dateEntree"
              type="date"
              value={champs.dateEntree}
              onChange={(e) => setChamps({ ...champs, dateEntree: e.target.value })}
              className="mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel htmlFor="role">Rôle</FieldLabel>
            <Select
              id="role"
              value={champs.role}
              onChange={(e) => setChamps({ ...champs, role: e.target.value as RoleUtilisateur })}
              className="mt-2 w-full"
            >
              <option value="salarie">Salarié·e</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="natureContrat">Nature du contrat</FieldLabel>
            <Select
              id="natureContrat"
              value={champs.natureContrat}
              onChange={(e) =>
                setChamps({ ...champs, natureContrat: e.target.value as NatureContrat })
              }
              className="mt-2 w-full"
            >
              <option value="cdi">CDI</option>
              <option value="cdd">CDD</option>
              <option value="alternance">Alternance</option>
              <option value="stage">Stage</option>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="dureeTravail">Durée de travail</FieldLabel>
            <Select
              id="dureeTravail"
              value={dureeSelection}
              onChange={(e) => {
                const valeur = e.target.value;
                setDureeSelection(valeur);
                if (valeur === "autre") {
                  setTauxAutre(String(champs.tauxActivite));
                } else {
                  setChamps({ ...champs, tauxActivite: Number(valeur) });
                }
              }}
              className="mt-2 w-full"
            >
              {PRESETS_DUREE.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="autre">Autre</option>
            </Select>
          </div>
        </div>

        {dureeSelection === "autre" && (
          <div>
            <FieldLabel htmlFor="tauxAutre">Pourcentage</FieldLabel>
            <Input
              id="tauxAutre"
              type="number"
              min={1}
              max={100}
              step="0.01"
              value={tauxAutre}
              onChange={(e) => {
                const valeur = e.target.value;
                setTauxAutre(valeur);
                const n = Number(valeur);
                if (valeur && !Number.isNaN(n)) {
                  setChamps({ ...champs, tauxActivite: n });
                }
              }}
              className="mt-2 w-full"
            />
          </div>
        )}

        <div>
          <FieldLabel htmlFor="anciennete">
            Date de référence ancienneté{" "}
            <span className="text-ink-500 font-normal">
              (si différente de la date d&rsquo;entrée)
            </span>
          </FieldLabel>
          <Input
            id="anciennete"
            type="date"
            value={champs.ancienneteDateReference ?? ""}
            onChange={(e) =>
              setChamps({ ...champs, ancienneteDateReference: e.target.value || null })
            }
            className="mt-2 w-full"
          />
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        <Button type="submit" disabled={envoi} className="rounded-card w-full py-3.5">
          <Check size={16} />
          {id ? "Enregistrer" : "Créer le profil"}
        </Button>
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
        natureContrat: utilisateur.natureContrat ?? "cdi",
        tauxActivite: utilisateur.tauxActivite,
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
