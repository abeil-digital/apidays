import { Coffee, Sun } from "lucide-react";
import type { TypeDemande } from "@/lib/types";

interface RowIconProps {
  type: TypeDemande;
}

export function RowIcon({ type }: RowIconProps) {
  const isCp = type === "CP";

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isCp ? "bg-brand" : "bg-ink-400"}`}
    >
      {isCp ? (
        <Sun size={16} color="white" strokeWidth={2.25} />
      ) : (
        <Coffee size={16} color="white" strokeWidth={2.25} />
      )}
    </div>
  );
}
