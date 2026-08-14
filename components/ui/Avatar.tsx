interface AvatarProps {
  initiales: string;
}

export function Avatar({ initiales }: AvatarProps) {
  return (
    <div className="text-slate border-ink-300 flex h-9 w-9 items-center justify-center rounded-full border bg-white text-xs font-bold">
      {initiales}
    </div>
  );
}
