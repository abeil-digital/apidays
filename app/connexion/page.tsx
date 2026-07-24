"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/connexion/actions";
import { FieldLabel } from "@/components/ui/FieldLabel";

const INITIAL_STATE: LoginState = {};

export default function ConnexionPage() {
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);

  return (
    <div className="bg-surface-app flex min-h-full items-center justify-center px-4">
      <form
        action={formAction}
        className="bg-surface-card rounded-card flex w-full max-w-sm flex-col gap-5 p-6 shadow-sm"
      >
        <div>
          <div className="text-ink-900 text-[1.3rem] font-bold">Apidays</div>
          <p className="text-ink-500 text-sm">Connexion à l&rsquo;espace salarié</p>
        </div>

        <div>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-control bg-surface-app text-ink-900 mt-2 w-full px-3 py-2.5 text-sm"
          />
        </div>

        {state.error && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-card bg-brand text-brand-foreground w-full py-3 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
