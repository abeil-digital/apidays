"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { creerTenant } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { NatureContrat } from "@/lib/types";

const NATURE_CONTRAT_OPTIONS: { value: NatureContrat; label: string }[] = [
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "alternance", label: "Alternance" },
  { value: "stage", label: "Stage" },
];

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
 * remplace les scripts `service_role` jetables utilisés jusqu'ici. Fiche
 * admin étendue (11/09/2026, demande explicite — éviter de ressaisir la
 * fiche après coup) : date d'entrée/nature de contrat/taux d'activité et
 * solde initial (CP/RTT/CPA de départ, `soldes_initiaux`) restent
 * optionnels, avec les mêmes défauts qu'avant (aujourd'hui/CDI/100%/aucun
 * solde initial) si laissés vides, voir `app/admin/actions.ts`. Pas de date
 * de référence ancienneté (retirée de la fiche "Nouvel utilisateur"
 * classique depuis le 02/09/2026, "pas un besoin Abeil actuellement").
 * Couleurs/logos optionnels — laissés vides, le défaut DB (charte Abeil, ou
 * `null` ⇒ fallback fichier Abeil côté composant pour les logos)
 * s'applique. Mise en page en 3 cards (11/09/2026, demande explicite) —
 * même gabarit que les blocs de réglage de Paramétrer > Congés & RTT
 * (`CongesRttPage.tsx`) : card `bg-surface-card border-ink-300/60 p-5`,
 * labels `mb-1.5 block text-sm font-bold`, champs jumelés en
 * `grid grid-cols-2`, bordure `!border-slate`. Titre de card en `text-lg`
 * (11/09/2026, demande explicite "grossir la taille des titres de card") —
 * plus gros que le `text-sm` des blocs de `CongesRttPage.tsx`, pour mieux
 * les distinguer visuellement des labels de champs qui utilisent la même
 * graisse (`font-bold`).
 */
export default function NouveauTenantPage() {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [slug, setSlug] = useState("");
  const [dateDebutUtilisation, setDateDebutUtilisation] = useState("");
  const [couleurNavy, setCouleurNavy] = useState("");
  const [couleurJaune, setCouleurJaune] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUrlFondClair, setLogoUrlFondClair] = useState("");
  const [logoUrlSigne, setLogoUrlSigne] = useState("");
  const [prenomAdmin, setPrenomAdmin] = useState("");
  const [nomAdmin, setNomAdmin] = useState("");
  const [emailAdmin, setEmailAdmin] = useState("");
  const [dateEntreeAdmin, setDateEntreeAdmin] = useState("");
  const [natureContratAdmin, setNatureContratAdmin] = useState<NatureContrat | "">("");
  const [tauxActiviteAdmin, setTauxActiviteAdmin] = useState("");
  const [soldeInitDate, setSoldeInitDate] = useState("");
  const [soldeInitCp, setSoldeInitCp] = useState("0");
  const [soldeInitRtt, setSoldeInitRtt] = useState("0");
  const [soldeInitCpa, setSoldeInitCpa] = useState("0");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    const resultat = await creerTenant({
      nom,
      slug,
      dateDebutUtilisation,
      couleurNavy: couleurNavy || undefined,
      couleurJaune: couleurJaune || undefined,
      logoUrl: logoUrl || undefined,
      logoUrlFondClair: logoUrlFondClair || undefined,
      logoUrlSigne: logoUrlSigne || undefined,
      prenomAdmin,
      nomAdmin,
      emailAdmin,
      dateEntreeAdmin: dateEntreeAdmin || undefined,
      natureContratAdmin: natureContratAdmin || undefined,
      tauxActiviteAdmin: tauxActiviteAdmin ? Number(tauxActiviteAdmin) : undefined,
      soldeInitialAdmin: soldeInitDate
        ? {
            dateReference: soldeInitDate,
            cp: Number(soldeInitCp) || 0,
            rtt: Number(soldeInitRtt) || 0,
            cpa: Number(soldeInitCpa) || 0,
          }
        : undefined,
    });

    setEnCours(false);

    if (!resultat.ok) {
      setErreur(MESSAGE_ERREUR[resultat.erreur ?? ""] ?? "Une erreur est survenue.");
      return;
    }

    const avertissement = resultat.avertissement ? "&emailEchoue=1" : "";
    router.push(`/admin?cree=${encodeURIComponent(nom)}${avertissement}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-ink-500 text-sm hover:underline">
          ← Tenants
        </Link>
      </div>

      <h1 className="text-ink-900 text-2xl font-semibold">Créer un tenant</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="bg-surface-card border-ink-300/60 flex flex-col gap-5 border p-5">
          <h2 className="text-ink-900 text-lg font-bold">Entreprise</h2>

          <div className="flex flex-col gap-5">
            <div>
              <label htmlFor="nom" className="text-ink-900 mb-1.5 block text-sm font-bold">
                Nom de l&apos;entreprise *
              </label>
              <Input
                id="nom"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="!border-slate"
              />
            </div>

            <div>
              <label htmlFor="slug" className="text-ink-900 mb-1.5 block text-sm font-bold">
                Slug *
              </label>
              <Input
                id="slug"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="ex. abeil"
                className="!border-slate"
              />
            </div>

            <div>
              <label
                htmlFor="dateDebutUtilisation"
                className="text-ink-900 mb-1.5 block text-sm font-bold"
              >
                Date de début d&apos;utilisation de l&apos;outil *
              </label>
              {/* "À partir de quand Apidays fait foi" pour ce tenant (11/09/2026,
              Backlog #73) — évite qu'un futur calcul de report reconstitue des
              soldes fictifs sur des périodes antérieures au démarrage réel chez
              ce client. N'a aucun effet sur l'ancienneté des collaborateurs
              (toujours basée sur leur date d'entrée réelle), voir
              `supabase/schema.sql`. */}
              <Input
                id="dateDebutUtilisation"
                type="date"
                required
                value={dateDebutUtilisation}
                onChange={(e) => setDateDebutUtilisation(e.target.value)}
                className="!border-slate w-fit"
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-card border-ink-300/60 flex flex-col gap-5 border p-5">
          <h2 className="text-ink-900 text-lg font-bold">Charte</h2>

          <p className="text-ink-500 text-xs">
            Facultatif — laissé vide, le tenant reprend la charte Abeil par défaut.
          </p>

          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="couleurNavy"
                  className="text-ink-900 mb-1.5 block text-sm font-bold"
                >
                  Couleur principale
                </label>
                <Input
                  id="couleurNavy"
                  value={couleurNavy}
                  onChange={(e) => setCouleurNavy(e.target.value)}
                  placeholder="#001e32"
                  className="!border-slate"
                />
              </div>
              <div>
                <label
                  htmlFor="couleurJaune"
                  className="text-ink-900 mb-1.5 block text-sm font-bold"
                >
                  Couleur d&apos;accent
                </label>
                <Input
                  id="couleurJaune"
                  value={couleurJaune}
                  onChange={(e) => setCouleurJaune(e.target.value)}
                  placeholder="#ebc850"
                  className="!border-slate"
                />
              </div>
            </div>

            <div>
              <label htmlFor="logoUrl" className="text-ink-900 mb-1.5 block text-sm font-bold">
                Logo header, fond navy
              </label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="/mon-logo.svg ou https://…"
                className="!border-slate"
              />
            </div>

            <div>
              <label
                htmlFor="logoUrlFondClair"
                className="text-ink-900 mb-1.5 block text-sm font-bold"
              >
                Logo connexion, fond clair
              </label>
              <Input
                id="logoUrlFondClair"
                value={logoUrlFondClair}
                onChange={(e) => setLogoUrlFondClair(e.target.value)}
                placeholder="/mon-logo-fond-clair.png ou https://…"
                className="!border-slate"
              />
            </div>

            <div>
              <label
                htmlFor="logoUrlSigne"
                className="text-ink-900 mb-1.5 block text-sm font-bold"
              >
                Signe SideNav
              </label>
              <Input
                id="logoUrlSigne"
                value={logoUrlSigne}
                onChange={(e) => setLogoUrlSigne(e.target.value)}
                placeholder="/mon-signe.png ou https://…"
                className="!border-slate"
              />
            </div>
          </div>
        </div>

        <div className="bg-surface-card border-ink-300/60 flex flex-col gap-5 border p-5">
          <h2 className="text-ink-900 text-lg font-bold">Premier admin</h2>

          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="prenomAdmin"
                  className="text-ink-900 mb-1.5 block text-sm font-bold"
                >
                  Prénom *
                </label>
                <Input
                  id="prenomAdmin"
                  required
                  value={prenomAdmin}
                  onChange={(e) => setPrenomAdmin(e.target.value)}
                  className="!border-slate"
                />
              </div>
              <div>
                <label
                  htmlFor="nomAdmin"
                  className="text-ink-900 mb-1.5 block text-sm font-bold"
                >
                  Nom *
                </label>
                <Input
                  id="nomAdmin"
                  required
                  value={nomAdmin}
                  onChange={(e) => setNomAdmin(e.target.value)}
                  className="!border-slate"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="emailAdmin"
                className="text-ink-900 mb-1.5 block text-sm font-bold"
              >
                Email *
              </label>
              <Input
                id="emailAdmin"
                type="email"
                required
                value={emailAdmin}
                onChange={(e) => setEmailAdmin(e.target.value)}
                className="!border-slate max-w-72"
              />
            </div>

            <p className="text-ink-500 text-xs">
              Facultatif — valeurs par défaut (aujourd&apos;hui, CDI, 100 %) si laissées vides.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="dateEntreeAdmin"
                  className="text-ink-900 mb-1.5 block text-sm font-bold"
                >
                  Date d&apos;entrée
                </label>
                <Input
                  id="dateEntreeAdmin"
                  type="date"
                  value={dateEntreeAdmin}
                  onChange={(e) => setDateEntreeAdmin(e.target.value)}
                  className="!border-slate w-fit"
                />
              </div>
              <div>
                <label
                  htmlFor="natureContratAdmin"
                  className="text-ink-900 mb-1.5 block text-sm font-bold"
                >
                  Nature de contrat
                </label>
                <Select
                  id="natureContratAdmin"
                  value={natureContratAdmin}
                  onChange={(e) => setNatureContratAdmin(e.target.value as NatureContrat | "")}
                >
                  <option value="">CDI</option>
                  {NATURE_CONTRAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label
                htmlFor="tauxActiviteAdmin"
                className="text-ink-900 mb-1.5 block text-sm font-bold"
              >
                Taux d&apos;activité
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="tauxActiviteAdmin"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={tauxActiviteAdmin}
                  onChange={(e) => setTauxActiviteAdmin(e.target.value)}
                  placeholder="100"
                  className="!border-slate w-20"
                />
                <span className="text-ink-500 text-sm">%</span>
              </div>
            </div>

            <hr className="border-ink-300" />

            <div>
              <h3 className="text-ink-900 text-sm font-bold">Solde initial</h3>
              <p className="text-ink-500 text-xs">
                Facultatif — report de la dernière fiche de paie.
              </p>
            </div>

            <div>
              <label
                htmlFor="soldeInitMois"
                className="text-ink-900 mb-1.5 block text-sm font-bold"
              >
                Au début du mois
              </label>
              {/* `type="month"`, normalisé au 1er du mois (`-01`) — la fiche
              "Nouvel utilisateur" classique force la même contrainte (deux
              `<select>` mois/année plutôt qu'un vrai sélecteur de date, voir
              `UtilisateurFichePage.tsx`) : `date_reference` fait toujours
              référence au début d'un mois dans les formules de bascule
              (`soldes.repository.ts`), jamais un jour arbitraire. */}
              <Input
                id="soldeInitMois"
                type="month"
                value={soldeInitDate ? soldeInitDate.slice(0, 7) : ""}
                onChange={(e) => setSoldeInitDate(e.target.value ? `${e.target.value}-01` : "")}
                className="!border-slate w-fit"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="soldeInitCp"
                  className="text-ink-900 mb-1.5 block text-sm font-bold"
                >
                  CP
                </label>
                <Input
                  id="soldeInitCp"
                  type="number"
                  step="0.5"
                  value={soldeInitCp}
                  onChange={(e) => setSoldeInitCp(e.target.value)}
                  disabled={!soldeInitDate}
                  className="!border-slate w-20"
                />
              </div>
              <div>
                <label
                  htmlFor="soldeInitRtt"
                  className="text-ink-900 mb-1.5 block text-sm font-bold"
                >
                  RTT
                </label>
                <Input
                  id="soldeInitRtt"
                  type="number"
                  step="0.5"
                  value={soldeInitRtt}
                  onChange={(e) => setSoldeInitRtt(e.target.value)}
                  disabled={!soldeInitDate}
                  className="!border-slate w-20"
                />
              </div>
              <div>
                <label
                  htmlFor="soldeInitCpa"
                  className="text-ink-900 mb-1.5 block text-sm font-bold"
                >
                  CPA
                </label>
                <Input
                  id="soldeInitCpa"
                  type="number"
                  step="0.5"
                  value={soldeInitCpa}
                  onChange={(e) => setSoldeInitCpa(e.target.value)}
                  disabled={!soldeInitDate}
                  className="!border-slate w-20"
                />
              </div>
            </div>
          </div>
        </div>

        {erreur && (
          <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
            {erreur}
          </div>
        )}

        <Button type="submit" disabled={enCours} className="rounded-card w-fit px-6 py-3">
          {enCours ? "Création…" : "Créer le tenant"}
        </Button>
      </form>
    </div>
  );
}
