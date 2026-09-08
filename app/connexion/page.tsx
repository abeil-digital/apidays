"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type LoginState } from "@/app/connexion/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const INITIAL_STATE: LoginState = {};

export default function ConnexionPage() {
  const [state, formAction, pending] = useActionState(login, INITIAL_STATE);

  return (
    <div className="bg-surface-app flex min-h-screen items-center justify-center px-4">
      <form
        action={formAction}
        className="bg-surface-card rounded-card flex w-full max-w-sm flex-col gap-5 p-6 shadow-sm"
      >
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
            src="/logo-abeil-fond-clair.png"
            alt="Abeil"
            width={1676}
            height={710}
            className="h-12 w-auto"
          />
          <p className="text-abeil-navy text-xl font-semibold">Bienvenue sur Apidays</p>
        </div>

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

        <div>
          <label htmlFor="password" className="text-abeil-navy mb-1.5 block text-sm font-bold">
            Mot de passe
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="!border-slate w-full rounded-md text-xs"
          />
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
