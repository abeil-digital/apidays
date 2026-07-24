@AGENTS.md

# Démarrage de session

Avant toute action, lis [CONTEXTE.md](CONTEXTE.md) (résumé rapide : stack, état actuel,
décisions, à faire). Pour le détail des choix d'architecture et du principe "provisoire", voir
[projet.md](projet.md) ; pour le schéma de base de données cible, voir
[BASE-DE-DONNEES.md](BASE-DE-DONNEES.md). Ne les relis pas plusieurs fois dans la même session —
une fois en tout début suffit.

# Vérification — allégée par défaut

Pour un changement petit et à faible risque (couleur/hex, texte/libellé, ajustement de style
mineur) : ne fais que `tsc --noEmit` + `eslint` (rapides), une seule capture d'écran maximum si
une vérification visuelle a du sens, pas de `npm run build` ni de `prettier --check` sauf doute.

Réserve la vérification complète (typecheck + lint + prettier + build + captures à plusieurs
largeurs d'écran) aux changements structurels : nouveau composant, nouvelle route, modification du
modèle de données, ou tout ce qui touche la mise en page/le responsive.

En cas de doute sur la catégorie, penche vers la vérification allégée et propose une passe complète
si besoin plutôt que de partir systématiquement sur le mode complet — l'objectif est de limiter la
consommation de tokens sur les petites itérations.
