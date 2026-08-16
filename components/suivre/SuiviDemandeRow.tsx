import type { DemandeEquipe } from "@/lib/types";
import {
  formatDate,
  formatDateAction,
  formatJours,
  formatPeriodeDemande,
  nomJourSemaine,
} from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { JourBadge } from "@/components/ui/JourBadge";
import { STATUT_CONFIG } from "@/components/ui/StatusBadge";
import { classeFondTypeBadge, LABEL_LONG } from "@/components/demandes/TypeBadge";

interface SuiviDemandeRowProps {
  demande: DemandeEquipe;
  isLast: boolean;
  /** Masque la ligne point de couleur + libellé du type — utile quand
   * l'appelant affiche déjà le type ailleurs (ex. `DetailCongePanel`, dont le
   * header coloré porte déjà cette information). */
  masquerType?: boolean;
  /** Masque la ligne "Posé le" — utile quand l'appelant l'affiche autrement
   * (ex. `DetailCongePanel`, qui la place en premier item de son feed
   * d'actions). */
  masquerPoseLe?: boolean;
}

/**
 * Carte compacte "demande" pour le feed "Suivi des demandes" (Espace
 * Suivre, vue admin) — remplace `DemandeEquipeRow` dans ce contexte-là, où
 * il n'y a pas d'action à poser (juste "avoir un œil dessus"), et où les
 * demandes de toute l'entreprise sont mélangées dans un seul flux
 * chronologique plutôt que groupées par salarié.
 *
 * Choix de rendu, issus d'itérations rapides ("mode reflexion") sur cette
 * carte précise — ne pas les reproduire ailleurs sans re-vérifier que
 * l'intention tient :
 *
 * - **Le collaborateur n'est pas affiché dans ce composant.** C'est
 *   `SuivrePage` qui l'affiche, en en-tête, au-dessus de chaque carte — la
 *   ligne "un salarié → une carte compacte" n'existait pas avant cette
 *   itération, c'était initialement un `TypeBadge` (nom du salarié) intégré
 *   à la ligne, sorti volontairement du composant pour laisser
 *   `SuiviDemandeRow` réutilisable sans porter cette notion.
 * - **Type de congé = point de couleur + libellé complet**, pas le
 *   `TypeBadge` pill/outline habituel — reprend le pattern "point + texte"
 *   d'un item de légende (`classeFondTypeBadge` pour la couleur,
 *   `LABEL_LONG` pour le texte complet, ex. "Congés Payés" plutôt que "CP").
 *   Les deux sont exportés de `TypeBadge.tsx`, pas dupliqués ici.
 * - **Statut + durée sont concaténés dans une seule pastille** (`Badge` +
 *   icône `STATUT_CONFIG`, texte = nombre de jours plutôt que le libellé du
 *   statut) — la couleur/icône porte l'information de validation, le
 *   nombre le remplace comme texte. `STATUT_CONFIG` est exporté de
 *   `StatusBadge.tsx` pour ce genre de réutilisation (même mapping
 *   tone/icône, libellé différent).
 * - **Tailles** : hiérarchie volontairement resserrée par rapport aux
 *   gabarits habituels (`RequestRow`, `DemandeEquipeRow`) — période en
 *   `text-xs` (pas `text-sm`), libellé du type en `text-[11px]`, "posé le"
 *   en `text-[10px]`, le tout pour tenir une carte dense sans les boutons
 *   d'action. Le contenu de la pastille durée est agrandi à `text-[14.4px]`
 *   (+20% par rapport à `text-xs`) pour rester lisible malgré le `scale-90`
 *   appliqué à la pastille entière.
 * - **Dates au format jj/mm/aaaa** (`formatDateAction`, pas `formatDate`) —
 *   règle du projet : toute date de demande ou d'action (posé le, publié
 *   le...) s'affiche en numérique, jamais en "13 août 2026".
 */
export function SuiviDemandeRow({
  demande,
  isLast,
  masquerType = false,
  masquerPoseLe = false,
}: SuiviDemandeRowProps) {
  const jours = demande.nbDemiJournees / 2;
  const codeBadge = demande.type === "CP" && demande.isAnticipation ? "CPA" : demande.type;
  const { tone, Icon } = STATUT_CONFIG[demande.statut];
  const estPeriode = demande.debut !== demande.fin;
  const labelDemiJournee = estPeriode
    ? null
    : demande.demiDebut === "apres_midi"
      ? "apm"
      : demande.demiFin === "matin"
        ? "ma"
        : null;
  // Pour une période, le début/la fin peuvent chacun être une demi-journée
  // (ex. arrivée l'après-midi du premier jour, départ le matin du dernier) —
  // suffixe évalué indépendamment par extrémité, contrairement au jour seul
  // ci-dessus où demiDebut/demiFin décrivent la même unique journée.
  const labelDemiDebut = estPeriode && demande.demiDebut === "apres_midi" ? "apm" : null;
  const labelDemiFin = estPeriode && demande.demiFin === "matin" ? "ma" : null;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${isLast ? "" : "border-ink-300/60 border-b"}`}
    >
      <div className="min-w-0 flex-1">
        {!masquerType && (
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${classeFondTypeBadge(codeBadge)}`} />
            <span className="text-ink-500 text-[11px] font-semibold">{LABEL_LONG[codeBadge]}</span>
          </span>
        )}
        {estPeriode ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <JourBadge className="!text-ink-500 h-[18px] w-[18px] !rounded-[2px] text-[10px]">
                {nomJourSemaine(demande.debut).slice(0, 2)}
              </JourBadge>
              <div className="text-ink-900 text-xs font-semibold">
                {formatDate(demande.debut)}
                {labelDemiDebut && <span className="text-ink-500"> - {labelDemiDebut}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <JourBadge className="!text-ink-500 h-[18px] w-[18px] !rounded-[2px] text-[10px]">
                {nomJourSemaine(demande.fin).slice(0, 2)}
              </JourBadge>
              <div className="text-ink-900 text-xs font-semibold">
                {formatDate(demande.fin)}
                {labelDemiFin && <span className="text-ink-500"> - {labelDemiFin}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <JourBadge className="!text-ink-500 h-[18px] w-[18px] !rounded-[2px] text-[10px]">
              {nomJourSemaine(demande.debut).slice(0, 2)}
            </JourBadge>
            <div className="text-ink-900 text-xs font-semibold">
              {formatPeriodeDemande(demande.debut, demande.fin)}
              {labelDemiJournee && <span className="text-ink-500"> - {labelDemiJournee}</span>}
            </div>
          </div>
        )}
        {!masquerPoseLe && (
          <div className="text-ink-500 text-[10px]">
            {`Posé le ${formatDateAction(demande.datePose)}`}
          </div>
        )}
      </div>
      <span className="origin-right scale-90">
        <Badge tone={tone}>
          <Icon size={12} strokeWidth={2.5} />
          <span className="text-[14.4px]">{formatJours(jours)} j</span>
        </Badge>
      </span>
    </div>
  );
}
