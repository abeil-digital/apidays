import Link from "next/link";

/**
 * Placeholder (10/09/2026) — contenu réel (SIREN, adresse, capital social,
 * hébergeur, directeur de publication...) pas encore rédigé, voir
 * Backlog.md. Page volontairement minimale tant que le vrai contenu
 * juridique n'est pas fourni par Vincent.
 */
export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-1 py-8">
      <h1 className="text-ink-900 text-2xl font-semibold">Mentions légales</h1>
      <p className="text-ink-500 text-sm">Cette page sera complétée prochainement.</p>
      <Link href="/" className="text-ink-500 text-sm hover:underline">
        ← Retour
      </Link>
    </div>
  );
}
