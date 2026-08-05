import type { ReactNode } from "react";

interface ListCardProps {
  children: ReactNode;
  className?: string;
}

export function ListCard({ children, className = "" }: ListCardProps) {
  return (
    <div className={`rounded-card bg-surface-card overflow-hidden ${className}`}>{children}</div>
  );
}
