"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import type { Faq, FaqInput } from "@/lib/types";
import { useFaqs } from "@/hooks/useFaqs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListCard } from "@/components/ui/ListCard";
import { Textarea } from "@/components/ui/Textarea";

interface LigneFormulaireFaqProps {
  valeurInitiale?: Faq;
  onValider: (input: FaqInput) => Promise<void>;
  onAnnuler: () => void;
}

/** Formulaire inline question/réponse — même gabarit que
 * `LigneFormulaireAnciennete` (`CongesRttPage.tsx`) : ligne dépliée dans la
 * `ListCard` plutôt qu'une popin, "Valider"/"Annuler" en pied de formulaire.
 * Pas de bascule Publier/Dépublier ici (07/09/2026, spec explicite : "en
 * création une FAQ est non publiée") — la publication se fait depuis la
 * pastille de la ligne, pas depuis ce formulaire. */
function LigneFormulaireFaq({ valeurInitiale, onValider, onAnnuler }: LigneFormulaireFaqProps) {
  const [question, setQuestion] = useState(valeurInitiale?.question ?? "");
  const [reponse, setReponse] = useState(valeurInitiale?.reponse ?? "");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!question.trim() || !reponse.trim()) {
      setErreur("Merci de compléter la question et la réponse.");
      return;
    }

    setErreur("");
    setEnvoi(true);
    try {
      await onValider({ question: question.trim(), reponse: reponse.trim() });
    } catch {
      setErreur("Impossible d'enregistrer cette FAQ.");
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-4 py-4">
      <div>
        <label htmlFor="faq-question" className="text-brand-primary mb-1.5 block text-sm font-bold">
          Question
        </label>
        <Input
          id="faq-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="!border-slate w-full"
        />
      </div>
      <div>
        <label htmlFor="faq-reponse" className="text-brand-primary mb-1.5 block text-sm font-bold">
          Réponse
        </label>
        <Textarea
          id="faq-reponse"
          value={reponse}
          onChange={(e) => setReponse(e.target.value)}
          rows={3}
          className="!border-slate w-full"
        />
      </div>

      {erreur && <p className="text-status-danger-fg text-xs">{erreur}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={envoi} className="rounded-full px-4 py-1.5 text-xs">
          Valider
        </Button>
        <button
          type="button"
          onClick={onAnnuler}
          className="text-ink-500 text-xs font-semibold underline"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

export function FaqAdminPage() {
  const { faqs, loading, error, ajouter, modifier, supprimer, reordonner } = useFaqs();
  const [ligneOuverte, setLigneOuverte] = useState<string | "nouvelle" | null>(null);
  // Aperçu de drag and drop (07/09/2026) — dérivé de `faqs` plutôt que
  // synchronisé via un effect (`dragOrder` reste `null` hors drag, le rendu
  // retombe alors sur `faqs`) : le hook ne persiste (`reordonner`) qu'au
  // drop, pas à chaque survol.
  const [dragOrder, setDragOrder] = useState<Faq[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const items = dragOrder ?? faqs;

  function handleDragStart(id: string) {
    setDragId(id);
    setDragOrder(faqs);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setDragOrder((prev) => {
      const base = prev ?? faqs;
      const dragIndex = base.findIndex((f) => f.id === dragId);
      const overIndex = base.findIndex((f) => f.id === overId);
      if (dragIndex === -1 || overIndex === -1) return base;
      const suivant = [...base];
      const [deplace] = suivant.splice(dragIndex, 1);
      suivant.splice(overIndex, 0, deplace);
      return suivant;
    });
  }

  async function handleDrop() {
    const ordreFinal = dragOrder ?? faqs;
    setDragId(null);
    setDragOrder(null);
    await reordonner(ordreFinal);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-2xl md:pt-0">
      <h1 className="text-brand-primary animate-stagger-in px-1 text-2xl font-semibold">FAQ</h1>

      {error && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
      ) : (
        <div className="bg-surface-card border-ink-300/60 flex flex-col gap-5 border p-5">
          <div>
            <h2 className="text-brand-primary text-sm font-bold">Questions fréquentes</h2>
            <p className="text-ink-500 mt-1.5 text-xs">
              Visibles des collaborateurs sur Accueil une fois publiées. Glisser une ligne pour
              changer son ordre d&rsquo;affichage.
            </p>
          </div>

          {items.length > 0 && (
            <ListCard>
              {items.map((faq, i) => (
                <div
                  key={faq.id}
                  className={i === items.length - 1 ? "" : "border-ink-300/60 border-b"}
                >
                  {ligneOuverte === faq.id ? (
                    <LigneFormulaireFaq
                      valeurInitiale={faq}
                      onValider={async (input) => {
                        await modifier(faq.id, input);
                        setLigneOuverte(null);
                      }}
                      onAnnuler={() => setLigneOuverte(null)}
                    />
                  ) : (
                    <div
                      draggable
                      onDragStart={() => handleDragStart(faq.id)}
                      onDragOver={(e) => handleDragOver(e, faq.id)}
                      onDrop={handleDrop}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOrder(null);
                      }}
                      className={`flex items-center gap-3 px-4 py-3 transition-opacity duration-150 ${
                        dragId === faq.id ? "opacity-40" : ""
                      }`}
                    >
                      <GripVertical size={16} className="text-ink-300 shrink-0 cursor-grab" />
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="text-ink-900 truncate text-sm font-semibold">
                          {faq.question}
                        </span>
                        <button
                          type="button"
                          onClick={() => modifier(faq.id, { publie: !faq.publie })}
                          className="shrink-0"
                        >
                          <Badge tone={faq.publie ? "success" : "neutral"}>
                            {faq.publie ? "Publiée" : "Brouillon"}
                          </Badge>
                        </button>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setLigneOuverte(faq.id)}
                          className="text-ink-500 text-xs font-semibold underline"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => supprimer(faq.id)}
                          aria-label="Supprimer cette FAQ"
                          className="text-status-danger-fg shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </ListCard>
          )}

          {ligneOuverte === "nouvelle" ? (
            <ListCard>
              <LigneFormulaireFaq
                onValider={async (input) => {
                  await ajouter(input);
                  setLigneOuverte(null);
                }}
                onAnnuler={() => setLigneOuverte(null)}
              />
            </ListCard>
          ) : (
            <button
              type="button"
              onClick={() => setLigneOuverte("nouvelle")}
              className="text-ink-900 w-fit text-xs font-semibold underline"
            >
              + ajouter une FAQ
            </button>
          )}
        </div>
      )}
    </div>
  );
}
