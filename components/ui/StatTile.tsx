import type { LucideIcon } from "lucide-react";

export type StatTileTone = "brand" | "accent" | "ink900" | "ink400";

const TONE_CLASSES: Record<StatTileTone, string> = {
  brand: "bg-brand",
  accent: "bg-accent",
  ink900: "bg-ink-900",
  ink400: "bg-ink-400",
};

interface StatTileProps {
  icon: LucideIcon;
  value: string | number;
  unit?: string;
  label: string;
  tone: StatTileTone;
}

export function StatTile({ icon: Icon, value, unit, label, tone }: StatTileProps) {
  return (
    <div
      className={`rounded-card flex min-h-[108px] flex-col justify-between p-4 ${TONE_CLASSES[tone]}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/25">
          <Icon size={15} color="white" strokeWidth={2.25} />
        </div>
        <div className="text-[1.9rem] leading-none font-bold text-white">
          {value}
          {unit && <span className="ml-0.5 text-sm font-semibold opacity-80">{unit}</span>}
        </div>
      </div>
      <div className="text-sm font-semibold text-white">{label}</div>
    </div>
  );
}
