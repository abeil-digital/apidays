"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sheet, Trash2, type LucideIcon } from "lucide-react";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandes } from "@/hooks/useDemandes";
import { formatJourMois, formatJours, todayISO } from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { ListCard } from "@/components/ui/ListCard";
import { MOIS_FR } from "@/components/ui/MiniCalendrier";
import { PeriodeAvecPastilles } from "@/components/ui/PeriodeAvecPastilles";
import { STATUT_CONFIG } from "@/components/ui/StatusBadge";
import { Toast } from "@/components/ui/Toast";
import {
  LABEL_COURT,
  classeFondTypeBadge,
  type TypeBadgeCode,
} from "@/components/demandes/TypeBadge";
import { dureeCongeImpose } from "@/lib/joursFeries";
import type { CongeImpose, Demande, DemiJournee, DjImposee, JourFerie } from "@/lib/types";

const TEXTE_VIDE = "Aucun jour off à venir.";

// Nom de la variable CSS du token couleur du type — même procédé `color-mix`
// que les compteurs de solde (`SoldeCard.tsx`, `VAR_COULEUR_TONE`, 12%),
// mais à 3% ici (20/08/2026 — 12% puis 6% jugés trop marqués, préférence
// pour une suggestion très subtile) pour teinter légèrement le fond de
// chaque card jour selon son type. Couvre tous les `TypeBadgeCode`
// (`SoldeCard` ne couvre que CP/RTT/CPA).
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

interface JourOff {
  id: string;
  debut: string;
  fin: string;
  demiDebut: DemiJournee;
  demiFin: DemiJournee;
  code: TypeBadgeCode;
  jours: number;
  tone: BadgeTone;
  // `null` pour CPI/DJI/FERIE — verts (tone) comme une demande validée, mais
  // sans le picto de validation (ce n'est pas un événement de décision).
  Icon: LucideIcon | null;
}

// Badge local "cercle" (20/08/2026, scopé à cette page) : même remplissage
// plein et même taille (36px) que `TypeBadge` (variant "circle" par défaut,
// fond couleur du type + texte blanc — 27px/25% réduit puis contour/
// transparent testés, tous deux annulés le même jour, retour à l'original).
// Badge dédié plutôt qu'une prop sur `TypeBadge.tsx` (qui reste utilisé
// ailleurs, ex. légende/`SuiviDemandeRow`) pour ne pas changer un composant
// partagé. Sert aussi pour "CI" (label custom, cf. bug `TypeBadge` qui
// ignore `label` en variant "circle" — seuls "outline"/"pill" le
// respectent).
function BadgeTypeLeger({ code, label }: { code: TypeBadgeCode; label?: string }) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${classeFondTypeBadge(code)}`}
    >
      {label ?? LABEL_COURT[code]}
    </div>
  );
}

function codeBadgeDemande(demande: Demande): TypeBadgeCode {
  return demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
}

/**
 * Card "Prochains jours off" (16/08/2026, Accueil2, essai) — même format 1/3
 * largeur que les autres encarts de la ligne. Chaque ligne : `BadgeTypeLeger`
 * cerclé (allégé, 20/08/2026 — contour + texte colorés, fond transparent)
 * + `PeriodeAvecPastilles` + `Badge` (icône `STATUT_CONFIG` + nombre de
 * jours) — mêmes composants, mêmes classes/tailles que `SuiviDemandeRow`
 * (le feed "Demandes à traiter" de `SuivrePage`) pour son bloc période/durée.
 * CI/FERIE (pas de vrai statut) : vert comme "validé" (même tone), mais sans
 * icône — ce n'est pas un événement de décision. Pas de titre propre
 * (20/08/2026 — retiré : "Mon Calendrier", déplacé au-dessus des deux
 * colonnes le même jour, sert désormais de titre commun aux deux ; avant
 * ça, un titre statique "Prochains jours off" avait déjà remplacé le
 * sélecteur de vue "Prochains jours off"/"En attente de validation").
 * Chaque jour off est sa propre card (20/08/2026 — indépendantes les unes
 * des autres, plutôt qu'une liste dans une card unique avec des
 * séparateurs `border-b`), empilées avec un léger espace de 3px
 * (`gap-[3px]`) qui fait office de fine bordure entre chaque card. Coins
 * légèrement arrondis (`rounded-sm`, plus discret que `rounded-card` de
 * `ListCard`) et `shadow-sm` pour détacher chaque card visuellement. CPI et
 * DJI fusionnés sous la
 * notion "CI" — Congés Imposés
 * (20/08/2026, scopé à Accueil uniquement) : même couleur (celle de CPI),
 * même libellé "CI", la distinction CPI/DJI restant pertinente côté
 * paramétrage Delphine mais pas jugée utile pour le collaborateur ici.
 * Jours non travaillés à venir : demandes perso validées ET en attente de
 * validation (20/08/2026 — les "en attente" étaient exclues à l'origine,
 * réintégrées à la demande explicite ; `STATUT_CONFIG["en attente"]` donne
 * le badge sablier/orange qui les distingue visuellement des validées), CI
 * (CPI + DJI), jours fériés (FERIE). Données chargées sur année en cours +
 * année suivante (pour ne pas couper la liste fin décembre), mais la liste
 * elle-même est bornée par `finPeriode` (20/08/2026 — le filtre onglets de
 * "Mon Calendrier" chapote aussi cette liste, demande explicite). Liste
 * intégrale sous cette borne (sans plafond de nombre de lignes, 20/08/2026),
 * triée par date.
 * `jourSurligne` (20/08/2026) — clic sur un jour du calendrier côté
 * `Dashboard2Page` : fait défiler la liste (interne, `overflow-y-auto`)
 * jusqu'à la card correspondante et la surligne brièvement (le parent efface
 * `jourSurligne` après un court délai, ce qui fait disparaître le surlignage
 * via la transition CSS plutôt qu'un minuteur local ici).
 * `finPeriode`/`debutPeriode` (20/08/2026, demande explicite) — le filtre de
 * "Mon Calendrier" (onglets Année en cours / Période de référence CP /
 * Année suivante) chapote aussi cette liste : bornes de la période active
 * (`rangeActive` côté `Dashboard2Page`). `debutPeriode` est nécessaire
 * (pas seulement `finPeriode`) : pour l'onglet "Année suivante", le début
 * de période est dans le FUTUR (1er janvier de l'année suivante), donc sans
 * cette borne basse les jours de l'année en cours restent affichés (ils
 * passent déjà le filtre "à venir", `j.fin >= today`). Sans ces props,
 * aucun filtre de période (comportement d'origine).
 */
interface ProchainsJoursOffCardProps {
  jourSurligne?: string | null;
  debutPeriode?: string;
  finPeriode?: string;
  /** Masque les demandes personnelles de l'utilisateur courant et le lien
   * "Gérer mes demandes" (21/08/2026) — pour un usage côté paramétrage
   * Calendrier (`/parametrer/calendrier3`) où seules les données de
   * paramétrage (CPI/DJI/Fériés) ont du sens, pas les congés perso de
   * l'admin connecté. Défaut : comportement inchangé (demandes incluses). */
  masquerDemandesPerso?: boolean;
  /** Distingue CPI et DJI (21/08/2026) au lieu de les fusionner sous "CI" —
   * pour le contexte paramétrage Calendrier, où la distinction reste
   * pertinente (contrairement à l'usage collaborateur d'origine). Défaut :
   * comportement inchangé (fusion "CI"). */
  separerCpiDji?: boolean;
  /** Filtre la liste à un seul code (21/08/2026) — ex. "DJI" pour ne montrer
   * que les demi-journées imposées. `undefined`/absent : liste complète
   * (comportement inchangé). */
  filtreCode?: TypeBadgeCode;
  /** Affiche une poubelle au survol des lignes CPI/DJI, pour les supprimer
   * directement depuis la liste (21/08/2026) — scopé au contexte
   * paramétrage Calendrier, jamais affiché côté collaborateur (qui ne gère
   * pas ces entrées). Défaut : pas de suppression possible depuis la liste. */
  avecSuppression?: boolean;
  /** Retire le filtre "à venir" (`fin >= aujourd'hui`) et le masquage de
   * l'année suivante tant qu'elle n'est pas publiée (22/08/2026) — pour un
   * tiroir de paramétrage (ex. clic sur la pill DJI de la légende
   * `/parametrer/calendrier2`) qui doit montrer TOUT ce qui est paramétré
   * pour l'année demandée (`debutPeriode`/`finPeriode`), passé ou futur,
   * publié ou non — Delphine gère ses propres entrées avant publication.
   * Défaut : comportement inchangé (liste "à venir" uniquement). */
  toutAfficher?: boolean;
  /** Injecte les données CPI/DJI/Fériés (et leurs suppressions) d'une année
   * précise depuis l'instance `useCalendrier` déjà en place chez l'appelant
   * (22/08/2026) — remplace complètement le double-fetch interne
   * (`calActuel`/`calSuivant`) plutôt que de le compléter, pour un tiroir de
   * paramétrage Calendrier (`/parametrer/calendrier2`) qui doit rester en
   * phase avec la grille/les pills de légende, qui lisent cette même
   * instance. Sans ce prop, l'ancien comportement (fetch interne
   * indépendant) est inchangé — mais deux instances distinctes ne se
   * notifient pas entre elles : supprimer depuis une liste qui fait son
   * propre fetch laisse la grille et les pills d'une AUTRE instance
   * périmées jusqu'au rechargement (bug constaté 22/08/2026). */
  donneesInjectees?: {
    congesImposes: CongeImpose[];
    djImposees: DjImposee[];
    joursFeries: JourFerie[];
    supprimerConge: (id: string) => Promise<void>;
    supprimerDj: (id: string) => Promise<void>;
    ajouterConge: (input: {
      debut: string;
      fin: string;
      demiDebut: DemiJournee;
      demiFin: DemiJournee;
    }) => Promise<CongeImpose>;
    ajouterDj: (input: { date: string; demiJournee: DemiJournee }) => Promise<DjImposee>;
  };
}

export function ProchainsJoursOffCard({
  jourSurligne,
  debutPeriode,
  finPeriode,
  masquerDemandesPerso = false,
  separerCpiDji = false,
  filtreCode,
  avecSuppression = false,
  toutAfficher = false,
  donneesInjectees,
}: ProchainsJoursOffCardProps = {}) {
  const anneeActuelle = new Date().getFullYear();
  const calActuel = useCalendrier(anneeActuelle);
  const calSuivant = useCalendrier(anneeActuelle + 1);
  const { demandes, loading: loadingDemandes } = useDemandes();
  const lignesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null);
  // Confirmation a posteriori de la suppression (22/08/2026) — toaster plutôt
  // qu'une popup bloquante, y compris pour l'échec (le jour reste alors dans
  // la liste, seule l'erreur diffère du succès). "Annuler" (undo) recrée
  // l'entrée avec les mêmes données — un nouvel id, pas une restauration de
  // l'ancien, suffisant fonctionnellement.
  const [toastSuppression, setToastSuppression] = useState<{
    message: string;
    tone: "success" | "error";
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Supprime un CPI/DJI directement depuis la liste (21/08/2026) — utilise
  // l'instance `useCalendrier` de l'année réelle de l'entrée (courante ou
  // suivante), pas un id fixe, pour que la liste (dérivée de ce même état)
  // se mette à jour immédiatement.
  async function handleSupprimer(j: JourOff) {
    setSuppressionEnCours(j.id);
    const libelleJour = `${j.code === "CPI" && j.debut !== j.fin ? "la période du " : "le "}${formatJourMois(j.debut, true)}${j.code === "CPI" && j.debut !== j.fin ? ` au ${formatJourMois(j.fin, true)}` : ""}`;
    const cal = Number(j.debut.slice(0, 4)) === anneeActuelle ? calActuel : calSuivant;
    const ajouterConge = donneesInjectees ? donneesInjectees.ajouterConge : cal.ajouterConge;
    const ajouterDj = donneesInjectees ? donneesInjectees.ajouterDj : cal.ajouterDj;

    async function handleAnnuler() {
      try {
        if (j.code === "CPI") {
          await ajouterConge({
            debut: j.debut,
            fin: j.fin,
            demiDebut: j.demiDebut,
            demiFin: j.demiFin,
          });
        } else if (j.code === "DJI") {
          await ajouterDj({ date: j.debut, demiJournee: j.demiDebut });
        }
        setToastSuppression({ message: `Suppression annulée.`, tone: "success" });
      } catch {
        setToastSuppression({ message: `Impossible d'annuler la suppression.`, tone: "error" });
      }
    }

    try {
      if (donneesInjectees) {
        if (j.code === "CPI") await donneesInjectees.supprimerConge(j.id);
        else if (j.code === "DJI") await donneesInjectees.supprimerDj(j.id);
      } else {
        if (j.code === "CPI") await cal.supprimerConge(j.id);
        else if (j.code === "DJI") await cal.supprimerDj(j.id);
      }
      setToastSuppression({
        message: `Vous avez supprimé ${libelleJour}.`,
        tone: "success",
        actionLabel: "Annuler",
        onAction: handleAnnuler,
      });
    } catch {
      setToastSuppression({ message: `Impossible de supprimer ${libelleJour}.`, tone: "error" });
    } finally {
      setSuppressionEnCours(null);
    }
  }

  const chargement = donneesInjectees
    ? loadingDemandes
    : calActuel.loading || calSuivant.loading || loadingDemandes;

  // CI/DJI de l'année suivante masqués tant que son calendrier n'est pas
  // publié (20/08/2026, demande explicite — même garde que
  // `anneeVisiblePourCommuns` côté `Dashboard2Page`/grille de calendrier) :
  // `useCalendrier` charge ces données dès qu'un paramétrage existe, même en
  // brouillon (`valideLe` null), donc sans ce filtre un CI en brouillon
  // apparaissait déjà dans cette liste — y compris pour Delphine (admin), qui
  // ne doit pas non plus voir un brouillon non publié ici. L'année en cours
  // reste toujours visible. Les fériés restent affichés dans tous les cas
  // (faits légaux fixes, connus à l'avance — même convention qu'ailleurs).
  const anneeSuivanteVisible = toutAfficher || Boolean(calSuivant.parametrage?.valideLe);

  const today = todayISO();
  const joursFeriesToutesAnnees: JourFerie[] = donneesInjectees
    ? donneesInjectees.joursFeries
    : [...calActuel.joursFeries, ...calSuivant.joursFeries];
  const congesImposesTous = donneesInjectees
    ? donneesInjectees.congesImposes
    : [...calActuel.congesImposes, ...(anneeSuivanteVisible ? calSuivant.congesImposes : [])];
  const djImposeesTous = donneesInjectees
    ? donneesInjectees.djImposees
    : [...calActuel.djImposees, ...(anneeSuivanteVisible ? calSuivant.djImposees : [])];

  const demandesPerso = (masquerDemandesPerso ? [] : demandes)
    .filter((d) => (d.statut === "validé" || d.statut === "en attente") && d.fin >= today)
    .map((d) => ({
      id: d.id,
      debut: d.debut,
      fin: d.fin,
      demiDebut: d.demiDebut,
      demiFin: d.demiFin,
      code: codeBadgeDemande(d),
      jours: d.nbDemiJournees / 2,
      tone: STATUT_CONFIG[d.statut].tone,
      Icon: STATUT_CONFIG[d.statut].Icon,
    }));

  const jours: JourOff[] = [
    ...demandesPerso,
    ...joursFeriesToutesAnnees.map((f) => ({
      id: f.id,
      debut: f.date,
      fin: f.date,
      demiDebut: "matin" as const,
      demiFin: "apres_midi" as const,
      code: "FERIE" as const,
      jours: 1,
      tone: "success" as BadgeTone,
      Icon: null,
    })),
    // CPI et DJI fusionnés sous la notion "CI" (Congés Imposés, 20/08/2026,
    // scopé à Accueil) — même `code: "CPI"` pour les deux (couleur commune),
    // libellé "CI" affiché au rendu (voir `BadgeTypeLeger label="CI"` plus bas).
    // La distinction CPI/DJI reste pertinente côté paramétrage Delphine,
    // pas jugée utile ici pour le collaborateur.
    ...congesImposesTous.map((c) => ({
      id: c.id,
      debut: c.debut,
      fin: c.fin,
      demiDebut: "matin" as const,
      demiFin: "apres_midi" as const,
      code: "CPI" as const,
      jours: dureeCongeImpose(c, joursFeriesToutesAnnees),
      tone: "success" as BadgeTone,
      Icon: null,
    })),
    ...djImposeesTous.map((d) => ({
      id: d.id,
      debut: d.date,
      fin: d.date,
      demiDebut: d.demiJournee,
      demiFin: d.demiJournee,
      code: (separerCpiDji ? "DJI" : "CPI") as TypeBadgeCode,
      jours: 0.5,
      tone: "success" as BadgeTone,
      Icon: null,
    })),
  ];

  const prochains = jours
    .filter(
      (j) =>
        (toutAfficher || j.fin >= today) &&
        (!finPeriode || j.debut <= finPeriode) &&
        (!debutPeriode || j.fin >= debutPeriode) &&
        (!filtreCode || j.code === filtreCode),
    )
    .sort((a, b) => a.debut.localeCompare(b.debut));

  const idSurligne = jourSurligne
    ? prochains.find((j) => jourSurligne >= j.debut && jourSurligne <= j.fin)?.id
    : undefined;

  useEffect(() => {
    if (!idSurligne) return;
    lignesRef.current.get(idSurligne)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [idSurligne]);

  return (
    <div className="flex h-full w-full flex-col lg:max-w-[300px] lg:shrink-0">
      {chargement ? (
        <ListCard>
          <div className="text-ink-500 py-8 text-center text-sm">Chargement…</div>
        </ListCard>
      ) : prochains.length === 0 ? (
        <ListCard>
          <EmptyRow text={TEXTE_VIDE} />
        </ListCard>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto">
          {prochains.map((j, i) => {
            const cleMois = j.debut.slice(0, 7);
            const changeDeMois = i === 0 || prochains[i - 1].debut.slice(0, 7) !== cleMois;
            const [annee, mois] = cleMois.split("-").map(Number);
            return (
              <div key={j.id}>
                {changeDeMois && (
                  <div
                    className={`text-ink-500 px-1 pb-1 text-[11px] font-semibold uppercase ${i === 0 ? "" : "pt-6"}`}
                  >
                    {`${MOIS_FR[mois - 1]} ${annee}`}
                  </div>
                )}
                <div
                  ref={(el) => {
                    if (el) lignesRef.current.set(j.id, el);
                    else lignesRef.current.delete(j.id);
                  }}
                  className={`bg-surface-card group flex items-center gap-3 rounded-sm px-[14.4px] py-3 transition-shadow duration-500 ${
                    j.id === idSurligne ? "ring-2" : ""
                  }`}
                  style={
                    {
                      "--tw-ring-color": `var(${VAR_COULEUR_TYPE[j.code]})`,
                    } as React.CSSProperties
                  }
                >
                  <BadgeTypeLeger
                    code={j.code}
                    label={j.code === "CPI" && !separerCpiDji ? "CI" : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <PeriodeAvecPastilles
                      debut={j.debut}
                      fin={j.fin}
                      demiDebut={j.demiDebut}
                      demiFin={j.demiFin}
                      compact
                    />
                  </div>
                  {/* Poubelle en sur-impression (21/08/2026) — plutôt qu'un
                      bouton en plus dans la ligne (qui réservait sa place et
                      compressait le reste), la poubelle occupe exactement la
                      même position que le badge "N j" : `relative`/`absolute
                      inset-0`, crossfade au survol (le badge s'efface, la
                      poubelle apparaît), aucun décalage de mise en page. */}
                  <span className="relative origin-right scale-90">
                    <Badge
                      tone={j.tone}
                      className={
                        avecSuppression && (j.code === "CPI" || j.code === "DJI")
                          ? "transition-opacity duration-150 group-hover:opacity-0"
                          : ""
                      }
                    >
                      {j.Icon && <j.Icon size={12} strokeWidth={2.5} />}
                      <span className="text-[14.4px]">{formatJours(j.jours)} j</span>
                    </Badge>
                    {avecSuppression && (j.code === "CPI" || j.code === "DJI") && (
                      <button
                        type="button"
                        onClick={() => handleSupprimer(j)}
                        disabled={suppressionEnCours === j.id}
                        aria-label="Supprimer"
                        className="text-status-danger-fg absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
          {/* Lien "Gérer mes demandes" (21/08/2026, demande explicite) — sticky
              en bas de la zone scrollable (pas de la card entière), toujours
              visible pendant le défilement de la liste. Fond opaque
              (`bg-surface-app`, celui de la page) nécessaire : sans lui, le
              contenu qui défile serait visible par transparence sous le
              lien. */}
          {!masquerDemandesPerso && (
            <Link
              href="/historique"
              className="bg-surface-app text-mint hover:text-mint-hover sticky bottom-0 flex items-center gap-2 px-1 py-3 text-sm font-semibold transition-colors"
            >
              <Sheet size={16} />
              Gérer mes demandes
            </Link>
          )}
        </div>
      )}

      {toastSuppression && (
        <Toast
          message={toastSuppression.message}
          tone={toastSuppression.tone}
          actionLabel={toastSuppression.actionLabel}
          onAction={toastSuppression.onAction}
          onClose={() => setToastSuppression(null)}
        />
      )}
    </div>
  );
}
