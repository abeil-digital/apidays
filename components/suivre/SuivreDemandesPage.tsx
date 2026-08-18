"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import type { StatutDemande } from "@/lib/types";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandesEquipe } from "@/hooks/useDemandesEquipe";
import { useReglesConges } from "@/hooks/useReglesConges";
import { periodeReferenceCp } from "@/lib/periodeReferenceCp";
import { LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { InputFiltrePill, SelectFiltrePill } from "@/components/ui/FiltrePill";
import { HistoriqueTable } from "@/components/historique/HistoriqueTable";
import { Toast } from "@/components/ui/Toast";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";

type Filtre = "Tous les statuts" | "En validation" | "Validés" | "Refusés";
type PeriodeFiltre = "annee_en_cours" | "periode_reference" | "personnalisee";

const FILTRES: Filtre[] = ["Tous les statuts", "En validation", "Validés", "Refusés"];

const STATUT_PAR_FILTRE: Partial<Record<Filtre, StatutDemande>> = {
  "En validation": "en attente",
  Validés: "validé",
  Refusés: "refusé",
};

const LABEL_PERIODE: Record<PeriodeFiltre, string> = {
  annee_en_cours: "Année en cours",
  periode_reference: "Période de référence",
  personnalisee: "Sélectionner une période",
};

// Types de congés sélectionnables — mêmes codes que la colonne Type du
// tableau (CPA dérivé de CP + isAnticipation, voir HistoriqueTable).
const TYPES_FILTRABLES: TypeBadgeCode[] = ["CP", "RTT", "CPA", "CSS", "CE", "RECUP", "EVT_FAM"];

/**
 * "Suivre les demandes" (`/suivre/demandes`) — reprend exactement
 * `HistoriquePage` (mêmes filtres statut/période, même `HistoriqueTable`)
 * mais sur `fetchDemandesEquipe` (toute l'entreprise) au lieu de
 * `fetchDemandes` (soi-même), avec `avecCollaborateur` pour ajouter la
 * colonne Collaborateur en tête de ligne. Visible admin + manager comme le
 * reste de `/suivre` (bloqué pour les salarié·es dans `proxy.ts`).
 */
export function SuivreDemandesPage() {
  const { demandes, valider, refuser, regulariser, remettreEnAttente } = useDemandesEquipe();
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);
  const { reglesAcquisition } = useReglesConges();

  // Données calendrier (courant + suivant) pour le lien "Voir" du panneau de
  // détail (`DetailCongePanel`) sur une demande "en attente" — mêmes données
  // pour tous les employés, pas de re-fetch par utilisateur (18/08/2026).
  const anneeActuelle = new Date().getFullYear();
  const calActuel = useCalendrier(anneeActuelle);
  const calSuivant = useCalendrier(anneeActuelle + 1);
  const joursFeries = [...calActuel.joursFeries, ...calSuivant.joursFeries];
  const congesImposes = [...calActuel.congesImposes, ...calSuivant.congesImposes];
  const djImposees = [...calActuel.djImposees, ...calSuivant.djImposees];
  const [filtre, setFiltre] = useState<Filtre>("Tous les statuts");
  const [periodeFiltre, setPeriodeFiltre] = useState<PeriodeFiltre>("annee_en_cours");
  const [debutPerso, setDebutPerso] = useState("");
  const [finPerso, setFinPerso] = useState("");
  const [collaborateurFiltre, setCollaborateurFiltre] = useState("tous");
  const [typeFiltre, setTypeFiltre] = useState<TypeBadgeCode | "tous">("tous");
  const [selectionId, setSelectionId] = useState<string | null>(null);

  const regleCp = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const periodeReference = periodeReferenceCp(regleCp);

  const { debut, fin } =
    periodeFiltre === "annee_en_cours"
      ? { debut: `${anneeActuelle}-01-01`, fin: `${anneeActuelle}-12-31` }
      : periodeFiltre === "periode_reference"
        ? periodeReference
        : { debut: debutPerso, fin: finPerso };

  // Collaborateurs réellement présents dans les demandes chargées, triés par
  // nom — pas une liste figée en dur (nouveaux profils, départs...).
  const collaborateurs = [
    ...new Map(
      demandes.map((d) => [d.demandeur.id, `${d.demandeur.prenom} ${d.demandeur.nom}`]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const filtered = demandes
    .filter((d) => {
      const statutAttendu = STATUT_PAR_FILTRE[filtre];
      if (statutAttendu && d.statut !== statutAttendu) return false;
      if (debut && d.debut < debut) return false;
      if (fin && d.debut > fin) return false;
      if (collaborateurFiltre !== "tous" && d.demandeur.id !== collaborateurFiltre) return false;
      if (typeFiltre !== "tous") {
        const code = d.type === "CP" && d.isAnticipation ? "CPA" : d.type;
        if (code !== typeFiltre) return false;
      }
      return true;
    })
    .sort((a, b) => b.debut.localeCompare(a.debut));

  const selection = demandes.find((d) => d.id === selectionId) ?? null;

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-6xl md:pt-0 print:pb-0">
      <h1 className="text-ink-900 px-1 text-2xl font-semibold print:hidden">Suivre les demandes</h1>

      <div className="hidden px-1 print:block">
        <h1 className="text-ink-900 text-2xl font-semibold">
          Suivi des demandes — toute l&apos;entreprise
        </h1>
      </div>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start print:block">
        <div
          className={`bg-surface-card w-full xl:min-w-0 ${selection ? "xl:flex-1" : "md:max-w-[900px]"}`}
        >
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3 print:hidden">
            <div className="flex flex-wrap items-end gap-2">
              <SelectFiltrePill
                value={typeFiltre}
                onChange={(e) => setTypeFiltre(e.target.value as TypeBadgeCode | "tous")}
              >
                <option value="tous">Tous les types</option>
                {TYPES_FILTRABLES.map((code) => (
                  <option key={code} value={code}>
                    {LABEL_LONG[code]}
                  </option>
                ))}
              </SelectFiltrePill>
              <SelectFiltrePill
                value={filtre}
                onChange={(e) => setFiltre(e.target.value as Filtre)}
              >
                {FILTRES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </SelectFiltrePill>
              <SelectFiltrePill
                value={collaborateurFiltre}
                onChange={(e) => setCollaborateurFiltre(e.target.value)}
              >
                <option value="tous">Tous les collaborateurs</option>
                {collaborateurs.map(([id, nom]) => (
                  <option key={id} value={id}>
                    {nom}
                  </option>
                ))}
              </SelectFiltrePill>
              <SelectFiltrePill
                value={periodeFiltre}
                onChange={(e) => setPeriodeFiltre(e.target.value as PeriodeFiltre)}
              >
                {(Object.entries(LABEL_PERIODE) as [PeriodeFiltre, string][]).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </SelectFiltrePill>
              {periodeFiltre === "personnalisee" && (
                <>
                  <InputFiltrePill
                    type="date"
                    aria-label="Du"
                    value={debutPerso}
                    onChange={(e) => setDebutPerso(e.target.value)}
                  />
                  <InputFiltrePill
                    type="date"
                    aria-label="Au"
                    value={finPerso}
                    onChange={(e) => setFinPerso(e.target.value)}
                  />
                </>
              )}
            </div>
            <button
              onClick={() => window.print()}
              className="bg-surface-app text-ink-900 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              <Printer size={13} />
              Exporter
            </button>
          </div>

          <div className="border-ink-300/60 border-t">
            <HistoriqueTable
              demandes={filtered}
              emptyText="Aucune demande sur cette période."
              avecCollaborateur
              compact
              onDateClick={setSelectionId}
              selectedId={selectionId}
            />
          </div>
        </div>

        {selection && (
          <DetailCongePanel
            key={selection.id}
            selection={selection}
            onClose={() => setSelectionId(null)}
            onValider={(commentaire) => valider(selection.id, commentaire)}
            onRefuser={(commentaire) => refuser(selection.id, commentaire)}
            onRegulariser={(commentaire) => regulariser(selection.id, commentaire)}
            onValiderSucces={(id, message) => setToast({ id, message })}
            joursFeries={joursFeries}
            congesImposes={congesImposes}
            djImposees={djImposees}
            autresDemandes={demandes.filter(
              (d) => d.demandeur.id === selection.demandeur.id && d.id !== selection.id,
            )}
          />
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          actionLabel="Annuler"
          onAction={() => {
            remettreEnAttente(toast.id);
            setToast(null);
          }}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
