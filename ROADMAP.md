# Roadmap — Parcours de demande de congé

Créé le 15/08/2026 pour recentrer le travail sur **un seul parcours de bout en bout** plutôt que de
disperser l'effort : **demande (collaborateur) → validation (manager) → suivi (Delphine)**. Les
autres chantiers (nav en rideau, harmonisation UI restante, etc.) restent dans
[Backlog.md](Backlog.md), pas ici — ce document n'a qu'un but : garder ce parcours en tête et
avancer dans l'ordre.

Base factuelle (état du code au 15/08/2026, pas d'opinion) en tête de chaque phase, puis
recommandations et points ouverts.

## Vue d'ensemble

| Phase | Sujet                                 | État                                                               |
| ----- | ------------------------------------- | ------------------------------------------------------------------ |
| 1     | Formulaire de demande (collaborateur) | Fonctionnel, visuel daté, règle de chevauchement absente           |
| 2     | Validation (manager)                  | Fonctionnel, information de décision incomplète                    |
| 3     | Suivi (Delphine)                      | Largement construit, deux JTBD encore mal couverts (voir plus bas) |

---

## Phase 1 — Formulaire de demande (collaborateur)

**État actuel** (`components/nouvelle-demande/NouvelleDemandeForm.tsx`) :

- Champs : type (7 options), dates début/fin, demi-journée (jour unique ou par borne), note
  facultative pour le manager.
- Validation actuelle : dates renseignées + fin ≥ début. Rien d'autre — pas de délai de prévenance,
  pas de blocage sur une date passée.
- Aperçu de solde avant/après déjà présent (CP/RTT/CPA), mais basé sur une **estimation calendaire
  côté client** (`joursDemandes`), pas le calcul exact demi-journées/fériés fait côté serveur
  (`calculerNbDemiJournees`) — les deux chiffres peuvent diverger de façon marginale.
- **Aucune détection de chevauchement** : rien n'empêche ni ne signale une demande dont les dates
  recoupent une demande existante (validée ou en attente) du même collaborateur. Confirmé par
  recherche sur tout le repo — seul un item Backlog existe pour le chevauchement CPI/DJI (différent,
  pas construit non plus).

**À faire :**

1. **Détection de chevauchement** — règle de gestion de base manquante, priorité haute. Nécessite
   une décision produit : **bloquant** (empêche la soumission) ou **avertissement** (confirmation
   avant envoi) ? Recommandation : bloquant dans un premier temps — il n'existe aujourd'hui aucun
   flux d'édition d'une demande déjà posée, donc un chevauchement n'a pas de cas d'usage légitime
   évident à couvrir par un simple avertissement.
2. **Aligner l'aperçu de solde sur le calcul exact** — remplacer l'estimation calendaire par un
   appel au même calcul que `creerDemande` (ou une fonction dédiée réutilisable), pour ne jamais
   afficher un chiffre différent de ce qui sera réellement décompté.
3. **Refonte visuelle** — délibérément en dernier dans cette phase : pas de raison de retravailler le
   style avant d'avoir posé les nouveaux états (avertissement de chevauchement, etc.) qu'il devra
   porter.

---

## Phase 2 — Validation (manager)

**État actuel** (`components/suivre/SuivrePage.tsx`, `DemandeEquipeRow.tsx`) :

- La liste "Demandes à traiter" affiche par ligne : type, collaborateur, dates, nombre de jours, note
  du collaborateur (si renseignée).
- Actions : Approuver (un clic, pas de commentaire) / Refuser (popin avec commentaire facultatif).
- **Le solde du collaborateur n'est pas visible dans cette liste** — il faut naviguer vers la liste
  "Salariés" (même page, plus bas) ou ouvrir l'historique de solde pour le consulter avant de
  décider.

**Question posée : quelles informations un manager doit-il avoir pour valider un congé ?**

Proposition (le JTBD manager étant "décider vite, sans me tromper, sans devoir naviguer ailleurs") :

- **Solde actuel + solde après cette demande** (même aperçu que côté collaborateur), affiché
  directement dans la ligne ou dans un panneau de décision — pas besoin d'aller chercher ailleurs. Le
  cas d'un solde qui deviendrait négatif doit être visible d'un coup d'œil.
- **Chevauchement avec une autre demande déjà validée dans l'équipe** sur les mêmes dates —
  aujourd'hui totalement absent. C'est un vrai JTBD manager ("est-ce que quelqu'un d'autre est déjà
  absent à cette période ?"), distinct du chevauchement personnel de la phase 1.
- **Note du collaborateur** — déjà présente.
- **Commentaire du manager à la décision** — présent uniquement pour un refus aujourd'hui. À trancher
  : faut-il aussi un champ commentaire en cas de validation (traçabilité) ?
- Optionnel/à discuter : bref rappel du nombre de congés déjà pris par ce collaborateur sur l'année,
  pour contextualiser sans devoir ouvrir un autre écran.

---

## Phase 3 — Suivi (Delphine)

**État actuel** — la plus avancée des trois phases : Export paie, Suivre les soldes, Suivre les
demandes, Paramétrer > Congés & RTT sont tous construits et documentés en détail dans
[CONTEXTE.md](CONTEXTE.md).

**Job to be done de Delphine** (formulés explicitement) :

1. Transmettre la paie, et faire des régularisations **avant** le passage à la paie et **peut-être
   après**.
2. Réguler un solde **en le justifiant**, et **transmettre à la paie** les régularisations faites
   a posteriori.

**Où ça coince aujourd'hui, au regard de ces deux JTBD :**

- **Aucune notion de "déjà transmis à la paie"** sur une demande — chaque congé validé de la période
  sélectionnée apparaît de façon identique dans Export paie, qu'il ait déjà été envoyé à la
  comptable lors d'un export précédent ou non. Déjà noté au Backlog (`"Passé en paie"`), mais c'est
  un **prérequis direct** du JTBD n°1 : "avant/après passage à la paie" suppose de savoir ce qui est
  déjà passé.
- **`ajustements_solde` (régularisation de solde) est aujourd'hui CP uniquement** — le
  `type_absence_id` est codé en dur sur "CP" dans `ajouterAjustementSolde`. Le JTBD n°2 parle de
  "réguler un solde" en général ; RTT et CPA n'ont aucun mécanisme équivalent aujourd'hui.
- **`ajustements_solde` et Export paie sont deux systèmes complètement déconnectés.** Un motif de
  justification est bien saisi à la régularisation (couvre la partie "en justifiant" du JTBD n°2),
  mais rien ne relie une régularisation de solde à sa transmission effective à la comptable — la
  partie "en transmettant à la paie" du JTBD n°2 n'est concrètement couverte par rien dans l'UI
  actuelle.

**À faire, dans l'ordre suggéré :**

1. **Champ "transmis à la paie"** — timestamp + auteur, posé sur une demande validée (et sur un
   ajustement de solde une fois le point 3 fait) au moment de l'export ou via une action dédiée
   ("Marquer comme transmis"). Débloque directement le JTBD n°1.
2. **Faire apparaître les régularisations de solde dans Export paie**, à côté des congés consommés —
   aujourd'hui Delphine doit consulter deux écrans séparés pour avoir la vue complète de "tout ce qui
   part à la paie ce mois-ci".
3. **Généraliser `ajustements_solde` à RTT/CPA**, pas seulement CP.

---

## Priorisation proposée (les 5 premiers chantiers)

1. Détection de chevauchement (phase 1) — règle de gestion de base manquante, risque d'erreur direct.
2. Solde + chevauchement équipe visibles à la décision (phase 2) — évite les allers-retours, gain
   rapide sur un écran déjà construit.
3. Champ "transmis à la paie" (phase 3) — débloque le vrai JTBD n°1 de Delphine.
4. Lien régularisations de solde ↔ Export paie (phase 3) — débloque le vrai JTBD n°2.
5. Refonte visuelle du formulaire de demande (phase 1) — une fois les nouveaux états (chevauchement)
   posés, pas avant.

## Ouvert — à trancher avant de coder

- Chevauchement collaborateur : bloquant ou avertissement avec confirmation ?
- Commentaire manager à la validation (pas seulement au refus) : utile ou bruit ?
- "Transmis à la paie" : marquage manuel (bouton dédié) ou automatique au moment de l'export CSV ?
- Régularisation de solde étendue à RTT/CPA : même mécanisme (`ajustements_solde` générique) ou
  logique propre à chaque type ?
- Sans lien direct avec ce parcours mais pouvant affecter les soldes affichés en phase 1/2 : les
  zones grises déjà notées dans [projet.md](projet.md) (ancienneté, temps partiel, répartition RTT
  imposés) restent non tranchées avec Abeil.
