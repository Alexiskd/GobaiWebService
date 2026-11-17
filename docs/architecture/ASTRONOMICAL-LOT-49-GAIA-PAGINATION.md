# Lot 49 — Gaia DR3 keyset pagination & progressive catalog loading

## Objectif

Étendre le chargement ponctuel du lot 47 en pages bornées, sans OFFSET et sans backend. Les pages sont ordonnées par `source_id` croissant et la page suivante applique `source_id > <dernier source_id>`.

## Changements

- `AstronomicalCatalogService.searchGaiaCone` accepte `sourceIdAfter`, valide le curseur comme entier décimal et l'intègre à l'ADQL.
- Le cache TAP distingue chaque curseur afin qu'une page ne soit jamais confondue avec une autre.
- `GaiaDR3SectorStreamer.loadConePages` charge jusqu'à `maxPages` pages (1 à 100), conserve un seul exemplaire par identifiant Gaia et vérifie la progression du curseur.
- `engine.loadGaiaDR3ConePages` indexe les nouvelles étoiles dans l'index galactique et alimente le starfield GPU.
- L'appel est toujours explicite : aucune requête n'est lancée au démarrage.

## API

```js
const result = await engine.loadGaiaDR3ConePages({
  raDeg: 83.8,
  decDeg: -5.4,
  radiusDeg: 1,
  limit: 500,
  maxPages: 10,
});
```

`limit` est la taille de page (plafonnée à 500 par le service). `maxPages` borne le travail réseau. Le résultat expose `pagesLoaded`, `count`, `hasMore` et `nextSourceIdAfter`.

## Limites et garanties

- Pagination par clé : pas de `OFFSET`, donc pas de décalage croissant des pages.
- Les pages sont triées par `source_id`, pas par magnitude ; la sélection visuelle du renderer continue ensuite de prioriser les magnitudes.
- Une limite de pages empêche les téléchargements sans fin. Pour continuer un chargement interrompu, relancer avec `sourceIdAfter: result.nextSourceIdAfter` dans un nouvel appel `engine.loadGaiaDR3ConePages`, ou augmenter `maxPages`.
- Les résultats sont une fenêtre de requête, pas un export complet de Gaia DR3. Le TAP public peut limiter ou interrompre des requêtes volumineuses.
- Les étoiles sans parallaxe positive exploitable restent exclues de la conversion 3D.
- Aucun service backend, worker Render ou stockage serveur n'est ajouté.
