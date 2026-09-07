import Link from "next/link";
import { notFound } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";

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
 */
const TYPES_VALIDES: EmailOtpType[] = ["invite", "recovery"];
const NEXT_PAR_DEFAUT = "/connexion/definir-mot-de-passe";

export default async function ConfirmerPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { type } = await params;
  const { token_hash } = await searchParams;

  if (!TYPES_VALIDES.includes(type as EmailOtpType)) {
    notFound();
  }

  const lienInvalide = !token_hash;
  const lienConfirmation = `/auth/confirm?token_hash=${encodeURIComponent(
    token_hash ?? "",
  )}&type=${type}&next=${encodeURIComponent(NEXT_PAR_DEFAUT)}`;

  return (
    <div className="bg-surface-app flex min-h-full items-center justify-center px-4">
      <div className="bg-surface-card rounded-card flex w-full max-w-sm flex-col gap-5 p-6 text-center shadow-sm">
        <div>
          <div className="text-ink-900 text-2xl font-semibold">Apidays</div>
          <p className="text-ink-500 mt-2 text-sm">
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
          <Link
            href={lienConfirmation}
            className="bg-slate hover:bg-slate/90 rounded-card w-full px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Continuer
          </Link>
        )}
      </div>
    </div>
  );
}
