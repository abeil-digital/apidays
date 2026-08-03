"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/connexion/actions";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";

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
          <div className="text-ink-900 text-2xl font-semibold">Apidays</div>
          <p className="text-ink-500 text-sm">Connexion à l&rsquo;espace salarié</p>
        </div>

        <div>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-2 w-full"
          />
        </div>

        <div>
          <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-2 w-full"
          />
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
