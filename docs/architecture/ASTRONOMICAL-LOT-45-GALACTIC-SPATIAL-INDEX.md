# Lot 45 — Galactic Spatial Index

## Objectif

Ajouter une structure spatiale 3D pour interroger efficacement les systèmes stellaires connus, sans parcourir tout le catalogue pour chaque recherche de proximité.

## Architecture livrée

- `GalacticSpatialIndex` maintient un registre d'identifiants, positions cartésiennes héliocentriques en parsecs et métadonnées.
- Un KD-tree équilibré est reconstruit paresseusement après les insertions, déplacements ou suppressions.
- `queryRadius` retourne les voisins dans un rayon, triés par distance.
- `nearest` retourne les plus proches dans une limite de distance facultative.
- Une grille de secteurs 3D (taille par défaut : 10 pc) fournit des clés déterministes et un accès direct aux membres d'un secteur.
- `SolarEngine` indexe les systèmes extrasolaires enregistrés à partir de `model.heliocentricParsecs` et retire les entrées lors de leur suppression.

## API moteur

- `queryInterstellarSystemsNear(positionPc, radiusPc, options)` — recherche de proximité en parsecs dans le repère héliocentrique.
- `getGalacticSpatialStats()` — nombre de systèmes, secteurs et taille de secteur.

## Limites explicites

Ce lot indexe uniquement les systèmes déjà chargés/enregistrés dans le moteur. Il ne télécharge pas automatiquement des catalogues complets, ne crée pas de données Gaia fictives et ne réalise pas encore le streaming réseau des secteurs. La grille de secteurs est un index secondaire; les requêtes de rayon utilisent le KD-tree. Les coordonnées doivent être dans le même repère héliocentrique ICRS et exprimées en parsecs.

## Compatibilité

Les quatre axiomes de périvolume, le gestionnaire de ressources GPU/réseau, le LOD et la configuration Render statique sont conservés. Aucun backend n'est ajouté.
