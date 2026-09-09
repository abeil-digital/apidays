"use client";

import { Suspense, useActionState, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { login, type LoginState } from "@/app/connexion/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const INITIAL_STATE: LoginState = {};

// Défaut = charte Abeil (`app/globals.css`) — affiché le temps du fetch
// vers `/api/branding-public`, voir plus bas. `logoUrlFondClair` à `null` :
// fallback sur `/logo-abeil-fond-clair.png` (09/09/2026, phase logo).
const BRANDING_DEFAUT = {
  couleurNavy: "#001e32",
  couleurJaune: "#ebc850",
  logoUrlFondClair: null as string | null,
};

// `useSearchParams()` (pour `next`, voir plus bas) exige une frontière
// Suspense pour rester prérendable statiquement — sinon `next build` échoue
// ("should be wrapped in a suspense boundary").
export default function ConnexionPage() {
  return (
    <Suspense>
      <FormulaireConnexion />
    </Suspense>
  );
}

function FormulaireConnexion() {
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);
  // Posé par `proxy.ts` avant de rediriger ici (ex. lien de notification
  // email) — retransmis à `login()` via un champ caché pour y renvoyer une
  // fois connecté, voir `app/connexion/actions.ts`.
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  // Posé par `app/t/[slug]/route.ts` (09/09/2026, résolution par chemin) —
  // transmis tel quel à `/api/branding-public`, voir plus bas.
  const slug = searchParams.get("slug");

  // Résolution du tenant par sous-domaine OU par chemin (09/09/2026, phase
  // routing) — avant connexion, la RLS ne permet pas de lire `entreprises`
  // (réservée à l'entreprise de l'utilisateur déjà connecté), d'où cette
  // route publique dédiée plutôt qu'un accès direct à la table. Bref flash
  // de la couleur Abeil par défaut le temps du fetch, assumé (page très
  // simple).
  const [branding, setBranding] = useState(BRANDING_DEFAUT);
  useEffect(() => {
    let cancelled = false;
    const url = slug ? `/api/branding-public?slug=${encodeURIComponent(slug)}` : "/api/branding-public";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled)
          setBranding({
            couleurNavy: data.couleurNavy,
            couleurJaune: data.couleurJaune,
            logoUrlFondClair: data.logoUrlFondClair,
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div
      className="bg-surface-app flex min-h-screen items-center justify-center px-4"
      style={
        {
          "--color-brand-primary": branding.couleurNavy,
          "--color-brand-accent": branding.couleurJaune,
        } as CSSProperties
      }
    >
      <form
        action={formAction}
        className="bg-surface-card rounded-card flex w-full max-w-sm flex-col gap-5 p-6 shadow-sm"
      >
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col items-start gap-3">
          {/* Version couleur fond clair (07/09/2026, Charte-abeil/2026_New_Logo)
              — le logo blanc (`logo-abeil.svg`, utilisé sur `HeaderBar`) n'a
              de sens que sur fond navy ; celui-ci est pensé pour un fond
              clair, pas besoin de bandeau sombre autour. Largeur/hauteur
              explicites (ratio réel du fichier, 2552x1532) pour ne pas
              dépendre d'un `w-auto` recalculé par le navigateur avant le
              chargement de l'image, qui étirait le logo le temps du calcul. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG statique */}
          <img
            src={branding.logoUrlFondClair ?? "/logo-abeil-fond-clair.png"}
            alt="Abeil"
            width={1676}
            height={710}
            className="h-12 w-auto"
          />
          <p className="text-brand-primary text-xl font-semibold">Bienvenue sur Apidays</p>
        </div>

        <div>
          <label htmlFor="email" className="text-brand-primary mb-1.5 block text-sm font-bold">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="text"
            required
            autoComplete="email"
            placeholder="votre email"
            className="!border-slate w-full rounded-md text-xs"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-brand-primary mb-1.5 block text-sm font-bold">
            Mot de passe
          </label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={afficherMotDePasse ? "text" : "password"}
              required
              autoComplete="current-password"
              className="!border-slate w-full rounded-md pr-10 text-xs"
            />
            <button
              type="button"
              onClick={() => setAfficherMotDePasse((v) => !v)}
              aria-label={
                afficherMotDePasse ? "Masquer le mot de passe" : "Afficher le mot de passe"
              }
              className="text-ink-500 hover:text-ink-900 absolute top-1/2 right-3 -translate-y-1/2"
            >
              {afficherMotDePasse ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-1.5 text-right">
            <Link
              href="/connexion/mot-de-passe-oublie"
              className="text-ink-500 text-xs hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        {state.error && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {state.error}
          </div>
        )}

        <Button type="submit" disabled={pending} className="rounded-card w-full py-3">
          {pending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>
    </div>
  );
}
