export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatRange(debut: string, fin: string): string {
  if (debut === fin) return formatDate(debut);

  const d1 = new Date(`${debut}T00:00:00`);
  const d2 = new Date(`${fin}T00:00:00`);
  const sameMonth = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

  if (sameMonth) {
    const day1 = new Intl.DateTimeFormat("fr-FR", { day: "numeric" }).format(d1);
    return `${day1} – ${formatDate(fin)}`;
  }

  return `${formatDate(debut)} – ${formatDate(fin)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
