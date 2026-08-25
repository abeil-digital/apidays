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

- **Modèle des jours imposés et de la répartition des congés — CPI/DJI mal calés sur les vraies
  règles Abeil** (25/08/2026, à trancher avant tout chantier dessus) — Vincent, en reprenant le
  cadrage : les collaborateurs cumulent 2,5 j de CP/mois (30 j/an) et **la semaine imposée du 15
  août fait partie de ces 30 j** — c'est du CP normal, juste sans choix de date, pas un bonus à
  part. Le "0,25 j/mois" de RTT (3 j/an) désigne les RTT que le salarié pose librement. Les 10
  demi-journées "imposées" actuelles (`demi_journees_imposees`, cible 16 en fait, pas 10 — voir
  plus bas) mélangent en réalité deux choses de nature différente :
  - **3 RTT imposées** (décomposées en demi-journées, ex. les vendredis après-midi) — doivent être
    décomptées comme du vrai RTT (le salarié les "consomme" au même titre qu'un RTT posé
    librement, juste sans en choisir la date).
  - **5 jours "offerts"** (10 demi-journées) — ceux-là, eux, ne sont assujettis à aucun compteur
    (ni CP ni RTT) : un vrai bonus hors solde.

  **Bugs actuels, conséquence directe** : la semaine du 15 août (CPI, table `conges_imposes`) ne
  déduit jamais le solde CP réel — alors qu'elle devrait ("connerie", Vincent) ; les vendredis
  après-midi (DJI) ne sont jamais comptabilisés comme RTT alors que 3 d'entre eux le devraient.
  Confirmé en code : `soldes.repository.ts` ne lit ni `conges_imposes` ni
  `demi_journees_imposees` — les deux mécanismes sont **totalement indépendants** des soldes
  CP/RTT calculés dans Congés & RTT (par construction actuelle, voir BASE-DE-DONNEES.md).

  **Piste de correctif esquissée (pas commencée)** : CPI recompte comme du CP (déduit
  `solde_reel` CP) ; DJI renommé DJO, cible ramenée à 10 demi-journées (comportement inchangé,
  reste hors compteur) ; nouveau sous-ensemble "RTT imposées" (6 demi-journées, paramétrable dans
  Calendrier comme DJI/CPI aujourd'hui) qui, lui, déduit le solde RTT — proposé en réutilisant
  `demi_journees_imposees` avec un flag `deduit_du_solde` plutôt qu'une table séparée, pour rester
  léger. **Question posée à Vincent, réponse "pourquoi pas..." reçue mais rien engagé** — à
  confirmer explicitement (notamment : la déduction CPI doit-elle s'appliquer dès la saisie du
  paramétrage, ou seulement une fois l'année publiée ?) avant de commencer.

- **Modification des CPI/DJI de l'année en cours** (22/08/2026) — dans le cadre du refacto en
  cours de `/parametrer/calendrier2` (nouveau tiroir légende + popin unifiée), une fois l'année en
  cours publiée et donc visible par les collaborateurs, le paramétrage des jours imposés (CPI/DJI)
  doit-il rester modifiable (ajout/suppression) par Delphine, ou faut-il verrouiller l'année en
  cours après publication (comme c'est déjà le cas pour l'année à venir tant qu'elle n'est pas
  publiée, mais en sens inverse) ? Aujourd'hui rien ne bloque la modification une fois publié.
