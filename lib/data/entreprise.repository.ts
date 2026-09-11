import { createClient } from "@/lib/supabase/client";

export interface EntrepriseCourante {
  /** "À partir de quand Apidays fait foi" pour ce tenant (11/09/2026,
   * Backlog #73) — `null` pour les tenants créés avant ce champ (Abeil...),
   * dont le comportement ne doit rester borné par rien. */
  dateDebutUtilisation: string | null;
}

/**
 * Données de l'entreprise de l'utilisateur connecté, côté client (11/09/2026,
 * épine dorsale du plafond "date de début d'utilisation de l'outil" —
 * Transmissions paie, Calendrier...). Même principe que
 * `fetchBrandingCourant` (`branding.repository.ts`, server-only) : pas de
 * `.eq()`, la policy RLS sur `entreprises` (`id = my_entreprise_id()`)
 * restreint déjà `.single()` à la bonne ligne — mais celui-ci est
 * volontairement client (`lib/supabase/client.ts`), pour les écrans "use
 * client" profonds que `fetchBrandingCourant` (appelé une fois dans
 * `app/(app)/layout.tsx`) n'atteint pas.
 */
export async function fetchEntrepriseCourante(): Promise<EntrepriseCourante> {
  const supabase = createClient();

  const { data } = await supabase.from("entreprises").select("date_debut_utilisation").single();

  return { dateDebutUtilisation: data?.date_debut_utilisation ?? null };
}
