import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className = "", ...props }: InputProps) {
  return (
    <input
      className={`rounded-control bg-surface-card text-ink-900 border px-3 py-2.5 text-sm ${
        error ? "border-status-danger-fg" : "border-ink-300"
      } ${className}`}
      {...props}
    />
  );
}
