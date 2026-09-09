"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { creerTenant } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const MESSAGE_ERREUR: Record<string, string> = {
  champs_manquants: "Tous les champs marqués * sont obligatoires.",
  slug_invalide: "Le slug ne doit contenir que des lettres minuscules, chiffres et tirets.",
  email_invalide: "L'adresse email de l'admin n'est pas valide.",
  slug_deja_utilise: "Ce slug est déjà utilisé par un autre tenant.",
  email_deja_utilise: "Cet email est déjà utilisé par un autre compte.",
  creation_entreprise_echouee: "La création du tenant a échoué. Réessaie.",
  creation_admin_echouee: "La création du profil admin a échoué. Réessaie.",
  invite_echouee: "L'envoi de l'invitation a échoué. Réessaie.",
  liaison_echouee: "La liaison du compte a échoué. Réessaie.",
};

/**
 * Formulaire de création d'un tenant (09/09/2026, flux d'onboarding) —
 * remplace les scripts `service_role` jetables utilisés jusqu'ici. Champs
 * volontairement réduits au strict nécessaire : pas de logo (reste réglable
 * par SQL comme aujourd'hui), pas de date d'entrée/nature de contrat/taux
 * d'activité pour le premier admin (posés par défaut côté action, voir
 * `app/admin/actions.ts`). Couleurs optionnelles — laissées vides, le
 * défaut DB (charte Abeil) s'applique.
 */
export default function NouveauTenantPage() {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [slug, setSlug] = useState("");
  const [couleurNavy, setCouleurNavy] = useState("");
  const [couleurJaune, setCouleurJaune] = useState("");
  const [prenomAdmin, setPrenomAdmin] = useState("");
  const [nomAdmin, setNomAdmin] = useState("");
  const [emailAdmin, setEmailAdmin] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const resultat = await creerTenant({
      nom,
      slug,
      couleurNavy: couleurNavy || undefined,
      couleurJaune: couleurJaune || undefined,
      prenomAdmin,
      nomAdmin,
      emailAdmin,
    });

    setEnCours(false);

    if (!resultat.ok) {
      setErreur(MESSAGE_ERREUR[resultat.erreur ?? ""] ?? "Une erreur est survenue.");
      return;
    }

    router.push(`/admin?cree=${encodeURIComponent(nom)}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-ink-500 text-sm hover:underline">
          ← Tenants
        </Link>
      </div>

      <h1 className="text-ink-900 text-2xl font-semibold">Créer un tenant</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-surface-card rounded-card flex flex-col gap-5 p-6 shadow-sm"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nom" className="text-ink-900 text-sm font-bold">
            Nom de l&apos;entreprise *
          </label>
          <Input id="nom" required value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="slug" className="text-ink-900 text-sm font-bold">
            Slug *
          </label>
          <Input
            id="slug"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="ex. abeil"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="couleurNavy" className="text-ink-900 text-sm font-bold">
              Couleur principale (optionnel)
            </label>
            <Input
              id="couleurNavy"
              value={couleurNavy}
              onChange={(e) => setCouleurNavy(e.target.value)}
              placeholder="#001e32"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="couleurJaune" className="text-ink-900 text-sm font-bold">
              Couleur d&apos;accent (optionnel)
            </label>
            <Input
              id="couleurJaune"
              value={couleurJaune}
              onChange={(e) => setCouleurJaune(e.target.value)}
              placeholder="#ebc850"
            />
          </div>
        </div>

        <hr className="border-ink-300" />

        <p className="text-ink-500 text-sm font-semibold">Premier admin</p>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="prenomAdmin" className="text-ink-900 text-sm font-bold">
              Prénom *
            </label>
            <Input
              id="prenomAdmin"
              required
              value={prenomAdmin}
              onChange={(e) => setPrenomAdmin(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="nomAdmin" className="text-ink-900 text-sm font-bold">
              Nom *
            </label>
            <Input
              id="nomAdmin"
              required
              value={nomAdmin}
              onChange={(e) => setNomAdmin(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="emailAdmin" className="text-ink-900 text-sm font-bold">
            Email *
          </label>
          <Input
            id="emailAdmin"
            type="email"
            required
            value={emailAdmin}
            onChange={(e) => setEmailAdmin(e.target.value)}
          />
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        <Button type="submit" disabled={enCours}>
          {enCours ? "Création…" : "Créer le tenant"}
        </Button>
      </form>
    </div>
  );
}
