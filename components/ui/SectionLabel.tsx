import type { ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <div className="text-ink-900 px-1 text-sm font-bold">{children}</div>;
}
