import Link from "next/link";
import { notFound } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { fetchBrandingParSlug } from "@/lib/data/brandingPublic";

/**
 * Page intermédiaire entre le lien email et /auth/confirm (07/09/2026,
 * correctif) — les liens d'invitation/réinitialisation sont souvent
 * "cliqués" automatiquement par les scanners anti-phishing des clients
 * mail (surtout quand l'email tombe en spam), ce qui consomme le token à
 * usage unique avant le vrai clic de l'utilisateur. En intercalant cette
 * page (chargée sans effet de bord — elle ne consomme rien), seul un vrai
 * clic humain sur le bouton déclenche la vérification côté
 * `/auth/confirm`, qui elle seule appelle `verifyOtp`.
 *
 * `type` en segment de route plutôt qu'en paramètre de requête, et `next`
 * codé en dur ci-dessous plutôt que transmis par email (07/09/2026,
 * contournement) — constaté empiriquement que le rendu des templates email
 * Supabase corrompt tout paramètre de requête au-delà du premier
 * (`token_hash`) : vidé pour `type`, tronqué avec des "..." pour `next`,
 * y compris avec du texte 100% statique dans le template (vérifié sur le
 * HTML brut de l'email reçu, hors influence de l'éditeur du dashboard).
 * Un seul paramètre dans l'URL email (`token_hash`) contourne le problème.
 *
 * `slug` (09/09/2026, e-mails d'invitation brandés par tenant) fait
 * exception à la mise en garde ci-dessus : il n'est plus ajouté par un
 * template Supabase (celui-ci n'envoie plus l'e-mail d'invitation, voir
 * `lib/resend/invitation.ts`) mais construit par l'app elle-même dans le
 * HTML qu'elle envoie via Resend — aucun risque de corruption. Propagé
 * dans `next` vers `/connexion/definir-mot-de-passe` (`app/auth/confirm/route.ts`
 * relaie déjà `next` verbatim, aucun changement nécessaire là-bas).
 */
const TYPES_VALIDES: EmailOtpType[] = ["invite", "recovery"];
const NEXT_PAR_DEFAUT = "/connexion/definir-mot-de-passe";

export default async function ConfirmerPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ token_hash?: string; slug?: string }>;
}) {
  const { type } = await params;
  const { token_hash, slug } = await searchParams;
  const branding = await fetchBrandingParSlug(slug);

  if (!TYPES_VALIDES.includes(type as EmailOtpType)) {
    notFound();
  }

  const lienInvalide = !token_hash;
  const next = slug ? `${NEXT_PAR_DEFAUT}?slug=${encodeURIComponent(slug)}` : NEXT_PAR_DEFAUT;
  const lienConfirmation = `/auth/confirm?token_hash=${encodeURIComponent(
    token_hash ?? "",
  )}&type=${type}&next=${encodeURIComponent(next)}`;

  return (
    <div className="bg-surface-app flex min-h-screen items-center justify-center px-4">
      <div className="bg-surface-card rounded-card flex w-full max-w-sm flex-col items-start gap-5 p-6 shadow-sm">
        <div className="flex flex-col items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG statique */}
          <img
            src={branding.logoUrlFondClair ?? "/logo-abeil-fond-clair.png"}
            alt={branding.nom}
            width={1676}
            height={710}
            className="h-12 w-auto"
          />
          <p className="text-ink-900 text-xl font-semibold">
            {lienInvalide ? "Lien invalide" : "Bienvenue sur Apidays"}
          </p>
          <p className="text-ink-500 text-sm">
            {lienInvalide
              ? "Ce lien est invalide."
              : "Cliquez pour continuer et accéder à votre compte."}
          </p>
        </div>

        {lienInvalide ? (
          <Link href="/connexion" className="text-ink-500 text-xs hover:underline">
            Retour à la connexion
          </Link>
        ) : (
          // <a> classique, pas <Link> (08/09/2026, correctif) — Link
          // précharge automatiquement sa cible dès qu'il entre dans le
          // viewport en prod (invisible en dev, d'où le bug non détecté en
          // local) : ça consommait le token à usage unique AVANT le vrai
          // clic, provoquant "lien invalide" au clic réel juste après.
          <a
            href={lienConfirmation}
            className="rounded-card bg-slate hover:bg-slate/90 w-full px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Continuer
          </a>
        )}
      </div>
    </div>
  );
}
