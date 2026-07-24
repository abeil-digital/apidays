"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Coffee, Send, Sun } from "lucide-react";
import type { TypeDemande } from "@/lib/types";
import { formatJours, nombreJours } from "@/lib/format";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldes } from "@/hooks/useSoldes";
import { BackHeader } from "@/components/ui/BackHeader";
import { FieldLabel } from "@/components/ui/FieldLabel";

const TYPES: { key: TypeDemande; label: string; Icon: typeof Sun }[] = [
  { key: "CP", label: "Congé payé", Icon: Sun },
  { key: "RTT", label: "RTT", Icon: Coffee },
];

export function NouvelleDemandeForm() {
  const { ajouterDemande } = useDemandes();
  const { soldes } = useSoldes();

  const [type, setType] = useState<TypeDemande>("CP");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const soldeActuel = soldes ? (type === "CP" ? soldes.cp.valeur : soldes.rtt.valeur) : null;
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
    await ajouterDemande({ type, debut, fin, note });
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-4 py-16 text-center md:max-w-2xl">
        <div className="bg-status-success-bg flex h-14 w-14 items-center justify-center rounded-full">
          <CheckCircle2 size={28} className="text-status-success-fg" />
        </div>
        <div>
          <div className="text-ink-900 text-[1.3rem] font-bold">Demande envoyée</div>
          <p className="text-ink-500 mt-1 max-w-xs text-sm">
            Votre manager va recevoir un e-mail et pourra approuver ou refuser cette demande.
          </p>
        </div>
        <Link
          href="/"
          className="bg-brand text-brand-foreground rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0">
      <BackHeader href="/" title="Nouvelle demande" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <FieldLabel>Type</FieldLabel>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TYPES.map(({ key, label, Icon }) => {
              const active = type === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setType(key)}
                  className={`rounded-control flex flex-col items-center gap-1.5 py-3 text-sm font-semibold ${
                    active
                      ? "bg-brand text-brand-foreground"
                      : "bg-surface-card text-ink-900 shadow-sm"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="debut">Date de début</FieldLabel>
            <input
              id="debut"
              type="date"
              value={debut}
              onChange={(e) => setDebut(e.target.value)}
              className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <FieldLabel htmlFor="fin">Date de fin</FieldLabel>
            <input
              id="fin"
              type="date"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        {soldeActuel !== null && (
          <div className="rounded-control bg-surface-card flex flex-col gap-1.5 px-3.5 py-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-500">Solde {type} actuel</span>
              <span className="text-ink-900 font-bold">{formatJours(soldeActuel)} j</span>
            </div>
            {soldeApres !== null && (
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Solde {type} après cette demande</span>
                <span
                  className={`font-bold ${soldeApres < 0 ? "text-status-danger-fg" : "text-ink-900"}`}
                >
                  {formatJours(soldeApres)} j
                </span>
              </div>
            )}
          </div>
        )}

        <div>
          <FieldLabel htmlFor="note">Message pour le manager (facultatif)</FieldLabel>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ex. mariage d'un proche, rendez-vous médical…"
            className="rounded-control bg-surface-app text-ink-900 mt-2 w-full resize-none px-3 py-2.5 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="rounded-card bg-brand text-brand-foreground flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold"
        >
          <Send size={16} />
          Envoyer la demande
        </button>
      </form>
    </div>
  );
}
