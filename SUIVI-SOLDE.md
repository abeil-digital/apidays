# Suivi de solde (`SoldeDetailPanel`)

Documentation de la fonctionnalité "Suivre mon solde" / "Suivre les soldes" — le panneau de détail
CP/RTT/CPA (`components/suivre/SoldeDetailPanel.tsx`), utilisé à la fois côté salarié (Accueil,
popin "Suivre mon solde") et côté manager (`/suivre/soldes`, docking latéral "Suivre les soldes").
Session du 18-20/08/2026, itérée par petites touches successives — voir aussi
[CONTEXTE.md](CONTEXTE.md) pour le fil chronologique complet.

## Objectif

Un seul composant, deux contextes d'usage très différents, pilotés par des props opt-in pour ne
jamais faire fuiter le comportement de l'un sur l'autre :

|                         | Accueil (salarié, "Suivre mon solde")                               | `/suivre/soldes` (manager, "Suivre les soldes")                       |
| ----------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Déclenchement           | Clic sur une `SoldeCard` (CP/RTT/CPA)                               | Clic sur une pill de solde d'un collaborateur                         |
| Présentation            | Popin overlay centrée, bords arrondis                               | Docking latéral `xl:sticky`, bords carrés                             |
| En-tête                 | Simplifié : `TypeBadge` + "Suivre mon solde", pas de bandeau coloré | Complet : avatar + nom du collaborateur, bandeau coloré plein bord    |
| Mode par défaut         | Théorique (compte les demandes en attente)                          | Réel                                                                  |
| Clic sur une pill congé | Ouvre `DetailCongePanel` à côté/en dessous, avec transition         | Non branché (le docking est déjà pris par la table de collaborateurs) |

Ces différences sont portées par 4 props opt-in sur `SoldeDetailPanel`, toutes `false`/absentes par
défaut (comportement manager inchangé si on ne les passe pas) :

- `arrondi` — bords arrondis + `overflow-hidden` (sinon bords carrés).
- `modeParDefaut` — `"theorique"` ou `"reel"` (sinon `"reel"`).
- `headerSimplifie` — bandeau simplifié sans avatar/nom/fond coloré (sinon bandeau complet).
- `avecDetailConge` — active tout le système de clic-sur-pill → `DetailCongePanel` décrit plus bas
  (sinon les pills ne sont pas cliquables, comportement historique inchangé).

Toutes les modifications de ce document sont scopées à ces 4 props : la vue manager
(`avecDetailConge` absent) n'a jamais été affectée par ce chantier, vérifié à chaque étape.

## Comportements

### Dissociation visuelle : pill (jour de congé) vs badge (solde initial / acquisition)

Affordance pas évidente à l'origine : "Solde N-1"/"Solde initial" (report de la période
précédente) et "Acquisition" (accrual mensuel RTT/CPA) ressemblaient visuellement à des pills de
congé cliquables alors qu'ils ne représentent pas une demande — juste une ligne comptable.

- **Pills de congé** (`type: "demande"`, un jour réellement posé) : contour arrondi
  (`rounded-full border`), fond `bg-surface-app` (quasi blanc), bordure couleur du type. Cliquables
  quand `avecDetailConge` est actif.
- **Badges d'info** ("Solde N-1"/"Solde initial", "Acquisition") : bords carrés, fond plein couleur
  du type (`classeFondTypeBadge`), texte blanc, **pas de bordure**. Jamais cliquables, jamais
  d'effet de survol — un survol y aurait impliqué à tort une affordance cliquable qui n'existe pas.

### Colonne "Solde" en gris

Sur les lignes "jour de congé" (`type: "demande"`) uniquement, la valeur de la colonne "Solde" est
en `text-ink-500` (gris) plutôt que `text-ink-900` — pour rester secondaire par rapport à
l'événement lui-même. Les lignes "Solde N-1"/"Acquisition" gardent `text-ink-900`.

### État "actif" (pill dont le détail est ouvert)

Quand une pill congé est cliquée (`avecDetailConge`), elle et sa ligne passent en état actif :

- Pill : fond plein couleur du type (`classeFondTypeBadge`), texte blanc, bordure transparente.
- Ligne (`<tr>`) : fond teinté à 12% (`color-mix(in srgb, var(--color-{type}) 12%, white)`) — même
  convention que `SoldeCard` (tinte de fond à 12%, voir commentaire historique dans ce fichier).
- La colonne "Solde" sticky de la ligne active reprend le même fond teinté (sinon le `sticky`
  casserait visuellement la continuité de couleur au scroll horizontal).

### Survol des pills (calé sur le comportement de `SoldeCard`)

Uniquement sur les pills congé (jamais sur les badges "Solde N-1"/"Acquisition", voir plus haut) :

- `hover:scale-105` — grossissement léger.
- Pill non active : fond `bg-surface-app` → teinte couleur du type à 15%
  (`hover:bg-[color-mix(in_srgb,var(--color-{type})_15%,white)]`, voir "Bug rencontré" ci-dessous).
- Pill déjà active (fond plein) : `hover:brightness-[0.85]` — assombrit la couleur pleine plutôt
  que de la teinter (elle l'est déjà).
- `transition-[scale,background-color,filter] duration-200` — **`scale`, pas `transform`** :
  Tailwind v4 anime `hover:scale-*` via la propriété CSS native `scale`, pas `transform`. Mettre
  `transform` dans la liste de propriétés transitionnées ne provoque pas d'erreur mais le
  grossissement se fait alors instantanément (aucune propriété "transform" ne change réellement),
  ce qui le rend facile à manquer — bug réel rencontré et corrigé le 20/08/2026, **également présent
  dans `SoldeCard.tsx` (`components/ui/SoldeCard.tsx:61`), pas corrigé là-bas** (voir tâche en
  arrière-plan associée).

### Clic sur une pill congé → `DetailCongePanel` (`avecDetailConge`)

Fonctionnalité expérimentale, scopée à Accueil pour l'instant.

- Récupère la demande complète via `fetchDemandeParId(id)` (nouvelle fonction,
  `lib/data/demandes.repository.ts`) — `MouvementSolde.id` (pill) correspond à l'id réel de
  `demandes_conges` uniquement pour `type: "demande"` (pas "ajustement"/"acquisition", qui n'ont
  pas de demande associée).
- État à deux niveaux : `idSelectionne` (mis à jour **avant** le fetch, sert à savoir sous quelle
  ligne afficher le panneau y compris pendant le chargement) et `demandeSelectionnee` (la donnée
  une fois résolue). `demandeSelectionnee` est explicitement remis à `null` au **début** de chaque
  nouveau clic — sinon, en changeant de ligne pendant qu'une autre demande est déjà ouverte,
  l'ancien contenu restait affiché sous la nouvelle ligne le temps du fetch (flash de contenu
  incohérent).
- **Desktop (`sm:` et plus)** : `DetailCongePanel` apparaît en colonne à droite du tableau, avec :
  - Écart de 20px entre le tableau et le panneau (`gap`, animé) — **valeur retenue comme référence
    pour tout affichage tableau + panneau de détail**, déjà celle utilisée par `gap-5` dans
    `HistoriquePage`/`SuivreDemandesPage`/`SuivreSoldesPage`/`CongesPaiePage` ; ce panneau-ci était
    l'exception (30px) à corriger, pas l'inverse.
  - Largeur de la colonne détail animée en `width` (0 → 256px) — 256px calé sur le `xl:w-64` propre
    à `DetailCongePanel` lui-même (pas une valeur arbitraire : un conteneur plus large aurait laissé
    un vide à droite du panneau, puisque `DetailCongePanel` ne remplit jamais plus que sa propre
    largeur intrinsèque au-delà de `xl:`).
  - Le tableau lui-même a une largeur fixe en px (`384px`, pas `max-w-sm` en `%`) : la card
    englobante n'a pas de largeur propre (elle s'ajuste à son contenu), donc un pourcentage y
    résout en `auto`/taille intrinsèque au lieu des 384px voulus — même piège que la largeur de la
    colonne détail, généralisé.
  - `DetailCongePanel` se cale sur le **haut du tableau**, pas sur le haut du bandeau "Suivre mon
    solde" au-dessus (le bandeau est sorti de `panneau` pour devenir un en-tête commun aux deux
    colonnes, éliminant le besoin d'un décalage manuel).
  - Gouttière droite de 15px entre le panneau et le bord de la popin.
- **Mobile (< `sm`)** : `DetailCongePanel` s'affiche **inline, directement sous la ligne cliquée**
  dans le tableau (`ligneDetailMobile`, une `<tr>` `colSpan={3}` insérée juste après la ligne
  concernée), pas en colonne à droite ni en bas de tout le tableau. Colonne détail desktop cachée
  (`hidden sm:block`). Corrige un bug d'utilisabilité réel : les deux colonnes à largeur fixe en px
  débordaient de l'écran sur mobile, coupées silencieusement par l'`overflow-hidden` de la card
  englobante.
- **Transition d'apparition + changement de ligne** : `DetailCongePanel` (et son placeholder
  "Chargement…") portent une animation CSS `detail-fade-in` (fondu + léger `translateY`, 200ms,
  `app/globals.css`) plutôt qu'une `transition` — une `animation` rejoue à chaque montage
  (déclenché par `key={demandeSelectionnee.id}`), y compris en passant d'une ligne à l'autre sans
  jamais démonter le composant entretemps, ce qu'une simple `transition` ne peut pas faire.
- **Popin unifiée** : le tableau et `DetailCongePanel` partagent une seule card englobante
  (`bg-surface-app` + `rounded-2xl` + `shadow-lg`) — `DetailCongePanel` a ses propres cartes
  internes (bandeau bleu, etc.) mais flottait visuellement en dehors de la popin "Suivre mon solde"
  avant cet ajout. Le fond de cette card englobante est gris (`bg-surface-app`, même fond que le
  reste de l'app) ; le tableau porte son propre fond blanc (`bg-surface-card`) pour rester une card
  distincte dessus.

### Hauteur/largeur proportionnelles à l'écran

- Le tableau interne est plafonné à `max-h-[45vh]` (pas un px fixe) — proportionnel à la hauteur
  d'écran, avec en-tête de colonnes ET colonne "Solde" `sticky` pendant le scroll.
- Le backdrop (`Dashboard2Page.tsx`) porte `overflow-y-auto` + `py-8` en filet de sécurité si la
  popin dépasse quand même la hauteur d'un écran très court — `items-center` conservé (reste
  centrée dans le cas normal, le scroll ne prend le relais que si besoin).

## Bug rencontré : classe Tailwind avec interpolation JS dans un crochet

Le bug le plus significatif de cette session, à retenir comme **règle générale pour tout le
repo** — pas spécifique à ce composant.

### Symptôme

```tsx
// ❌ Ne fonctionne jamais, silencieusement
className={`... hover:bg-[color-mix(in_srgb,var(${VAR_COULEUR[code]})_15%,white)] ...`}
```

La classe apparaît correctement dans le DOM rendu (React ne fait qu'assembler une chaîne de
caractères, il ne se soucie pas de ce que Tailwind peut ou non en faire). Mais **aucune règle CSS
correspondante n'est jamais générée**, donc l'effet ne s'applique jamais, quel que soit :

- le cache Turbopack (`rm -rf .next` + restart n'y change rien),
- l'état du survol réel testé,
- un hard refresh navigateur.

Vérification faite pendant le debug : la règle CSS est absente de `document.styleSheets` alors que
la classe est bien présente dans `element.className`. Piste de diagnostic à retenir : quand une
classe Tailwind arbitraire s'affiche dans le DOM sans jamais avoir d'effet visuel — même après
avoir épuisé les vidages de cache habituels — vérifier en premier si son contenu dépend d'une
interpolation JS runtime.

### Cause

Tailwind (v3 comme v4) génère son CSS par **analyse statique du texte source** — un scan de chaîne
de caractères sur les fichiers, pas une exécution du code JavaScript/TypeScript. Une classe
arbitraire comme `hover:bg-[...]` doit être une chaîne **complète et littérale** dans le fichier
source pour que le scanner la reconnaisse et génère la règle correspondante. Dès qu'une partie de
la valeur entre crochets vient d'une expression JS (`${VAR_COULEUR[code]}`, ici la variable CSS
`--color-cp`/`--color-rtt`/`--color-cpa` selon le type), le scanner ne voit qu'un fragment de texte
non reconnaissable comme une classe valide — et ne génère rien.

Ce n'est **pas limité aux valeurs arbitraires avec `color-mix`** : toute classe Tailwind dont une
portion (couleur, taille, propriété...) est injectée dynamiquement via une variable JS au lieu
d'être écrite en toutes lettres dans le code source tombe dans le même piège.

### Correctif — le pattern déjà en place ailleurs dans le repo

Le repo a déjà la bonne pratique établie à plusieurs endroits
(`components/dashboard/ActiviteRecenteFeed.tsx`, `components/nouvelle-demande/PoserDemandeModal.tsx`) :
un **lookup object** avec une entrée par valeur possible, chaque entrée étant une chaîne
**entièrement figée**, littérale, sans interpolation :

```ts
// ✅ Chaque valeur est un texte complet, scannable statiquement
const HOVER_BG_CONGE: Record<CodeSoldeDetail, string> = {
  CP: "hover:bg-[color-mix(in_srgb,var(--color-cp)_15%,white)]",
  RTT: "hover:bg-[color-mix(in_srgb,var(--color-rtt)_15%,white)]",
  CPA: "hover:bg-[color-mix(in_srgb,var(--color-cpa)_15%,white)]",
};
```

```tsx
// ✅ On interpole seulement le CHOIX de la clé, jamais le contenu de la classe elle-même
className={`... ${HOVER_BG_CONGE[code]}`}
```

Le seul cas où interpoler une variable CSS **à l'intérieur** d'un `style` inline (pas d'une classe
Tailwind) reste sûr est via l'attribut `style={{ backgroundColor: \`color-mix(in srgb, var(${VAR}) 12%, white)\` }}`
— c'est du CSS inline standard, résolu par le navigateur à l'exécution, pas par le scanner Tailwind
au build. C'est d'ailleurs le mécanisme déjà utilisé pour le fond teinté des lignes actives dans ce
même fichier (`style={{ backgroundColor: ... }}`sur les`<tr>`/`<td>` sticky) — fonctionne
correctement car ce n'est jamais passé par une classe Tailwind arbitraire.

### Leçon à appliquer partout

Avant d'écrire `className={\`...hover:bg-[...${variable}...]...\`}`(ou tout autre modificateur
Tailwind avec valeur arbitraire dépendant d'une variable JS) : **s'arrêter et utiliser un lookup
object figé par valeur possible**, comme ci-dessus. Si la variable a un nombre de valeurs possibles
trop grand pour un lookup raisonnable, passer par un`style` inline plutôt qu'une classe Tailwind.

## Composants et fichiers concernés

| Fichier                                         | Rôle                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `components/suivre/SoldeDetailPanel.tsx`        | Composant principal — tableau événements/pills, header, mode réel/théorique, intégration `DetailCongePanel`                     |
| `components/suivre/DetailCongePanel.tsx`        | Panneau "Détail du congé", réutilisé tel quel (aucune modification pour ce chantier)                                            |
| `lib/data/demandes.repository.ts`               | `fetchDemandeParId(id)` — nouvelle fonction, demande complète par id pour le clic sur pill                                      |
| `lib/format.ts`                                 | `formatPeriodePillNumerique` — format jj/mm/aa des pills de date (CP/RTT/CPA, Export paie, Suivre les demandes en mode compact) |
| `app/globals.css`                               | `--color-mint-hover`, `--animate-detail-fade-in`/`@keyframes detail-fade-in`                                                    |
| `components/dashboard/Dashboard2Page.tsx`       | Backdrop overlay de la popin Accueil (`arrondi`, `modeParDefaut="theorique"`, `headerSimplifie`, `avecDetailConge`)             |
| `components/design-system/DesignSystemPage.tsx` | `SoldeCard` et bouton "Poser un congé" documentés avec leur comportement au survol                                              |

## Limites connues / non traité

- `avecDetailConge` reste expérimental et scopé à Accueil — pas branché sur "Suivre les soldes"
  (vue manager), dont le docking latéral est déjà pris par la table de collaborateurs.
- Le bug de transition `scale`/`transform` (voir plus haut) est corrigé ici mais **toujours présent
  dans `SoldeCard.tsx`** — tâche en arrière-plan proposée (`task_2a00f5cb`), pas encore traitée.
- Formulation exacte, couleurs, largeurs (384px/256px/15px/20px/45vh) : choix pragmatiques issus
  d'itérations successives, pas garantis figés définitivement.
