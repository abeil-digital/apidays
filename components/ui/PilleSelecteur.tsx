interface PilleSelecteurOption<T extends string> {
  value: T;
  label: string;
}

interface PilleSelecteurProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: PilleSelecteurOption<T>[];
  className?: string;
}

/** Sélecteur à pilules (segmented control) — alternative compacte à un menu
 * déroulant pour un petit nombre d'options mutuellement exclusives. */
export function PilleSelecteur<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: PilleSelecteurProps<T>) {
  return (
    <div className={`inline-flex gap-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            value === option.value
              ? "bg-brand text-brand-foreground"
              : "bg-surface-card text-ink-500"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
