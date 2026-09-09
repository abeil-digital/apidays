"use client";

import { useActionState, useState, type FormEvent } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import {
  definirMotDePasse,
  type DefinirMotDePasseState,
} from "@/app/connexion/definir-mot-de-passe/actions";
import {
  criteresMotDePasse,
  MESSAGE_POLITIQUE_MOT_DE_PASSE,
  respectePolitiqueMotDePasse,
} from "@/lib/passwordPolicy";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const INITIAL_STATE: DefinirMotDePasseState = {};

function CritereMotDePasse({ rempli, texte }: { rempli: boolean; texte: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 text-xs ${rempli ? "text-status-success-fg" : "text-ink-500"}`}
    >
      <Check size={12} className={rempli ? "opacity-100" : "opacity-30"} />
      {texte}
    </li>
  );
}

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
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);
  const [afficherConfirmation, setAfficherConfirmation] = useState(false);

  const mismatch = confirmation.length > 0 && motDePasse !== confirmation;
  const match = confirmation.length > 0 && motDePasse === confirmation;
  const criteres = criteresMotDePasse(motDePasse);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (!respectePolitiqueMotDePasse(motDePasse)) {
      e.preventDefault();
      setErreurLocale(MESSAGE_POLITIQUE_MOT_DE_PASSE);
      return;
    }
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
          <p className="text-brand-primary text-xl font-semibold">Définir un mot de passe</p>
        </div>

        <div>
          <label htmlFor="motDePasse" className="text-brand-primary mb-1.5 block text-sm font-bold">
            Nouveau mot de passe
          </label>
          <div className="relative">
            <Input
              id="motDePasse"
              name="motDePasse"
              type={afficherMotDePasse ? "text" : "password"}
              required
              autoComplete="new-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
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
          <ul className="mt-1.5 flex flex-col gap-1">
            <CritereMotDePasse rempli={criteres.longueur} texte="Au moins 8 caractères" />
            <CritereMotDePasse rempli={criteres.majuscule} texte="Une majuscule" />
            <CritereMotDePasse rempli={criteres.caractereSpecial} texte="Un caractère spécial" />
          </ul>
        </div>

        <div>
          <label htmlFor="confirmation" className="text-brand-primary mb-1.5 block text-sm font-bold">
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <Input
              id="confirmation"
              name="confirmation"
              type={afficherConfirmation ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              error={mismatch}
              className={`w-full rounded-md pr-10 text-xs ${mismatch ? "" : "!border-slate"}`}
            />
            <button
              type="button"
              onClick={() => setAfficherConfirmation((v) => !v)}
              aria-label={
                afficherConfirmation ? "Masquer le mot de passe" : "Afficher le mot de passe"
              }
              className="text-ink-500 hover:text-ink-900 absolute top-1/2 right-3 -translate-y-1/2"
            >
              {afficherConfirmation ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {mismatch && (
            <p className="text-status-danger-fg mt-1.5 text-xs">
              Les mots de passe ne correspondent pas.
            </p>
          )}
          {match && (
            <p className="text-status-success-fg mt-1.5 flex items-center gap-1 text-xs">
              <Check size={14} />
              Les mots de passe correspondent.
            </p>
          )}
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        <Button
          type="submit"
          disabled={pending || !match || !respectePolitiqueMotDePasse(motDePasse)}
          className="rounded-card w-full py-3"
        >
          {pending ? "Enregistrement…" : "Définir le mot de passe"}
        </Button>
      </form>
    </div>
  );
}
