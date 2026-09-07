"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useFaqs } from "@/hooks/useFaqs";

/**
 * Card FAQ (20/08/2026, premier jet ; refonte 21/08/2026 sur maquette de
 * référence fournie, puis 21/08/2026 sur demande explicite) — bords carrés
 * (pas de `rounded-*`), pas de bordure ni d'ombre. Padding horizontal propre
 * conservé (`px-8 md:px-12`, comme le padding vertical) — l'essai "sans
 * gouttière gauche/droite" du même jour a été annulé sur demande explicite.
 * Titre "Questions fréquentes" même typo que le `<h1>`
 * "Bonjour, {prénom}" (`text-2xl font-semibold`, pas de soulignement — la
 * maquette de référence soulignait, mais demande explicite d'aligner sur le
 * style de titre déjà utilisé ailleurs sur Accueil). Intitulés de question
 * même typo que les pastilles de sélection de période du calendrier ("2026"
 * / "Juin 26 → Mai 27" / "2027", `text-sm font-semibold`) — déjà le cas ici,
 * conservé tel quel. Accordéon de questions à droite (une seule dépliée à la
 * fois, réponse affichée en dessous de la question elle-même plutôt que dans
 * un panneau séparé). Empilé en une seule colonne sous `md:`. Contenu géré
 * depuis Paramétrer > FAQ (07/09/2026, remplace le contenu provisoire en
 * dur) — `useFaqs()` ne renvoie ici que les FAQ publiées (RLS, un
 * collaborateur ne voit jamais les brouillons), déjà triées par `ordre`.
 * Rien affiché tant que le chargement est en cours ou si aucune FAQ n'est
 * publiée, plutôt qu'une card vide.
 *
 * Débordement à droite jusqu'au bord de l'écran, bord gauche collé au rail
 * `SideNav` replié sans la gouttière `px-3` habituelle (21/08/2026, demande
 * explicite — le premier essai laissait 12px d'écart entre le rail et la
 * card, pas voulu ; un essai antérieur d'étendre aussi le bord gauche
 * jusqu'à 0 sous le rail a lui été annulé). Repère stable : l'espaceur
 * invisible du rail (`data-sidenav-spacer` dans `SideNav.tsx`, largeur fixe
 * même si la nav elle-même s'élargit au survol en `absolute`) — son bord
 * droit donne la position exacte à coller. Calculé à partir du PARENT de
 * cette card (pas d'elle-même) : mesurer `conteneurRef` directement une
 * fois son propre `marginLeft` appliqué aurait re-mesuré une position déjà
 * décalée par nous, faussant tout recalcul suivant (piège rencontré sur un
 * essai précédent). Le parent, lui, n'est jamais modifié, donc stable et
 * rejouable au resize sans boucle de rétroaction.
 */
export function FaqCard() {
  const { faqs, loading } = useFaqs();
  const [selectionId, setSelectionId] = useState<string>("");
  const conteneurRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ margeGauche: 0, largeur: 0 });

  // Sélection par défaut sur la première FAQ une fois chargée (07/09/2026,
  // ne peut plus être calculée en synchrone comme avec l'ancien tableau en
  // dur). Ajustement pendant le rendu plutôt que dans un effect (pattern
  // documenté React — "adjusting state as you render") : `initialise` garde
  // ce réglage à usage unique, sans quoi rouvrir la 1ère FAQ écraserait un
  // repli volontaire du collaborateur (`selectionId` remis à "" au clic).
  const [initialise, setInitialise] = useState(false);
  if (!initialise && faqs.length > 0) {
    setInitialise(true);
    setSelectionId(faqs[0].id);
  }

  useEffect(() => {
    function recalculer() {
      const parent = conteneurRef.current?.parentElement;
      const spacer = document.querySelector("[data-sidenav-spacer]");
      if (!parent) return;
      const naturelGauche = parent.getBoundingClientRect().left;
      const railDroite = spacer ? spacer.getBoundingClientRect().right : naturelGauche;
      setDimensions({
        margeGauche: railDroite - naturelGauche,
        largeur: window.innerWidth - railDroite,
      });
    }
    recalculer();
    window.addEventListener("resize", recalculer);
    return () => window.removeEventListener("resize", recalculer);
  }, []);

  if (loading || faqs.length === 0) return null;

  return (
    <div
      ref={conteneurRef}
      className="overflow-hidden bg-[#FCEFB3] px-8 py-8 md:px-12 md:py-12"
      style={{ width: dimensions.largeur || "100%", marginLeft: dimensions.margeGauche }}
    >
      <div className="flex flex-col gap-8 md:flex-row md:gap-16">
        <div className="shrink-0 md:w-72">
          <h2 className="text-abeil-navy text-2xl font-semibold">Questions fréquentes</h2>
          <p className="text-ink-500 mt-2 text-sm">
            Comprendre les quelques principes qui encadrent les congés chez Abeil
          </p>
        </div>
        <div className="divide-ink-300/60 flex min-w-0 flex-col divide-y md:w-[400px]">
          {faqs.map((faq) => {
            const active = faq.id === selectionId;
            return (
              <div key={faq.id} className="py-4 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectionId(active ? "" : faq.id)}
                  className="text-ink-900 flex w-full items-center justify-between gap-3 text-left text-sm font-semibold"
                >
                  {faq.question}
                  {active ? (
                    <ChevronUp size={16} className="text-ink-500 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-ink-500 shrink-0" />
                  )}
                </button>
                {active && (
                  <p className="text-ink-500 mt-2 text-sm leading-relaxed">{faq.reponse}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
