import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error, className = "", children, ...props }: SelectProps) {
  return (
    <select
      className={`rounded-control bg-surface-card text-ink-900 border px-3 py-2.5 text-sm ${
        error ? "border-status-danger-fg" : "border-ink-300"
      } ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
