"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import {
  envoyerFeedback,
  LONGUEUR_MAX_COMMENTAIRE,
  LONGUEUR_MAX_NOM,
} from "@/lib/data/feedbacks.repository";

/**
 * Lien « Feedback » du pied de page + formulaire (22/10/2026, demande de
 * Vincent — « On s'améliore, faites-nous part de vos remarques, questions »).
 * Deux champs : nom-prénom (pré-rempli avec le profil connecté, modifiable) et
 * commentaire. Accessible aux seules personnes connectées (le pied de page
 * n'existe que dans l'app connectée). Les messages sont lus par les managers
 * dans la page « Feedback » (`FeedbackListePage.tsx`).
 */
export function FeedbackLien() {
  const { utilisateur } = useUtilisateur();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [anonyme, setAnonyme] = useState(false);
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoye, setEnvoye] = useState(false);

  function ouvrir() {
    setNom(utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}`.trim() : "");
    setCommentaire("");
    setAnonyme(false);
    setErreur("");
    setEnvoye(false);
    setOuvert(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErreur("");
    setEnvoi(true);
    try {
      await envoyerFeedback({ nom, commentaire, anonyme });
      setEnvoye(true);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Impossible d'envoyer votre message.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        className="text-brand-accent text-sm font-semibold hover:underline"
      >
        Votre avis compte
      </button>

      {ouvert && (
        <Modal
          onClose={() => setOuvert(false)}
          surface="faq"
          separateur={false}
          className="max-w-md overflow-hidden rounded-2xl"
          header={
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-ink-900 text-base font-semibold">Votre avis compte</h2>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                aria-label="Fermer"
                className="text-ink-500 hover:text-ink-900 shrink-0"
              >
                <X size={18} />
              </button>
            </div>
          }
        >
          {/* Fond de la popin jaune (celui de la FAQ, `FaqCard.tsx`) avec
              l'introduction posée dessus ; formulaire sur card blanche, comme
              « Suivre mon solde » (`SoldeDetailPanel.tsx`). */}
          {!envoye && (
            <div className="text-ink-900 mb-4 flex flex-col gap-2 px-1 text-sm">
              <p className="font-semibold">Apidays est en amélioration continue.</p>
              <p>
                Faites-nous part de vos remarques, questions, bugs ou tout simplement suggestions
                d&rsquo;amélioration.
              </p>
            </div>
          )}
          <div className="bg-surface-card rounded-xl p-5 shadow-sm">
            {envoye ? (
              <div className="flex flex-col gap-4">
                <p className="text-ink-900 text-sm">
                  Merci, votre message a bien été envoyé. Nous le lirons avec attention.
                </p>
                <div className="flex justify-end">
                  <Button onClick={() => setOuvert(false)} className="rounded-full px-5 py-2.5">
                    Fermer
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-ink-900 text-sm font-semibold">Nom - prénom</span>
                  <Input
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    maxLength={LONGUEUR_MAX_NOM}
                    required={!anonyme}
                    disabled={anonyme}
                    className="disabled:bg-surface-app disabled:text-ink-500"
                  />
                </label>
                <label className="text-ink-700 -mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={anonyme}
                    onChange={(e) => setAnonyme(e.target.checked)}
                  />
                  Je préfère rester anonyme
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-ink-900 text-sm font-semibold">
                    Mon message / ma remarque
                  </span>
                  <Textarea
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    maxLength={LONGUEUR_MAX_COMMENTAIRE}
                    rows={6}
                    required
                  />
                  <span className="text-ink-500 self-end text-xs">
                    {commentaire.length}/{LONGUEUR_MAX_COMMENTAIRE}
                  </span>
                </label>
                {erreur && (
                  <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
                    {erreur}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setOuvert(false)}
                    className="rounded-full px-4 py-2 text-sm"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={envoi || (!anonyme && !nom.trim()) || !commentaire.trim()}
                    className="rounded-full px-5 py-2.5 text-sm"
                  >
                    Envoyer
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
