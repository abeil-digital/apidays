# Banc d'essai du moteur de solde

Contrôle automatique de `lib/data/soldes.repository.ts` (le moteur CP / RTT / CPA), hors navigateur.
Le projet n'a pas de framework de tests : ce dossier en tient lieu pour le moteur de solde.

## Principe
- `oracle.mjs` recalcule les soldes **à partir des règles métier**, sans réutiliser le code du moteur
  (capital de période, solde initial, bonus d'ancienneté « jour de l'anniversaire », acquisition
  mensuelle créditée le 1er du mois suivant, transfert CPA → CP à la bascule, RTT par année civile).
- `comparer-abeil.mjs` charge les vraies données d'Abeil (lecture seule), appelle le vrai moteur
  `fetchSoldes` et affiche **tout écart** moteur ≠ oracle (soldes « théoriques »), par collaborateur,
  type et date.
- `hooks.mjs` / `register.mjs` / `clientStub.mjs` permettent d'exécuter le moteur sous Node (Node 24).
  Les tables de gel (`soldes_periode`, `acquisitions_gelees`) sont en écriture neutralisée.

## Lancer
```bash
TEST_EMAIL=<email d'un manager ou admin du tenant Abeil> \
DATES=2026-10-08,2027-05-31,2027-06-15 \
node --import ./scripts/moteur-solde/register.mjs scripts/moteur-solde/comparer-abeil.mjs
```
Le script génère un lien de connexion pour ce compte (API d'administration, rien n'est envoyé) afin que
les règles de sécurité de la base filtrent le bon tenant. Il lit `.env.local`.

## Lecture du résultat
Aucun écart attendu. `N écart(s) au total` = 0 signifie que le moteur et l'oracle concordent.

## Limites
- L'oracle couvre la configuration d'Abeil (période CP au 01/06, RTT en année civile, mode « jour de
  l'anniversaire », solde initial au 01/06/2026, temps plein, CDI). Un autre tenant demande d'adapter l'oracle.
- Seuls les soldes théoriques sont comparés (pas le « réel » ancré sur les exports de paie).
