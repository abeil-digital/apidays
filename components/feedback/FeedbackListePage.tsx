"use client";

import { useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import type { Feedback } from "@/lib/types";
import { fetchFeedbacks } from "@/lib/data/feedbacks.repository";
import { EmptyRow } from "@/components/ui/EmptyRow";

function formatDateHeure(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/**
 * Page « Feedback » (navigation de niveau 1, manager/admin — 22/10/2026) : les
 * retours envoyés depuis le pied de page, du plus récent au plus ancien, en
 * lecture seule. Voir `feedbacks` dans schema.sql pour les droits.
 */
export function FeedbackListePage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[] | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchFeedbacks()
      .then((data) => {
        if (!cancelled) setFeedbacks(data);
      })
      .catch((e) => {
        if (!cancelled) setErreur(e instanceof Error ? e.message : "Chargement impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 pt-5 pb-4 md:pt-0">
      <div className="flex items-center gap-2 px-1">
        <MessageSquareText size={22} className="text-ink-900" />
        <h1 className="text-ink-900 text-2xl font-semibold">Feedback</h1>
        {feedbacks && (
          <span className="text-ink-500 ml-1 text-sm">
            {feedbacks.length} message{feedbacks.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="text-ink-500 px-1 text-sm">
        Les remarques, questions et idées envoyées depuis le lien « Feedback » en bas de chaque
        page.
      </p>

      {erreur && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {erreur}
        </div>
      )}

      {feedbacks === null && !erreur && <EmptyRow text="Chargement…" />}
      {feedbacks && feedbacks.length === 0 && <EmptyRow text="Aucun message pour le moment." />}

      {feedbacks && feedbacks.length > 0 && (
        <ul className="flex flex-col gap-3">
          {feedbacks.map((f) => (
            <li key={f.id} className="bg-surface-card rounded-xl px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-ink-900 text-sm font-semibold">{f.nom}</span>
                <span className="text-ink-500 text-xs">{formatDateHeure(f.creeLe)}</span>
              </div>
              <p className="text-ink-900 mt-1.5 text-sm whitespace-pre-wrap">{f.commentaire}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
