# Lot 48 — Galactic GPU Instancing & Massive Star Rendering

## Objectif

Optimiser la couche de rendu Gaia DR3 sans modifier le fournisseur de données du lot 47 ni introduire de backend. Les étoiles sont regroupées dans un unique objet `THREE.Points` et transférées au GPU au moyen de buffers typés réutilisables.

## Changements

- `GaiaStarfieldLayer` préalloue les buffers position/couleur avec une capacité qui croît par paliers (minimum 256, puis doublement jusqu'au besoin).
- Les attributs utilisent `DynamicDrawUsage` lorsqu'il est disponible et sont marqués `needsUpdate` après écriture.
- `setDrawRange` limite le nombre de sommets effectivement dessinés sans recréer l'objet `THREE.Points`.
- LOD CPU avant upload : filtre de résidence, magnitude maximale, distance maximale, puis tri par magnitude croissante et plafond `maxStars`.
- L'origine flottante recalcule les positions dans le buffer existant, sans remplacer les attributs tant que la capacité suffit.
- Statistiques ajoutées : étoiles résidentes/rendues, troncature, capacité, estimation des octets GPU et budget actif.
- `engine.setGaiaRenderBudget(options)` permet d'ajuster le LOD à chaud sans recharger Gaia.

## API

```js
engine.setGaiaRenderBudget({
  maxStars: 250_000,
  maxMagnitude: 15,
  maxDistancePc: 100,
  pointSize: 2.0,
});

engine.getGaiaStreamingStats();
```

`maxStars` est un plafond de rendu, pas une promesse de téléchargement. Le lot 47 limite encore les réponses Gaia à 500 enregistrements par cône ; il faut donc un lot de pagination/partitionnement de catalogue avant de pouvoir alimenter des buffers de centaines de milliers d'étoiles depuis Gaia.

## Limites et exactitude

- `THREE.Points` correspond à un rendu de points GPU groupés (un draw call), pas à `THREE.InstancedMesh` : un mesh par étoile serait inutile pour des sprites ponctuels.
- Le filtre de magnitude et la distance sont appliqués côté CPU lors de la préparation des buffers.
- Le budget mémoire rapporté estime uniquement les deux buffers `Float32Array` (positions + couleurs), sans compter la géométrie, le matériau, les objets JavaScript ni les allocations internes du navigateur/GPU.
- Le plafond par défaut est 1 000 000 de sommets côté renderer, mais la limite d'acquisition Gaia du lot 47 reste 500 lignes par cône.
- Aucun benchmark matériel GPU ni validation visuelle navigateur n'est revendiqué ici.

## Validation

Les tests unitaires couvrent la conversion d'axes ICRS, le draw range, la réutilisation des buffers, la résidence, les filtres de magnitude/distance et le plafond de rendu.
