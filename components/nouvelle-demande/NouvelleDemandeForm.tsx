"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";
import type { TypeDemande } from "@/lib/types";
import { formatJours, nombreJours } from "@/lib/format";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldes } from "@/hooks/useSoldes";
import { BackHeader } from "@/components/ui/BackHeader";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

interface OptionType {
  key: string;
  label: string;
  type: TypeDemande;
  isAnticipation: boolean;
}

// "Congés anticipés" n'est pas un type d'absence à part en base : c'est un CP
// (type "CP") posé avec is_anticipation=true, qui consomme le solde théorique
// plutôt que le solde réel — voir BASE-DE-DONNEES.md.
const OPTIONS: OptionType[] = [
  { key: "CP", label: "Congés Payés", type: "CP", isAnticipation: false },
  { key: "RTT", label: "RTT", type: "RTT", isAnticipation: false },
  { key: "CP_ANTICIPE", label: "Congés anticipés", type: "CP", isAnticipation: true },
  { key: "CSS", label: "Congé sans solde", type: "CSS", isAnticipation: false },
  { key: "CE", label: "Congé exceptionnel", type: "CE", isAnticipation: false },
  { key: "RECUP", label: "Récupération", type: "RECUP", isAnticipation: false },
  { key: "EVT_FAM", label: "Événement Familial", type: "EVT_FAM", isAnticipation: false },
];

export function NouvelleDemandeForm() {
  const { ajouterDemande } = useDemandes();
  const { soldes } = useSoldes();

  const [optionKey, setOptionKey] = useState("CP");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const option = OPTIONS.find((o) => o.key === optionKey)!;

  const soldeActuel = soldes
    ? optionKey === "CP"
      ? soldes.cp.valeur
      : optionKey === "RTT"
        ? soldes.rtt.valeur
        : optionKey === "CP_ANTICIPE"
          ? soldes.cpt.valeur
          : null
    : null;
  const joursDemandes = debut && fin && fin >= debut ? nombreJours(debut, fin) : null;
  const soldeApres =
    soldeActuel !== null && joursDemandes !== null ? soldeActuel - joursDemandes : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!debut || !fin) {
      setError("Merci d'indiquer une date de début et de fin.");
      return;
    }
    if (fin < debut) {
      setError("La date de fin doit être après la date de début.");
      return;
    }

    setError("");
    await ajouterDemande({
      type: option.type,
      isAnticipation: option.isAnticipation,
      debut,
      fin,
      note,
    });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-4 py-16 text-center md:max-w-2xl">
        <div className="bg-status-success-bg flex h-14 w-14 items-center justify-center rounded-full">
          <CheckCircle2 size={28} className="text-status-success-fg" />
        </div>
        <div>
          <div className="text-ink-900 text-2xl font-semibold">Demande envoyée</div>
          <p className="text-ink-500 mt-1 max-w-xs text-sm">
            Votre manager va recevoir un e-mail et pourra approuver ou refuser cette demande.
          </p>
        </div>
        <Button href="/" className="rounded-full px-5 py-2.5">
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0">
      <BackHeader href="/" title="Nouvelle demande" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <FieldLabel htmlFor="type">Type</FieldLabel>
          <Select
            id="type"
            value={optionKey}
            onChange={(e) => setOptionKey(e.target.value)}
            className="mt-2 w-full"
          >
            {OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="debut">Date de début</FieldLabel>
            <Input
              id="debut"
              type="date"
              value={debut}
              onChange={(e) => setDebut(e.target.value)}
              className="mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel htmlFor="fin">Date de fin</FieldLabel>
            <Input
              id="fin"
              type="date"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className="mt-2 w-full"
            />
          </div>
        </div>

        {soldeActuel !== null ? (
          <div className="rounded-control bg-surface-card flex flex-col gap-1.5 px-3.5 py-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-500">Solde {option.label} actuel</span>
              <span className="text-ink-900 font-bold">{formatJours(soldeActuel)} j</span>
            </div>
            {soldeApres !== null && (
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Solde {option.label} après cette demande</span>
                <span
                  className={`font-bold ${soldeApres < 0 ? "text-status-danger-fg" : "text-ink-900"}`}
                >
                  {formatJours(soldeApres)} j
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-ink-500 px-1 text-xs">
            Aucun solde associé à ce type d&rsquo;absence.
          </p>
        )}

        <div>
          <FieldLabel htmlFor="note">Message pour le manager (facultatif)</FieldLabel>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ex. mariage d'un proche, rendez-vous médical…"
            className="mt-2 w-full"
          />
        </div>

        {error && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {error}
          </div>
        )}

        <Button type="submit" className="rounded-card w-fit self-start px-6 py-3.5">
          <Send size={16} />
          Envoyer la demande
        </Button>
      </form>
    </div>
  );
}
