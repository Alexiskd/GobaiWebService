# Lot 50 — Galactic Sector Scheduler

## Objectif

Relier le catalogue Gaia DR3 à la direction de la caméra, tout en gardant le chargement réseau désactivé au démarrage. Le planificateur travaille sur des tuiles angulaires ICRS (RA/Dec) : ce sont des secteurs de catalogue céleste, distincts des secteurs cartésiens 3D de `GalacticSpatialIndex`.

## Architecture

- `GalacticSectorScheduler` construit une tuile centrale et jusqu'à quatre tuiles cardinales autour de la direction caméra.
- Les tuiles sont classées par distance angulaire à la caméra.
- Une file bornée et une concurrence configurable empêchent les rafales réseau.
- Les requêtes de tuiles sorties du voisinage désiré sont annulées.
- Les secteurs chargés sont dédupliqués en mémoire ; les pages individuelles restent cachées par `GaiaSectorCache`.
- À la sortie du voisinage, les étoiles possédées uniquement par cette tuile sont retirées de l'index spatial et du starfield ; les étoiles partagées par une autre tuile ou chargées manuellement sont conservées.
- La pagination keyset reprend avec `source_id > nextSourceIdAfter`.
- Un plafond `maxPagesPerSector` limite la quantité de données récupérée par tuile.
- Les erreurs appliquent un délai de retry.

## API moteur

Le streaming est désactivé par défaut. Pour l'activer explicitement :

```js
engine.setGaiaAutoStreaming(true, {
  radiusDeg: 1,
  maxPages: 1,
  maxPagesPerSector: 5,
  maxConcurrent: 1,
  maxPrefetchSectors: 5,
});
```

Pour l'arrêter :

```js
engine.setGaiaAutoStreaming(false);
```

Les statistiques du planificateur sont exposées via `engine.getGaiaStreamingStats().scheduler`.

## Limites

- Les tuiles sont angulaires et non des cubes cartésiens de parsecs. La conversion Gaia vers parsecs et l'index 3D restent réalisés par la couche de données existante.
- Le scheduler suit la direction radiale caméra-Soleil ; il ne déduit pas encore le frustum optique exact.
- Le cache et la liste des secteurs chargés vivent dans la session navigateur. Le cache IndexedDB conserve les pages selon la politique existante.
- La sélection de source reste limitée par les réponses TAP, la magnitude et les parallaxes disponibles ; ce lot ne constitue pas un miroir complet de Gaia DR3.
- Aucun backend, worker Render, service serveur ou téléchargement au démarrage n'est ajouté.

## Validation

Les tests couvrent le désactivé par défaut, la file bornée, la normalisation RA, la déduplication, l'annulation et le délai de retry. Les tests réseau utilisent un streamer simulé ; la disponibilité réelle du TAP ESA doit être vérifiée depuis le navigateur.
