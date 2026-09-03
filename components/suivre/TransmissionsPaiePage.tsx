"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Send } from "lucide-react";
import { useCongesATransmettre } from "@/hooks/useCongesATransmettre";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import type { CongeATransmettre, DemandeEquipe, StatutDemande } from "@/lib/types";
import { retirerDemande } from "@/lib/data/demandes.repository";
import {
  calculerJoursATransmettreMaintenant,
  fetchCheckFichesPaie,
  fetchExportPaie,
  fetchLignesTransmissionParDemande,
  genererExportPaie,
} from "@/lib/data/exportsPaie.repository";
import type { LigneExportPaie } from "@/lib/types";
import {
  formatDateAction,
  formatDateHeureAction,
  formatJours,
  formatPeriodePillNumerique,
  renderDureeATransmettre,
} from "@/lib/format";
import {
  LABEL_COURT,
  LABEL_LONG,
  TypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { InputFiltrePill } from "@/components/ui/FiltrePill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { HistoriqueTable } from "@/components/historique/HistoriqueTable";
import { DetailCongePanel } from "@/components/suivre/DetailCongePanel";
import { DetailAjustementPanel } from "@/components/suivre/DetailAjustementPanel";
import { TableauAjustements } from "@/components/suivre/TableauAjustements";
import { fetchAjustementsEquipe, type AjustementEquipe } from "@/lib/data/soldes.repository";
// "Poser pour un collaborateur" mise en suspens (28/08/2026, "simplifier la
// partie admin") — créait une demande déjà `validee` directement, plus
// cohérent avec le pouvoir de validation qu'admin vient de perdre sur
// "Suivre les demandes"/"Suivre les soldes 2". Bouton + modal retirés de
// l'UI (RLS inchangée, `PoserCongePourCollaborateurModal.tsx` reste en
// place) en attendant un futur flux où la demande créée passerait par une
// validation manager plutôt que d'être insérée déjà validée.
// "Vérifier les fiches de paie" originale supprimée (27/08/2026, demande
// explicite — "on va rechallenger cette fonctionnalité écart, donc on ne la
// garde pas telle quelle") : le contrôle ligne par ligne "Écart"/"OK"
// qu'elle portait est remis à plat, pas juste caché. Seule
// `VerifierFichesPaiePage2` reste, point de départ de la refonte.
import { VerifierFichesPaiePage2 } from "@/components/suivre/VerifierFichesPaiePage2";

type Onglet = "transmettre" | "verifier2";

// Codes de type suivis par le récap (25/08/2026) — mêmes 7 codes que le
// sélecteur "Poser pour un collaborateur", CPA dérivé de CP + isAnticipation.
const TYPES_RECAP: TypeBadgeCode[] = ["CP", "RTT", "CPA", "CSS", "CE", "RECUP", "EVT_FAM"];

// Les 3 types "officiels" transmis à la paie (25/08/2026, demande explicite :
// "le 0 est une donnée importante") — toujours affichés dans le bandeau
// sticky sous forme de pastille colorée, même à 0 (contrairement aux autres
// types de `TYPES_RECAP`, qui restent masqués quand ils sont nuls).
const TYPES_PRINCIPAUX: TypeBadgeCode[] = ["CP", "RTT", "CPA"];

function codeRecap(demande: DemandeEquipe): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

// Ordre d'affichage par type au sein d'un même collaborateur (28/08/2026,
// demande explicite) — CP/RTT/CSS/CPA dans cet ordre, puis le reste. Un type
// absent de cette liste (CE/RECUP/EVT_FAM, en pratique jamais présents ici,
// voir `fetchDemandesAvecSoldeTransmission`) part en fin de liste plutôt
// qu'en tête (`indexOf` renvoie -1 sinon).
const ORDRE_TYPE_TRANSMISSION: TypeBadgeCode[] = [
  "CP",
  "RTT",
  "CSS",
  "CPA",
  "CE",
  "RECUP",
  "EVT_FAM",
];

function ordreType(demande: DemandeEquipe): number {
  const index = ORDRE_TYPE_TRANSMISSION.indexOf(codeRecap(demande));
  return index === -1 ? ORDRE_TYPE_TRANSMISSION.length : index;
}

// Chaque section de "Quels congés transmettre" doit lister, par
// collaborateur, ses congés dans l'ordre CP/RTT/CSS/CPA puis le reste
// (28/08/2026, demande explicite) — tri stable : le regroupement par
// collaborateur vient du tri par défaut de `HistoriqueTable`
// (`triParDefaut="collaborateur"`), qui préserve cet ordre au sein d'un
// même collaborateur grâce à la stabilité de `Array.prototype.sort`.
// Générique (28/08/2026) — utilisé aussi bien sur les `CongeATransmettre[]`
// live que sur les `DemandeEquipe[]` figées d'un export déjà transmis.
function trierParCollaborateurPuisType<T extends DemandeEquipe>(demandes: T[]): T[] {
  return [...demandes].sort((a, b) => {
    const nomA = `${a.demandeur.prenom} ${a.demandeur.nom}`;
    const nomB = `${b.demandeur.prenom} ${b.demandeur.nom}`;
    const cmpNom = nomA.localeCompare(nomB);
    if (cmpNom !== 0) return cmpNom;
    return ordreType(a) - ordreType(b);
  });
}

// Port depuis `CongesPaiePage.tsx` (28/08/2026, suppression de l'onglet
// "Générer l'export") — génération du CSV, jusque-là déclenchée via
// `CongesPaiePageHandle.exporter()` sur un composant maintenant retiré.
// Câblée directement ici, sur les données déjà chargées par cet écran
// (`moisEnCours`/`repechage`/`corrections`/`ajustementsFiltres`), sans
// dupliquer un second fetch.
type TypeConsomme = "CP" | "RTT" | "CPA" | "CSS";

const LABEL_TYPE: Record<TypeConsomme, string> = {
  CP: "CP",
  RTT: "RTT",
  CPA: "Congés anticipés",
  CSS: "Congé sans solde",
};

function libellePeriodeDemande(d: DemandeEquipe): string {
  return formatPeriodePillNumerique(d.debut, d.fin);
}

interface DatePeriode {
  id: string;
  label: string;
  statut: StatutDemande;
}

interface LigneCollab {
  nom: string;
  parType: Record<TypeConsomme, { jours: number; dates: DatePeriode[] }>;
}

function ligneVide(): LigneCollab["parType"] {
  return {
    CP: { jours: 0, dates: [] },
    RTT: { jours: 0, dates: [] },
    CPA: { jours: 0, dates: [] },
    CSS: { jours: 0, dates: [] },
  };
}

// Même règle que `CongesPaiePage` d'origine pour les données LIVE : un
// refusé ne compte jamais, un annulé compte seulement si
// `inclureAnnuleDansTotal` (les corrections, dont le total attendu est
// justement la correction négative). `ignorerStatutLive` (28/08/2026,
// "les données qu'un export contient doivent être historisées") : une fois
// un export transmis, son contenu est un fait historique — un congé transmis
// en juillet doit rester compté dans le total de juillet même si son statut
// LIVE est passé à "annulé" depuis (régularisé en août). Sans ça, ce total
// retombait à 0 après coup pour toute demande depuis réannulée, alors que
// `joursPour` (basé sur `joursParDemandeFigee`, propre à CET export) reste
// exact.
function grouperParCollaborateur(
  demandes: DemandeEquipe[],
  joursPour: (d: DemandeEquipe) => number,
  inclureAnnuleDansTotal: boolean,
  ignorerStatutLive = false,
): LigneCollab[] {
  const parId = new Map<string, LigneCollab>();

  for (const d of demandes) {
    const bucket: TypeConsomme =
      d.type === "CP" && d.isAnticipation ? "CPA" : (d.type as TypeConsomme);
    const id = d.demandeur.id;

    if (!parId.has(id)) {
      parId.set(id, { nom: `${d.demandeur.prenom} ${d.demandeur.nom}`, parType: ligneVide() });
    }

    const ligne = parId.get(id)!;
    if (
      ignorerStatutLive ||
      (d.statut !== "refusé" && (inclureAnnuleDansTotal || d.statut !== "annulé"))
    ) {
      ligne.parType[bucket].jours += joursPour(d);
    }
    ligne.parType[bucket].dates.push({
      id: d.id,
      label: libellePeriodeDemande(d),
      statut: d.statut,
    });
  }

  return [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom));
}

function csvLigne(champs: string[]): string {
  return champs.map((valeur) => `"${valeur.replace(/"/g, '""')}"`).join(";");
}

function nomMoisAnnee(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(`${iso}T00:00:00`),
  );
}

// CP/RTT/CSS/CPA puis le reste — même ordre que `ORDRE_TYPE_TRANSMISSION` à
// l'écran, `TypeConsomme` (pas de CE/RECUP/EVT_FAM, hors périmètre du CSV).
const ORDRE_TYPE_CSV: TypeConsomme[] = ["CP", "RTT", "CSS", "CPA"];

/**
 * Un bloc par collaborateur (28/08/2026, demande explicite — "un bloc par
 * collaborateur / liste des CP / liste des RTT / etc") : une ligne avec son
 * seul nom, puis une ligne par type qu'il a effectivement consommé sur cette
 * section (`jours !== 0` — pas de ligne "0" pour un type absent). Une ligne
 * vide sépare chaque collaborateur.
 */
function genererBlocCollaborateurs(lignesCollab: LigneCollab[]): string[] {
  const sortie: string[] = [];
  for (const ligne of lignesCollab) {
    const typesAvecJours = ORDRE_TYPE_CSV.filter((t) => ligne.parType[t].jours !== 0);
    if (typesAvecJours.length === 0) continue;
    sortie.push(csvLigne([ligne.nom]));
    for (const t of typesAvecJours) {
      const c = ligne.parType[t];
      const dates = c.dates.filter((d) => d.statut !== "refusé");
      sortie.push(
        csvLigne([LABEL_TYPE[t], dates.map((d) => d.label).join(", "), formatJours(c.jours)]),
      );
    }
    sortie.push("");
  }
  return sortie;
}

/**
 * CSV structuré en sections — reprend exactement les 3 tableaux de "Quels
 * congés transmettre", chacune en blocs par collaborateur
 * (`genererBlocCollaborateurs`). "Régularisations" garde des colonnes
 * dédiées (Collaborateur/Type/Date/Jours/Motif) — nature différente d'un
 * congé (pas de "dates consommées" à lister).
 */
function genererCsv(
  periode: { debut: string; fin: string },
  sections: { titre: string; lignes: LigneCollab[] }[],
  ajustements: AjustementEquipe[],
): string {
  const corps: string[] = [
    csvLigne([`Export congés ${nomMoisAnnee(periode.debut)}`]),
    csvLigne([
      `Période de prise en compte : ${formatDateAction(periode.debut)} - ${formatDateAction(periode.fin)}`,
    ]),
    "",
  ];

  for (const section of sections) {
    corps.push(csvLigne([section.titre]), "", ...genererBlocCollaborateurs(section.lignes));
  }

  corps.push(csvLigne(["Régularisations"]), "");
  corps.push(csvLigne(["Collaborateur", "Type", "Date", "Jours", "Motif"]));
  const ajustementsTries = [...ajustements].sort(
    (a, b) => a.nomComplet.localeCompare(b.nomComplet) || a.date.localeCompare(b.date),
  );
  for (const a of ajustementsTries) {
    corps.push(
      csvLigne([
        a.nomComplet,
        a.code,
        formatDateAction(a.date),
        formatJours(a.deltaJours),
        a.motif,
      ]),
    );
  }

  return corps.join("\n");
}

/**
 * Totaux "jours transmis par type" — somme, par type, les jours qui
 * partiraient réellement maintenant (`joursParId`, même valeur que la
 * colonne "Transmis"). Alimente les pastilles/le récap du bandeau sticky de
 * "Quels congés transmettre" (25/08/2026, déplacé depuis une carte de la
 * colonne droite — demande explicite : ce récap doit rester visible en
 * permanence, aux côtés du bouton de validation, pas seulement quand rien
 * n'est sélectionné).
 *
 * Exclut les corrections (congés déjà passés en paye puis annulés,
 * 25/08/2026, demande explicite : "on va pas les compter dans le solde
 * CP/RTT/CPA ou autre") — un congé déjà transmis à la paie ne doit plus
 * bouger le total "à transmettre" une fois annulé, ce n'est plus la même
 * opération (une régularisation comptable, pas un envoi normal). Ces
 * corrections ont leur propre total, `totauxCorrectionsParType`.
 */
function totauxParType(
  demandes: DemandeEquipe[],
  joursParId: Record<string, number>,
): Record<TypeBadgeCode, number> {
  const totaux: Record<TypeBadgeCode, number> = {
    CP: 0,
    RTT: 0,
    CPA: 0,
    CSS: 0,
    CE: 0,
    RECUP: 0,
    EVT_FAM: 0,
    DJI: 0,
    CPI: 0,
    FERIE: 0,
  };
  for (const d of demandes) {
    if (d.statut === "annulé") continue;
    totaux[codeRecap(d)] += joursParId[d.id] ?? 0;
  }
  return totaux;
}

/**
 * Totaux "à régulariser" par type — jours déjà transmis à la paie pour des
 * congés annulés depuis (`joursDejaTransmis`, positif), à part des totaux
 * "à transmettre" ci-dessus (25/08/2026, voir doc de `totauxParType`).
 * Affiché en simple phrase sous les pastilles plutôt que mêlé au récap
 * chiffré, pour ne pas laisser croire que ces jours partiraient à nouveau.
 */
function totauxCorrectionsParType(demandes: CongeATransmettre[]): [TypeBadgeCode, number][] {
  const totaux: Partial<Record<TypeBadgeCode, number>> = {};
  for (const d of demandes) {
    if (d.statut !== "annulé") continue;
    const code = codeRecap(d);
    totaux[code] = (totaux[code] ?? 0) + d.joursDejaTransmis;
  }
  return Object.entries(totaux).filter(([, jours]) => jours !== 0) as [TypeBadgeCode, number][];
}

/**
 * Onglet "Quels congés transmettre" (renommé depuis "Récap congé",
 * 24/08/2026) — branché sur `fetchCongesATransmettre` (validés non
 * totalement transmis + annulés à corriger + en attente chevauchant la
 * période), pas `useCongesConsommes` : plus de filtre de date sur les
 * validés/annulés, un congé jamais transmis remonte quel que soit son mois
 * d'origine (bug "congés de période précédente"/"à cheval" corrigé par la
 * notion de solde de transmission, voir BASE-DE-DONNEES.md). Les lignes
 * donnent accès au détail complet (`DetailCongePanel`, action "Annuler
 * cette demande" uniquement — plus de Valider/Refuser/Régulariser sur cet
 * écran, 28/08/2026, cohérent avec le reste de l'app) — largeur du tableau
 * verrouillée via CSS Grid.
 */
function QuelsCongesTransmettre({
  periode,
  exportPaie,
  onTransmis,
}: {
  periode: { debut: string; fin: string };
  exportPaie: { id: string; genereLe: string } | null;
  onTransmis: () => void;
}) {
  const estTransmis = Boolean(exportPaie);
  const [debut, setDebut] = useState(periode.debut);
  const [fin, setFin] = useState(periode.fin);

  // Contenu figé de l'export réel une fois transmis (28/08/2026, bug
  // signalé — "j'ai plus aucune donnée dans le tableau après la valid") :
  // `useCongesATransmettre` liste ce qui RESTE à transmettre, donc plus
  // rien une fois tout envoyé. Porté depuis l'ancien `CongesPaiePage.figeParExport` —
  // une fois `exportPaie` connu, les 3 tableaux/le CSV reflètent exactement
  // `export_paie_lignes` de cet export (`fetchCheckFichesPaie`), plus jamais
  // le backlog live.
  const [demandesFigees, setDemandesFigees] = useState<DemandeEquipe[]>([]);
  const [joursParDemandeFigee, setJoursParDemandeFigee] = useState<Record<string, number>>({});
  const [chargementFige, setChargementFige] = useState(estTransmis);

  const exportPaieId = exportPaie?.id ?? null;
  useEffect(() => {
    if (!exportPaieId) return;
    let cancelled = false;
    fetchCheckFichesPaie(exportPaieId).then((collaborateurs) => {
      if (cancelled) return;
      const demandesVues: DemandeEquipe[] = [];
      const jours: Record<string, number> = {};
      for (const collab of collaborateurs) {
        for (const { ligne, demande } of collab.lignes) {
          demandesVues.push(demande);
          jours[demande.id] = (jours[demande.id] ?? 0) + ligne.joursInclus;
        }
      }
      setDemandesFigees(demandesVues);
      setJoursParDemandeFigee(jours);
      setChargementFige(false);
    });
    return () => {
      cancelled = true;
    };
  }, [exportPaieId]);

  const { demandes, loading, error, refetch } = useCongesATransmettre(debut, fin);
  const demandesPourAffichage = estTransmis ? demandesFigees : demandes;
  const chargementAffiche = estTransmis ? chargementFige : loading;
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const { utilisateur } = useUtilisateur();
  const estAdmin = utilisateur?.role === "admin";
  const [modalOuverte, setModalOuverte] = useState(false);
  const [enCoursTransmission, setEnCoursTransmission] = useState(false);
  const [erreurTransmission, setErreurTransmission] = useState<string | null>(null);

  // Transmet directement depuis cet écran (28/08/2026, "on va s'intéresser
  // au comportement de valider et générer l'export") — même action que le
  // bouton "Transmettre" de l'onglet "Générer l'export" (`genererExportPaie`),
  // court-circuite le détour par cet onglet pour la confirmer ici.
  async function transmettre() {
    setEnCoursTransmission(true);
    setErreurTransmission(null);
    try {
      await genererExportPaie(periode);
      setModalOuverte(false);
      refetch();
      onTransmis();
    } catch (e) {
      setErreurTransmission(
        e instanceof Error ? e.message : "Impossible de transmettre cette période.",
      );
    } finally {
      setEnCoursTransmission(false);
    }
  }
  const [joursATransmettreParId, setJoursATransmettreParId] = useState<Record<string, number>>({});
  const [lignesTransmissionParId, setLignesTransmissionParId] = useState<
    Record<string, LigneExportPaie[]>
  >({});
  const [ajustementsEquipe, setAjustementsEquipe] = useState<AjustementEquipe[]>([]);
  const [selectionAjustementId, setSelectionAjustementId] = useState<string | null>(null);

  // Régularisations manuelles de la période (27/08/2026, "faut prévoir une
  // catégorie régulation aussi") — même principe que `CongesPaiePage`
  // (équipe entière, filtrées côté client sur `debut`/`fin`).
  useEffect(() => {
    let cancelled = false;
    fetchAjustementsEquipe().then((data) => {
      if (!cancelled) setAjustementsEquipe(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Combien de jours partiraient réellement pour chaque ligne si on
  // transmettait maintenant (calcul async, tient compte du découpage sur un
  // congé à cheval) — alimente la colonne Durée (X/Y) et le récap par type.
  // Sans objet une fois transmis (`estTransmis`) — il n'y a plus de "si on
  // transmettait maintenant" à prévisualiser, `joursParDemandeFigee` prend le
  // relais partout ci-dessous.
  useEffect(() => {
    if (estTransmis) return;
    let cancelled = false;
    Promise.all(
      demandes.map(
        async (d) => [d.id, await calculerJoursATransmettreMaintenant(d, periode)] as const,
      ),
    ).then((entrees) => {
      if (!cancelled) setJoursATransmettreParId(Object.fromEntries(entrees));
    });
    return () => {
      cancelled = true;
    };
  }, [demandes, periode, estTransmis]);

  // Lignes de transmission RÉELLES (`export_paie_lignes`, déjà persistées)
  // pour chaque demande — alimente le feed du `DetailCongePanel` ("Transmis
  // le"/"En paye le"/"Écart signalé le", 25/08/2026 : matérialise le passage
  // en paie effectif, distinct de la simple prévision `previsionTransmission`
  // ci-dessous, qui reste toujours affichée en plus, à la fin du feed).
  // Sourcé sur `demandesPourAffichage` (25/08/2026, même principe que
  // `CongesPaiePage.demandesPourFeed`) pour rester correct en mode figé.
  useEffect(() => {
    let cancelled = false;
    fetchLignesTransmissionParDemande(demandesPourAffichage.map((d) => d.id)).then((data) => {
      if (!cancelled) setLignesTransmissionParId(data);
    });
    return () => {
      cancelled = true;
    };
  }, [demandesPourAffichage]);

  const selection = demandesPourAffichage.find((d) => d.id === selectionId) ?? null;
  const ajustementsFiltres = ajustementsEquipe.filter((a) => a.date >= debut && a.date <= fin);
  const ajustementSelectionne =
    ajustementsFiltres.find((a) => a.id === selectionAjustementId) ?? null;

  // Décision/Régularisation retirées de cet écran (28/08/2026, "on va
  // supprimer les blocs régulation et décision pour le remplacer par le
  // bloc qui permet de supprimer un congé") — cohérent avec le reste de
  // l'app : admin ne valide/refuse/régularise plus nulle part, seulement
  // annuler (RLS inchangée, `retirerDemande` déjà générique).
  async function retirer(commentaire: string) {
    if (!selection) return;
    await retirerDemande(selection.id, commentaire);
    refetch();
  }

  // Trois tableaux distincts (25/08/2026, demande explicite) :
  // - "Congés consommés sur la période" : validés/en attente touchant
  //   l'intervalle Du/Au sélectionné.
  // - "Congés consommés non passés sur des périodes précédentes" : validés/
  //   en attente entièrement avant `Du` — le repêchage (jamais transmis,
  //   jamais tranchés).
  // - "Congés passés en paye mais annulés" : demandes annulées après avoir
  //   déjà été transmises (solde de transmission > 0, correction à venir),
  //   à part des deux tableaux ci-dessus plutôt que mélangées dedans.
  // `fetchCongesATransmettre` ne filtre déjà que sur `Au` (pas de borne
  // basse côté requête, c'est tout l'intérêt du repêchage) — `Du` ne sert
  // donc qu'à cette séparation d'affichage, pas à la requête elle-même.
  // Une fois transmis (28/08/2026, bug signalé — "j'ai plus aucune donnée
  // dans le tableau après la valid") : `demandes` (backlog live) est vide
  // par définition (tout a été transmis), donc les 3 tableaux basculent sur
  // le contenu figé de l'export réel (`demandesFigees`), reparti par signe
  // de `joursParDemandeFigee` (négatif = correction) plutôt que par statut
  // live — même principe que l'ancien `CongesPaiePage.figeParExport`.
  const corrections = estTransmis
    ? trierParCollaborateurPuisType(
        demandesFigees.filter((d) => (joursParDemandeFigee[d.id] ?? 0) < 0),
      )
    : trierParCollaborateurPuisType(demandes.filter((d) => d.statut === "annulé"));
  const moisEnCours = estTransmis
    ? trierParCollaborateurPuisType(
        demandesFigees.filter((d) => (joursParDemandeFigee[d.id] ?? 0) >= 0 && d.fin >= debut),
      )
    : trierParCollaborateurPuisType(
        demandes.filter((d) => d.statut !== "annulé" && d.fin >= debut),
      );
  const repechage = estTransmis
    ? trierParCollaborateurPuisType(
        demandesFigees.filter((d) => (joursParDemandeFigee[d.id] ?? 0) >= 0 && d.fin < debut),
      )
    : trierParCollaborateurPuisType(demandes.filter((d) => d.statut !== "annulé" && d.fin < debut));
  const totaux = totauxParType(
    demandesPourAffichage,
    estTransmis ? joursParDemandeFigee : joursATransmettreParId,
  );
  const pillsPrincipales = TYPES_PRINCIPAUX.map(
    (code) => [code, totaux[code]] as [TypeBadgeCode, number],
  );
  const pillsAutres = TYPES_RECAP.filter((code) => !TYPES_PRINCIPAUX.includes(code))
    .map((code) => [code, totaux[code]] as [TypeBadgeCode, number])
    .filter(([, jours]) => jours !== 0);
  // Sans objet une fois transmis : une correction restant à régulariser
  // apparaîtrait déjà comme sa propre ligne négative dans un futur export,
  // pas dans celui-ci (déjà généré).
  const correctionsARegulariser = estTransmis ? [] : totauxCorrectionsParType(demandes);

  // Jours pris en compte pour le CSV (28/08/2026, port depuis
  // `CongesPaiePage`) — avant transmission, la prévision "si on transmettait
  // maintenant" (`joursATransmettreParId`, même valeur que la colonne
  // "Transmis" à l'écran) ; une fois transmis, les jours RÉELLEMENT envoyés
  // (`joursParDemandeFigee`) — sans ce bascule, le CSV exporté après coup
  // afficherait 0 partout (la prévision "maintenant" n'a plus de sens une
  // fois l'export déjà généré).
  function joursPourCsv(d: DemandeEquipe): number {
    if (estTransmis) return joursParDemandeFigee[d.id] ?? 0;
    return joursATransmettreParId[d.id] ?? (d as CongeATransmettre).joursRestants;
  }

  // Colonne Durée une fois transmis (28/08/2026) — `renderDureeATransmettre`
  // s'appuie sur `joursRestants`/`joursDejaTransmis`, propres à
  // `CongeATransmettre` (calculés côté client par `fetchCongesATransmettre`),
  // absents des `DemandeEquipe` figées renvoyées par `fetchCheckFichesPaie`.
  // Le nombre de jours réellement transmis (`joursParDemandeFigee`) suffit
  // ici, plus de "X/Y" à prévisualiser une fois l'export déjà généré.
  function renderDureeFigee(demandeId: string): string {
    return `${formatJours(joursParDemandeFigee[demandeId] ?? 0)} j`;
  }

  function exporter() {
    const csv = genererCsv(
      { debut, fin },
      [
        {
          titre: "Congés consommés sur la période",
          lignes: grouperParCollaborateur(moisEnCours, joursPourCsv, false, estTransmis),
        },
        {
          titre: "Congés consommés non passés sur des périodes précédentes",
          lignes: grouperParCollaborateur(repechage, joursPourCsv, false, estTransmis),
        },
        {
          titre: "Congés passés en paye mais annulés",
          lignes: grouperParCollaborateur(corrections, joursPourCsv, true, estTransmis),
        },
      ],
      ajustementsFiltres,
    );
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conges-paie_${debut}_${fin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,900px)_16rem] xl:gap-x-2.5">
        <div className="flex w-full min-w-0 flex-col gap-5">
          <div className="animate-stagger-in bg-surface-card w-full min-w-0 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <InputFiltrePill
                  type="date"
                  aria-label="Du"
                  value={debut}
                  onChange={(e) => setDebut(e.target.value)}
                  disabled={estTransmis}
                />
                <InputFiltrePill
                  type="date"
                  aria-label="Au"
                  value={fin}
                  onChange={(e) => setFin(e.target.value)}
                  disabled={estTransmis}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-control bg-status-danger-bg text-status-danger-fg mx-4 mb-3 px-3 py-2.5 text-sm">
                {error}
              </div>
            )}

            <div className="border-ink-300/60 border-t px-4 pt-3 pb-1">
              <h2 className="text-ink-900 text-sm font-bold">Congés consommés sur la période</h2>
            </div>
            {chargementAffiche ? (
              <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
            ) : (
              <HistoriqueTable
                demandes={moisEnCours}
                avecCollaborateur
                compact
                onDateClick={(id) => {
                  setSelectionAjustementId(null);
                  setSelectionId(id);
                }}
                selectedId={selectionId}
                renderDuree={(d) =>
                  estTransmis
                    ? renderDureeFigee(d.id)
                    : renderDureeATransmettre(d as CongeATransmettre, joursATransmettreParId[d.id])
                }
                emptyText="Rien à transmettre sur cette période."
                triParDefaut="collaborateur"
                libelleColonneDuree="Transmis"
                lignesTransmissionParDemande={lignesTransmissionParId}
              />
            )}
          </div>

          <div
            className="animate-stagger-in bg-surface-card w-full min-w-0 shadow-sm"
            style={{ animationDelay: "90ms" }}
          >
            <div className="px-4 pt-3 pb-1">
              <h2 className="text-ink-900 text-sm font-bold">
                Congés consommés non passés sur des périodes précédentes
              </h2>
            </div>
            <div className="border-ink-300/60 border-t">
              {chargementAffiche ? (
                <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
              ) : (
                <HistoriqueTable
                  demandes={repechage}
                  avecCollaborateur
                  compact
                  onDateClick={(id) => {
                    setSelectionAjustementId(null);
                    setSelectionId(id);
                  }}
                  selectedId={selectionId}
                  renderDuree={(d) =>
                    estTransmis
                      ? renderDureeFigee(d.id)
                      : renderDureeATransmettre(
                          d as CongeATransmettre,
                          joursATransmettreParId[d.id],
                        )
                  }
                  emptyText="Aucun congé en repêchage."
                  triParDefaut="collaborateur"
                  libelleColonneDuree="Transmis"
                  lignesTransmissionParDemande={lignesTransmissionParId}
                />
              )}
            </div>
          </div>

          <div
            className="animate-stagger-in bg-surface-card w-full min-w-0 shadow-sm"
            style={{ animationDelay: "180ms" }}
          >
            <div className="px-4 pt-3 pb-1">
              <h2 className="text-ink-900 text-sm font-bold">Congés passés en paye mais annulés</h2>
            </div>
            <div className="border-ink-300/60 border-t">
              {chargementAffiche ? (
                <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
              ) : (
                <HistoriqueTable
                  demandes={corrections}
                  avecCollaborateur
                  compact
                  onDateClick={(id) => {
                    setSelectionAjustementId(null);
                    setSelectionId(id);
                  }}
                  selectedId={selectionId}
                  renderDuree={(d) =>
                    estTransmis
                      ? renderDureeFigee(d.id)
                      : renderDureeATransmettre(
                          d as CongeATransmettre,
                          joursATransmettreParId[d.id],
                        )
                  }
                  emptyText="Aucune correction à transmettre."
                  triParDefaut="collaborateur"
                  libelleColonneDuree="Transmis"
                  lignesTransmissionParDemande={lignesTransmissionParId}
                />
              )}
            </div>
          </div>

          <div
            className="animate-stagger-in bg-surface-card w-full min-w-0 shadow-sm"
            style={{ animationDelay: "270ms" }}
          >
            <div className="px-4 pt-3 pb-1">
              <h2 className="text-ink-900 text-sm font-bold">Régularisations</h2>
            </div>
            <div className="border-ink-300/60 border-t">
              <TableauAjustements
                ajustements={ajustementsFiltres}
                selectionId={selectionAjustementId}
                onSelect={(id) => {
                  setSelectionId(null);
                  setSelectionAjustementId(id);
                }}
              />
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
            onClose={() => setSelectionAjustementId(null)}
          />
        )}

        {selection && (
          <div className="flex flex-col gap-3">
            <DetailCongePanel
              key={selection.id}
              selection={selection}
              onClose={() => setSelectionId(null)}
              onRetirer={estTransmis ? undefined : retirer}
              peutAnnulerDejaTransmis={estAdmin}
              libelleRetirer="Annuler ce congé"
              texteRetirer="Ce congé n'a pas été pris par le collaborateur"
              lignesTransmission={lignesTransmissionParId[selection.id]}
            />
          </div>
        )}
      </div>

      {/* Bandeau sticky (25/08/2026, demande explicite) — porte le récap
          "jours transmis par type" (toujours visible, plus seulement quand
          rien n'est sélectionné) et le bouton de validation, qui bascule sur
          l'onglet "Générer l'export" plutôt que de transmettre directement
          depuis cet onglet (décision actée : garder l'action réelle
          "Transmettre" à un seul endroit). Les 3 types officiels (CP/RTT/CPA,
          25/08/2026) s'affichent en pastille colorée (`TypeBadge` variant
          "pill", même format que la colonne Solde de "Suivre les soldes")
          et restent visibles même à 0 — "le 0 est une donnée importante"
          (Vincent). Les autres types (CSS/CE/RECUP/EVT_FAM) gardent le rendu
          texte existant, masqués quand nuls (cas plus rares). Les corrections
          (congés déjà passés en paye puis annulés) n'entrent plus dans ces
          totaux (25/08/2026, demande explicite) — une simple phrase dédiée
          ("X j de {type} à régulariser") apparaît sous les pastilles quand
          il y en a, pour ne pas laisser croire que ces jours repartiraient
          normalement. */}
      <div className="bg-surface-card border-ink-300/60 sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border-t px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-end gap-4">
            {pillsPrincipales.map(([code, jours]) => (
              <div key={code} className="flex flex-col items-center gap-1">
                <span className="text-ink-500 text-[10px] font-semibold">{LABEL_COURT[code]}</span>
                <TypeBadge code={code} variant="pill" label={`${formatJours(jours)} j`} />
              </div>
            ))}
            {pillsAutres.map(([code, jours]) => (
              <span key={code} className="flex items-center gap-1.5 text-sm">
                <span className="text-ink-500">{LABEL_LONG[code]}</span>
                <span className="text-ink-900 font-semibold">{formatJours(jours)} j</span>
              </span>
            ))}
          </div>
          {correctionsARegulariser.length > 0 && (
            <p className="text-ink-500 text-xs">
              {correctionsARegulariser.map(([code, jours], i) => (
                <span key={code}>
                  {i > 0 && " · "}
                  <span className="text-ink-900 font-semibold">{formatJours(jours)} j</span> de{" "}
                  {LABEL_LONG[code]} à régulariser
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={exporter}
            className="text-slate hover:text-slate/80 text-sm font-semibold underline"
          >
            Exporter (CSV)
          </button>
          <Button
            onClick={() => setModalOuverte(true)}
            disabled={estTransmis}
            className="rounded-full px-5 py-2.5 text-sm"
          >
            <Send size={16} />
            Valider et générer l&rsquo;export
          </Button>
        </div>
      </div>

      {modalOuverte && (
        <Modal title="Transmettre ces données" onClose={() => setModalOuverte(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-ink-700 text-sm">
              Confirmez-vous que vous allez envoyer ces données à la paie ? L&apos;historique sera
              consultable dans Apidays.
            </p>
            {erreurTransmission && (
              <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
                {erreurTransmission}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setModalOuverte(false)}
                className="rounded-full px-4 py-2 text-sm"
              >
                Annuler
              </Button>
              <Button
                onClick={transmettre}
                disabled={enCoursTransmission}
                className="rounded-full px-4 py-2 text-sm"
              >
                Confirmer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * "Transmissions paie" (`/suivre/transmissions-paie/[debut]`, 24/08/2026, restructuré en
 * 3 onglets le même jour) — nouvelle section Suivre, remplace l'ancien écran
 * "Export paie" (`/suivre/paie`, supprimé le 25/08/2026 une fois ce parcours
 * jugé complet). Toujours ouverte sur une période précise (`periode`, choisie
 * sur la page liste `/suivre/transmissions-paie`).
 * - **Quels congés transmettre** : revue avant transmission — porte aussi
 *   l'action "Transmettre" elle-même depuis le 28/08/2026 (ancien onglet
 *   "Générer l'export" supprimé, jugé redondant — "juste une mise en page
 *   différente de ce qui se passe ici").
 * - **Vérifier les fiches de paie** : check du retour comptable, désactivé
 *   tant qu'aucun export n'existe pour cette période.
 */
export function TransmissionsPaiePage({
  periode,
  titre,
}: {
  periode: { debut: string; fin: string };
  titre: string;
}) {
  const [onglet, setOnglet] = useState<Onglet>("transmettre");
  const [exportPaie, setExportPaie] = useState<{ id: string; genereLe: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchExportPaie(periode).then((data) => {
      if (!cancelled) setExportPaie(data);
    });
    return () => {
      cancelled = true;
    };
  }, [periode]);

  function rafraichirExport() {
    fetchExportPaie(periode).then(setExportPaie);
  }

  const onglets: { id: Onglet; label: string }[] = [
    { id: "transmettre", label: "Quels congés transmettre" },
    { id: "verifier2", label: "Vérifier les fiches de paie 2" },
  ];

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0">
      <Link
        href="/suivre/transmissions-paie"
        className="text-ink-500 hover:text-ink-900 animate-stagger-in flex w-fit items-center gap-1 px-1 text-sm font-semibold"
      >
        <ChevronLeft size={16} />
        Transmissions paie
      </Link>

      <h1
        className="text-abeil-navy animate-stagger-in px-1 text-2xl font-semibold"
        style={{ animationDelay: "60ms" }}
      >
        {titre}
      </h1>

      <div
        className="animate-stagger-in flex flex-wrap items-center gap-2 px-1"
        style={{ animationDelay: "120ms" }}
      >
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOnglet(o.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
              onglet === o.id
                ? "bg-slate/90 hover:bg-slate text-white"
                : "border-slate text-slate hover:bg-slate/10 border bg-transparent"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Bandeau sous les onglets (28/08/2026, réservé à "Quels congés
          transmettre" — n'a pas de sens sur "Vérifier les fiches de paie",
          qui n'affiche de toute façon rien tant qu'aucun export n'existe). */}
      {onglet === "transmettre" && exportPaie && (
        <div className="bg-status-success-bg text-status-success-fg rounded-control mx-1 px-4 py-2.5 text-sm font-semibold">
          Transmis le {formatDateHeureAction(exportPaie.genereLe)}
        </div>
      )}

      {onglet === "transmettre" && (
        <QuelsCongesTransmettre
          periode={periode}
          exportPaie={exportPaie}
          onTransmis={rafraichirExport}
        />
      )}
      {onglet === "verifier2" && (
        <VerifierFichesPaiePage2 exportId={exportPaie?.id ?? null} periode={periode} />
      )}
    </div>
  );
}
