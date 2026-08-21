"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Question {
  id: string;
  question: string;
  reponse: string;
}

// Contenu provisoire (20/08/2026, "on affinera") — texte de départ pour poser
// le principe d'affichage, pas encore les vraies réponses métier validées.
const QUESTIONS: Question[] = [
  {
    id: "solde-theorique-reel",
    question: "Solde théorique et Solde réel, c'est quoi ?",
    reponse:
      "Le solde théorique inclut vos demandes en attente de validation (il anticipe leur acceptation), alors que le solde réel ne compte que les jours déjà validés. Le solde réel est toujours égal ou supérieur au solde théorique.",
  },
  {
    id: "jours-imposes",
    question: "Quels jours imposés cette année ?",
    reponse:
      "Les jours et demi-journées imposés (CPI/DJI) sont définis par votre manager dans le calendrier de l'année. Vous les retrouvez directement sur votre calendrier, avec les jours fériés.",
  },
  {
    id: "conges-ete",
    question: "À quel moment je pose mes congés d'été ?",
    reponse:
      "Il n'y a pas de fenêtre imposée : vous pouvez poser vos congés d'été dès que vous connaissez vos dates, dans la limite de votre solde disponible sur la période.",
  },
  {
    id: "jours-anciennete",
    question: "Les jours d'ancienneté, c'est pour qui ?",
    reponse:
      "Les jours d'ancienneté s'ajoutent automatiquement à votre solde de congés payés une fois un seuil d'ancienneté atteint. Le nombre de jours dépend du barème en vigueur.",
  },
];

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
 * un panneau séparé). Empilé en une seule colonne sous `md:`. Contenu des
 * réponses volontairement provisoire, pas encore les vraies règles métier
 * validées.
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
  const [selectionId, setSelectionId] = useState<string>(QUESTIONS[0].id);
  const conteneurRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ margeGauche: 0, largeur: 0 });

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

  return (
    <div
      ref={conteneurRef}
      className="bg-surface-card overflow-hidden px-8 py-8 md:px-12 md:py-12"
      style={{ width: dimensions.largeur || "100%", marginLeft: dimensions.margeGauche }}
    >
      <div className="flex flex-col gap-8 md:flex-row md:gap-16">
        <div className="shrink-0 md:w-72">
          <h2 className="text-ink-900 text-2xl font-semibold">Questions fréquentes</h2>
          <p className="text-ink-500 mt-2 text-sm">
            Comprendre les quelques principes qui encadrent les congés chez Abeil
          </p>
        </div>
        <div className="divide-ink-300/60 flex min-w-0 flex-col divide-y md:w-[400px]">
          {QUESTIONS.map((q) => {
            const active = q.id === selectionId;
            return (
              <div key={q.id} className="py-4 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectionId(active ? "" : q.id)}
                  className="text-ink-900 flex w-full items-center justify-between gap-3 text-left text-sm font-semibold"
                >
                  {q.question}
                  {active ? (
                    <ChevronUp size={16} className="text-ink-500 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-ink-500 shrink-0" />
                  )}
                </button>
                {active && <p className="text-ink-500 mt-2 text-sm leading-relaxed">{q.reponse}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
