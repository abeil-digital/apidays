"use client";

import { useState } from "react";
import { formatDateAction } from "@/lib/format";
import { periodePaieParDefaut } from "@/lib/periodePaie";
import { useCongesConsommes } from "@/hooks/useCongesConsommes";
import { useDemandesEquipe } from "@/hooks/useDemandesEquipe";
import { useUtilisateur } from "@/hooks/useUtilisateur";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { ListCard } from "@/components/ui/ListCard";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { CongesConsommesCard } from "@/components/suivre/CongesConsommesCard";
import { DemandeEquipeRow } from "@/components/suivre/DemandeEquipeRow";
import { HistoriqueSoldeModal } from "@/components/suivre/HistoriqueSoldeModal";
import { SalarieRow } from "@/components/suivre/SalarieRow";
import { SuiviDemandeRow } from "@/components/suivre/SuiviDemandeRow";

const LIMITE_SUIVI = 10;
const PERIODE_PAIE = periodePaieParDefaut();

export function SuivrePage() {
  const { demandes, loading, error, valider, refuser } = useDemandesEquipe();
  const { utilisateurs, loading: loadingEquipe } = useUtilisateursAdmin();
  const { utilisateur } = useUtilisateur();
  const { demandes: congesConsommes, loading: loadingConges } = useCongesConsommes(
    PERIODE_PAIE.debut,
    PERIODE_PAIE.fin,
  );

  const [enCoursId, setEnCoursId] = useState<string | null>(null);
  const [refusOuvert, setRefusOuvert] = useState<{ id: string } | null>(null);
  const [commentaireRefus, setCommentaireRefus] = useState("");
  const [historiqueOuvert, setHistoriqueOuvert] = useState<{ id: string; nom: string } | null>(
    null,
  );

  const estAdmin = utilisateur?.role === "admin";
  const aTraiter = demandes.filter((d) => d.statut === "en attente");
  const suiviRecent = [...demandes]
    .sort((a, b) => b.datePose.localeCompare(a.datePose))
    .slice(0, LIMITE_SUIVI);

  async function handleApprouver(id: string) {
    setEnCoursId(id);
    try {
      await valider(id);
    } finally {
      setEnCoursId(null);
    }
  }

  function ouvrirRefus(id: string) {
    setCommentaireRefus("");
    setRefusOuvert({ id });
  }

  async function confirmerRefus() {
    if (!refusOuvert) return;
    setEnCoursId(refusOuvert.id);
    try {
      await refuser(refusOuvert.id, commentaireRefus.trim());
      setRefusOuvert(null);
    } finally {
      setEnCoursId(null);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-6xl md:pt-0">
      <h1 className="text-ink-900 px-1 text-2xl font-semibold">Suivre</h1>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex max-w-[900px] flex-1 flex-col gap-2">
          <h2 className="text-ink-900 px-1 text-lg font-bold">Salariés</h2>

          {loadingEquipe ? (
            <div className="text-ink-500 py-8 text-center text-sm">Chargement…</div>
          ) : utilisateurs.length === 0 ? (
            <EmptyRow text="Aucun salarié." />
          ) : (
            <>
              <div className="flex items-center gap-3 px-4">
                <div className="w-8 shrink-0" />
                <div className="flex-1" />
                <div className="flex shrink-0 items-center gap-4">
                  <span className="text-ink-500 w-14 text-center text-sm font-bold">CP</span>
                  <span className="text-ink-500 w-14 text-center text-sm font-bold">RTT</span>
                  <span className="text-ink-500 w-14 text-center text-sm font-bold">CPA</span>
                </div>
              </div>
              <ListCard>
                {utilisateurs.map((u, i) => (
                  <SalarieRow
                    key={u.id}
                    utilisateur={u}
                    isLast={i === utilisateurs.length - 1}
                    onClickCp={() => setHistoriqueOuvert({ id: u.id, nom: `${u.prenom} ${u.nom}` })}
                  />
                ))}
              </ListCard>
            </>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 md:w-64 md:shrink-0">
          {estAdmin ? (
            <>
              <CongesConsommesCard
                demandes={congesConsommes}
                loading={loadingConges}
                libellePeriode={`${formatDateAction(PERIODE_PAIE.debut)} → ${formatDateAction(PERIODE_PAIE.fin)}`}
              />

              <h2 className="text-ink-900 px-1 text-lg font-bold">Suivi des demandes</h2>

              {error && (
                <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="text-ink-500 py-8 text-center text-sm">Chargement…</div>
              ) : suiviRecent.length === 0 ? (
                <EmptyRow text="Aucune demande pour le moment." />
              ) : (
                <div className="flex flex-col gap-3">
                  {suiviRecent.map((demande) => (
                    <div key={demande.id} className="flex flex-col gap-1">
                      <span className="text-ink-500 px-1 text-xs font-semibold">
                        {demande.demandeur.prenom} {demande.demandeur.nom}
                      </span>
                      <div className="bg-surface-card shadow-sm">
                        <SuiviDemandeRow demande={demande} isLast />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-ink-900 px-1 text-lg font-bold">
                {`Demandes à traiter${aTraiter.length > 0 ? ` (${aTraiter.length})` : ""}`}
              </h2>

              {error && (
                <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="text-ink-500 py-8 text-center text-sm">Chargement…</div>
              ) : aTraiter.length === 0 ? (
                <EmptyRow text="Aucune demande en attente de validation." />
              ) : (
                <div className="flex flex-col gap-3">
                  {aTraiter.map((demande) => (
                    <div key={demande.id} className="bg-surface-card rounded-xl shadow-sm">
                      <DemandeEquipeRow
                        demande={demande}
                        isLast
                        enCours={enCoursId === demande.id}
                        onApprouver={() => handleApprouver(demande.id)}
                        onRefuser={() => ouvrirRefus(demande.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {refusOuvert && (
        <Modal title="Refuser la demande" onClose={() => setRefusOuvert(null)}>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="commentaire-refus" className="text-ink-500 mb-1.5 block text-xs">
                Commentaire pour le salarié (facultatif)
              </label>
              <Textarea
                id="commentaire-refus"
                value={commentaireRefus}
                onChange={(e) => setCommentaireRefus(e.target.value)}
                rows={3}
                placeholder="Ex. période déjà couverte par un congé imposé…"
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setRefusOuvert(null)}
                className="rounded-full px-4 py-2"
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                disabled={enCoursId === refusOuvert.id}
                onClick={confirmerRefus}
                className="rounded-full px-4 py-2"
              >
                Confirmer le refus
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {historiqueOuvert && (
        <HistoriqueSoldeModal
          utilisateurId={historiqueOuvert.id}
          nomComplet={historiqueOuvert.nom}
          peutReguler={utilisateur?.role === "admin"}
          onClose={() => setHistoriqueOuvert(null)}
        />
      )}
    </div>
  );
}
