"use client";

import { useState } from "react";

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
 * Card FAQ (20/08/2026, premier jet — "pose un principe moderne on
 * affinera") — bord à bord (`w-full`, pas de `max-w` comme la grille
 * calendrier au-dessus), sous "Prochains jours off"/"Mon Calendrier". Liste
 * de questions alignée à gauche, réponse de la question sélectionnée
 * affichée à droite (colonne unique empilée en dessous de `md:`). Contenu
 * des réponses volontairement provisoire, pas encore les vraies règles
 * métier validées.
 */
export function FaqCard() {
  const [selectionId, setSelectionId] = useState<string>(QUESTIONS[0].id);
  const selection = QUESTIONS.find((q) => q.id === selectionId);

  return (
    <div className="bg-surface-card w-full overflow-hidden rounded-2xl shadow-sm">
      <h2 className="text-ink-500 px-4 pt-4 pb-2 text-sm font-bold">FAQ</h2>
      <div className="border-ink-300/60 flex flex-col border-t md:flex-row">
        <div className="border-ink-300/60 flex flex-col border-b md:w-72 md:shrink-0 md:border-r md:border-b-0">
          {QUESTIONS.map((q) => {
            const active = q.id === selectionId;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectionId(q.id)}
                className={`px-4 py-3 text-left text-sm transition-colors duration-150 ${
                  active
                    ? "bg-mint-tint text-ink-900 font-semibold"
                    : "text-ink-500 hover:bg-surface-app"
                }`}
              >
                {q.question}
              </button>
            );
          })}
        </div>
        <div className="text-ink-900 flex-1 p-4 text-sm">
          {selection ? selection.reponse : null}
        </div>
      </div>
      {/* Pied de card (20/08/2026, provisoire) — pas de vrai canal de contact
          branché pour l'instant, juste le principe posé. */}
      <div className="border-ink-300/60 text-ink-500 border-t px-4 py-3 text-xs">
        Vous ne trouvez pas votre réponse ?{" "}
        <span className="text-mint font-semibold">Contactez les RH</span>
      </div>
    </div>
  );
}
