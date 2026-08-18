"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  /** Couleur du picto calendrier — opt-in, défaut inchangé (`text-ink-500`)
   * pour les appelants existants (popin CPI). Utilisé par "Poser un jour"
   * (18/08/2026) en blanc, sur fond `bg-mint-tint`. */
  iconClassName?: string;
  /** Couleur d'accent du calendrier ouvert (jour sélectionné/survolé) —
   * valeur CSS `color` valide (ex. `var(--color-cp)`). Opt-in, défaut
   * inchangé (`var(--color-mint)`) pour les appelants existants (popin
   * CPI). "Poser un jour" (18/08/2026) l'accorde à la couleur du type de
   * congé choisi. */
  accentColor?: string;
  /** Réduit légèrement la taille du champ de saisie et de la grille du
   * calendrier ouvert — opt-in, défaut inchangé pour les appelants
   * existants (popin CPI). Utilisé par "Poser un jour" (18/08/2026), le
   * `jj/mm/aaaa` étant en `text-xl` d'origine, un peu grand dans ce
   * contexte. */
  compact?: boolean;
  /** Date ISO à matérialiser dans la grille par un rond plein (couleur
   * `accentColor`), sans que ce soit la date sélectionnée de CE picker —
   * opt-in, ignoré par défaut. Utilisé par "Poser un jour" (18/08/2026) sur
   * le picker "Au" pour garder repère visuel de la date "Du" déjà choisie une
   * fois qu'on choisit la fin de période. */
  dateMarquee?: string;
  /** Mois ISO (aaaa-mm-jj, jour ignoré) sur lequel ouvrir la grille — opt-in,
   * défaut inchangé (mois de `value`, sinon mois courant). Utilisé par
   * "Poser un jour" (18/08/2026) sur le picker "Au" pour s'ouvrir sur le mois
   * de la date "Du" plutôt que toujours le mois courant, qui n'a pas de sens
   * une fois qu'on a déjà choisi un début de période ailleurs dans l'année. */
  moisInitial?: string;
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
  iconClassName = "text-ink-500",
  accentColor = "var(--color-mint)",
  compact = false,
  dateMarquee,
  moisInitial,
}: DatePickerProps) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState(value ? formatAffichage(value) : "");
  const [positionPopover, setPositionPopover] = useState<{ top: number; left: number } | null>(
    null,
  );
  const conteneurRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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
      const cible = e.target as Node;
      if (
        conteneurRef.current &&
        !conteneurRef.current.contains(cible) &&
        !popoverRef.current?.contains(cible)
      ) {
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

  // Le calendrier est affiché dans un portail (`document.body`), en position
  // fixe recalculée au clavier/scroll — sinon, ouvert depuis une popin dont le
  // corps scrolle (`Modal`, 18/08/2026), un calendrier `position: absolute`
  // classique se retrouve rogné par l'`overflow-y-auto` du conteneur dès
  // qu'il dépasse la zone visible, au lieu de rester au-dessus de tout.
  useEffect(() => {
    if (!ouvert) return;
    function positionner() {
      const rect = conteneurRef.current?.getBoundingClientRect();
      if (rect) setPositionPopover({ top: rect.bottom + 8, left: rect.left });
    }
    positionner();
    window.addEventListener("scroll", positionner, true);
    window.addEventListener("resize", positionner);
    return () => {
      window.removeEventListener("scroll", positionner, true);
      window.removeEventListener("resize", positionner);
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
        className={`text-ink-900 placeholder:text-ink-900 border-ink-300 w-[10ch] border-b bg-transparent px-1 py-1 ${compact ? "text-lg" : "text-xl"} ${className}`}
      />
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-label="Ouvrir le calendrier"
        className={`shrink-0 ${iconClassName}`}
      >
        <CalendarDays size={20} />
      </button>

      {ouvert &&
        positionPopover &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ top: positionPopover.top, left: positionPopover.left }}
            className={`bg-surface-card border-ink-300 fixed z-50 rounded-xl border p-2 shadow-lg ${compact ? "text-sm" : ""}`}
          >
            <DayPicker
              mode="single"
              locale={fr}
              selected={isoVersDate(value)}
              defaultMonth={isoVersDate(moisInitial ?? value)}
              onSelect={(date) => {
                if (date) onChange(dateVersIso(date));
                setOuvert(false);
              }}
              disabled={disabled}
              modifiers={dateMarquee ? { marquee: [isoVersDate(dateMarquee)!] } : undefined}
              modifiersClassNames={{ marquee: "rdp-jour-marque" }}
              style={
                {
                  "--rdp-accent-color": accentColor,
                  ...(compact && {
                    "--rdp-day-width": "38px",
                    "--rdp-day-height": "38px",
                    "--rdp-day_button-width": "36px",
                    "--rdp-day_button-height": "36px",
                  }),
                } as React.CSSProperties
              }
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
