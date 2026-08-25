# Questions / besoins de précision

Liste de questions à trancher avec Vincent — agrégées ici au fil de la session plutôt que
dispersées dans le chat, pour ne rien perdre. Pas un todo : une question retirée une fois
répondue (la réponse et la décision vont dans [CONTEXTE.md](CONTEXTE.md)/[Backlog.md](Backlog.md)
selon le cas).

## Poser/Accueil

- **Affichage des soldes : théorique vs réel** (20/08/2026) — aujourd'hui les cards Soldes
  d'Accueil affichent le solde théorique (compte les demandes en attente), et la popin "Suivre mon
  solde" démarre elle aussi sur "Théorique" par défaut. Est-ce nécessaire de proposer au
  collaborateur le switch vers le solde réel sur cette popin, ou le solde théorique
  suffit-il pour cet usage (vue salarié sur son propre solde) ? Le sélecteur Réel/Théorique reste
  utile côté "Suivre les soldes" (vue manager), la question ne porte que sur la popin Accueil.

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

## Paramétrer/Calendrier

- **Modification des CPI/DJI de l'année en cours** (22/08/2026) — dans le cadre du refacto en
  cours de `/parametrer/calendrier2` (nouveau tiroir légende + popin unifiée), une fois l'année en
  cours publiée et donc visible par les collaborateurs, le paramétrage des jours imposés (CPI/DJI)
  doit-il rester modifiable (ajout/suppression) par Delphine, ou faut-il verrouiller l'année en
  cours après publication (comme c'est déjà le cas pour l'année à venir tant qu'elle n'est pas
  publiée, mais en sens inverse) ? Aujourd'hui rien ne bloque la modification une fois publié.
