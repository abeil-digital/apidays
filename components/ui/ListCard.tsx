import type { ReactNode } from "react";

interface ListCardProps {
  children: ReactNode;
}

export function ListCard({ children }: ListCardProps) {
  return <div className="rounded-card bg-surface-card overflow-hidden">{children}</div>;
}
