import type { DemandeEquipe } from "@/lib/types";
import { formatDateAction, formatJours, formatPeriodeDemande } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
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
        <div className="text-ink-900 text-xs font-semibold">
          {formatPeriodeDemande(demande.debut, demande.fin)}
        </div>
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
