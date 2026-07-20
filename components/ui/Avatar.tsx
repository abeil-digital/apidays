interface AvatarProps {
  initiales: string;
}

export function Avatar({ initiales }: AvatarProps) {
  return (
    <div className="text-slate flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold">
      {initiales}
    </div>
  );
}
