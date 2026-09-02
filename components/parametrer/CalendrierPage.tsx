"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlusCircle, TriangleAlert, X } from "lucide-react";
import type { CongeImpose, DemandeEquipe, DemiJournee, DjImposee, JourFerie } from "@/lib/types";
import { formatJourMois, formatJours, nombreJours } from "@/lib/format";
import { dureeCongeImpose, joursFeriesLegaux } from "@/lib/joursFeries";
import { useCalendrier } from "@/hooks/useCalendrier";
import { useDemandesEquipe } from "@/hooks/useDemandesEquipe";
import { useObjectifsCalendrier } from "@/hooks/useObjectifsCalendrier";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MiniCalendrier, MOIS_FR, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { PeriodeAvecPastilles } from "@/components/ui/PeriodeAvecPastilles";
import { STATUT_CONFIG } from "@/components/ui/StatusBadge";
import { TypeBadge } from "@/components/demandes/TypeBadge";
import { demiCouvertePeriode } from "@/components/demandes/DetailPeriodeConges";
import { ModalPoserJourImpose, type Mode } from "@/components/parametrer/ModalPoserJourImpose";
import { ProchainsJoursOffCard } from "@/components/dashboard/ProchainsJoursOffCard";

const LABEL_TAG_DEMI_JOURNEE: Record<DemiJournee, string> = {
  matin: "Matin",
  apres_midi: "A. Midi",
};

function formatJourMoisComplet(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const jour = d.getUTCDate();
  const jourTexte = jour === 1 ? "1er" : String(jour);
  const mois = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(d);
  return `${jourTexte} ${mois}`;
}

// ------------------------------------------------------------
// Calendrier — vue synthétique (12 mini-calendriers + pastilles DJI/CPI/
// férié). Le composant `MiniCalendrier` est un composant design system
// (components/ui/MiniCalendrier.tsx, voir /design-system) ; ce qui reste ici
// est la logique métier propre à Calendrier (priorité férié > CPI > DJI,
// continuité de groupe).
// ------------------------------------------------------------

/** Couleur de la pastille de volume selon l'avancement vers une cible —
 * gris = rien posé, orange = entamé, vert = cible atteinte ou dépassée. */
function classesPastilleVolume(valeur: number, cible: number): string {
  if (valeur <= 0) return "bg-surface-app text-ink-500";
  if (valeur > cible) return "bg-status-danger-bg text-status-danger-fg";
  if (valeur >= cible) return "bg-status-success-bg text-status-success-fg";
  return "bg-status-warning-bg text-status-warning-fg";
}

interface SnippetCongeProps {
  conge: CongeImpose;
  ancre: DOMRect;
  onSupprimer: () => Promise<void>;
  onFermer: () => void;
}

/**
 * Petit popover positionné juste sous la période cliquée sur le calendrier
 * (via `ancre`, le `DOMRect` du jour/segment cliqué) — suppression uniquement
 * (bascule sur une confirmation inline avant d'agir, avec gestion d'erreur) :
 * une période de congés imposés déjà posée ne se modifie pas, seulement
 * supprimer puis reposer si besoin.
 */
function SnippetConge({ conge, ancre, onSupprimer, onFermer }: SnippetCongeProps) {
  const [confirmation, setConfirmation] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreur, setErreur] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onFermer();
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [onFermer]);

  async function handleConfirmerSuppression() {
    setSuppression(true);
    try {
      await onSupprimer();
    } catch {
      setErreur("Impossible de supprimer cette période.");
      setSuppression(false);
    }
  }

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top: ancre.bottom + 8, left: ancre.left }}
      className="bg-surface-card z-30 flex w-56 flex-col gap-2 rounded-xl p-3 shadow-lg"
    >
      <div>
        <div className="text-ink-900 text-sm font-bold">
          Du {formatJourMois(conge.debut, false)} au {formatJourMois(conge.fin, false)}
        </div>
        <div className="text-ink-500 text-xs">{nombreJours(conge.debut, conge.fin)} jours</div>
      </div>

      {confirmation ? (
        <div className="flex flex-col gap-2">
          <p className="text-ink-900 text-xs">Supprimer cette période ?</p>
          {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirmerSuppression}
              disabled={suppression}
              className="text-status-danger-fg text-xs font-semibold underline"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(false)}
              className="text-ink-500 text-xs font-semibold underline"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmation(true)}
          className="text-status-danger-fg w-fit text-xs font-semibold underline"
        >
          Supprimer
        </button>
      )}
    </div>
  );
}

interface SnippetDjiProps {
  dj: DjImposee;
  ancre: DOMRect;
  onSupprimer: () => Promise<void>;
  onFermer: () => void;
}

/** Équivalent de `SnippetConge` pour une DJI cliquée sur le calendrier —
 * suppression uniquement (pas d'édition de créneau depuis le calendrier). */
function SnippetDji({ dj, ancre, onSupprimer, onFermer }: SnippetDjiProps) {
  const [confirmation, setConfirmation] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreur, setErreur] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onFermer();
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [onFermer]);

  async function handleConfirmerSuppression() {
    setSuppression(true);
    try {
      await onSupprimer();
    } catch {
      setErreur("Impossible de supprimer cette demi-journée.");
      setSuppression(false);
    }
  }

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top: ancre.bottom + 8, left: ancre.left }}
      className="bg-surface-card z-30 flex w-56 flex-col gap-2 rounded-xl p-3 shadow-lg"
    >
      <div>
        <div className="text-ink-900 text-sm font-bold">{formatJourMoisComplet(dj.date)}</div>
        <div className="text-ink-500 text-xs">{LABEL_TAG_DEMI_JOURNEE[dj.demiJournee]}</div>
      </div>

      {confirmation ? (
        <div className="flex flex-col gap-2">
          <p className="text-ink-900 text-xs">Supprimer cette demi-journée ?</p>
          {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirmerSuppression}
              disabled={suppression}
              className="text-status-danger-fg text-xs font-semibold underline"
            >
              Confirmer
            </button>
            <button
              type="button"
              onClick={() => setConfirmation(false)}
              className="text-ink-500 text-xs font-semibold underline"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmation(true)}
          className="text-status-danger-fg w-fit text-xs font-semibold underline"
        >
          Supprimer
        </button>
      )}
    </div>
  );
}

interface SnippetFerieProps {
  ferie: JourFerie;
  ancre: DOMRect;
  onFermer: () => void;
}

/** Équivalent de `SnippetConge`/`SnippetDji` pour un jour férié cliqué sur le
 * calendrier — purement informatif, aucune action associée (les jours
 * fériés légaux ne s'éditent/suppriment pas depuis le calendrier). */
function SnippetFerie({ ferie, ancre, onFermer }: SnippetFerieProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClicExterieur(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onFermer();
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [onFermer]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top: ancre.bottom + 8, left: ancre.left }}
      className="bg-surface-card z-30 flex w-56 flex-col gap-1 rounded-xl p-3 shadow-lg"
    >
      <div className="text-ink-900 text-sm font-bold">{formatJourMoisComplet(ferie.date)}</div>
      <div className="text-ink-500 text-xs">{ferie.libelle}</div>
    </div>
  );
}

interface ConflitAgenda {
  /** Id de l'entrée CPI/DJI concernée — indispensable pour distinguer deux
   * DJI du même jour (matin/après-midi), sinon dupliquées vues comme une
   * seule entrée (même `debut`/`fin`) et provoquant des clés React en
   * doublon (bug constaté 22/08/2026). */
  id: string;
  code: "CPI" | "DJI";
  debut: string;
  fin: string;
  demande: DemandeEquipe;
}

interface TiroirConflitsAgendaProps {
  conflits: ConflitAgenda[];
}

/**
 * Tiroir "Conflit d'agenda" (22/08/2026) — même traitement que les tiroirs
 * DJI/CPI/Fériés de la légende (calé sous son déclencheur, croix de
 * fermeture, pas de popup centrée) : liste des CPI/DJI paramétrés qui
 * recouvrent une demande personnelle déjà existante (voir `conflitsAgenda`
 * dans `VueCalendrierGrille`) — une ligne par couple (entrée CPI/DJI,
 * demande) : un même jour posé par deux collaborateurs différents produit
 * deux lignes. Le "composant congé" concerné est joint tel quel, en
 * reprenant le gabarit `TypeBadge`/`PeriodeAvecPastilles`/`Badge` déjà
 * utilisé pour une demande partout ailleurs (`ActiviteRecenteCard`,
 * `SuiviDemandeRow`) — purement informatif, aucune action de résolution ici
 * (arbitrage manuel par Delphine).
 */
function TiroirConflitsAgenda({ conflits }: TiroirConflitsAgendaProps) {
  return (
    <div className="flex h-full flex-col gap-[3px] overflow-y-auto">
      {conflits.map((c) => {
        const unJour = c.debut === c.fin;
        const libellePeriode = unJour
          ? formatJourMois(c.debut, false)
          : `Du ${formatJourMois(c.debut, false)} au ${formatJourMois(c.fin, false)}`;
        const jours = c.demande.nbDemiJournees / 2;
        const codeDemande =
          c.demande.type === "CP" && c.demande.isAnticipation ? "CPA" : c.demande.type;
        const { tone, Icon } = STATUT_CONFIG[c.demande.statut];
        return (
          <div key={`${c.id}-${c.demande.id}`} className="flex flex-col gap-2 rounded-sm px-0 py-3">
            <div className="text-ink-500 text-xs">
              <span
                className="rounded px-1"
                style={{
                  backgroundColor: `color-mix(in srgb, var(--color-${c.code.toLowerCase()}) 30%, white)`,
                }}
              >
                {c.code}
              </span>
              {` - ${libellePeriode}`}
            </div>
            <div className="text-ink-900 text-xs font-semibold">
              {`${c.demande.demandeur.prenom} ${c.demande.demandeur.nom}`}
            </div>
            <div className="bg-surface-card flex items-center gap-3 rounded-xl p-2">
              <TypeBadge code={codeDemande} />
              <div className="min-w-0 flex-1">
                <PeriodeAvecPastilles
                  debut={c.demande.debut}
                  fin={c.demande.fin}
                  demiDebut={c.demande.demiDebut}
                  demiFin={c.demande.demiFin}
                />
              </div>
              <span className="shrink-0 origin-right scale-90">
                <Badge tone={tone}>
                  <Icon size={12} strokeWidth={2.5} />
                  <span className="text-[14.4px]">{formatJours(jours)} j</span>
                </Badge>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VueCalendrierGrille({ annee }: { annee: number }) {
  const estAnneeLive = annee === new Date().getFullYear();
  const calendrier = useCalendrier(annee);
  const { objectifs } = useObjectifsCalendrier();
  const { demandes: demandesEquipe } = useDemandesEquipe();

  // Conflits d'agenda (22/08/2026) — un CPI/DJI paramétré qui recouvre une
  // demande personnelle déjà existante (validée ou en attente, peu importe le
  // collaborateur) : transparence plutôt que blocage, une alerte pour que
  // Delphine arbitre manuellement avant publication. Une ligne par couple
  // (entrée CPI/DJI, demande) — un même jour posé par deux collaborateurs
  // produit deux lignes, dédupliquées par id de demande (une demande qui
  // chevauche plusieurs jours d'un même CPI ne compte qu'une fois pour ce
  // CPI).
  const conflitsAgenda = useMemo<ConflitAgenda[]>(() => {
    const demandesActives = demandesEquipe.filter(
      (d) => d.statut !== "refusé" && d.statut !== "annulé",
    );
    function demiEnConflit(iso: string, demi: DemiJournee): DemandeEquipe[] {
      return demandesActives.filter((d) =>
        demiCouvertePeriode(iso, demi, d.debut, d.fin, d.demiDebut, d.demiFin),
      );
    }

    const conflits: ConflitAgenda[] = [];
    for (const c of calendrier.congesImposes) {
      const idsVus = new Set<string>();
      const curseur = new Date(`${c.debut}T00:00:00Z`);
      const borne = new Date(`${c.fin}T00:00:00Z`);
      while (curseur <= borne) {
        const iso = curseur.toISOString().slice(0, 10);
        const jourSemaine = curseur.getUTCDay();
        if (jourSemaine !== 0 && jourSemaine !== 6) {
          for (const d of [...demiEnConflit(iso, "matin"), ...demiEnConflit(iso, "apres_midi")]) {
            if (!idsVus.has(d.id)) {
              idsVus.add(d.id);
              conflits.push({ id: c.id, code: "CPI", debut: c.debut, fin: c.fin, demande: d });
            }
          }
        }
        curseur.setUTCDate(curseur.getUTCDate() + 1);
      }
    }
    for (const dj of calendrier.djImposees) {
      for (const d of demiEnConflit(dj.date, dj.demiJournee)) {
        conflits.push({ id: dj.id, code: "DJI", debut: dj.date, fin: dj.date, demande: d });
      }
    }
    return conflits.sort((a, b) => a.debut.localeCompare(b.debut));
  }, [demandesEquipe, calendrier.congesImposes, calendrier.djImposees]);
  // Tiroir Conflits d'agenda (22/08/2026) — même principe que les tiroirs
  // DJI/CPI/Fériés ci-dessus.
  const [tiroirConflitsOuvert, setTiroirConflitsOuvert] = useState(false);
  const carteConflitsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tiroirConflitsOuvert) return;
    function handleClicExterieur(e: MouseEvent) {
      if (carteConflitsRef.current && !carteConflitsRef.current.contains(e.target as Node)) {
        setTiroirConflitsOuvert(false);
      }
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [tiroirConflitsOuvert]);

  // Compteurs de volume affichés sur les cartes légende — pas de cible ni de
  // jauge, juste ce qui est déjà posé, pour un état "en un coup d'œil".
  const totalJoursCpi = useMemo(
    () =>
      calendrier.congesImposes.reduce(
        (somme, c) => somme + dureeCongeImpose(c, calendrier.joursFeries),
        0,
      ),
    [calendrier.congesImposes, calendrier.joursFeries],
  );
  const totalDemiJourneesDji = calendrier.djImposees.length;
  const totalJoursFeries = calendrier.joursFeries.length;
  // Cibles CPI/DJI : réglage global (Congés & RTT), pas de variation par
  // année. `parametrage_periode.nb_demi_journees_cible` n'est PAS utilisé ici
  // — cette colonne est `not null default 16`, donc toujours renseignée dès
  // qu'une année a été touchée une seule fois, ce qui masquerait en
  // permanence toute mise à jour du réglage global (bug constaté : changer
  // la cible DJI dans Congés & RTT n'avait aucun effet sur le Calendrier).
  // 0 (pas de valeur saisie en Congés & RTT, ou explicitement à 0) masque la
  // section CPI ci-dessous (29/08/2026, demande explicite) — plus de défaut
  // silencieux à 5, qui aurait gardé la section visible tant que Delphine
  // n'a jamais touché ce champ.
  const cibleJoursCpi = objectifs?.cibleJoursCpi ?? 0;
  const cibleDemiJourneesDji = objectifs?.cibleDemiJourneesDji ?? 16;
  const classesPastilleCpi = classesPastilleVolume(totalJoursCpi, cibleJoursCpi);
  const classesPastilleDji = classesPastilleVolume(totalDemiJourneesDji, cibleDemiJourneesDji);
  const classesPastilleFeries =
    totalJoursFeries > 0
      ? "bg-status-success-bg text-status-success-fg"
      : "bg-surface-app text-ink-500";
  const pretAPublier =
    totalJoursCpi === cibleJoursCpi &&
    totalDemiJourneesDji === cibleDemiJourneesDji &&
    totalJoursFeries > 0;
  const [snippetConge, setSnippetConge] = useState<{ conge: CongeImpose; ancre: DOMRect } | null>(
    null,
  );
  const [snippetDji, setSnippetDji] = useState<{ dj: DjImposee; ancre: DOMRect } | null>(null);
  // Tiroir DJI (22/08/2026) — clic sur la pill "N demi-journées" de la
  // légende : ouvre un tiroir calé sous la carte, reprenant tel quel le
  // composant liste avec suppression au survol déjà utilisé sur
  // `/parametrer/calendrier3` (`ProchainsJoursOffCard`, `filtreCode="DJI"`).
  // La carte elle-même n'ouvre plus l'ancienne modale "référentiel"
  // (22/08/2026, retirée — voir plus bas).
  const [tiroirDjiOuvert, setTiroirDjiOuvert] = useState(false);
  const carteDjiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tiroirDjiOuvert) return;
    function handleClicExterieur(e: MouseEvent) {
      if (carteDjiRef.current && !carteDjiRef.current.contains(e.target as Node)) {
        setTiroirDjiOuvert(false);
      }
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [tiroirDjiOuvert]);

  // Tiroir CPI (22/08/2026) — même principe que le tiroir DJI ci-dessus.
  const [tiroirCpiOuvert, setTiroirCpiOuvert] = useState(false);
  const carteCpiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tiroirCpiOuvert) return;
    function handleClicExterieur(e: MouseEvent) {
      if (carteCpiRef.current && !carteCpiRef.current.contains(e.target as Node)) {
        setTiroirCpiOuvert(false);
      }
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [tiroirCpiOuvert]);

  // Tiroir Fériés (22/08/2026) — même principe, sans suppression (jours
  // fériés légaux non supprimables depuis le calendrier).
  const [tiroirFerieOuvert, setTiroirFerieOuvert] = useState(false);
  const carteFerieRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tiroirFerieOuvert) return;
    function handleClicExterieur(e: MouseEvent) {
      if (carteFerieRef.current && !carteFerieRef.current.contains(e.target as Node)) {
        setTiroirFerieOuvert(false);
      }
    }
    window.addEventListener("mousedown", handleClicExterieur);
    return () => window.removeEventListener("mousedown", handleClicExterieur);
  }, [tiroirFerieOuvert]);

  // Toggle Lundi de Pentecôte (22/08/2026) — repris en intro du tiroir
  // Fériés, même logique que `ModalJoursFeries` (pas de colonne "travaillé"
  // en base : "travaillée" = pas de ligne pour ce jour dans `jours_feries`).
  const referentielFeries = useMemo(() => joursFeriesLegaux(annee), [annee]);
  const pentecoteRef = referentielFeries.find((f) => f.libelle === "Lundi de Pentecôte");
  const pentecoteEnBase = calendrier.joursFeries.find((f) => f.libelle === "Lundi de Pentecôte");
  const pentecoteTravaillee = !pentecoteEnBase;
  const [pentecoteEnCours, setPentecoteEnCours] = useState(false);

  async function handleTogglePentecote() {
    if (!pentecoteRef) return;
    setPentecoteEnCours(true);
    try {
      if (pentecoteTravaillee) {
        await calendrier.ajouterFerie({ date: pentecoteRef.date, libelle: pentecoteRef.libelle });
      } else if (pentecoteEnBase) {
        await calendrier.supprimerFerie(pentecoteEnBase.id);
      }
    } finally {
      setPentecoteEnCours(false);
    }
  }
  const [snippetFerie, setSnippetFerie] = useState<{ ferie: JourFerie; ancre: DOMRect } | null>(
    null,
  );
  // "+" au survol d'un jour vide (22/08/2026) — ouvre la nouvelle popin
  // unifiée CPI/DJI (`ModalPoserJourImpose`, calquée sur Calendrier (v2))
  // sans toucher aux légendes/modales existantes, qui restent le moyen de
  // parcourir/gérer en lot. Mode par défaut DJI : un clic sur un seul jour
  // est statistiquement plus souvent une demi-journée qu'une période CPI.
  const [modaleCreation, setModaleCreation] = useState<Mode | null>(null);
  const [dateInitialeCreation, setDateInitialeCreation] = useState<string | undefined>(undefined);

  function handleJourVideClick(iso: string) {
    setDateInitialeCreation(iso);
    setModaleCreation("DJI");
  }

  function fermerModaleCreation() {
    setModaleCreation(null);
    setDateInitialeCreation(undefined);
  }
  const [publicationEnCours, setPublicationEnCours] = useState(false);
  const [erreurPublication, setErreurPublication] = useState("");

  async function handlePublier() {
    setErreurPublication("");
    setPublicationEnCours(true);
    try {
      await calendrier.publierParametrage();
    } catch {
      setErreurPublication("Impossible de publier le paramétrage.");
    } finally {
      setPublicationEnCours(false);
    }
  }

  async function handleDepublier() {
    setErreurPublication("");
    setPublicationEnCours(true);
    try {
      await calendrier.depublierParametrage();
    } catch {
      setErreurPublication("Impossible d'annuler la publication.");
    } finally {
      setPublicationEnCours(false);
    }
  }

  if (calendrier.loading) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  function estEnConge(iso: string): boolean {
    return calendrier.congesImposes.some((c) => iso >= c.debut && iso <= c.fin);
  }

  // Priorité d'affichage quand plusieurs types tombent le même jour : férié
  // > congé imposé (CPI) > demi-journée imposée (DJI). Cas à la marge : un
  // jour qui est À LA FOIS dans un congé imposé ET a une DJI ne doit pas
  // faire disparaître silencieusement la DJI derrière le CPI — le jour se
  // partage en deux couleurs pleines (`partage`), chacune sur sa vraie
  // moitié (matin/après-midi), plutôt que la pastille CPI pleine habituelle.
  function tipoDuJour(iso: string): PastilleJour | null {
    if (calendrier.joursFeries.some((f) => f.date === iso)) {
      return { classeFond: "bg-ferie" };
    }

    const dj = calendrier.djImposees.find((d) => d.date === iso);
    const enConge = estEnConge(iso);

    if (enConge && dj) {
      const couleurDji = "var(--color-dji)";
      const couleurCp = "var(--color-cp)";
      return dj.demiJournee === "matin"
        ? { partage: { gauche: couleurDji, droite: couleurCp } }
        : { partage: { gauche: couleurCp, droite: couleurDji } };
    }
    if (enConge) {
      return { classeFond: "bg-cp" };
    }
    if (dj) {
      return {
        moitie: {
          couleur: "var(--color-dji)",
          cote: dj.demiJournee === "matin" ? "gauche" : "droite",
        },
      };
    }
    return null;
  }

  // Un jour férié à l'intérieur d'une période de congé imposé n'interrompt
  // pas la continuité visuelle (voir règles dans MiniCalendrier.tsx).
  function estEnGroupe(isoA: string, isoB: string): boolean {
    return estEnConge(isoA) && estEnConge(isoB);
  }

  // Cliquer un jour de congé imposé sur le calendrier principal ouvre la
  // modale en mode édition pour cette période (seul moyen actuel pour
  // l'admin de modifier/supprimer un CPI déjà posé sans repasser par la
  // liste "Déjà posés" de la modale).
  function handleJourClick(iso: string, ancre: DOMRect) {
    // Même priorité que l'affichage des pastilles (`tipoDuJour`) : un jour
    // férié prend le dessus visuellement, donc le clic doit ouvrir le
    // snippet férié (lecture seule) plutôt que CPI/DJI sous-jacents.
    const ferie = calendrier.joursFeries.find((f) => f.date === iso);
    if (ferie) {
      setSnippetFerie({ ferie, ancre });
      return;
    }
    const conge = calendrier.congesImposes.find((c) => iso >= c.debut && iso <= c.fin);
    if (conge) {
      setSnippetConge({ conge, ancre });
      return;
    }
    const dj = calendrier.djImposees.find((d) => d.date === iso);
    if (dj) {
      setSnippetDji({ dj, ancre });
    }
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <div className="grid max-w-[900px] flex-1 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))] gap-4">
        {MOIS_FR.map((_, moisIndex) => (
          <MiniCalendrier
            key={moisIndex}
            annee={annee}
            moisIndex={moisIndex}
            tipoDuJour={tipoDuJour}
            estEnGroupe={estEnGroupe}
            onJourClick={handleJourClick}
            onJourVideClick={handleJourVideClick}
          />
        ))}
      </div>

      <div className="flex w-full flex-col gap-3 md:w-64 md:shrink-0">
        <div ref={carteDjiRef} className="relative">
          <div className="bg-surface-card flex w-full items-start gap-2.5 rounded-xl p-4 text-left shadow-sm">
            <TypeBadge code="DJI" />
            <div className="flex flex-1 flex-col">
              <span className="text-ink-900 text-sm">Demi-journées imposées</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setTiroirDjiOuvert((v) => !v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    setTiroirDjiOuvert((v) => !v);
                  }
                }}
                className={`mt-1 w-fit cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition-[filter] duration-150 hover:brightness-90 ${classesPastilleDji}`}
              >
                {totalDemiJourneesDji}{" "}
                {totalDemiJourneesDji === 1 ? "demi-journée" : "demi-journées"}
              </span>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setDateInitialeCreation(undefined);
                setModaleCreation("DJI");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  setDateInitialeCreation(undefined);
                  setModaleCreation("DJI");
                }
              }}
              className="shrink-0 cursor-pointer self-center"
            >
              <PlusCircle
                size={18}
                className="text-mint transition-transform duration-150 hover:scale-125"
              />
            </span>
          </div>

          {tiroirDjiOuvert && (
            <div className="bg-surface-card rounded-card absolute top-full right-0 left-0 z-20 mt-2 flex h-80 flex-col p-2 shadow-lg">
              <button
                type="button"
                onClick={() => setTiroirDjiOuvert(false)}
                aria-label="Fermer"
                className="text-ink-500 hover:text-ink-900 mb-1 self-end"
              >
                <X size={16} />
              </button>
              <div className="min-h-0 flex-1">
                <ProchainsJoursOffCard
                  debutPeriode={`${annee}-01-01`}
                  finPeriode={`${annee}-12-31`}
                  masquerDemandesPerso
                  separerCpiDji
                  filtreCode="DJI"
                  avecSuppression
                  toutAfficher
                  donneesInjectees={{
                    congesImposes: calendrier.congesImposes,
                    djImposees: calendrier.djImposees,
                    joursFeries: calendrier.joursFeries,
                    supprimerConge: calendrier.supprimerConge,
                    supprimerDj: calendrier.supprimerDj,
                    ajouterConge: calendrier.ajouterConge,
                    ajouterDj: calendrier.ajouterDj,
                  }}
                />
              </div>
            </div>
          )}
        </div>
        {cibleJoursCpi > 0 && (
          <div ref={carteCpiRef} className="relative">
            <div className="bg-surface-card flex w-full items-start gap-2.5 rounded-xl p-4 text-left shadow-sm">
              <TypeBadge code="CPI" />
              <div className="flex flex-1 flex-col">
                <span className="text-ink-900 text-sm">Congés imposés</span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTiroirCpiOuvert((v) => !v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      setTiroirCpiOuvert((v) => !v);
                    }
                  }}
                  className={`mt-1 w-fit cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition-[filter] duration-150 hover:brightness-90 ${classesPastilleCpi}`}
                >
                  {formatJours(totalJoursCpi)} {totalJoursCpi === 1 ? "jour" : "jours"}
                </span>
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setDateInitialeCreation(undefined);
                  setModaleCreation("CPI");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    setDateInitialeCreation(undefined);
                    setModaleCreation("CPI");
                  }
                }}
                className="shrink-0 cursor-pointer self-center"
              >
                <PlusCircle
                  size={18}
                  className="text-mint transition-transform duration-150 hover:scale-125"
                />
              </span>
            </div>

            {tiroirCpiOuvert && (
              <div className="bg-surface-card rounded-card absolute top-full right-0 left-0 z-20 mt-2 flex h-80 flex-col p-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => setTiroirCpiOuvert(false)}
                  aria-label="Fermer"
                  className="text-ink-500 hover:text-ink-900 mb-1 self-end"
                >
                  <X size={16} />
                </button>
                <div className="min-h-0 flex-1">
                  <ProchainsJoursOffCard
                    debutPeriode={`${annee}-01-01`}
                    finPeriode={`${annee}-12-31`}
                    masquerDemandesPerso
                    separerCpiDji
                    filtreCode="CPI"
                    avecSuppression
                    toutAfficher
                    donneesInjectees={{
                      congesImposes: calendrier.congesImposes,
                      djImposees: calendrier.djImposees,
                      joursFeries: calendrier.joursFeries,
                      supprimerConge: calendrier.supprimerConge,
                      supprimerDj: calendrier.supprimerDj,
                      ajouterConge: calendrier.ajouterConge,
                      ajouterDj: calendrier.ajouterDj,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={carteFerieRef} className="relative">
          <div className="bg-surface-card flex w-full items-start gap-2.5 rounded-xl p-4 text-left shadow-sm">
            <TypeBadge code="FERIE" />
            <div className="flex flex-1 flex-col">
              <span className="text-ink-900 text-sm">Jours fériés</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setTiroirFerieOuvert((v) => !v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    setTiroirFerieOuvert((v) => !v);
                  }
                }}
                className={`mt-1 w-fit cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition-[filter] duration-150 hover:brightness-90 ${classesPastilleFeries}`}
              >
                {totalJoursFeries} {totalJoursFeries === 1 ? "jour" : "jours"}
              </span>
            </div>
          </div>

          {tiroirFerieOuvert && (
            <div className="bg-surface-card rounded-card absolute top-full right-0 left-0 z-20 mt-2 flex h-80 flex-col p-2 shadow-lg">
              <button
                type="button"
                onClick={() => setTiroirFerieOuvert(false)}
                aria-label="Fermer"
                className="text-ink-500 hover:text-ink-900 mb-1 self-end"
              >
                <X size={16} />
              </button>
              <div className="bg-mint-tint mb-2 flex shrink-0 items-center justify-between rounded-xl px-3 py-2">
                <span className="text-ink-900 text-xs font-semibold">Lundi de Pentecôte</span>
                <div className="flex items-center gap-2">
                  <span className="text-ink-500 text-xs">
                    {pentecoteTravaillee ? "Travaillé" : "Férié"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!pentecoteTravaillee}
                    aria-label="Lundi de Pentecôte férié"
                    disabled={pentecoteEnCours || calendrier.joursFeries.length === 0}
                    onClick={handleTogglePentecote}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50 ${
                      pentecoteTravaillee ? "bg-ink-300" : "bg-mint"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] duration-150 ${
                        pentecoteTravaillee ? "left-0.5" : "left-4"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <ProchainsJoursOffCard
                  debutPeriode={`${annee}-01-01`}
                  finPeriode={`${annee}-12-31`}
                  masquerDemandesPerso
                  separerCpiDji
                  filtreCode="FERIE"
                  toutAfficher
                />
              </div>
            </div>
          )}
        </div>

        {conflitsAgenda.length > 0 && (
          <div ref={carteConflitsRef} className="relative my-2">
            <button
              type="button"
              onClick={() => setTiroirConflitsOuvert((v) => !v)}
              className="flex w-fit items-center gap-1.5 px-1 text-left"
            >
              <TriangleAlert size={14} className="text-status-warning-fg shrink-0" />
              <span className="bg-status-warning-bg text-status-warning-fg rounded px-1 text-[11px] font-semibold hover:underline">
                {`Conflit d'agenda (${conflitsAgenda.length})`}
              </span>
            </button>

            {tiroirConflitsOuvert && (
              <div className="bg-surface-card rounded-card absolute top-full right-0 left-0 z-20 mt-2 flex h-80 flex-col p-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => setTiroirConflitsOuvert(false)}
                  aria-label="Fermer"
                  className="text-ink-500 hover:text-ink-900 mb-1 self-end"
                >
                  <X size={16} />
                </button>
                <div className="min-h-0 flex-1">
                  <TiroirConflitsAgenda conflits={conflitsAgenda} />
                </div>
              </div>
            )}
          </div>
        )}

        {estAnneeLive && (
          <p className="text-ink-500 px-1 text-sm">
            <span className="bg-status-success-bg text-status-success-fg px-1">Publié</span> ce
            calendrier est visible par les collaborateurs
          </p>
        )}

        {!estAnneeLive &&
          (calendrier.parametrage?.valideLe ? (
            <div className="flex flex-col gap-1 px-1">
              <p className="text-ink-500 text-sm">
                <span className="bg-status-success-bg text-status-success-fg px-1">Publié</span> ce
                calendrier est visible par les collaborateurs
              </p>
              <button
                type="button"
                onClick={handleDepublier}
                disabled={publicationEnCours}
                className="text-ink-500 w-fit text-xs underline underline-offset-2 disabled:opacity-60"
              >
                {publicationEnCours ? "Annulation…" : "Annuler la publication"}
              </button>
              {erreurPublication && (
                <p className="text-status-danger-fg text-xs">{erreurPublication}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-ink-500 px-1 text-sm">
                <span className="bg-status-warning-bg text-status-warning-fg px-1">Brouillon</span>{" "}
                ce calendrier n&rsquo;est pas visible par les collaborateurs
              </p>
              <Button
                type="button"
                variant={pretAPublier ? "primary" : "secondary"}
                onClick={handlePublier}
                disabled={publicationEnCours || !pretAPublier}
                className="rounded-card w-full px-4 py-2.5"
              >
                {publicationEnCours ? "Publication…" : "Publier"}
              </Button>
              {erreurPublication && (
                <p className="text-status-danger-fg text-xs">{erreurPublication}</p>
              )}
            </div>
          ))}
      </div>

      {snippetConge && (
        <SnippetConge
          conge={snippetConge.conge}
          ancre={snippetConge.ancre}
          onSupprimer={async () => {
            await calendrier.supprimerConge(snippetConge.conge.id);
            setSnippetConge(null);
          }}
          onFermer={() => setSnippetConge(null)}
        />
      )}

      {snippetDji && (
        <SnippetDji
          dj={snippetDji.dj}
          ancre={snippetDji.ancre}
          onSupprimer={async () => {
            await calendrier.supprimerDj(snippetDji.dj.id);
            setSnippetDji(null);
          }}
          onFermer={() => setSnippetDji(null)}
        />
      )}

      {snippetFerie && (
        <SnippetFerie
          ferie={snippetFerie.ferie}
          ancre={snippetFerie.ancre}
          onFermer={() => setSnippetFerie(null)}
        />
      )}

      {modaleCreation && (
        <ModalPoserJourImpose
          joursFeries={calendrier.joursFeries}
          congesImposes={calendrier.congesImposes}
          djImposees={calendrier.djImposees}
          onAjouterCongeImpose={calendrier.ajouterConge}
          onAjouterDj={calendrier.ajouterDj}
          onClose={fermerModaleCreation}
          modeInitial={modaleCreation}
          dateInitiale={dateInitialeCreation}
        />
      )}
    </div>
  );
}

/**
 * Écran Paramétrer > Calendrier (route `/parametrer/calendrier2`) — vue
 * synthétique (12 mini-calendriers + pastilles), onglets année en cours /
 * année à venir, publication du paramétrage. Remplace l'ancien écran
 * Calendrier (route `/parametrer/calendrier`, supprimée) — le nom
 * "Calendrier2" reste pour l'instant côté code/route, à renommer plus tard
 * si besoin (voir Backlog.md).
 */
export function Calendrier2Page() {
  const anneeEnCours = new Date().getFullYear();
  const anneeAVenir = anneeEnCours + 1;
  const [annee, setAnnee] = useState(anneeEnCours);

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-none md:pt-0">
      <h1 className="text-ink-900 animate-stagger-in px-1 text-2xl font-semibold">Calendrier</h1>

      <div className="animate-stagger-in flex gap-2 px-1" style={{ animationDelay: "60ms" }}>
        <button
          type="button"
          onClick={() => setAnnee(anneeEnCours)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            annee === anneeEnCours
              ? "bg-brand text-brand-foreground"
              : "bg-surface-card text-ink-900 shadow-sm"
          }`}
        >
          {anneeEnCours}
        </button>
        <button
          type="button"
          onClick={() => setAnnee(anneeAVenir)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            annee === anneeAVenir
              ? "bg-brand text-brand-foreground"
              : "bg-surface-card text-ink-900 shadow-sm"
          }`}
        >
          {anneeAVenir} - Brouillon
        </button>
      </div>

      {new Date().getMonth() === 11 && (
        <div className="bg-status-warning-bg text-status-warning-fg rounded-control flex items-center gap-2.5 px-4 py-3 text-sm font-semibold">
          <TriangleAlert size={18} className="shrink-0" />
          {`Pensez à paramétrer les jours imposés de ${anneeAVenir} avant la fin de l’année.`}
        </div>
      )}

      <div className="animate-stagger-in" style={{ animationDelay: "120ms" }}>
        <VueCalendrierGrille key={annee} annee={annee} />
      </div>
    </div>
  );
}
