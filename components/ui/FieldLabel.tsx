import type { ReactNode } from "react";

interface FieldLabelProps {
  children: ReactNode;
  htmlFor?: string;
}

export function FieldLabel({ children, htmlFor }: FieldLabelProps) {
  return (
    <label htmlFor={htmlFor} className="text-ink-500 px-1 text-xs font-bold">
      {children}
    </label>
  );
}
