import { assertSuperAdmin } from "@/lib/supabase/superAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateAction } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { TenantsToast } from "@/components/admin/TenantsToast";
import { SupprimerTenantButton } from "@/components/admin/SupprimerTenantButton";

// Abeil = seul tenant réel — jamais de bouton de suppression sur sa ligne
// (voir aussi la protection en dur côté action, `app/admin/actions.ts`).
const ID_ABEIL = "c52b18b8-73b0-403c-990c-b2b4894acb92";

interface TenantResume {
  id: string;
  nom: string;
  slug: string;
  createdAt: string;
  nbUtilisateurs: number;
}

async function fetchTenants(): Promise<TenantResume[]> {
  const admin = createAdminClient();

  const [{ data: entreprises }, { data: utilisateurs }] = await Promise.all([
    admin.from("entreprises").select("id, nom, slug, created_at").order("created_at"),
    admin.from("utilisateurs").select("entreprise_id"),
  ]);

  const nbParEntreprise = new Map<string, number>();
  for (const u of utilisateurs ?? []) {
    nbParEntreprise.set(u.entreprise_id, (nbParEntreprise.get(u.entreprise_id) ?? 0) + 1);
  }

  return (entreprises ?? []).map((e) => ({
    id: e.id,
    nom: e.nom,
    slug: e.slug,
    createdAt: e.created_at,
    nbUtilisateurs: nbParEntreprise.get(e.id) ?? 0,
  }));
}

/**
 * Liste des tenants (09/09/2026, flux d'onboarding) — lecture + suppression
 * uniquement (ajoutée après le premier test réel, pour nettoyer les
 * tenants de test) ; édition (couleurs/logo/nom) toujours hors scope, voir
 * Backlog.md. `service_role` : `entreprises` n'a aucune policy SELECT
 * ouverte à tous les tenants (par design, voir schema.sql) —
 * `assertSuperAdmin()` revérifie l'autorité avant tout accès, `proxy.ts`
 * n'est qu'une première ligne de défense côté route.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ cree?: string }>;
}) {
  await assertSuperAdmin();
  const tenants = await fetchTenants();
  const { cree } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <TenantsToast nomCree={cree} />

      <div className="flex items-center justify-between">
        <h1 className="text-ink-900 text-2xl font-semibold">Tenants</h1>
        <Button href="/admin/nouveau">Créer un tenant</Button>
      </div>

      <div className="bg-surface-card rounded-card overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-ink-300 text-ink-500 border-b">
              <th className="px-4 py-3 font-semibold">Nom</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">Créé le</th>
              <th className="px-4 py-3 font-semibold">Utilisateurs</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-ink-300 border-b last:border-0">
                <td className="text-ink-900 px-4 py-3 font-medium">{tenant.nom}</td>
                <td className="text-ink-500 px-4 py-3">{tenant.slug}</td>
                <td className="text-ink-500 px-4 py-3">{formatDateAction(tenant.createdAt.slice(0, 10))}</td>
                <td className="text-ink-500 px-4 py-3">{tenant.nbUtilisateurs}</td>
                <td className="px-4 py-3 text-right">
                  {tenant.id !== ID_ABEIL && (
                    <SupprimerTenantButton id={tenant.id} nom={tenant.nom} slug={tenant.slug} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
