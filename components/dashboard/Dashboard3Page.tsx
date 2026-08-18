"use client";

import { useState } from "react";
import { useDemandes } from "@/hooks/useDemandes";
import { useSoldes } from "@/hooks/useSoldes";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { SoldeCard } from "@/components/ui/SoldeCard";
import { ActiviteRecenteFeed } from "@/components/dashboard/ActiviteRecenteFeed";
import { ListingTiroir } from "@/components/dashboard/ListingTiroir";
import { ReglesCongesModal } from "@/components/dashboard/ReglesCongesModal";
import { PoserDemandeModal } from "@/components/nouvelle-demande/PoserDemandeModal";
import { SoldeDetailPanel } from "@/components/suivre/SoldeDetailPanel";

type CodeSoldeDetail = "CP" | "RTT" | "CPA";

/**
 * Duplicata de travail de `Dashboard2Page` (18/08/2026) — copie pour itérer
 * sur l'écran d'accueil (grandes phrases cliquables sous Soldes, etc.) sans
 * toucher à la version actuellement en ligne sur `/`. Route provisoire
 * `/dashboard3`, reliée à la nav sous "Accueil2". À fusionner ou remplacer
 * `Dashboard2Page` une fois les changements validés (voir Backlog.md) — même
 * pattern qu'un précédent duplicata identique, supprimé le 18/08/2026 une
 * fois fusionné.
 *
 * Section "Mes Congés" (calendrier + légende CPI/DJI/Fériés/PERSO) retirée
 * entièrement le 18/08/2026 sur cette page de test — reste disponible sur
 * `Dashboard2Page`/`MonCalendrierPage`, pas dupliquée ici.
 */
export function Dashboard3Page() {
  const { utilisateur, loading: loadingUtilisateur } = useUtilisateur();
  const { soldes, loading: loadingSoldes, refetch: refetchSoldes } = useSoldes();
  const { demandes, loading: loadingDemandes, refetch: refetchDemandes } = useDemandes();
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [soldeDetailOuvert, setSoldeDetailOuvert] = useState<CodeSoldeDetail | null>(null);
  const [tiroirActiviteOuvert, setTiroirActiviteOuvert] = useState(false);
  const [tiroirListingOuvert, setTiroirListingOuvert] = useState(false);
  const [nouvelleDemandeOuverte, setNouvelleDemandeOuverte] = useState(false);

  const loading = loadingUtilisateur || loadingSoldes || loadingDemandes;

  if (loading || !utilisateur || !soldes) {
    return <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pb-4 md:max-w-6xl md:pt-0">
      <div className="px-1 pt-5 md:pt-0">
        <h1 className="text-ink-900 text-2xl font-semibold">Bonjour, {utilisateur.prenom}</h1>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-4 rounded-2xl py-4 md:py-5">
          <div className="flex flex-col gap-1 px-1">
            <h2 className="text-ink-900 text-sm font-semibold">Mes Soldes</h2>
          </div>

          <div className="grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-3">
            <SoldeCard
              valeur={soldes.cp.valeurApresAttente}
              conditionPrefixe={soldes.cp.conditionPrefixe}
              conditionAccent={soldes.cp.conditionAccent}
              tone="cp"
              avecInfo
              onInfoClick={() => setSoldeDetailOuvert("CP")}
            />
            <SoldeCard
              valeur={soldes.rtt.valeurApresAttente}
              conditionPrefixe={soldes.rtt.conditionPrefixe}
              conditionAccent={soldes.rtt.conditionAccent}
              tone="rtt"
              avecInfo
              onInfoClick={() => setSoldeDetailOuvert("RTT")}
            />
            <SoldeCard
              valeur={soldes.cpa.valeurApresAttente}
              conditionPrefixe={soldes.cpa.conditionPrefixe}
              conditionAccent={soldes.cpa.conditionAccent}
              tone="cpa"
              avecInfo
              onInfoClick={() => setSoldeDetailOuvert("CPA")}
            />
          </div>
        </div>

        {/* 3 grandes phrases (18/08/2026, test), même taille que le titre
            "Bonjour, {prénom}" — "Poser un congé" ouvre la popin (même
            `nouvelleDemandeOuverte` que le bouton de la grille Soldes), les
            2 autres restent sans action pour l'instant. */}
        <div className="flex flex-col gap-1 px-1">
          <button
            type="button"
            onClick={() => setNouvelleDemandeOuverte(true)}
            className="hover:bg-mint text-ink-900 w-fit text-left text-[30px] font-semibold transition-colors hover:text-white"
          >
            Poser un congé
          </button>
          <button
            type="button"
            onClick={() => setTiroirListingOuvert(true)}
            className="hover:bg-mint text-ink-900 w-fit text-left text-[30px] font-semibold transition-colors hover:text-white"
          >
            Suivre mes demandes
          </button>
          <button
            type="button"
            onClick={() => setReglesOuvertes(true)}
            className="hover:bg-mint text-ink-900 w-fit text-left text-[30px] font-semibold transition-colors hover:text-white"
          >
            Quelles semaines poser en 2027 ?
          </button>
        </div>
      </div>

      {reglesOuvertes && (
        <ReglesCongesModal soldes={soldes} onClose={() => setReglesOuvertes(false)} />
      )}

      {/* "Poser un congé" (18/08/2026) — s'affiche en popin contextuelle sur
          Accueil plutôt que de naviguer vers `/nouvelle-demande` (route
          conservée pour l'instant, vouée à être désactivée). `onSuccess`
          rafraîchit `demandes`/`soldes` de CETTE page : la popin a sa propre
          instance de `useDemandes`/`useSoldes`, l'ajout ne se répercute pas
          automatiquement ici. */}
      {nouvelleDemandeOuverte && (
        <PoserDemandeModal
          onClose={() => setNouvelleDemandeOuverte(false)}
          onSuccess={() => {
            refetchDemandes();
            refetchSoldes();
          }}
        />
      )}

      {/* Détail de solde (17/08/2026) — même `SoldeDetailPanel` que "Suivre les
          soldes" (vue manager sur un collaborateur), ici recentré en overlay
          pour la propre consultation du salarié sur son solde. Backdrop
          manuel plutôt que `Modal` : `SoldeDetailPanel` a déjà son propre
          bandeau coloré plein bord (voir `DetailCongePanel`/`Modal`
          `header`), l'encapsuler dans le `children` par défaut de `Modal`
          aurait ajouté un double padding. */}
      {soldeDetailOuvert && (
        <div
          className="bg-ink-900/50 fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => setSoldeDetailOuvert(null)}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <SoldeDetailPanel
              key={soldeDetailOuvert}
              code={soldeDetailOuvert}
              utilisateurId={utilisateur.id}
              nomComplet={`${utilisateur.prenom} ${utilisateur.nom}`}
              onClose={() => setSoldeDetailOuvert(null)}
            />
          </div>
        </div>
      )}

      <ActiviteRecenteFeed
        demandes={demandes}
        tiroirOuvert={tiroirActiviteOuvert}
        onFermerTiroir={() => setTiroirActiviteOuvert(false)}
      />

      <ListingTiroir
        demandes={demandes}
        tiroirOuvert={tiroirListingOuvert}
        onFermerTiroir={() => setTiroirListingOuvert(false)}
      />
    </div>
  );
}
