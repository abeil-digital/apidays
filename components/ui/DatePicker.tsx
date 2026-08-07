"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { fr } from "react-day-picker/locale";
import "react-day-picker/style.css";

/**
 * Sélecteur de date custom (remplace `<input type="date">`) — nécessaire dès
 * qu'on doit désactiver visuellement des jours précis (week-ends, jours
 * fériés, congés imposés...) directement dans le calendrier, ce que le
 * widget natif du navigateur ne permet pas de styler.
 *
 * `disabled` reçoit un objet `Date` (fuseau local du navigateur) — construit
 * la date de comparaison en local, pas en UTC, pour éviter un décalage d'un
 * jour avec ce que l'utilisateur voit affiché dans la grille.
 */

interface DatePickerProps {
  id?: string;
  /** Date ISO (aaaa-mm-jj) ou chaîne vide. */
  value: string;
  onChange: (iso: string) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  className?: string;
}

function isoVersDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [annee, mois, jour] = iso.split("-").map(Number);
  return new Date(annee, mois - 1, jour);
}

function dateVersIso(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

function formatAffichage(iso: string): string {
  const date = isoVersDate(iso);
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function DatePicker({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  className = "",
}: DatePickerProps) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState(value ? formatAffichage(value) : "");
  const conteneurRef = useRef<HTMLDivElement>(null);

  // Resynchronise le texte affiché quand la date change depuis l'extérieur
  // (sélection au calendrier, reset du formulaire...) — ajustement pendant le
  // rendu plutôt que dans un effet, pattern recommandé par React pour dériver
  // un état local d'une prop sans rendu intermédiaire inutile.
  const [valeurPrecedente, setValeurPrecedente] = useState(value);
  if (value !== valeurPrecedente) {
    setValeurPrecedente(value);
    setTexte(value ? formatAffichage(value) : "");
  }

  useEffect(() => {
    if (!ouvert) return;
    function handleClicExterieur(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    function handleEchap(e: KeyboardEvent) {
      if (e.key === "Escape") setOuvert(false);
    }
    window.addEventListener("mousedown", handleClicExterieur);
    window.addEventListener("keydown", handleEchap);
    return () => {
      window.removeEventListener("mousedown", handleClicExterieur);
      window.removeEventListener("keydown", handleEchap);
    };
  }, [ouvert]);

  // Saisie clavier au format jj/mm/aaaa, en plus du choix au calendrier —
  // uniquement commise si la date est complète, valide, et pas désactivée.
  function handleTexteChange(saisie: string) {
    setTexte(saisie);
    const m = saisie.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return;
    const [, jour, mois, annee] = m;
    const iso = `${annee}-${mois}-${jour}`;
    const date = isoVersDate(iso);
    if (date && date.getMonth() === Number(mois) - 1 && !disabled?.(date)) {
      onChange(iso);
    }
  }

  return (
    <div ref={conteneurRef} className="relative flex items-center gap-2">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={texte}
        placeholder={placeholder ?? "jj/mm/aaaa"}
        onChange={(e) => handleTexteChange(e.target.value)}
        onFocus={() => setOuvert(true)}
        className={`text-ink-900 placeholder:text-ink-900 border-ink-300 w-[10ch] border-b bg-transparent px-1 py-1 text-xl ${className}`}
      />
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-label="Ouvrir le calendrier"
        className="text-ink-500 shrink-0"
      >
        <CalendarDays size={20} />
      </button>

      {ouvert && (
        <div className="bg-surface-card border-ink-300 absolute top-full left-0 z-20 mt-2 rounded-xl border p-2 shadow-lg">
          <DayPicker
            mode="single"
            locale={fr}
            selected={isoVersDate(value)}
            onSelect={(date) => {
              if (date) onChange(dateVersIso(date));
              setOuvert(false);
            }}
            disabled={disabled}
            style={{ "--rdp-accent-color": "var(--color-mint)" } as React.CSSProperties}
          />
        </div>
      )}
    </div>
  );
}
