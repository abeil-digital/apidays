"use client";

import { useState, type ReactNode } from "react";
import { Eye, PlusCircle, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { JourBadge } from "@/components/ui/JourBadge";
import { ListCard } from "@/components/ui/ListCard";
import { MiniCalendrier, type PastilleJour } from "@/components/ui/MiniCalendrier";
import { Modal } from "@/components/ui/Modal";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { InputFiltrePill, SelectFiltrePill } from "@/components/ui/FiltrePill";
import { Input } from "@/components/ui/Input";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SelectPille } from "@/components/ui/SelectPille";
import { SoldeCard } from "@/components/ui/SoldeCard";
import { SoldeMoisBloc } from "@/components/ui/SoldeMoisBloc";
import { TypeBadge, TypeBadgePillEnhanced } from "@/components/demandes/TypeBadge";
import { SuiviDemandeRow } from "@/components/suivre/SuiviDemandeRow";
import type { DemandeEquipe, MouvementSolde, StatutDemande } from "@/lib/types";

/**
 * Page de référence du design system — importe et rend les VRAIS composants
 * de `components/ui/` (et alentours) avec des props représentatives. Le but
 * est qu'elle reste juste dans le temps : si un composant change, cette page
 * change avec lui automatiquement, sans maintenance manuelle d'une doc à
 * part. Ne rien recréer visuellement ici — toujours importer.
 */

const PALETTE: { token: string; className: string }[] = [
  { token: "brand", className: "bg-brand" },
  { token: "brand-foreground", className: "bg-brand-foreground" },
  { token: "slate", className: "bg-slate" },
  { token: "surface-app", className: "bg-surface-app" },
  { token: "surface-card", className: "bg-surface-card" },
  { token: "ink-900", className: "bg-ink-900" },
  { token: "ink-500", className: "bg-ink-500" },
  { token: "ink-300", className: "bg-ink-300" },
  { token: "cp", className: "bg-cp" },
  { token: "rtt", className: "bg-rtt" },
  { token: "cpa", className: "bg-cpa" },
  { token: "css", className: "bg-css" },
  { token: "ce", className: "bg-ce" },
  { token: "recup", className: "bg-recup" },
  { token: "evtfam", className: "bg-evtfam" },
  { token: "dji", className: "bg-dji" },
  { token: "ferie", className: "bg-ferie" },
  { token: "mint", className: "bg-mint" },
  { token: "mint-tint", className: "bg-mint-tint" },
  { token: "status-success-bg", className: "bg-status-success-bg" },
  { token: "status-success-fg", className: "bg-status-success-fg" },
  { token: "status-warning-bg", className: "bg-status-warning-bg" },
  { token: "status-warning-fg", className: "bg-status-warning-fg" },
  { token: "status-danger-bg", className: "bg-status-danger-bg" },
  { token: "status-danger-fg", className: "bg-status-danger-fg" },
  { token: "status-neutral-bg", className: "bg-status-neutral-bg" },
  { token: "status-neutral-fg", className: "bg-status-neutral-fg" },
];

const BADGE_TONES: BadgeTone[] = ["success", "warning", "danger", "neutral"];
const BUTTON_VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost"];
const STATUTS_DEMANDE: StatutDemande[] = ["validé", "en attente", "refusé"];

const SOLDE_MOIS_EXEMPLE: MouvementSolde[] = [
  {
    id: "exemple-demande",
    type: "demande",
    date: "2026-08-10",
    libelle: "CP : du 10/08 au 12/08",
    jours: -3,
    soldeApres: 45,
  },
  {
    id: "exemple-ajustement",
    type: "ajustement",
    date: "2026-08-13",
    libelle: "Régul",
    jours: -8,
    soldeApres: 37,
  },
];

const SUIVI_DEMANDES_EXEMPLE: DemandeEquipe[] = [
  {
    id: "exemple-suivi-1",
    type: "CP",
    isAnticipation: false,
    debut: "2026-08-21",
    fin: "2026-08-21",
    demiDebut: "matin",
    demiFin: "apres_midi",
    nbDemiJournees: 2,
    datePose: "2026-08-13",
    dateDecision: null,
    statut: "en attente",
    note: "",
    commentaireManager: "",
    demandeur: { id: "exemple-collab-1", prenom: "Salarie", nom: "Test" },
  },
  {
    id: "exemple-suivi-2",
    type: "CP",
    isAnticipation: false,
    debut: "2026-08-03",
    fin: "2026-08-28",
    demiDebut: "matin",
    demiFin: "apres_midi",
    nbDemiJournees: 40,
    datePose: "2026-08-13",
    dateDecision: "2026-08-13",
    statut: "validé",
    note: "",
    commentaireManager: "",
    demandeur: { id: "exemple-collab-2", prenom: "Olivier", nom: "Test" },
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-ink-900 border-ink-300 border-b pb-2 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function ComponentExample({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-ink-500 text-xs font-semibold">{title}</div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/**
 * Données d'exemple figées (pas de hook, pas d'appel réseau) pour illustrer
 * les 3 règles de gestion de `MiniCalendrier` en un seul mois : isolé (6, 7,
 * 10 — demi-journées), groupe multi-semaines avec un férié qui n'interrompt
 * pas la continuité (13→24, férié le 14), jour travaillé qui interrompt
 * (rien entre 17 et 20 puisqu'ils sont dans des groupes différents ici).
 */
const DEMO_FERIES = new Set(["2026-07-14"]);
const DEMO_CONGE = { debut: "2026-07-13", fin: "2026-07-24" };
const DEMO_DJI: Record<string, "gauche" | "droite"> = {
  "2026-07-06": "gauche",
  "2026-07-07": "droite",
  "2026-07-10": "gauche",
};

function demoEstEnConge(iso: string): boolean {
  return iso >= DEMO_CONGE.debut && iso <= DEMO_CONGE.fin;
}

function demoTipoDuJour(iso: string): PastilleJour | null {
  if (DEMO_FERIES.has(iso)) return { classeFond: "bg-ferie" };
  if (demoEstEnConge(iso)) return { classeFond: "bg-cp" };
  const cote = DEMO_DJI[iso];
  if (cote) return { moitie: { couleur: "var(--color-dji)", cote } };
  return null;
}

function demoEstEnGroupe(isoA: string, isoB: string): boolean {
  return demoEstEnConge(isoA) && demoEstEnConge(isoB);
}

function MiniCalendrierDemo() {
  return (
    <MiniCalendrier
      annee={2026}
      moisIndex={6}
      tipoDuJour={demoTipoDuJour}
      estEnGroupe={demoEstEnGroupe}
    />
  );
}

export function DesignSystemPage() {
  const [modalOuverte, setModalOuverte] = useState(false);
  const [modalCentreOuverte, setModalCentreOuverte] = useState(false);
  const [modalHauteOuverte, setModalHauteOuverte] = useState(false);
  const [dateExemple, setDateExemple] = useState("");
  const [soldeMoisOuvert, setSoldeMoisOuvert] = useState(true);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8">
      <div>
        <h1 className="text-ink-900 text-2xl font-semibold">Design system</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Référence vivante — cette page importe les vrais composants de <code>components/ui/</code>{" "}
          (et alentours) avec de vraies props. Si un composant change, cette page change avec lui.
        </p>
      </div>

      <Section title="Palette">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {PALETTE.map(({ token, className }) => (
            <div key={token} className="flex flex-col gap-1.5">
              <div className={`border-ink-300 h-16 w-full rounded-lg border ${className}`} />
              <code className="text-ink-500 text-xs">{token}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typographie">
        <div className="flex flex-col">
          <div className="border-ink-300/60 flex items-baseline justify-between gap-4 border-b py-3">
            <span className="text-ink-900 text-2xl font-semibold">Bonjour, Camille</span>
            <code className="text-ink-500 shrink-0 text-xs">
              text-2xl font-semibold text-ink-900
            </code>
          </div>
          <div className="border-ink-300/60 flex items-baseline justify-between gap-4 border-b py-3">
            <SectionLabel>Demandes en cours</SectionLabel>
            <code className="text-ink-500 shrink-0 text-xs">
              text-sm font-bold text-ink-900 (SectionLabel — pas encore aligné sur la nouvelle
              convention text-lg font-medium)
            </code>
          </div>
          <div className="border-ink-300/60 flex items-baseline justify-between gap-4 border-b py-3">
            <span className="text-ink-900 text-base">Congé payé du 10 au 12 août 2026.</span>
            <code className="text-ink-500 shrink-0 text-xs">text-base</code>
          </div>
          <div className="border-ink-300/60 flex items-baseline justify-between gap-4 border-b py-3">
            <span className="text-ink-500 text-sm">3 jours - posé le 24 juil. 2026</span>
            <code className="text-ink-500 shrink-0 text-xs">text-sm text-ink-500</code>
          </div>
          <div className="border-ink-300/60 flex items-baseline justify-between gap-4 border-b py-3">
            <span className="text-ink-500 text-xs">HISTORIQUE</span>
            <code className="text-ink-500 shrink-0 text-xs">text-xs text-ink-500</code>
          </div>
          <p className="text-ink-500 pt-3 text-xs font-semibold">
            Suivi des demandes (SuiviDemandeRow) — échelle resserrée pour une carte dense sans
            action
          </p>
          <div className="border-ink-300/60 flex items-baseline justify-between gap-4 border-b py-3">
            <span className="text-ink-500 text-[11px] font-semibold">Congés Payés</span>
            <code className="text-ink-500 shrink-0 text-xs">
              text-[11px] font-semibold text-ink-500 — libellé du type (point de couleur + texte)
            </code>
          </div>
          <div className="border-ink-300/60 flex items-baseline justify-between gap-4 border-b py-3">
            <span className="text-ink-900 text-xs font-semibold">21 août 2026</span>
            <code className="text-ink-500 shrink-0 text-xs">
              text-xs font-semibold text-ink-900 — période (pas text-sm, densité de carte)
            </code>
          </div>
          <div className="border-ink-300/60 flex items-baseline justify-between gap-4 border-b py-3">
            <span className="text-ink-500 text-[10px]">Posé le 13/08/2026</span>
            <code className="text-ink-500 shrink-0 text-xs">
              text-[10px] text-ink-500 — le plus petit gabarit du DS, réservé à cette carte
            </code>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <span className="text-[14.4px]">1 j</span>
            <code className="text-ink-500 shrink-0 text-xs">
              text-[14.4px] — contenu de la pastille durée, +20% vs text-xs pour compenser le
              scale-90 appliqué à la pastille
            </code>
          </div>
        </div>
      </Section>

      <Section title="Composants">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ComponentExample title="Avatar">
            <Avatar initiales="CR" />
            <Avatar initiales="ST" />
          </ComponentExample>

          <ComponentExample title="Badge (4 tons)">
            {BADGE_TONES.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </ComponentExample>

          <ComponentExample title="Button (3 variantes)">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} className="rounded-full px-4 py-2">
                {variant}
              </Button>
            ))}
          </ComponentExample>

          <ComponentExample title="StatusBadge (StatutDemande)">
            {STATUTS_DEMANDE.map((statut) => (
              <StatusBadge key={statut} statut={statut} />
            ))}
          </ComponentExample>

          <ComponentExample title="TypeBadge">
            <TypeBadge code="CP" />
            <TypeBadge code="RTT" />
            <TypeBadge code="CPA" />
            <TypeBadge code="CSS" />
            <TypeBadge code="CE" />
            <TypeBadge code="RECUP" />
            <TypeBadge code="EVT_FAM" />
            <TypeBadge code="DJI" />
            <TypeBadge code="CPI" />
            <TypeBadge code="FERIE" />
          </ComponentExample>

          <ComponentExample title="TypeBadge (variant outline)">
            <TypeBadge code="DJI" variant="outline" label="Matin" />
            <TypeBadge code="DJI" variant="outline" label="A. Midi" />
            <TypeBadge code="CP" variant="outline" />
            <TypeBadge code="RTT" variant="outline" />
          </ComponentExample>

          <ComponentExample title="TypeBadge (variant pill) — motif d'un jour indisponible">
            <TypeBadge code="FERIE" variant="pill" />
            <TypeBadge code="CPI" variant="pill" />
          </ComponentExample>

          <ComponentExample title="TypeBadgePillEnhanced — solde de premier plan (Espace Suivre)">
            <TypeBadgePillEnhanced code="CP" label="48 j" />
          </ComponentExample>

          {/* Suivre les soldes : les 3 pills du tableau (CP/RTT/CPA) s'inversent chacune
              indépendamment (fond blanc, texte/contour couleur du type) tant que le panneau
              `SoldeDetailPanel` est ouvert pour ce salarié SUR CE TYPE précis — même `TypeBadge`,
              juste `variant="outline"` au lieu de `variant="pill"`, piloté par un simple booléen
              `active` côté appelant (`Selection { utilisateurId; code }`, pas de nouvel état ni de
              composant dédié). Le panneau lui-même n'est pas rendu ici : il fetch ses données via
              `useHistoriqueSolde(utilisateurId, code)`, pas de props représentatives possibles sans
              un vrai salarié — voir `components/suivre/SoldeDetailPanel.tsx` pour le détail complet
              (en-tête coloré au fond du type + texte blanc, ligne "Solde N-1"/"Solde initial"
              foncée via `color-mix` pour l'accessibilité, icône `+` — pas de point — colorée au
              type pour un événement d'acquisition mensuelle RTT/CPA). */}
          <ComponentExample title="Pill de solde cliquable — état normal vs état déclenché (Suivre les soldes)">
            <div className="flex flex-col items-center gap-1.5">
              <TypeBadge code="CP" variant="pill" label="39 j" />
              <span className="text-ink-500 text-[11px]">CP normal</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <TypeBadge code="CP" variant="outline" label="39 j" />
              <span className="text-ink-500 text-[11px]">CP déclenché</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <TypeBadge code="RTT" variant="pill" label="0,75 j" />
              <span className="text-ink-500 text-[11px]">RTT normal</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <TypeBadge code="RTT" variant="outline" label="0,75 j" />
              <span className="text-ink-500 text-[11px]">RTT déclenché</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <TypeBadge code="CPA" variant="pill" label="4 j" />
              <span className="text-ink-500 text-[11px]">CPA normal</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <TypeBadge code="CPA" variant="outline" label="4 j" />
              <span className="text-ink-500 text-[11px]">CPA déclenché</span>
            </div>
          </ComponentExample>

          <ComponentExample title="SoldeMoisBloc — bloc mois du feed d'historique de solde (Espace Suivre)">
            <div className="flex w-full max-w-sm flex-col gap-2">
              <SoldeMoisBloc
                code="CP"
                libelleMois="Août"
                mouvements={SOLDE_MOIS_EXEMPLE}
                soldeLibelle="Solde paie août"
                soldeValeur={37}
                ouvert={soldeMoisOuvert}
                onToggle={() => setSoldeMoisOuvert((v) => !v)}
              />
            </div>
          </ComponentExample>

          <ComponentExample title="SuiviDemandeRow — carte compacte de suivi (Espace Suivre, vue admin)">
            <div className="flex w-full max-w-sm flex-col gap-3">
              {SUIVI_DEMANDES_EXEMPLE.map((demande) => (
                <div key={demande.id} className="flex flex-col gap-1">
                  <span className="text-ink-500 px-1 text-xs font-semibold">
                    {demande.demandeur.prenom} {demande.demandeur.nom}
                  </span>
                  <div className="bg-surface-card shadow-sm">
                    <SuiviDemandeRow demande={demande} isLast />
                  </div>
                </div>
              ))}
            </div>
          </ComponentExample>

          <ComponentExample title="FieldLabel + Input">
            <div>
              <FieldLabel htmlFor="design-system-champ-exemple">Libellé de champ</FieldLabel>
              <Input
                id="design-system-champ-exemple"
                readOnly
                value="Valeur d'exemple"
                className="mt-2 w-full"
              />
            </div>
          </ComponentExample>

          <ComponentExample title="SectionLabel">
            <SectionLabel>Titre de section</SectionLabel>
          </ComponentExample>

          <ComponentExample title="Modal">
            <Button onClick={() => setModalOuverte(true)} className="rounded-full px-4 py-2">
              Ouvrir la modale
            </Button>
          </ComponentExample>

          <ComponentExample title="SoldeCard">
            <div className="grid w-full grid-cols-3 gap-3">
              <SoldeCard
                valeur={18}
                conditionPrefixe="À poser avant le"
                conditionAccent="31/05/2026"
                tone="cp"
              />
              <SoldeCard
                valeur={3}
                conditionPrefixe="À poser avant le"
                conditionAccent="31/12/2026"
                tone="rtt"
              />
              <SoldeCard
                valeur={2.25}
                conditionPrefixe="En cours d'acquisition"
                conditionAccent="juin 2026"
                tone="cpa"
              />
            </div>
          </ComponentExample>

          <ComponentExample title="MiniCalendrier">
            <MiniCalendrierDemo />
          </ComponentExample>
        </div>

        <div>
          <div className="text-ink-500 mb-2 text-xs font-semibold">ListCard</div>
          <ListCard>
            <div className="border-ink-300/60 border-b px-4 py-3 text-sm">
              Élément d&rsquo;exemple 1
            </div>
            <div className="border-ink-300/60 border-b px-4 py-3 text-sm">
              Élément d&rsquo;exemple 2
            </div>
            <div className="px-4 py-3 text-sm">Élément d&rsquo;exemple 3</div>
          </ListCard>
        </div>
      </Section>

      <Section title="Popins référentielles (DJI / CPI / Fériés)">
        <p className="text-ink-500 -mt-2 text-xs">
          Composants introduits pour les popins de <code>CalendrierPage.tsx</code> (DJI, CPI,
          Fériés) — gabarit commun : encart jour à gauche, contenu au centre, action à droite.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ComponentExample title="JourBadge — encart jour (36×36, repère court)">
            <JourBadge>Ve</JourBadge>
            <JourBadge>Lu</JourBadge>
            <JourBadge muted>Ve</JourBadge>
            <code className="text-ink-500 text-xs">muted → grisé (ex. Pentecôte travaillée)</code>
          </ComponentExample>

          <ComponentExample title="SelectPille — actif / désactivé">
            <SelectPille defaultValue="apres_midi">
              <option value="matin">Matin</option>
              <option value="apres_midi">A. midi</option>
              <option value="entiere">Journée</option>
            </SelectPille>
            <SelectPille defaultValue="apres_midi" disabled>
              <option value="matin">Matin</option>
              <option value="apres_midi">A. midi</option>
            </SelectPille>
          </ComponentExample>

          <ComponentExample title="FiltrePill (SelectFiltrePill / InputFiltrePill) — filtres de tableau">
            <SelectFiltrePill defaultValue="Toutes">
              <option value="Toutes">Toutes</option>
              <option value="Validées">Validées</option>
              <option value="Refusées">Refusées</option>
            </SelectFiltrePill>
            <InputFiltrePill type="date" aria-label="Du" />
            <code className="text-ink-500 text-xs">
              standard pour tout filtre de tableau (statut, période, recherche…) — voir /historique.
              text-xs / px-2.5 py-1, contour mint, chevron mint superposé. Distinct de SelectPille
              par l&apos;usage (filtre de page vs créneau en popin DJI/CPI), pas par la taille.
            </code>
          </ComponentExample>

          <ComponentExample title="DatePicker — champ tapable + calendrier (jours désactivables)">
            <DatePicker
              value={dateExemple}
              onChange={setDateExemple}
              disabled={(date) => date.getDay() === 0 || date.getDay() === 6}
            />
          </ComponentExample>

          <ComponentExample title="Icônes d'action — hover">
            <button
              type="button"
              aria-label="Ajouter"
              className="text-mint transition-transform duration-150 hover:scale-125"
            >
              <PlusCircle size={18} />
            </button>
            <button
              type="button"
              aria-label="Supprimer"
              className="text-status-danger-fg transition-transform duration-150 hover:scale-125"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              aria-label="Voir"
              className="text-mint transition-transform duration-150 hover:scale-125"
            >
              <Eye size={18} />
            </button>
            <code className="text-ink-500 text-xs">
              transition-transform duration-150 hover:scale-125
            </code>
          </ComponentExample>
        </div>

        <div>
          <div className="text-ink-500 mb-2 text-xs font-semibold">
            Ligne de liste — les 3 états (jour dispo / indisponible / déjà ajouté)
          </div>
          <ListCard>
            <div className="border-ink-300/60 flex items-center gap-3 border-b px-4 py-2.5 text-sm">
              <JourBadge>Ve</JourBadge>
              <span className="text-ink-900 flex-1">23 janvier</span>
              <button
                type="button"
                aria-label="Ajouter"
                className="text-mint shrink-0 transition-transform duration-150 hover:scale-125"
              >
                <PlusCircle size={18} />
              </button>
            </div>
            <div className="border-ink-300/60 flex items-center gap-3 border-b px-4 py-2.5 text-sm">
              <JourBadge muted>Ve</JourBadge>
              <span className="text-ink-500 flex-1">1 mai</span>
              <TypeBadge code="FERIE" variant="pill" />
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <JourBadge>Ve</JourBadge>
              <span className="text-ink-500 flex-1">30 janvier</span>
              <SelectPille defaultValue="apres_midi" disabled>
                <option value="apres_midi">A. midi</option>
              </SelectPille>
              <span className="text-mint">✓</span>
            </div>
          </ListCard>
        </div>

        <div>
          <div className="text-ink-500 mb-2 text-xs font-semibold">
            Popin — taille et position (prop <code>align</code> de Modal)
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setModalCentreOuverte(true)} className="rounded-full px-4 py-2">
              Modal centrée (défaut, max-w-md)
            </Button>
            <Button onClick={() => setModalHauteOuverte(true)} className="rounded-full px-4 py-2">
              Modal align=&quot;top&quot; (DJI/CPI/Fériés, max-w-4xl)
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Transitions">
        <p className="text-ink-500 text-xs">
          Deux durées standard, pas de 3<sup>e</sup> valeur sans raison :
        </p>
        <div className="flex flex-col gap-2 text-xs">
          <div className="border-ink-300/60 flex items-center justify-between gap-4 border-b py-2">
            <span className="text-ink-900">Icônes/selects — survol (scale, fond, opacité)</span>
            <code className="text-ink-500 shrink-0">transition-* duration-150</code>
          </div>
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-ink-900">
              Flash de confirmation après un ajout (ligne qui s&rsquo;estompe)
            </span>
            <code className="text-ink-500 shrink-0">transition-colors duration-700</code>
          </div>
        </div>
      </Section>

      <Section title="États">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-ink-500 mb-2 text-xs">
              Les 4 tons de <code>Badge</code> sont montrés ci-dessus (section Composants).
            </p>
          </div>

          <ComponentExample title="Champ de formulaire (Input) — normal / focus / erreur">
            <div className="flex w-full flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <FieldLabel htmlFor="design-system-champ-normal">Normal</FieldLabel>
                <Input
                  id="design-system-champ-normal"
                  placeholder="Valeur"
                  className="mt-2 w-full"
                />
              </div>
              <div className="flex-1">
                <FieldLabel htmlFor="design-system-champ-focus">Focus</FieldLabel>
                <Input
                  id="design-system-champ-focus"
                  placeholder="Valeur"
                  className="outline-brand mt-2 w-full outline-2 outline-offset-2"
                />
              </div>
              <div className="flex-1">
                <FieldLabel htmlFor="design-system-champ-erreur">
                  Avec message d&rsquo;erreur
                </FieldLabel>
                <Input
                  id="design-system-champ-erreur"
                  placeholder="Valeur"
                  error
                  className="mt-2 w-full"
                />
                <div className="rounded-control bg-status-danger-bg text-status-danger-fg mt-2 px-3 py-2 text-xs">
                  Champ obligatoire.
                </div>
              </div>
            </div>
          </ComponentExample>
        </div>
      </Section>

      {modalOuverte && (
        <Modal title="Exemple de modale" onClose={() => setModalOuverte(false)}>
          <p className="text-ink-500 text-sm">
            Contenu d&rsquo;exemple — même composant <code>Modal</code> que{" "}
            <code>ReglesCongesModal</code> et la confirmation d&rsquo;archivage.
          </p>
        </Modal>
      )}

      {modalCentreOuverte && (
        <Modal title='Modal align="center"' onClose={() => setModalCentreOuverte(false)}>
          <p className="text-ink-500 text-sm">
            Comportement par défaut — centrée verticalement, se déplace selon la hauteur du contenu.
            Convient aux petites confirmations.
          </p>
        </Modal>
      )}

      {modalHauteOuverte && (
        <Modal
          title='Modal align="top"'
          onClose={() => setModalHauteOuverte(false)}
          className="max-w-4xl"
          align="top"
        >
          <p className="text-ink-500 text-sm">
            Position stable en haut de l&rsquo;écran, indépendante de la hauteur du contenu — DJI,
            CPI et Fériés l&rsquo;utilisent toutes les trois avec <code>max-w-4xl</code> pour
            apparaître exactement au même endroit d&rsquo;une popin à l&rsquo;autre.
          </p>
        </Modal>
      )}
    </div>
  );
}
