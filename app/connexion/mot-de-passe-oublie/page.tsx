"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  demanderReinitialisation,
  type MotDePasseOublieState,
} from "@/app/connexion/mot-de-passe-oublie/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const INITIAL_STATE: MotDePasseOublieState = {};

export default function MotDePasseOubliePage() {
  const [state, formAction, pending] = useActionState(demanderReinitialisation, INITIAL_STATE);

  return (
    <div className="bg-surface-app flex min-h-screen items-center justify-center px-4">
      <div className="bg-surface-card rounded-card flex w-full max-w-sm flex-col gap-5 p-6 shadow-sm">
        <div className="flex flex-col items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG statique */}
          <img
            src="/logo-abeil-fond-clair.png"
            alt="Abeil"
            width={1676}
            height={710}
            className="h-12 w-auto"
          />
          <p className="text-abeil-navy text-xl font-semibold">Mot de passe oublié</p>
        </div>

        {state.envoye ? (
          <p className="text-ink-900 text-sm">
            Consultez votre boîte mail.
            <br />
            Un lien vous permettra de saisir un nouveau mot de passe.
          </p>
        ) : (
          <form action={formAction} className="flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="text-abeil-navy mb-1.5 block text-sm font-bold">
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
