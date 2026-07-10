interface AvatarProps {
  initiales: string;
  bordered?: boolean;
}

export function Avatar({ initiales, bordered = false }: AvatarProps) {
  return (
    <div
      className={`text-ink-900 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
        bordered ? "border-ink-300 bg-surface-card border" : "bg-ink-300"
      }`}
    >
      {initiales}
    </div>
  );
}
