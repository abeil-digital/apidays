"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { login, type LoginState } from "@/app/connexion/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const INITIAL_STATE: LoginState = {};

/**
 * Page de connexion dédiée à l'administration (09/09/2026) — distincte de
 * `/connexion`, volontairement neutre (pas de logo/couleurs de tenant) :
 * se connecter à l'espace super-admin via un écran estampillé Abeil (ou
 * n'importe quel tenant résolu par sous-domaine) n'a pas de sens
 * logiquement, remarque de Vincent en testant le flux d'onboarding.
 * Hérite du layout `app/admin/layout.tsx` (bandeau "Administration —
 * Apidays"), pas d'`AppShell`. `proxy.ts` redirige ici tout visiteur non
 * connecté sur `/admin/*` (et non plus vers `/connexion`) ; réutilise le
 * même Server Action `login()` que la connexion tenant — l'authentification
 * elle-même est unique dans l'app, seul l'habillage change.
 */
export default function AdminConnexionPage() {
  return (
    <Suspense>
      <FormulaireConnexionAdmin />
    </Suspense>
  );
}

function FormulaireConnexionAdmin() {
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);
  const next = useSearchParams().get("next") ?? "/admin";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form
        action={formAction}
        className="bg-surface-card rounded-card flex w-full max-w-sm flex-col gap-5 p-6 shadow-sm"
      >
        <input type="hidden" name="next" value={next} />
        <p className="text-ink-900 text-xl font-semibold">Connexion — Administration</p>

        <div>
          <label htmlFor="email" className="text-ink-900 mb-1.5 block text-sm font-bold">
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
          <label htmlFor="password" className="text-ink-900 mb-1.5 block text-sm font-bold">
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
