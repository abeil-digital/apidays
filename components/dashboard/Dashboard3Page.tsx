"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, PlusCircle } from "lucide-react";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { SoldeCard } from "@/components/ui/SoldeCard";
import { ActiviteRecenteFeed } from "@/components/dashboard/ActiviteRecenteFeed";
import { CalendrierMoisCourantCard } from "@/components/dashboard/CalendrierMoisCourantCard";
import { ProchainsJoursOffCard } from "@/components/dashboard/ProchainsJoursOffCard";
import { ReglesCongesModal } from "@/components/dashboard/ReglesCongesModal";

/**
 * Duplicata de travail de `Dashboard2Page` (16/08/2026) — copie pour itérer
 * sur l'écran d'accueil sans toucher à la version actuellement en ligne sur
 * `/`. Route provisoire `/dashboard3`, reliée à la nav sous "Accueil2". À
 * fusionner ou remplacer `Dashboard2Page` une fois les changements validés
 * (voir Backlog.md).
 *
 * La section "Mes Congés" (calendrier + légende CPI/DJI/Fériés/PERSO) a été
 * extraite dans sa propre sous-rubrique "Mon calendrier" (16/08/2026,
 * `components/dashboard/MonCalendrierPage.tsx`, route `/mon-calendrier`).
 * L'encart "En attente de validation" a ensuite été retiré aussi (16/08/2026).
 * Le bandeau "Soldes" du haut avait été remplacé par une card "Mes soldes"
 * dans la ligne du bas (essai, 16/08/2026), puis ré-annulé (16/08/2026) —
 * retour au bandeau du haut, `MesSoldesCard` retiré (fichier conservé,
 * inutilisé) pour ne pas dupliquer l'affichage des soldes sur la page.
 */
export function Dashboard3Page() {
  const { utilisateur, loading: loadingUtilisateur } = useUtilisateur();
  const { soldes, loading: loadingSoldes } = useSoldes();
  const { demandes, loading: loadingDemandes } = useDemandes();
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [tiroirActiviteOuvert, setTiroirActiviteOuvert] = useState(false);

  const loading = loadingUtilisateur || loadingSoldes || loadingDemandes;

  if (loading || !utilisateur || !soldes) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-4 md:max-w-6xl md:pt-0">
      <div className="flex items-center gap-2 px-1 pt-5 md:pt-0">
        <h1 className="text-ink-900 text-2xl font-semibold">Bonjour, {utilisateur.prenom}</h1>
        {/* Picto coche (17/08/2026) — déclencheur du tiroir "Activité
            récente" (`ActiviteRecenteFeed`), seul point d'entrée depuis que
            la colonne inline a été retirée du corps de page. */}
        <button
          type="button"
          onClick={() => setTiroirActiviteOuvert(true)}
          aria-label="Activité récente"
          className="text-ink-500 flex h-8 w-8 items-center justify-center rounded-full"
        >
          <Check size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="bg-mint-tint flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6 md:p-5">
          <div className="flex shrink-0 flex-col gap-1 md:w-44">
            <h2 className="text-ink-900 text-lg font-bold">Soldes</h2>
            <p className="text-ink-500 text-xs leading-snug">Quels congés imposés cette année ?</p>
            <button
              type="button"
              onClick={() => setReglesOuvertes(true)}
              className="text-ink-900 w-fit text-xs font-semibold underline"
            >
              découvrir
            </button>
          </div>

          <div className="grid max-w-2xl flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <SoldeCard
              valeur={soldes.cp.valeurApresAttente}
              conditionPrefixe={soldes.cp.conditionPrefixe}
              conditionAccent={soldes.cp.conditionAccent}
              tone="cp"
              carre
            />
            <SoldeCard
              valeur={soldes.rtt.valeurApresAttente}
              conditionPrefixe={soldes.rtt.conditionPrefixe}
              conditionAccent={soldes.rtt.conditionAccent}
              tone="rtt"
              carre
            />
            <SoldeCard
              valeur={soldes.cpa.valeurApresAttente}
              conditionPrefixe={soldes.cpa.conditionPrefixe}
              conditionAccent={soldes.cpa.conditionAccent}
              tone="cpa"
              carre
            />
            <Link
              href="/nouvelle-demande"
              className="bg-mint flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-white shadow-sm"
            >
              <span className="text-sm font-semibold">Poser un congé</span>
              <PlusCircle size={20} />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <ProchainsJoursOffCard />
        <CalendrierMoisCourantCard />
      </div>

      <ActiviteRecenteFeed
        demandes={demandes}
        tiroirOuvert={tiroirActiviteOuvert}
        onFermerTiroir={() => setTiroirActiviteOuvert(false)}
      />

      {reglesOuvertes && (
        <ReglesCongesModal soldes={soldes} onClose={() => setReglesOuvertes(false)} />
      )}
    </div>
  );
}
