# Surface — Lot 20 : pipeline atlas opt-in dans TileLayer

## Objectif

Introduire un premier chemin réel de copie des images de fond des tuiles vers l'atlas multi-couches, tout en conservant le chemin historique comme repli.

## Changements

- `SatelliteTileAtlasPipeline` encapsule l'enqueue, le traitement borné, la liaison aux uniforms et la libération logique.
- `TileLayer` accepte `surfaceAtlasPipeline` en option. La valeur par défaut `null` conserve strictement le rendu historique.
- À l'installation d'une tuile, seule la couche couleur est proposée à l'atlas. Si elle est immédiatement prête, `map` et `baseRect` pointent vers l'atlas. Si l'atlas est plein, en attente ou en erreur, les uniforms historiques restent intacts.
- À la destruction d'une tuile, l'entrée logique `tile:<key>` est libérée. Le pipeline ne détruit pas l'atlas, qui reste propriété de l'appelant.

## Activation expérimentale

Créer un `SatelliteMultiLayerTextureAtlasManager` avec un canal `color` (factory de page et blit compatibles avec le navigateur), l'encapsuler dans `SatelliteTileAtlasPipeline`, puis passer cette instance à la construction de `TileLayer` sous le paramètre `surfaceAtlasPipeline`.

## Limites et sécurité

- Désactivé par défaut : aucun astre n'est modifié sans activation explicite.
- Première intégration réelle limitée à la couleur. Altitude et nuit restent sur leurs chargeurs spécialisés ; le canal normal n'est pas branché au shader.
- L'image source reste conservée par le système de textures classique : ce lot valide le flux d'intégration, pas encore une réduction de mémoire GPU.
- Les allocations d'atlas libérées ne sont pas recyclées ; éviter les activations sur des sessions longues sans stratégie de compaction.
- Aucune promesse de réduction des draw calls : une tuile reste un mesh.
- Build Vite, validation visuelle et mesures WebGL réelles restent à effectuer dans l'environnement avec dépendances et GPU.
