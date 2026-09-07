"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  demanderReinitialisation,
  type MotDePasseOublieState,
} from "@/app/connexion/mot-de-passe-oublie/actions";
import { Button } from "@/components/ui/Button";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Input } from "@/components/ui/Input";

const INITIAL_STATE: MotDePasseOublieState = {};

export default function MotDePasseOubliePage() {
  const [state, formAction, pending] = useActionState(demanderReinitialisation, INITIAL_STATE);

  return (
    <div className="bg-surface-app flex min-h-full items-center justify-center px-4">
      <div className="bg-surface-card rounded-card flex w-full max-w-sm flex-col gap-5 p-6 shadow-sm">
        <div>
          <div className="text-ink-900 text-2xl font-semibold">Apidays</div>
          <p className="text-ink-500 text-sm">Mot de passe oublié</p>
        </div>

        {state.envoye ? (
          <p className="text-ink-900 text-sm">
            Si un compte existe pour cet email, vous recevrez un lien pour définir un nouveau mot de
            passe.
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-5">
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

            <Button type="submit" disabled={pending} className="rounded-card w-full py-3">
              {pending ? "Envoi…" : "Envoyer le lien"}
            </Button>
          </form>
        )}

        <Link href="/connexion" className="text-ink-500 text-xs hover:underline">
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
