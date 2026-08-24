"use client";

import { useState } from "react";
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
 * Fond "pas vraiment blanc" signalé à plusieurs reprises (21/08/2026 puis
 * 24/08/2026) malgré un `background-color` vérifié pur `#ffffff` en
 * inspection (`bg-surface-card`, aucun `box-shadow`/`opacity`/`color-mix`
 * trouvé en cause à quelque niveau de la hiérarchie, vérifié jusqu'à la
 * racine de page). Plusieurs pistes testées le 24/08/2026 — bordure
 * `border-ink-300/40`, gap élargi à 8px, `rounded-xl`/`shadow-sm` calqué sur
 * les cards `MiniCalendrier` — **aucune n'a changé quoi que ce soit au
 * rendu perçu par Vincent**, toutes annulées, retour à l'habillage
 * d'origine (`rounded-sm`, `gap-[3px]`, pas de bordure/ombre). Un test de
 * diagnostic (fond temporairement rouge vif) faisait suspecter la variante
 * `lab()` grand-gamut de `--color-red-500` (Tailwind v4, écrans P3) — mais
 * ce mécanisme ne s'applique pas à `--color-surface-card` (`#fff` unique,
 * aucune variante `lab()`/`oklch()` dans le CSS compilé), donc sans lien
 * avéré avec ce fond blanc. **Cause toujours non identifiée** — l'écart de
 * rendu ne se vérifie pas de façon fiable dans cet environnement automatisé
 * (même limite que le halo de focus de `SelectPille`), un vrai retour
 * visuel humain reste nécessaire avant de retenter quoi que ce soit ici.
 * Le surlignage/scroll auto vers la card d'un jour cliqué sur le calendrier
 * (`jourSurligne`, introduit le 20/08/2026) a été retiré le 24/08/2026 —
 * décision explicite de supprimer l'interaction entre le clic sur le
 * calendrier et cette liste, au profit d'un overlay unique (voir
 * `SnippetJourCalendrier`, `Dashboard2Page`/`CalendrierCollaborateur`).
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
  /** Consulter les jours off d'un AUTRE collaborateur plutôt que ceux de
   * l'utilisateur connecté (24/08/2026, `/suivre/calendrier` — manager/admin)
   * — passé à `useDemandes`. Masque aussi le lien "Gérer mes demandes" (mène
   * à `/historique`, propre à l'utilisateur connecté, non pertinent en
   * consultant quelqu'un d'autre) indépendamment de `masquerDemandesPerso`
   * (qui masque les demandes elles-mêmes, pas seulement ce lien). Défaut :
   * comportement d'origine, l'utilisateur connecté. */
  utilisateurId?: string;
}

export function ProchainsJoursOffCard({
  debutPeriode,
  finPeriode,
  masquerDemandesPerso = false,
  separerCpiDji = false,
  filtreCode,
  avecSuppression = false,
  toutAfficher = false,
  donneesInjectees,
  utilisateurId,
}: ProchainsJoursOffCardProps = {}) {
  const anneeActuelle = new Date().getFullYear();
  const calActuel = useCalendrier(anneeActuelle);
  const calSuivant = useCalendrier(anneeActuelle + 1);
  const { demandes, loading: loadingDemandes } = useDemandes(utilisateurId);
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
                <div className="bg-surface-card group flex items-center gap-3 rounded-sm px-[14.4px] py-3">
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
          {!masquerDemandesPerso && !utilisateurId && (
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
