"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { getAujourdhui } from "@/lib/aujourdhui";
import { todayISO } from "@/lib/format";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandesEquipe } from "@/hooks/useDemandesEquipe";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { fetchLignesTransmissionParDemande } from "@/lib/data/exportsPaie.repository";
import { classeFondTypeBadge, type TypeBadgeCode } from "@/components/demandes/TypeBadge";
import {
  SnippetJourCalendrier,
  type JourCalendrierClique,
} from "@/components/demandes/SnippetJourCalendrier";
import { CompteurTypologies } from "@/components/demandes/CompteurTypologies";
import { compterTypologies } from "@/components/demandes/compterTypologies";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";
import {
  DetailJourCommunPanel,
  type JourCommunClique,
} from "@/components/demandes/DetailJourCommunPanel";
import type { DemandeEquipe, LigneExportPaie } from "@/lib/types";

function isoDate(annee: number, moisIndex: number, jour: number): string {
  return new Date(Date.UTC(annee, moisIndex, jour)).toISOString().slice(0, 10);
}

function ajouterJoursIso(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Tous les mois (année + index) couverts par une plage de dates ISO, bornes
 * incluses — voir DashboardPage.tsx, même helper (duplication assumée). */
function moisEntre(debutIso: string, finIso: string): { annee: number; moisIndex: number }[] {
  const mois: { annee: number; moisIndex: number }[] = [];
  let annee = Number(debutIso.slice(0, 4));
  let moisIndex = Number(debutIso.slice(5, 7)) - 1;
  const anneeFin = Number(finIso.slice(0, 4));
  const moisIndexFin = Number(finIso.slice(5, 7)) - 1;

  while (annee < anneeFin || (annee === anneeFin && moisIndex <= moisIndexFin)) {
    mois.push({ annee, moisIndex });
    moisIndex += 1;
    if (moisIndex > 11) {
      moisIndex = 0;
      annee += 1;
    }
  }

  return mois;
}

function codeBadgeDemande(demande: DemandeEquipe): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

// Voir DashboardPage.tsx (même constante, duplication assumée entre les
// deux variantes de calendrier, comme le reste de leurs helpers).
const VAR_COULEUR_TYPE: Record<TypeBadgeCode, string> = {
  CP: "--color-cp",
  RTT: "--color-rtt",
  CPA: "--color-cpa",
  CSS: "--color-css",
  CE: "--color-ce",
  RECUP: "--color-recup",
  EVT_FAM: "--color-evtfam",
  DJI: "--color-dji",
  CPI: "--color-cpi",
  FERIE: "--color-ferie",
};

/** Sélecteur "Commence : Aujourd'hui / Il y a 3 mois" — même composant que
 * `SelectCommence` de `DashboardPage.tsx` (duplication assumée). */
function SelectCommence({ actif, onChange }: { actif: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="relative inline-flex w-fit items-center gap-1.5">
      <span className="text-ink-500 text-xs">Commence :</span>
      <select
        value={actif ? "il_y_a_3_mois" : "aujourdhui"}
        onChange={(e) => onChange(e.target.value === "il_y_a_3_mois")}
        className="text-mint relative appearance-none pr-4 text-xs font-normal underline underline-offset-2 outline-none"
      >
        <option value="aujourdhui">Aujourd&apos;hui</option>
        <option value="il_y_a_3_mois">Il y a 3 mois</option>
      </select>
      <ChevronDown size={11} className="text-mint pointer-events-none absolute right-0" />
    </div>
  );
}

/**
 * Calendrier d'un collaborateur, pour `/suivre/calendrier` (24/08/2026,
 * manager/admin — refondu le 15/09/2026 pour reprendre le gabarit "nouvelle
 * version" d'Accueil (`DashboardPage.tsx`, section "Mon Calendrier") : fenêtre
 * glissante de 9 mois + sélecteur "Commence : Aujourd'hui / Il y a 3 mois"
 * (remplace les 3 anciens onglets Année en cours/Période de référence
 * CP/Année suivante, jugés trop compliqués), 4ᵉ colonne fixe hébergeant le
 * détail du jour cliqué (`DetailCongePanel` pour une demande personnelle,
 * `DetailJourCommunPanel` en lecture seule pour un CPI/DJI/Férié) + la
 * légende par typologie empilée verticalement, couleur du chiffre
 * orange/vert plutôt que fond atténué, chevauchement demande/férié/DJI
 * "transparent" (variante `partage`), routage du clic par demi-journée
 * (`moitieCliquee`), jours passés atténués (`estPasse`). Voir Backlog.md
 * "Calendrier simplifié", point 5.
 *
 * Différence volontaire avec `DashboardPage` : pas de bouton "+"/clic sur un
 * jour vide (un manager ne pose pas de congé à la place d'un collaborateur
 * depuis cet écran, hors scope) ; `estPasse` garde en revanche la même
 * exception "jour déjà posé reste à pleine opacité".
 *
 * Droits de décision/annulation dans `DetailCongePanel` scopés au rôle du
 * VIEWER, pas à `utilisateurId` (le collaborateur consulté) : principe
 * tranché le 15/09/2026 par Vincent — "les droits des managers sont les
 * mêmes que ceux des administrateurs avec juste un droit supplémentaire :
 * la validation des congés". Concrètement, manager ET admin peuvent tous
 * les deux annuler une demande à tout moment (y compris déjà transmise en
 * paie, `peutAnnulerDejaTransmis`), le manager ayant en plus valider/
 * refuser. Pas de `onRegulariser` ici (abandonné, même changement appliqué
 * à `SuivreDemandesPage.tsx`).
 */
export function CalendrierCollaborateur({ utilisateurId }: { utilisateurId: string }) {
  const { utilisateur: viewer } = useUtilisateur();
  const { demandes: demandesEquipe, valider, refuser, retirer } = useDemandesEquipe();
  const estManager = viewer?.role === "manager";
  const estAdmin = viewer?.role === "admin";
  const demandes = demandesEquipe.filter((d) => d.demandeur.id === utilisateurId);

  const [snippet, setSnippet] = useState<{ jour: JourCalendrierClique; ancre: DOMRect } | null>(
    null,
  );
  const [demandeSelectionnee, setDemandeSelectionnee] = useState<DemandeEquipe | null>(null);
  const [jourCommunSelectionne, setJourCommunSelectionne] = useState<JourCommunClique | null>(
    null,
  );
  const [commenceIlYA3Mois, setCommenceIlYA3Mois] = useState(false);
  // Statut de transmission paie par demande (15/09/2026, demande explicite de
  // Vincent — "il faut le faire", même mécanisme que `SuivreDemandesPage.tsx`)
  // : seules les demandes validées/annulées peuvent avoir des lignes
  // `export_paie_lignes` (en attente/refusé n'en ont jamais). Nécessaire pour
  // la nuance "Passé en paie" (`peutAnnulerDejaTransmis`), vraie pour manager
  // et admin — les deux peuvent annuler une demande déjà transmise ici.
  const [lignesTransmissionParDemande, setLignesTransmissionParDemande] = useState<
    Record<string, LigneExportPaie[]>
  >({});

  useEffect(() => {
    let cancelled = false;
    const ids = demandesEquipe
      .filter(
        (d) => d.demandeur.id === utilisateurId && (d.statut === "validé" || d.statut === "annulé"),
      )
      .map((d) => d.id);
    fetchLignesTransmissionParDemande(ids)
      .then((data) => {
        if (!cancelled) setLignesTransmissionParDemande(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [utilisateurId, demandesEquipe]);

  const anneeActuelle = getAujourdhui().getFullYear();
  const anneePrecedente = anneeActuelle - 1;
  const anneeSuivante = anneeActuelle + 1;
  const calendrierAnneePrecedente = useCalendrier(anneePrecedente);
  const calendrierAnneeA = useCalendrier(anneeActuelle);
  const calendrierAnneeB = useCalendrier(anneeSuivante);

  const loading =
    calendrierAnneePrecedente.loading || calendrierAnneeA.loading || calendrierAnneeB.loading;

  if (loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  const todayIso = todayISO();
  // Fenêtre glissante de 9 mois, décalable de 3 mois en arrière — voir
  // DashboardPage.tsx pour le détail du calcul (duplication assumée).
  const decalageMoisDebut = commenceIlYA3Mois ? -3 : 0;
  const moisIndexDebutBrut = getAujourdhui().getMonth() + decalageMoisDebut;
  const moisIndexDebut = ((moisIndexDebutBrut % 12) + 12) % 12;
  const anneeDebutFenetre = anneeActuelle + Math.floor(moisIndexDebutBrut / 12);
  const debutMoisActuel = isoDate(anneeDebutFenetre, moisIndexDebut, 1);
  const moisIndexFinBrut = moisIndexDebutBrut + 8;
  const moisIndexFin = ((moisIndexFinBrut % 12) + 12) % 12;
  const anneeFinFenetre = anneeActuelle + Math.floor(moisIndexFinBrut / 12);
  const finFenetre9Mois = ajouterJoursIso(isoDate(anneeFinFenetre, moisIndexFin + 1, 1), -1);
  const rangeActive = { debut: debutMoisActuel, fin: finFenetre9Mois };
  const moisActifs = moisEntre(rangeActive.debut, rangeActive.fin);

  function calendrierPourAnnee(annee: number) {
    if (annee === anneePrecedente) return calendrierAnneePrecedente;
    if (annee === anneeSuivante) return calendrierAnneeB;
    return calendrierAnneeA;
  }

  function anneeVisiblePourCommuns(annee: number): boolean {
    return Boolean(calendrierPourAnnee(annee).parametrage?.valideLe);
  }

  const anneesNonParametrees = (() => {
    const anneeDebut = Number(rangeActive.debut.slice(0, 4));
    const anneeFin = Number(rangeActive.fin.slice(0, 4));
    const annees: number[] = [];
    for (let a = anneeDebut; a <= anneeFin; a++) annees.push(a);
    return annees.filter((a) => !anneeVisiblePourCommuns(a));
  })();

  const joursFeriesToutesAnnees = [...calendrierAnneeA.joursFeries, ...calendrierAnneeB.joursFeries];
  const congesImposesVisibles = [
    ...calendrierAnneeA.congesImposes,
    ...calendrierAnneeB.congesImposes,
  ].filter((c) => anneeVisiblePourCommuns(Number(c.debut.slice(0, 4))));
  const djImposeesVisibles = [
    ...calendrierAnneeA.djImposees,
    ...calendrierAnneeB.djImposees,
  ].filter((d) => anneeVisiblePourCommuns(Number(d.date.slice(0, 4))));
  const typologies = compterTypologies({
    demandes,
    rangeActive,
    congesImposes: congesImposesVisibles,
    djImposees: djImposeesVisibles,
    joursFeries: joursFeriesToutesAnnees,
    joursFeriesPourDuree: joursFeriesToutesAnnees,
  });

  function demandeDuJour(iso: string): DemandeEquipe | undefined {
    return demandes.find(
      (d) =>
        d.statut !== "refusé" &&
        d.statut !== "annulé" &&
        iso >= d.debut &&
        iso <= d.fin &&
        !d.congeImposeId,
    );
  }

  function communDuJour(iso: string): PastilleJour | null {
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    if (cal.joursFeries.some((f) => f.date === iso)) {
      return { classeFond: classeFondTypeBadge("FERIE") };
    }
    if (!anneeVisiblePourCommuns(annee)) return null;
    if (cal.congesImposes.some((c) => iso >= c.debut && iso <= c.fin)) {
      return { classeFond: classeFondTypeBadge("CPI") };
    }
    const dji = cal.djImposees.find((d) => d.date === iso);
    if (dji) {
      return {
        moitie: {
          couleur: "var(--color-cpi)",
          cote: dji.demiJournee === "matin" ? "gauche" : "droite",
        },
      };
    }
    return null;
  }

  // Priorité férié > demande > CPI > DJI, contour orange pour "en attente"
  // seulement (validé = chiffre blanc standard, recentré le 15/09/2026),
  // chevauchement demande/férié/DJI transparent — voir DashboardPage.tsx
  // pour le détail complet de ce correctif (duplication assumée).
  function tipoDuJour(iso: string): PastilleJour | null {
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    if (cal.joursFeries.some((f) => f.date === iso)) {
      return { classeFond: classeFondTypeBadge("FERIE") };
    }

    const demande = demandeDuJour(iso);
    if (demande) {
      const code = codeBadgeDemande(demande);
      let matinCouvert = !(iso === demande.debut && demande.demiDebut === "apres_midi");
      let apresMidiCouvert = !(iso === demande.fin && demande.demiFin === "matin");
      const couleurContour =
        demande.statut === "en attente" ? "var(--color-status-warning-fg)" : undefined;

      const dji = anneeVisiblePourCommuns(annee)
        ? cal.djImposees.find((d) => d.date === iso)
        : undefined;
      if (dji?.demiJournee === "matin") matinCouvert = false;
      if (dji?.demiJournee === "apres_midi") apresMidiCouvert = false;

      if (matinCouvert && apresMidiCouvert) {
        return { classeFond: classeFondTypeBadge(code), couleurContour };
      }

      const couleurDemande = `var(${VAR_COULEUR_TYPE[code]})`;
      if (dji) {
        // Contour "en attente" posé uniquement côté congé, jamais côté DJI
        // (15/09/2026, demande explicite de Vincent) — la moitié DJI n'a
        // aucune notion de validation, un contour sur toute la case le
        // laisserait croire à tort.
        return {
          partage: matinCouvert
            ? { gauche: couleurDemande, droite: "var(--color-dji)", couleurContourGauche: couleurContour }
            : { gauche: "var(--color-dji)", droite: couleurDemande, couleurContourDroite: couleurContour },
        };
      }
      return {
        moitie: { couleur: couleurDemande, cote: matinCouvert ? "gauche" : "droite" },
        couleurContour,
      };
    }
    return communDuJour(iso);
  }

  function estEnGroupe(isoA: string, isoB: string): boolean {
    const demandeA = demandeDuJour(isoA);
    const demandeB = demandeDuJour(isoB);
    if (demandeA || demandeB) return Boolean(demandeA && demandeB && demandeA.id === demandeB.id);

    const annee = Number(isoA.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    const cpiA = cal.congesImposes.find((c) => isoA >= c.debut && isoA <= c.fin);
    const cpiB = cal.congesImposes.find((c) => isoB >= c.debut && isoB <= c.fin);
    return Boolean(cpiA && cpiB && cpiA.id === cpiB.id);
  }

  function occupantDuJour(
    iso: string,
    moitieCliquee?: "gauche" | "droite",
  ): JourCalendrierClique | null {
    const annee = Number(iso.slice(0, 4));
    const cal = calendrierPourAnnee(annee);
    const ferie = cal.joursFeries.find((f) => f.date === iso);
    if (ferie) return { kind: "ferie", ferie };

    const demande = demandeDuJour(iso);
    if (demande) {
      const dji =
        moitieCliquee && anneeVisiblePourCommuns(annee)
          ? cal.djImposees.find((d) => d.date === iso)
          : undefined;
      const demiClique = moitieCliquee === "gauche" ? "matin" : "apres_midi";
      if (dji && dji.demiJournee === demiClique) return { kind: "dji", dji };
      return { kind: "demande", demande };
    }

    if (!anneeVisiblePourCommuns(annee)) return null;
    const cpi = cal.congesImposes.find((c) => iso >= c.debut && iso <= c.fin);
    if (cpi) return { kind: "cpi", cpi };
    const dji = cal.djImposees.find((d) => d.date === iso);
    if (dji) return { kind: "dji", dji };
    return null;
  }

  function handleJourClick(iso: string, ancre: DOMRect, moitieCliquee?: "gauche" | "droite") {
    const jour = occupantDuJour(iso, moitieCliquee);
    if (!jour) return;
    if (jour.kind === "demande") {
      setSnippet(null);
      setJourCommunSelectionne(null);
      setDemandeSelectionnee(jour.demande as DemandeEquipe);
    } else {
      setDemandeSelectionnee(null);
      setJourCommunSelectionne(jour);
      setSnippet(jour.kind === "cpi" ? { jour, ancre } : null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 px-1">
        <SelectCommence actif={commenceIlYA3Mois} onChange={setCommenceIlYA3Mois} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-6">
          {anneesNonParametrees.length > 0 && (
            <p className="text-sm font-normal">
              <span className="text-ink-900 rounded-sm bg-yellow-200 px-1">
                {anneesNonParametrees.length === 1
                  ? `Le calendrier ${anneesNonParametrees[0]} n’est pas encore paramétré par l’administrateur.`
                  : `Les calendriers ${anneesNonParametrees.join(" et ")} ne sont pas paramétrés par l’administrateur.`}
              </span>
            </p>
          )}

          {/* Même gabarit 4 colonnes que DashboardPage.tsx (duplication
              assumée) — voir son commentaire pour le détail du `xl:sticky`
              et du bug `items-start`/`animate-stagger-in` déjà corrigé. */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
              {moisActifs.map(({ annee, moisIndex }) => (
                <MiniCalendrier
                  key={`${annee}-${moisIndex}`}
                  annee={annee}
                  moisIndex={moisIndex}
                  tipoDuJour={tipoDuJour}
                  estEnGroupe={estEnGroupe}
                  onJourClick={handleJourClick}
                  estAujourdhui={(iso) => iso === todayIso}
                  // Même exception que DashboardPage.tsx — un jour déjà
                  // posé garde son chiffre à pleine opacité, seuls les
                  // jours vides passés s'atténuent.
                  estPasse={(iso) => iso < todayIso && !demandeDuJour(iso)}
                  className="h-[290px] w-full"
                  texteJour="text-base"
                  paddingClassName="p-6"
                  classeTitreMois="text-ink-900 text-base"
                />
              ))}
            </div>
            <div className="flex flex-col gap-4">
              {/* `hidden sm:block` (22/09/2026, demande explicite de Vincent —
                  "appliquer ce principe aux éléments similaires de Suivre") :
                  sous `sm:`, ce panneau s'ouvre en popin (voir plus bas)
                  plutôt que de s'empiler sous la grille des mois — même
                  traitement que `DashboardPage.tsx`. */}
              {demandeSelectionnee && (
                <div className="hidden sm:block">
                  <DetailCongePanel
                    key={demandeSelectionnee.id}
                    selection={demandeSelectionnee}
                    onClose={() => setDemandeSelectionnee(null)}
                    onValider={
                      estManager
                        ? (commentaire) => valider(demandeSelectionnee.id, commentaire)
                        : undefined
                    }
                    onRefuser={
                      estManager
                        ? (commentaire) => refuser(demandeSelectionnee.id, commentaire)
                        : undefined
                    }
                    onRetirer={
                      estManager || estAdmin
                        ? (commentaire) => retirer(demandeSelectionnee.id, commentaire)
                        : undefined
                    }
                    peutAnnulerDejaTransmis={estManager || estAdmin}
                    joursFeries={joursFeriesToutesAnnees}
                    congesImposes={congesImposesVisibles}
                    djImposees={djImposeesVisibles}
                    autresDemandes={demandes.filter((d) => d.id !== demandeSelectionnee.id)}
                    lignesTransmission={lignesTransmissionParDemande[demandeSelectionnee.id]}
                  />
                </div>
              )}
              {/* `hidden sm:block` (23/09/2026, demande explicite de
                  Vincent) : même traitement que `DetailCongePanel`
                  ci-dessus, resté oublié sur ce panneau-ci lors du 1er
                  passage. */}
              {jourCommunSelectionne && (
                <div className="hidden sm:block">
                  <DetailJourCommunPanel
                    jour={jourCommunSelectionne}
                    onClose={() => setJourCommunSelectionne(null)}
                  />
                </div>
              )}
              {!demandeSelectionnee && !jourCommunSelectionne && (
                <CompteurTypologies typologies={typologies} vertical />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Popin mobile (22/09/2026) — portail vers `document.body`, `sm:hidden`
          sur le backdrop uniquement : toujours monté, invisible dès `sm:`. */}
      {demandeSelectionnee &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="bg-ink-900/50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8 sm:hidden"
            onClick={() => setDemandeSelectionnee(null)}
          >
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <DetailCongePanel
                key={demandeSelectionnee.id}
                selection={demandeSelectionnee}
                onClose={() => setDemandeSelectionnee(null)}
                onValider={
                  estManager ? (commentaire) => valider(demandeSelectionnee.id, commentaire) : undefined
                }
                onRefuser={
                  estManager ? (commentaire) => refuser(demandeSelectionnee.id, commentaire) : undefined
                }
                onRetirer={
                  estManager || estAdmin
                    ? (commentaire) => retirer(demandeSelectionnee.id, commentaire)
                    : undefined
                }
                peutAnnulerDejaTransmis={estManager || estAdmin}
                joursFeries={joursFeriesToutesAnnees}
                congesImposes={congesImposesVisibles}
                djImposees={djImposeesVisibles}
                autresDemandes={demandes.filter((d) => d.id !== demandeSelectionnee.id)}
                lignesTransmission={lignesTransmissionParDemande[demandeSelectionnee.id]}
                pleineLargeur
              />
            </div>
          </div>,
          document.body,
        )}

      {/* Popin mobile — jour commun (CPI/DJI/Férié, 23/09/2026). */}
      {jourCommunSelectionne &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="bg-ink-900/50 fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8 sm:hidden"
            onClick={() => setJourCommunSelectionne(null)}
          >
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <DetailJourCommunPanel
                jour={jourCommunSelectionne}
                onClose={() => setJourCommunSelectionne(null)}
              />
            </div>
          </div>,
          document.body,
        )}

      {snippet && (
        <SnippetJourCalendrier
          jour={snippet.jour}
          ancre={snippet.ancre}
          joursFeries={joursFeriesToutesAnnees}
          onFermer={() => setSnippet(null)}
        />
      )}
    </div>
  );
}
