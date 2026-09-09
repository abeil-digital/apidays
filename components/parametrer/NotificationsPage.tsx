"use client";

import { useState } from "react";
import type {
  NotifDecisionCollaborateur,
  ParametrageNotifications,
  ParametrageNotificationsInput,
} from "@/lib/types";
import { useParametrageNotifications } from "@/hooks/useParametrageNotifications";
import { Button } from "@/components/ui/Button";
import { ListCard } from "@/components/ui/ListCard";
import { SelectPille } from "@/components/ui/SelectPille";

const JOURS_SEMAINE: { valeur: number; label: string }[] = [
  { valeur: 1, label: "Lundi" },
  { valeur: 2, label: "Mardi" },
  { valeur: 3, label: "Mercredi" },
  { valeur: 4, label: "Jeudi" },
  { valeur: 5, label: "Vendredi" },
  { valeur: 6, label: "Samedi" },
  { valeur: 7, label: "Dimanche" },
];

const HEURES_BUREAU = Array.from({ length: 12 }, (_, i) => i + 8); // 8h → 19h

const OPTIONS_DECISION: { valeur: NotifDecisionCollaborateur; label: string }[] = [
  { valeur: "tous", label: "Tous" },
  { valeur: "refus_uniquement", label: "Refus uniquement" },
  { valeur: "aucune", label: "Aucune" },
];

/** Convertit une heure Paris (0-23, affichée à l'admin) en heure UTC stockée
 * en base — le cron (`app/api/cron/notifications-digest`) compare en UTC,
 * voir le commentaire de `heureRecap` dans `lib/types.ts`. Passe par une date
 * de référence arbitraire (aujourd'hui) : suffisant pour une heure de bureau
 * "approximative", pas besoin de gérer le jour lui-même. */
function heureParisVersUtc(heureParis: number): number {
  const reference = new Date();
  reference.setUTCHours(12, 0, 0, 0); // pivot neutre, hors bascule DST
  const decalage =
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(reference),
    ) - 12;
  return (heureParis - decalage + 24) % 24;
}

function heureUtcVersParis(heureUtc: number): number {
  const reference = new Date();
  reference.setUTCHours(12, 0, 0, 0);
  const decalage =
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(reference),
    ) - 12;
  return (heureUtc + decalage + 24) % 24;
}

export function NotificationsPage() {
  const { parametrage, loading, enregistrer } = useParametrageNotifications();

  if (loading || !parametrage) return null;

  return <FormulaireNotifications parametrage={parametrage} onEnregistrer={enregistrer} />;
}

function FormulaireNotifications({
  parametrage,
  onEnregistrer,
}: {
  parametrage: ParametrageNotifications;
  onEnregistrer: (input: ParametrageNotificationsInput) => Promise<ParametrageNotifications>;
}) {
  const [frequence, setFrequence] = useState(parametrage.frequence);
  const [jourRecap, setJourRecap] = useState(parametrage.jourRecap);
  const [heureRecapParis, setHeureRecapParis] = useState(heureUtcVersParis(parametrage.heureRecap));
  const [copieAdministrateur, setCopieAdministrateur] = useState(parametrage.copieAdministrateur);
  const [notifDecisionCollaborateur, setNotifDecisionCollaborateur] = useState(
    parametrage.notifDecisionCollaborateur,
  );
  const [enregistrement, setEnregistrement] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleEnregistrer() {
    setErreur("");
    setConfirmation(false);
    setEnregistrement(true);
    try {
      await onEnregistrer({
        frequence,
        jourRecap,
        heureRecap: heureParisVersUtc(heureRecapParis),
        copieAdministrateur,
        notifDecisionCollaborateur,
      });
      setConfirmation(true);
    } catch {
      setErreur("Impossible d'enregistrer les réglages.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0">
      <h1 className="text-brand-primary animate-stagger-in px-1 text-2xl font-semibold">
        Notifications
      </h1>

      <ListCard className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-brand-primary mb-2 text-sm font-bold">Notifications de demande de congés</p>
          <p className="text-ink-500 mb-3 text-xs">
            Les managers sont notifiés par e-mail des demandes d&apos;absence.
          </p>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="frequence"
                checked={frequence === "immediate"}
                onChange={() => setFrequence("immediate")}
              />
              À chaque demande
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="frequence"
                checked={frequence === "hebdomadaire"}
                onChange={() => setFrequence("hebdomadaire")}
              />
              En un mail récap hebdomadaire
            </label>
          </div>

          {frequence === "hebdomadaire" && (
            <div className="mt-3 flex items-center gap-3 pl-6">
              <SelectPille value={jourRecap} onChange={(e) => setJourRecap(Number(e.target.value))}>
                {JOURS_SEMAINE.map((j) => (
                  <option key={j.valeur} value={j.valeur}>
                    {j.label}
                  </option>
                ))}
              </SelectPille>
              <SelectPille
                value={heureRecapParis}
                onChange={(e) => setHeureRecapParis(Number(e.target.value))}
              >
                {HEURES_BUREAU.map((h) => (
                  <option key={h} value={h}>
                    {h}h
                  </option>
                ))}
              </SelectPille>
            </div>
          )}
          {frequence === "hebdomadaire" && (
            <p className="text-ink-500 mt-2 pl-6 text-xs">
              Heure indicative — l&apos;envoi a lieu une fois par jour, à partir de cette heure.
            </p>
          )}
        </div>

        <div className="bg-mint-tint flex items-center justify-between rounded-xl px-3 py-2">
          <span className="text-ink-900 text-xs font-semibold">Copie carbone administrateur</span>
          <button
            type="button"
            role="switch"
            aria-checked={copieAdministrateur}
            aria-label="Copie carbone administrateur"
            onClick={() => setCopieAdministrateur((v) => !v)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${
              copieAdministrateur ? "bg-mint" : "bg-ink-300"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] duration-150 ${
                copieAdministrateur ? "left-4" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </ListCard>

      <ListCard className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-brand-primary mb-2 text-sm font-bold">
            Notifications de décisions de demandes (collaborateurs)
          </p>
          <p className="text-ink-500 mb-3 text-xs">
            Les collaborateurs sont notifiés des réponses à leurs demandes.
          </p>

          <div className="flex flex-col gap-2">
            {OPTIONS_DECISION.map((option) => (
              <label key={option.valeur} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="notifDecisionCollaborateur"
                  checked={notifDecisionCollaborateur === option.valeur}
                  onChange={() => setNotifDecisionCollaborateur(option.valeur)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </ListCard>

      {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}
      {confirmation && <p className="text-mint text-xs font-semibold">Réglages enregistrés.</p>}

      <Button
        type="button"
        disabled={enregistrement}
        onClick={handleEnregistrer}
        className="w-fit rounded-full px-4 py-1.5 text-xs"
      >
        Enregistrer
      </Button>
    </div>
  );
}
