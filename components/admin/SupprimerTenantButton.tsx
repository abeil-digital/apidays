"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { supprimerTenant } from "@/app/admin/actions";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function EnTeteModalDanger({ titre, onClose }: { titre: string; onClose: () => void }) {
  return (
    <div className="bg-status-danger-bg flex items-center justify-between px-6 py-4">
      <h2 className="text-status-danger-fg text-lg font-semibold">{titre}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="text-status-danger-fg/70 hover:text-status-danger-fg shrink-0"
      >
        <X size={18} />
      </button>
    </div>
  );
}

/**
 * Suppression d'un tenant (09/09/2026, ajoutée après le premier test réel
 * de création — Vincent a besoin de nettoyer ce qu'il crée). Action
 * irréversible et destructrice (tenant + tous ses comptes) : confirmation
 * "haute" par popin (demande explicite, pas un simple `window.confirm`) —
 * il faut retaper le slug exact du tenant pour activer le bouton, même
 * principe qu'une suppression de dépôt sur GitHub.
 */
export function SupprimerTenantButton({
  id,
  nom,
  slug,
}: {
  id: string;
  nom: string;
  slug: string;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleConfirmer() {
    setEnCours(true);
    setErreur("");
    const resultat = await supprimerTenant(id);
    if (!resultat.ok) {
      setErreur("La suppression a échoué. Réessaie.");
      setEnCours(false);
      return;
    }
    setOuvert(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={`Supprimer ${nom}`}
        className="text-status-danger-fg hover:opacity-70"
      >
        <Trash2 size={16} />
      </button>

      {ouvert && (
        <Modal
          onClose={() => setOuvert(false)}
          header={<EnTeteModalDanger titre="Supprimer ce tenant" onClose={() => setOuvert(false)} />}
        >
          <div className="flex flex-col gap-4">
            <p className="text-ink-900 text-sm">
              Le tenant <strong>{nom}</strong>, tous ses utilisateurs et leurs comptes seront
              supprimés <strong>définitivement</strong>. Cette action est irréversible.
            </p>

            <div>
              <label htmlFor="confirmation-slug" className="text-ink-900 mb-1.5 block text-sm font-bold">
                Tape <code className="bg-surface-app rounded px-1">{slug}</code> pour confirmer
              </label>
              <Input
                id="confirmation-slug"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                autoComplete="off"
                className="!border-slate w-full rounded-md text-xs"
              />
            </div>

            {erreur && (
              <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
                {erreur}
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={handleConfirmer}
              disabled={saisie !== slug || enCours}
              className="rounded-card !bg-status-danger-bg !text-status-danger-fg !border-transparent w-fit self-start px-6 py-3 enabled:hover:opacity-90"
            >
              {enCours ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
