"use client";

import { useActionState, useState, type FormEvent } from "react";
import {
  definirMotDePasse,
  type DefinirMotDePasseState,
} from "@/app/connexion/definir-mot-de-passe/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const INITIAL_STATE: DefinirMotDePasseState = {};

/**
 * Écran partagé invitation/mot de passe oublié — atteint via
 * `app/auth/confirm/route.ts` qui a déjà posé la session temporaire.
 * Validation de correspondance des deux champs côté client, avant tout
 * aller-retour serveur (la vraie vérification reste côté action).
 */
export default function DefinirMotDePassePage() {
  const [state, formAction, pending] = useActionState(definirMotDePasse, INITIAL_STATE);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreurLocale, setErreurLocale] = useState("");

  const mismatch = confirmation.length > 0 && motDePasse !== confirmation;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (motDePasse !== confirmation) {
      e.preventDefault();
      setErreurLocale("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setErreurLocale("");
  }

  const erreur = erreurLocale || state.error;

  return (
    <div className="bg-surface-app flex min-h-screen items-center justify-center px-4">
      <form
        action={formAction}
        onSubmit={handleSubmit}
        className="bg-surface-card rounded-card flex w-full max-w-sm flex-col gap-5 p-6 shadow-sm"
      >
        <div className="flex flex-col items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- PNG statique */}
          <img
            src="/logo-abeil-fond-clair.png"
            alt="Abeil"
            width={1676}
            height={710}
            className="h-12 w-auto"
          />
          <p className="text-abeil-navy text-xl font-semibold">Définir un mot de passe</p>
        </div>

        <div>
          <label htmlFor="motDePasse" className="text-abeil-navy mb-1.5 block text-sm font-bold">
            Nouveau mot de passe
          </label>
          <Input
            id="motDePasse"
            name="motDePasse"
            type="password"
            required
            autoComplete="new-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="!border-slate w-full rounded-md text-xs"
          />
        </div>

        <div>
          <label htmlFor="confirmation" className="text-abeil-navy mb-1.5 block text-sm font-bold">
            Confirmer le mot de passe
          </label>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            error={mismatch}
            className={`w-full rounded-md text-xs ${mismatch ? "" : "!border-slate"}`}
          />
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        <Button type="submit" disabled={pending} className="rounded-card w-full py-3">
          {pending ? "Enregistrement…" : "Définir le mot de passe"}
        </Button>
      </form>
    </div>
  );
}
