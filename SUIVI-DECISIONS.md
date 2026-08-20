# Suivi des décisions (Accueil)

Documentation de la fonctionnalité "Depuis ma dernière visite" — la ligne affichée sur Accueil
(`/`, `Dashboard2Page.tsx`) entre "Bonjour, {prénom}" et "Soldes". Introduite le 18/08/2026.

## Objectif

Sur son Accueil, le salarié doit voir en un coup d'œil :

1. Combien de ses demandes sont **actuellement en attente** de décision (état réel).
2. Si le manager a **récemment validé ou refusé** une ou plusieurs de ses demandes depuis sa
   dernière visite (notification).

Ces deux notions ont volontairement des logiques d'affichage différentes (voir "Principe
fondateur" ci-dessous) et cohabitent sur la même ligne, indépendamment l'une de l'autre.

## Principe fondateur : état vs notification

Point de départ de la conception (échange avec Vincent, 18/08/2026) :

- **"En attente" est un état réel**, toujours vrai tant que la demande n'est pas traitée. Il n'y a
  pas de notion de "vu" à lui appliquer : le nombre affiché est simplement le nombre de demandes
  `en_attente` en base, recalculé à chaque chargement.
- **"Validé" / "Refusé" sont des événements passés**, pas un état permanent. Les afficher comme
  des compteurs qui restent affichés indéfiniment (une ancienne version de cette carte avait 3
  pills "En attente" / "Validées" / "Refusées") n'a pas de sens dans la durée — d'où le retrait des
  pills "Validées"/"Refusées" au profit d'une seule notion : "décisions non vues depuis ma dernière
  visite".
- Le **journal** (`ActiviteRecenteFeed.tsx`, tiroir "Mon journal") est le bon endroit pour
  représenter ces événements passés — pas un compteur permanent sur Accueil.

## Règle de gestion : la notion de "vu"

### Colonne et fonction (base de données)

- `demandes_conges.vu boolean not null default false` — voir `supabase/schema.sql`.
- Générique à **tout statut décidé**, pas seulement "validée" : prêt pour "refusée" sans nouvelle
  migration (déjà utilisé pour les deux).
- `vu` repasse à `false` à **chaque nouveau changement de statut** (validation, refus, remise en
  attente — voir `deciderDemande()`/`remettreEnAttenteDemande()` dans
  `lib/data/demandes.repository.ts`) : une décision (ou un changement de décision) est une nouvelle
  information à consulter, même si une précédente avait déjà été vue.
- Modifiable **uniquement** via la fonction RPC `marquer_demande_vue(p_demande_id)`
  (`security definer`, filtrée sur `utilisateur_id = my_utilisateur_id()`) — jamais par un
  `UPDATE` direct depuis le client. Raison : la policy RLS du salarié n'autorise la modification de
  ses propres demandes que tant qu'elles sont `en_attente` ; l'élargir aux demandes déjà décidées
  aurait aussi exposé les autres colonnes (dates, statut...) à une modification côté client. La
  fonction ne touche que `vu`.
- Exposé côté app : `Demande.vu` (`lib/types.ts`), `marquerDemandeVue()` (repository),
  `marquerVue()` (`useDemandes`, encore utilisé par `HistoriquePage` — voir plus bas).

### Quand une décision devient "vue" — principe "depuis ma dernière visite"

**Ce n'est pas** : "vu" ne se marque **plus** à la fermeture du tiroir "Mon journal" (première
version, abandonnée le 18/08/2026 — Vincent : perturbant que la mise en avant disparaisse dès
qu'on ouvre/ferme le volet).

**C'est** : une décision reste mise en avant **toute la session en cours** (l'onglet reste
ouvert), quel que soit le nombre d'ouvertures/fermetures du journal, et n'est marquée "vu" qu'au
tout début de la **session suivante** — pas à la fin de la session en cours (rien ne se déclenche
fiablement à la fermeture d'un onglet).

Implémentation (`hooks/useDemandes.ts`) :

- `sessionStorage` (clé `apidays_journal_session_started`, vidée à la fermeture de l'onglet) sert
  de marqueur "déjà traité cette session" — évite de rejouer la logique à chaque remontage du
  hook dans la même session (plusieurs pages appellent `useDemandes()`).
- `localStorage` (clé `apidays_journal_non_vues`, survit à la fermeture de l'onglet) recopie en
  continu la liste des IDs de décisions encore non vues — c'est la "photo" de ce qui est resté
  affiché pendant la session qui vient de se terminer.
- Au tout premier montage d'une **nouvelle** session (flag `sessionStorage` absent), la liste
  précédente lue dans `localStorage` est marquée "vu" d'un coup (`marquerDemandeVue()` pour chaque
  ID), puis le flag est posé pour le reste de la session.
- **Piège corrigé le 18/08/2026** : l'effet qui écrit dans `localStorage` doit attendre la fin du
  chargement (`if (loading) return;`) — sans cette garde, il s'exécute dès le tout premier rendu
  (`demandes` encore à `[]`) et écrase la liste persistée avec un tableau vide, juste avant que
  l'effet de marquage n'ait la chance de la lire. Résultat observé avant correctif : la mise en
  avant ne survivait jamais à un changement de session (redevenait "aucune décision récente"
  immédiatement).
- Cette notion de "session" est **par onglet navigateur** (`sessionStorage`), pas une vraie
  session d'authentification Supabase — approximation pragmatique, plus simple à détecter de façon
  fiable qu'un événement de connexion.

### Autre point d'entrée : Historique

`HistoriquePage.tsx` marque "vu" **immédiatement** à l'ouverture du panneau de détail d'une
demande décidée (`marquerVue(selection.id)` dans un `useEffect` sur `selection`) — mécanisme
indépendant et plus direct : consulter le détail complet d'une demande dans l'Historique est un
acte de consultation explicite plus fort que la simple présence sur Accueil, donc pas soumis au
principe "depuis ma dernière visite".

## Principes d'affichage

### La phrase "Depuis ma dernière visite" (Accueil)

Composant : `Dashboard2Page.tsx`, entre le titre "Bonjour, {prénom}" et la section "Soldes".

Structure (une seule ligne, `flex-wrap`) :

```
Depuis ma dernière visite                                    ← label, text-xs font-semibold text-ink-500
[📰] {n} demande(s) en attente  |  {n} nouvelle(s) décision(s) - voir le journal
```

- Icône `Newspaper` (lucide-react, 12px, `text-ink-500`) — représente le journal, collée au
  premier indicateur.
- **"{n} demande(s) en attente"** : mis en avant (fond `bg-status-warning-bg`, texte
  `text-status-warning-fg`) **si et seulement si** `n > 0`. Sinon texte neutre gris
  ("0 demande en attente").
- Séparateur `|` en `text-ink-500` (gris foncé).
- **"{n} nouvelle(s) décision(s)"** : mis en avant (fond `bg-yellow-100`, texte `text-ink-900`) si
  `n > 0`, indépendamment du compteur "en attente" — **les deux mises en avant peuvent cohabiter
  simultanément** (règle changée le 18/08/2026 : la première version rendait les décisions
  prioritaires uniquement quand "en attente" valait 0 ; jugé trop restrictif). Sinon : "aucune
  décision récente".
- Lien "voir le journal" : `text-mint font-bold underline` quand il y a des décisions non vues à
  signaler, sinon `text-ink-500 underline` (neutre).

**Choix de couleur "jaune pâle" pour les décisions non vues** : le vert (`status-success`) a été
essayé puis rejeté — le lot "nouvelles décisions" peut mélanger validations ET refus, donc une
couleur de statut (verte = positive) induirait en erreur. Le jaune pâle (`bg-yellow-100`, Tailwind
standard, pas un token custom du design system) sert de code couleur neutre "nouveauté", distinct
des tokens `status-success`/`status-warning`/`status-danger` qui restent réservés au statut réel
d'une demande (voir `Badge`/`StatusBadge`). Le lien "voir le journal" reste en `mint` (accent
générique de l'app pour "regarde ici, action possible" — déjà utilisé pour d'autres CTA/liens,
jamais lié à validé/refusé).

### Le journal ("Mon journal", `ActiviteRecenteFeed.tsx`)

Tiroir latéral ouvert depuis le lien "voir le journal" (`tiroirOuvert`/`onFermerTiroir` pilotés par
`Dashboard2Page`).

- Titre "Mon journal" avec la même icône `Newspaper` (16px) en en-tête.
- Liste de phrases en langage naturel (pas le format carte), un événement par ligne : "posé"
  (toujours) et "décidé" (si tranchée), triées du plus récent au plus ancien, 6 dernières lignes
  (`NB_LIGNES`).
- **Ligne de décision non vue** (`vu: false` sur la demande) : mise en avant visuellement — fond
  `bg-yellow-100/40` (jaune pâle, 40% de transparence — un jaune plein jugé trop appuyé pour une
  liste de plusieurs lignes) + texte en `font-semibold`. Même code couleur que la phrase d'Accueil.
- Chaque ligne reste un lien vers `/historique?demande=<id>` (ouvre le panneau détaillé complet).

**Garantie d'inclusion dans les 6 lignes** (bug corrigé le 18/08/2026, deux fois dans la même
journée pour deux causes distinctes) :

Le tri chronologique seul (`comparerEvenements`, départage "décidé" avant "posé" à date égale) peut
repousser hors des 6 lignes visibles :

1. Un événement "posé" d'une demande **encore en attente** — si plusieurs décisions tombent le même
   jour, elles gagnent le départage et remplissent les 6 emplacements avant que les événements
   "posé en attente" ne soient pris en compte.
2. Une **décision non vue** — même mécanisme : si plus de 6 événements existent le même jour, une
   décision non vue peut se retrouver au-delà de la limite, alors que le compteur de la phrase
   d'Accueil (qui n'a pas cette limite de 6) continue de l'annoncer. Symptôme observé : "3
   nouvelles décisions" affiché alors que seules 2 étaient visibles/surlignées dans le journal.

Solution retenue (`ActiviteRecenteFeed.tsx`) : les événements "posé (en attente)" puis les
"décision (non vue)" sont réservés en premier dans la liste des 6 lignes (dans cet ordre de
priorité), le reste des emplacements est comblé par les événements les plus récents parmi ceux
qui restent, puis l'ensemble est retrié chronologiquement pour l'affichage final. Ainsi le
compteur de la phrase d'Accueil et le contenu réellement visible du journal restent toujours
cohérents.

## Composants et fichiers concernés

| Fichier | Rôle |
| --- | --- |
| `supabase/schema.sql` | Colonne `demandes_conges.vu` + fonction `marquer_demande_vue()` |
| `lib/types.ts` | Champ `Demande.vu` |
| `lib/data/demandes.repository.ts` | `marquerDemandeVue()` (appel RPC) ; `vu: false` forcé dans `deciderDemande()`/`remettreEnAttenteDemande()` |
| `hooks/useDemandes.ts` | `marquerVue()` (marquage optimiste immédiat, utilisé par Historique) ; logique de session "depuis ma dernière visite" (`sessionStorage`/`localStorage`) |
| `components/dashboard/Dashboard2Page.tsx` | La phrase "Depuis ma dernière visite" (calcul `nbEnAttente`/`nbDecisionsNonVues`, rendu, lien vers le journal) |
| `components/dashboard/ActiviteRecenteFeed.tsx` | Tiroir "Mon journal" — génération des événements, garantie d'inclusion des lignes prioritaires, emphase visuelle des décisions non vues |
| `components/historique/HistoriquePage.tsx` | Marquage "vu" immédiat à la consultation du détail d'une demande ; filtres `?statut=valide_non_vu`/`refuse_non_vu` (pré-sélection venant d'anciens liens, voir Backlog) |

## Limites connues / non traité

Voir aussi [Backlog.md](Backlog.md) (ligne "URGENT — Vérifier le principe de mise en avant...").

- La notion de "session" est liée à l'onglet navigateur (`sessionStorage`), pas à une vraie
  session d'authentification — un utilisateur qui garde le même onglet ouvert plusieurs jours ne
  "changera" jamais de session tant qu'il ne le ferme pas.
- Pas de nettoyage/expiration des clés `localStorage`/`sessionStorage` si plusieurs comptes
  utilisent le même navigateur (clés non scopées par utilisateur).
- Aucune notion équivalente côté manager (voir Backlog : "Gestion du Journal côté manager").
- Formulation exacte de la phrase, couleurs exactes (jaune pâle notamment, pas un token du design
  system) : volontairement provisoires, à retravailler.
