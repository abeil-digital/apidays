interface EmptyRowProps {
  text: string;
}

export function EmptyRow({ text }: EmptyRowProps) {
  return <div className="bg-surface-card text-ink-500 px-4 py-4 text-sm">{text}</div>;
}
