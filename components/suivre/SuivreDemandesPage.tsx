"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import type { LigneExportPaie, StatutDemande } from "@/lib/types";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandesEquipe } from "@/hooks/useDemandesEquipe";
import { useReglesConges } from "@/hooks/useReglesConges";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { fetchLignesTransmissionParDemande } from "@/lib/data/exportsPaie.repository";
import { fetchAjustementsEquipe, type AjustementEquipe } from "@/lib/data/soldes.repository";
import { periodeReferenceCp } from "@/lib/periodeReferenceCp";
import { LABEL_LONG, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import { InputFiltrePill, SelectFiltrePill } from "@/components/ui/FiltrePill";
import { HistoriqueTable } from "@/components/historique/HistoriqueTable";
import { Toast } from "@/components/ui/Toast";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";
import { DetailAjustementPanel } from "@/components/suivre/DetailAjustementPanel";
import { TableauAjustements } from "@/components/suivre/TableauAjustements";
import { KanbanDemandes } from "@/components/suivre/KanbanDemandes";
import { BandeauExportPaie } from "@/components/suivre/BandeauExportPaie";

type Filtre = "Tous les statuts" | "En validation" | "Validés" | "Refusés" | "Annulés";
type PeriodeFiltre = "toutes_dates" | "annee_en_cours" | "periode_reference" | "personnalisee";

// "Annulés" (25/08/2026) — régularisations, plutôt une exception qu'un flux
// courant : placé en dernier, après les 3 statuts habituels.
const FILTRES: Filtre[] = ["Tous les statuts", "En validation", "Validés", "Refusés", "Annulés"];

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
// tableau (CPA dérivé de CP + isAnticipation, voir HistoriqueTable).
const TYPES_FILTRABLES: TypeBadgeCode[] = ["CP", "RTT", "CPA", "CSS", "CE", "RECUP", "EVT_FAM"];

// Régularisations manuelles (27/08/2026, "Ajuster le solde") — pas des
// demandes (pas de workflow de validation), donc pas des `TypeBadgeCode` :
// pseudo-types dédiés dans le même filtre, rendus séparément de
// `HistoriqueTable` (voir plus bas, `TableauAjustements`).
type TypeFiltreRegul = "REGUL_CP" | "REGUL_RTT" | "REGUL_CPA";
const TYPES_REGUL: { valeur: TypeFiltreRegul; label: string; code: "CP" | "RTT" | "CPA" }[] = [
  { valeur: "REGUL_CP", label: "Régul CP", code: "CP" },
  { valeur: "REGUL_RTT", label: "Régul RTT", code: "RTT" },
  { valeur: "REGUL_CPA", label: "Régul CPA", code: "CPA" },
];

// `?statut=`/`?periode=` → filtres pré-sélectionnés (22/08/2026) — lien
// depuis l'encart "Demandes à étudier" d'Accueil (manager), même principe
// que `?statut=`/`?demande=` sur `HistoriquePage`.
const FILTRE_PAR_PARAM_STATUT: Record<string, Filtre> = {
  en_attente: "En validation",
};
const PERIODE_PAR_PARAM: Record<string, PeriodeFiltre> = {
  toutes_dates: "toutes_dates",
};

/**
 * "Suivre les demandes" (`/suivre/demandes`) — reprend exactement
 * `HistoriquePage` (mêmes filtres statut/période, même `HistoriqueTable`)
 * mais sur `fetchDemandesEquipe` (toute l'entreprise) au lieu de
 * `fetchDemandes` (soi-même), avec `avecCollaborateur` pour ajouter la
 * colonne Collaborateur en tête de ligne. Visible admin + manager comme le
 * reste de `/suivre` (bloqué pour les salarié·es dans `proxy.ts`).
 */
export function SuivreDemandesPage() {
  const { demandes, valider, refuser, remettreEnAttente, retirer } = useDemandesEquipe();
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);
  const { reglesAcquisition } = useReglesConges();
  const searchParams = useSearchParams();
  // Droits (15/09/2026, tranché par Vincent — "les droits des managers sont
  // les mêmes que ceux des administrateurs avec juste un droit
  // supplémentaire : la validation des congés") : manager ET admin peuvent
  // tous les deux "Annuler cette demande" à tout moment, y compris déjà
  // transmise en paie (`peutAnnulerDejaTransmis`) ; le manager garde en plus
  // Valider/Refuser. Plus de "Régulariser" ici (abandonné avec
  // `managerPeutAnnuler`). Changement UI seulement — la policy RLS reste
  // large pour les deux rôles (voir plan), donc `retirer` fonctionne déjà
  // sans migration.
  const { utilisateur } = useUtilisateur();
  const estManager = utilisateur?.role === "manager";
  const estAdmin = utilisateur?.role === "admin";

  // Données calendrier (courant + suivant) pour le lien "Voir" du panneau de
  // détail (`DetailCongePanel`) sur une demande "en attente" — mêmes données
  // pour tous les employés, pas de re-fetch par utilisateur (18/08/2026).
  const anneeActuelle = new Date().getFullYear();
  const calActuel = useCalendrier(anneeActuelle);
  const calSuivant = useCalendrier(anneeActuelle + 1);
  const joursFeries = [...calActuel.joursFeries, ...calSuivant.joursFeries];
  const congesImposes = [...calActuel.congesImposes, ...calSuivant.congesImposes];
  const djImposees = [...calActuel.djImposees, ...calSuivant.djImposees];
  const [filtre, setFiltre] = useState<Filtre>(
    FILTRE_PAR_PARAM_STATUT[searchParams.get("statut") ?? ""] ?? "Tous les statuts",
  );
  const [periodeFiltre, setPeriodeFiltre] = useState<PeriodeFiltre>(
    PERIODE_PAR_PARAM[searchParams.get("periode") ?? ""] ?? "annee_en_cours",
  );
  const [debutPerso, setDebutPerso] = useState("");
  const [finPerso, setFinPerso] = useState("");
  const [collaborateurFiltre, setCollaborateurFiltre] = useState("tous");
  const [typeFiltre, setTypeFiltre] = useState<TypeBadgeCode | TypeFiltreRegul | "tous">("tous");
  const [selectionId, setSelectionId] = useState<string | null>(null);
  // Toggle Liste/Kanban (21/09/2026, test d'affichage — voir Backlog "Suivre
  // les demandes : vue Kanban") — par défaut sur Kanban pour la vérif,
  // repassera par défaut sur Liste une fois le chantier officiellement lancé.
  const [vueKanban, setVueKanban] = useState(true);
  const [lignesTransmissionParDemande, setLignesTransmissionParDemande] = useState<
    Record<string, LigneExportPaie[]>
  >({});
  const [ajustementsEquipe, setAjustementsEquipe] = useState<AjustementEquipe[]>([]);
  const regulSelectionne = TYPES_REGUL.find((r) => r.valeur === typeFiltre) ?? null;

  // Ajustements manuels de l'équipe (27/08/2026) — chargés une seule fois
  // (pas de refetch par filtre, la liste complète est légère), filtrés
  // ensuite côté client comme `demandes`.
  useEffect(() => {
    let cancelled = false;
    fetchAjustementsEquipe().then((data) => {
      if (!cancelled) setAjustementsEquipe(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Statut de transmission paie par demande (Transmissions paie, 24/08/2026) —
  // seules les demandes validées/annulées peuvent avoir des lignes
  // `export_paie_lignes` (en attente/refusé n'en ont jamais).
  useEffect(() => {
    let cancelled = false;
    const ids = demandes
      .filter((d) => d.statut === "validé" || d.statut === "annulé")
      .map((d) => d.id);
    fetchLignesTransmissionParDemande(ids)
      .then((data) => {
        if (!cancelled) setLignesTransmissionParDemande(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [demandes]);

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

  // Vue Kanban (21/09/2026, scope réduit à 3 colonnes le même jour — voir
  // CONTEXTE.md) : les filtres "période" et "statut" de la page n'ont plus
  // de sens ici — aucune des 3 colonnes retenues (En attente /
  // Validées-prochain export / Validées-pas encore dues, avec ses
  // sous-groupes Congés annulés/Périodes précédentes) ne doit être bornée
  // par une date, et le statut EST la classification en colonnes elle-même
  // (filtrer par statut viderait des colonnes entières, ex. "Régul" a
  // besoin des demandes annulées). Seuls collaborateur/type restent
  // pertinents.
  const filteredSansPeriode = demandes
    .filter((d) => {
      if (collaborateurFiltre !== "tous" && d.demandeur.id !== collaborateurFiltre) return false;
      if (typeFiltre !== "tous") {
        const code = d.type === "CP" && d.isAnticipation ? "CPA" : d.type;
        if (code !== typeFiltre) return false;
      }
      return true;
    })
    .sort((a, b) => b.debut.localeCompare(a.debut));

  // Régularisations filtrées avec les mêmes critères période/collaborateur
  // que les demandes (27/08/2026) — pas de filtre "Filtre" (statut), les
  // ajustements n'ont pas de workflow de validation.
  const ajustementsFiltres = regulSelectionne
    ? ajustementsEquipe
        .filter((a) => a.code === regulSelectionne.code)
        .filter((a) => !debut || a.date >= debut)
        .filter((a) => !fin || a.date <= fin)
        .filter((a) => collaborateurFiltre === "tous" || a.utilisateurId === collaborateurFiltre)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const selection = demandes.find((d) => d.id === selectionId) ?? null;
  const ajustementSelectionne = regulSelectionne
    ? (ajustementsFiltres.find((a) => a.id === selectionId) ?? null)
    : null;
  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0 print:pb-0">
      <h1 className="text-ink-900 animate-stagger-in px-1 text-2xl font-semibold print:hidden">
        Suivre les demandes
      </h1>

      <div className="hidden px-1 print:block">
        <h1 className="text-ink-900 text-2xl font-semibold">
          Suivi des demandes — toute l&apos;entreprise
        </h1>
      </div>

      <div
        className={`animate-stagger-in grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,900px)_16rem] xl:gap-x-2.5 print:block ${
          vueKanban ? "xl:items-stretch" : "items-start"
        }`}
        style={{ animationDelay: "90ms" }}
      >
        <div className="flex w-full min-w-0 flex-col gap-2">
          {/* "Exporter" sorti de la barre de filtres (17/09/2026, PTP
              Vincent) — restait poussé vers le bas quand le groupe "Du"/"Au"
              grandit en dessous de "Sélectionner une période" (voir plus
              bas), même une fois la barre passée en `items-start`. Sortie du
              conteneur `bg-surface-card` (fond transparent, pas la carte
              blanche) et placée au-dessus de toute la barre de filtres. */}
          <div className="flex items-center justify-between px-1 print:hidden">
            {/* Toggle Liste/Kanban (21/09/2026, test d'affichage) */}
            <div className="border-ink-300/60 inline-flex rounded-full border p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setVueKanban(true)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  vueKanban ? "bg-slate text-white" : "text-ink-500"
                }`}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setVueKanban(false)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  !vueKanban ? "bg-slate text-white" : "text-ink-500"
                }`}
              >
                Liste
              </button>
            </div>
            <button
              onClick={() => window.print()}
              className="bg-slate hover:bg-slate/90 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150"
            >
              <Printer size={13} />
              Exporter
            </button>
          </div>

          <div className="bg-surface-card w-full min-w-0">
            <div className="bg-mint-tint/50 flex flex-wrap items-start gap-3 px-4 py-3 print:hidden">
              <div className="flex flex-wrap items-start gap-2">
                <SelectFiltrePill
                  value={typeFiltre}
                  onChange={(e) =>
                    setTypeFiltre(e.target.value as TypeBadgeCode | TypeFiltreRegul | "tous")
                  }
                >
                  <option value="tous">Tous les types</option>
                  {TYPES_FILTRABLES.map((code) => (
                    <option key={code} value={code}>
                      {LABEL_LONG[code]}
                    </option>
                  ))}
                  {TYPES_REGUL.map((r) => (
                    <option key={r.valeur} value={r.valeur}>
                      {r.label}
                    </option>
                  ))}
                </SelectFiltrePill>
                {/* Masqué en vue Kanban (21/09/2026) : le statut EST déjà la
                    classification en colonnes, un filtre en plus n'aurait
                    plus de sens (viderait des colonnes entières). */}
                {!vueKanban && (
                  <SelectFiltrePill value={filtre} onChange={(e) => setFiltre(e.target.value as Filtre)}>
                    {FILTRES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </SelectFiltrePill>
                )}
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
                {/* Sélecteur de période + "Du"/"Au" regroupés dans leur propre
                  colonne (17/09/2026, PTP Vincent — "les deux sélecteurs
                  doivent se caler sous 'Sélectionner une période'") : la
                  ligne de dates apparaît directement sous le sélecteur plutôt
                  qu'en pleine largeur depuis le bord gauche de la barre de
                  filtres, et les deux champs restent toujours groupés (jamais
                  scindés par un retour à la ligne intempestif entre les deux,
                  l'un sur une ligne et l'autre isolé sur la suivante).
                  Libellés "Du"/"Au" rendus visibles (avant seulement
                  `aria-label`, les deux champs étaient indiscernables). Ce
                  bloc grandissant verticalement sans agrandir le conteneur
                  parent (`items-end` uniquement DANS ce sous-groupe, jamais
                  propagé au conteneur global) — voir aussi le passage de la
                  barre entière à `items-start` ci-dessus, pour que le bouton
                  "Exporter" ne soit plus poussé vers le bas quand cette
                  colonne grandit. */}
                {/* Masqué en vue Kanban (21/09/2026) : le filtre période ne
                    s'y applique plus, aucune des 3 colonnes n'est bornée
                    par une date — le laisser affiché serait trompeur, il
                    n'aurait plus aucun effet. */}
                {!vueKanban && (
                  <div className="flex flex-col items-start gap-2">
                    <SelectFiltrePill
                      value={periodeFiltre}
                      onChange={(e) => setPeriodeFiltre(e.target.value as PeriodeFiltre)}
                    >
                      {(Object.entries(LABEL_PERIODE) as [PeriodeFiltre, string][]).map(
                        ([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ),
                      )}
                    </SelectFiltrePill>
                    {periodeFiltre === "personnalisee" && (
                      <div className="flex items-center gap-2">
                        <span className="text-ink-500 text-xs font-semibold">Du</span>
                        <InputFiltrePill
                          type="date"
                          aria-label="Du"
                          value={debutPerso}
                          onChange={(e) => setDebutPerso(e.target.value)}
                        />
                        <span className="text-ink-500 text-xs font-semibold">Au</span>
                        <InputFiltrePill
                          type="date"
                          aria-label="Au"
                          value={finPerso}
                          onChange={(e) => setFinPerso(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-slate/30 border-t">
              {regulSelectionne ? (
                <TableauAjustements
                  ajustements={ajustementsFiltres}
                  selectionId={selectionId}
                  onSelect={setSelectionId}
                />
              ) : vueKanban ? (
                <div className="flex flex-col gap-3 p-3">
                  <BandeauExportPaie />
                  <KanbanDemandes
                    demandes={filteredSansPeriode}
                    lignesTransmissionParDemande={lignesTransmissionParDemande}
                    selectionId={selectionId}
                    onCardClick={setSelectionId}
                  />
                </div>
              ) : (
                <HistoriqueTable
                  demandes={filtered}
                  emptyText="Aucune demande sur cette période."
                  avecCollaborateur
                  compact
                  onDateClick={setSelectionId}
                  selectedId={selectionId}
                  lignesTransmissionParDemande={lignesTransmissionParDemande}
                />
              )}
            </div>
          </div>
        </div>

        {ajustementSelectionne && (
          <DetailAjustementPanel
            key={ajustementSelectionne.id}
            ajustement={{
              code: ajustementSelectionne.code,
              nomComplet: ajustementSelectionne.nomComplet,
              deltaJours: ajustementSelectionne.deltaJours,
              date: ajustementSelectionne.date,
              auteurNom: ajustementSelectionne.auteurNom,
              motif: ajustementSelectionne.motif,
            }}
            onClose={() => setSelectionId(null)}
          />
        )}

        {selection && (
          // En vue Kanban (21/09/2026, demande de Vincent) : `pleineLargeur`
          // neutralise le `xl:sticky xl:w-64 xl:shrink-0` interne du panneau
          // (pensé pour un docking à côté d'une longue liste qui défile) —
          // repris manuellement ici + `self-stretch` pour que le panneau
          // s'aligne sur la hauteur de la ligne kanban (`xl:items-stretch`
          // sur la grille ci-dessus), au lieu de rester collé en haut avec
          // du vide en dessous à côté de colonnes bien plus hautes.
          <div className={vueKanban ? "xl:w-64 xl:shrink-0 self-stretch" : undefined}>
            <DetailCongePanel
              key={selection.id}
              selection={selection}
              pleineLargeur={vueKanban}
              onClose={() => setSelectionId(null)}
              onValider={estManager ? (commentaire) => valider(selection.id, commentaire) : undefined}
              onRefuser={estManager ? (commentaire) => refuser(selection.id, commentaire) : undefined}
              onRetirer={
                estManager || estAdmin
                  ? (commentaire) => retirer(selection.id, commentaire)
                  : undefined
              }
              peutAnnulerDejaTransmis={estManager || estAdmin}
              onValiderSucces={(id, message) => setToast({ id, message })}
              joursFeries={joursFeries}
              congesImposes={congesImposes}
              djImposees={djImposees}
              autresDemandes={demandes.filter(
                (d) => d.demandeur.id === selection.demandeur.id && d.id !== selection.id,
              )}
              lignesTransmission={lignesTransmissionParDemande[selection.id]}
            />
          </div>
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
