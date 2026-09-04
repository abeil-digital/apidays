# Questions / besoins de précision

Liste de questions à trancher avec Vincent — agrégées ici au fil de la session plutôt que
dispersées dans le chat, pour ne rien perdre. Pas un todo : une question retirée une fois
répondue (la réponse et la décision vont dans [CONTEXTE.md](CONTEXTE.md)/[Backlog.md](Backlog.md)
selon le cas).

## Suivre/Transmissions paie

- **Valider un congé non décidé au moment de générer l'export** (25/08/2026) — si un congé
  "en attente" traîne encore au moment où Delphine fait "Générer l'export", peut-elle le valider
  directement depuis là (avec traçabilité — qui a validé, quand) ? Déjà possible techniquement :
  l'onglet "Quels congés transmettre" fait remonter tous les "en attente" jamais tranchés (pas
  seulement ceux de la période) et ouvre le `DetailCongePanel` complet au clic, avec les actions
  Valider/Refuser normales (mêmes colonnes de traçabilité — `validateur_id`/`date_decision` —
  que partout ailleurs dans l'app). À confirmer avec Vincent que c'est bien le comportement voulu
  (vs. bloquer la génération de l'export tant qu'il reste des "en attente" non tranchés).
- **Delphine peut-elle ajouter un congé pour un collaborateur ?** (25/08/2026) — même logique de
  traçabilité que ci-dessus. Déjà construit : bouton "Poser pour un collaborateur" sur l'onglet
  "Quels congés transmettre", crée une demande directement `validee` avec
  `commentaire_decision = "Ajouté par {prénom} {nom}"`, visible dans l'historique du collaborateur
  concerné (transparence actée). Portée volontairement limitée : oubli de saisie/correction
  ponctuelle — la maladie reste explicitement hors scope (décision déjà actée avec Vincent). À
  confirmer que ce périmètre reste le bon une fois l'écran testé en usage réel.
- **"Quels congés transmettre" doit-il aussi geler sur une période déjà transmise ?** (25/08/2026,
  chantier "Vérifier les fiches de paie" mis en pause) — "Générer l'export" a désormais un mode figé
  une fois l'export généré (montre le contenu réel `export_paie_lignes`, plus le backlog live). "Quels
  congés transmettre" n'a PAS reçu le même traitement — il continue d'afficher le backlog live même
  pour une période déjà transmise. Comportement peut-être voulu (l'onglet sert justement à repérer ce
  qui reste à transmettre, y compris pour une période déjà close), mais pas explicitement tranché.
- **Split "CP n / CP n-1+n-2" sur "Vérifier les fiches de paie"** (25/08/2026) — la vraie fiche de
  paie du comptable distingue le CP de l'année en cours du CP reporté des années précédentes ; l'app
  ne montre qu'un total CP combiné (le moteur de solde actuel n'a qu'un seul niveau de report, pas de
  détail par année). Vincent a validé qu'on n'attaque pas ce chantier pour l'instant — à rouvrir si le
  total combiné s'avère insuffisant pour vraiment vérifier la fiche de paie à l'usage.
- **Format Droit/Pris/Solde vs Solde précédent/Mouvement/Solde en cours** (25/08/2026) — simplifié à
  3 valeurs (pas de Droit/Pris détaillés séparément par catégorie) pour aller plus vite. À revalider
  une fois Vincent en usage réel sur une vraie fiche de paie, si ce niveau de détail suffit pour
  "checker que les jours sont bien pris en compte dans la FDP" comme demandé.
- **Périmètre de bascule du modèle théorique/réel** (27/08/2026, tranché) — implémenté partout d'un
  coup plutôt qu'en migration progressive : `fetchSoldes`/`fetchHistoriqueCp`/`fetchHistoriqueRtt`
  dérivent désormais toutes `valeur` (réel) de `export_paie_lignes`, donc tous les écrans qui lisent
  `.valeur` (`SuivreSoldesPage`, `SoldeDetailPanel`, `fetchComparaisonSoldes`...) en héritent
  automatiquement. Le plafond de pose (`PoserDemandeModal`, `PoserCongePourCollaborateurModal`) a été
  basculé sur `.valeurApresAttente` pour ne pas devenir trop permissif. Vérifié en navigateur sur le
  cas Delphine (voir CONTEXTE.md) — comportement conforme.
- **Congés à cheval sur deux mois : cas à la marge non couverts** (05/09/2026, repris du Backlog
  "Annulation d'une demande à cheval") — le principe général de découpage/transmission d'un congé
  qui déborde sur le mois suivant est tranché et codé (notation "2/6", reliquat transmis au mois
  suivant, voir CONTEXTE.md). Reste non vérifié/non listé : les cas limites, notamment
  l'**annulation d'une demande à cheval partiellement déjà transmise** (une partie transmise sur un
  mois, l'autre pas encore) — le comportement exact de `retirerDemande`/de la correction générée au
  prochain export n'a jamais été vérifié sur ce cas précis. Vincent confirme qu'il y a bien des cas
  à la marge à traiter — à lister précisément avec lui avant de considérer le sujet clos.

## Paramétrer/Calendrier

- **Modification des DJI de l'année en cours** (22/08/2026, reformulé le 05/09/2026 — ne concerne
  plus que DJI, la question CPI est devenue sans objet vu ce qui précède) — dans le cadre du
  refacto de `/parametrer/calendrier2`, une fois l'année en cours publiée et donc visible par les
  collaborateurs, le paramétrage des DJI doit-il rester modifiable (ajout/suppression) par
  Delphine, ou faut-il verrouiller l'année en cours après publication (comme c'est déjà le cas pour
  l'année à venir tant qu'elle n'est pas publiée, mais en sens inverse) ? Aujourd'hui rien ne
  bloque la modification une fois publié.

## Paramétrer/Congés & RTT

- **Moment exact où le bonus d'ancienneté est attribué au collaborateur** (05/09/2026) — lecture du
  code (`bonusAnciennete`/`ansAnciennete` dans `soldes.repository.ts`) : le bonus est recalculé à
  chaque consultation du solde, au jour anniversaire exact de l'ancienneté (comparaison mois+jour
  vs date d'entrée/date de référence), et s'ajoute immédiatement au capital CP de la période en
  cours dès que le seuil est franchi — pas d'attente du renouvellement de la période CP (juin par
  ex.), pas de proratisation. Présenté à Vincent comme tel, réaction : "je ne pense pas que ça
  fonctionne comme ça" — donc soit la lecture de code est incomplète/erronée sur un point non vu,
  soit le comportement attendu par Vincent diffère de ce que fait le code aujourd'hui (ex. bonus
  attribué seulement au renouvellement de période, pas en cours d'année ?). À clarifier avec
  Vincent avant de considérer ce point comme acquis — voir aussi
  [CONTEXTE.md](CONTEXTE.md) pour le reste de l'audit "règles d'ancienneté" du même jour.

  **Sous-point tranché (05/09/2026)** : le non-cumul entre seuils n'est PAS la source du désaccord
  — Vincent a confirmé que le comportement actuel (seul le seuil le plus favorable s'applique, pas
  de somme entre règles — ex. à 12 ans avec les règles 5 ans→+1j et 10 ans→+2j, le collaborateur a
  +2j au total, pas +3j) est bien le comportement voulu. Le désaccord reste donc entier sur le
  **moment exact** où le bonus s'applique (jour anniversaire précis vs autre logique attendue),
  point encore à clarifier.

## Moteur de solde / fin de période

- **Principe de bascule de période : comment le CPA se transfère vers le solde CP ?** (05/09/2026,
  repris du Backlog "Prévoir la gestion des fins de période") — lu dans le code
  (`soldes.repository.ts`, `fetchSoldes`) : aucune étape explicite de "transfert" n'existe. Le CPA
  (congé pris par anticipation sur la période suivante) est une simple projection calculée à la
  volée — `accrualCpa` sur `periodeSuivante`, avec le même taux mensuel que le CP — et sa
  consommation (`is_anticipation = true`) est explicitement exclue du calcul de report du CP
  normal (`consommePeriodePrecedente` filtre sur `is_anticipation = false`). Autrement dit : quand
  la période bascule réellement (l'ancienne "periodeSuivante" devient "periodeEnCours"), rien ne
  vérifie explicitement que les jours déjà pris en CPA sont bien recomptés comme de la
  consommation CP normale sur la nouvelle période — le mécanisme repose entièrement sur le fait que
  les demandes CPA passées tombent naturellement dans la nouvelle fenêtre de dates au moment du
  calcul, jamais vérifié de bout en bout sur un vrai cas de bascule. Rejoint la remarque de Vincent
  du 29/08/2026 (voir Backlog.md) : le vrai sujet n'est pas qu'une formule, c'est aussi comment
  RENDRE TANGIBLE ce moment pour le collaborateur et Delphine (jours restants perdus ou reportés,
  CPA de l'année qui devient le CP de la suivante) — rien de tout ça n'est affiché aujourd'hui.

## Paramétrer/Utilisateurs

- **Proratisation du mois d'entrée partiel (acquisition CP/RTT/CPA)** (05/09/2026) — signalé par
  Vincent : un collaborateur créé avec une date d'entrée en cours de mois (ex. 14/06/26) acquiert
  quand même un mois complet de CP/RTT pour ce mois — le moteur (`accrualMensuelSomme` dans
  `soldes.repository.ts`) ne raisonne qu'en mois entiers, aucune proratisation journalière nulle
  part dans ce moteur (choix assumé jusqu'ici, documenté dans le code). Trois options
  proposées : (1) prorata au jour près (`tauxAcquisitionMensuel × jours travaillés / jours du
mois`) — précis, mais introduit une granularité absente ailleurs dans le moteur ; (2) règle
  "entré avant/après le 15" (mois compté entier si entrée ≤ 15, pas compté sinon) — cohérente avec
  la logique "tout ou rien par mois" déjà en place (`moisEffet`) ; (3) ne rien changer. **Vincent :
  "on pose la question à Delphine"** — en attente de sa réponse avant d'implémenter quoi que ce
  soit (le changement toucherait 6 points d'appel de `accrualMensuelSomme`, et changerait
  rétroactivement le solde affiché de tout collaborateur déjà entré en cours de mois).
