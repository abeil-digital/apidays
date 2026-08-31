"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import type { LigneExportPaie, StatutDemande } from "@/lib/types";
import { useDemandes } from "@/hooks/useDemandes";
import { useReglesConges } from "@/hooks/useReglesConges";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { periodeReferenceCp } from "@/lib/periodeReferenceCp";
import { fetchLignesTransmissionParDemande } from "@/lib/data/exportsPaie.repository";
import { LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { InputFiltrePill, SelectFiltrePill } from "@/components/ui/FiltrePill";
import { HistoriqueTable } from "@/components/historique/HistoriqueTable";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";

type Filtre = "Tous les statuts" | "En validation" | "Validés" | "Refusés" | "Annulés";
type PeriodeFiltre = "toutes_dates" | "annee_en_cours" | "periode_reference" | "personnalisee";

const FILTRES: Filtre[] = ["Tous les statuts", "En validation", "Validés", "Refusés", "Annulés"];

// "Annulés" (28/08/2026) — même filtre déjà présent sur Suivre les demandes,
// manquait ici : couvre aussi bien les demandes retirées par le
// collaborateur (`onRetirer`, DetailCongePanel) que les régularisations
// manager, les deux partageant le même statut `annulé` (voir
// `retireeParSoiMeme` dans DetailCongePanel.tsx pour la distinction
// d'affichage, purement au niveau du feed).
const STATUT_PAR_FILTRE: Partial<Record<Filtre, StatutDemande>> = {
  "En validation": "en attente",
  Validés: "validé",
  Refusés: "refusé",
  Annulés: "annulé",
};

const LABEL_PERIODE: Record<PeriodeFiltre, string> = {
  toutes_dates: "Toutes les dates",
  annee_en_cours: "Année en cours",
  periode_reference: "Période de référence",
  personnalisee: "Sélectionner une période",
};

// Types de congés sélectionnables — mêmes codes que la colonne Type du
// tableau (CPA dérivé de CP + isAnticipation, voir HistoriqueTable), même
// liste que le filtre équivalent de Suivre les demandes.
const TYPES_FILTRABLES: TypeBadgeCode[] = ["CP", "RTT", "CPA", "CSS", "CE", "RECUP", "EVT_FAM"];

// `?statut=` → `Filtre` pré-sélectionné — lien depuis la pill "En attente"
// d'Accueil. Même principe que `?demande=<id>` plus bas. Les variantes
// `valide_non_vu`/`refuse_non_vu` (compteurs "Validées"/"Refusé" jamais
// construits sur Accueil) ont été retirées le 28/08/2026, avec les options
// de filtre "Validés non vus"/"Refusés non vus" — aucun lien n'y menait,
// et ce n'est pas un critère qu'un utilisateur choisit manuellement. Le
// mécanisme `vu`/`marquerVue` reste utilisé par le Journal (Accueil).
const FILTRE_PAR_PARAM_STATUT: Record<string, Filtre> = {
  en_attente: "En validation",
};

export function HistoriquePage() {
  const { demandes, marquerVue, retirer } = useDemandes();
  const { utilisateur } = useUtilisateur();
  const { reglesAcquisition } = useReglesConges();
  const searchParams = useSearchParams();
  const [filtre, setFiltre] = useState<Filtre>(
    FILTRE_PAR_PARAM_STATUT[searchParams.get("statut") ?? ""] ?? "Tous les statuts",
  );
  const [typeFiltre, setTypeFiltre] = useState<TypeBadgeCode | "tous">("tous");
  const [periodeFiltre, setPeriodeFiltre] = useState<PeriodeFiltre>("toutes_dates");
  const [debutPerso, setDebutPerso] = useState("");
  const [finPerso, setFinPerso] = useState("");
  // Pré-sélection via `?demande=<id>` — lien "cliquable" depuis l'encart
  // Activité récente d'Accueil2, qui ouvre directement le panneau déployé
  // sur cette demande plutôt que de renvoyer sur un historique "à plat".
  const [selectionId, setSelectionId] = useState<string | null>(searchParams.get("demande"));
  const [lignesTransmissionParId, setLignesTransmissionParId] = useState<
    Record<string, LigneExportPaie[]>
  >({});

  // Statut de transmission paie par demande (28/08/2026, "Annuler cette
  // demande" étendu aux congés validés non transmis) — même fetch que
  // `SuivreDemandesPage.tsx`, seules les demandes validées/annulées peuvent
  // avoir des lignes `export_paie_lignes` (en attente/refusé n'en ont jamais).
  useEffect(() => {
    let cancelled = false;
    const ids = demandes
      .filter((d) => d.statut === "validé" || d.statut === "annulé")
      .map((d) => d.id);
    fetchLignesTransmissionParDemande(ids)
      .then((data) => {
        if (!cancelled) setLignesTransmissionParId(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [demandes]);

  const anneeActuelle = new Date().getFullYear();
  const regleCp = reglesAcquisition.find((r) => r.typeAbsence === "CP");
  const periodeReference = periodeReferenceCp(regleCp);

  const { debut, fin } =
    periodeFiltre === "toutes_dates"
      ? { debut: "", fin: "" }
      : periodeFiltre === "annee_en_cours"
        ? { debut: `${anneeActuelle}-01-01`, fin: `${anneeActuelle}-12-31` }
        : periodeFiltre === "periode_reference"
          ? periodeReference
          : { debut: debutPerso, fin: finPerso };

  const filtered = demandes
    .filter((d) => {
      const statutAttendu = STATUT_PAR_FILTRE[filtre];
      if (statutAttendu && d.statut !== statutAttendu) return false;
      if (debut && d.debut < debut) return false;
      if (fin && d.debut > fin) return false;
      if (typeFiltre !== "tous") {
        const code = d.type === "CP" && d.isAnticipation ? "CPA" : d.type;
        if (code !== typeFiltre) return false;
      }
      return true;
    })
    .sort((a, b) => b.datePose.localeCompare(a.datePose));

  // Le tableau respecte les filtres, mais le panneau doit pouvoir s'ouvrir
  // même sur une demande qu'ils excluent (lien "?demande=" depuis Activité
  // récente d'Accueil2, qui n'a pas de notion de filtre) — repli sur la liste
  // complète, non filtrée, si besoin.
  const selection =
    filtered.find((d) => d.id === selectionId) ??
    demandes.find((d) => d.id === selectionId) ??
    null;

  // Marque "vue" dès l'ouverture du panneau de détail — même logique que
  // "lu" sur une notification, pas une action explicite séparée. Ne concerne
  // que les demandes décidées (`vu` reste sans effet côté "en attente").
  useEffect(() => {
    if (selection && selection.statut !== "en attente" && !selection.vu) {
      marquerVue(selection.id);
    }
  }, [selection, marquerVue]);

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0 print:pb-0">
      <h1 className="text-ink-900 animate-stagger-in px-1 text-2xl font-semibold print:hidden">
        Historique
      </h1>

      <div className="hidden px-1 print:block">
        <h1 className="text-ink-900 text-2xl font-semibold">
          Historique des congés — {utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : ""}
        </h1>
      </div>

      <div
        className="animate-stagger-in flex flex-col gap-5 xl:flex-row xl:items-start print:block"
        style={{ animationDelay: "90ms" }}
      >
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
            onRetirer={(commentaire) => retirer(selection.id, commentaire)}
            lignesTransmission={lignesTransmissionParId[selection.id]}
          />
        )}
      </div>
    </div>
  );
}
