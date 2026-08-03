import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`rounded-control bg-surface-card text-ink-900 resize-none border px-3 py-2.5 text-sm ${
        error ? "border-status-danger-fg" : "border-ink-300"
      } ${className}`}
      {...props}
    />
  );
}
