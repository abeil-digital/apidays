import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface BackHeaderProps {
  href: string;
  title: string;
}

export function BackHeader({ href, title }: BackHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Link
        href={href}
        aria-label="Retour"
        className="bg-surface-card text-ink-900 flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm"
      >
        <ChevronLeft size={18} />
      </Link>
      <h1 className="text-slate text-2xl font-semibold">{title}</h1>
    </div>
  );
}
