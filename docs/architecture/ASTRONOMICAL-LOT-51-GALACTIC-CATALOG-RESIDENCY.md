# Lot 51 — Galactic Catalog Memory & Residency

## Objectif

Empêcher le catalogue Gaia DR3 chargé en mémoire de croître sans limite pendant la navigation galactique. Le lot ajoute une politique de résidence CPU LRU, coordonnée avec les secteurs angulaires du planificateur du lot 50.

## Politique active

- Plafond initial : 24 secteurs, 250 000 identifiants-étoiles comptés par secteur et 96 Mio estimés.
- Estimation prudente : 384 octets par étoile (objet JS, identifiants, index et marge d'allocation). Ce n'est pas une mesure exacte du heap V8.
- Les secteurs du champ courant sont épinglés ; ils ne sont pas évincés par la politique LRU.
- Les secteurs hors champ sont classés par dernière activité. Le plus ancien est évincé jusqu'au retour sous les plafonds.
- L'éviction passe par `GalacticSectorScheduler.evictSector`, puis par le mécanisme existant de retrait des propriétaires d'étoiles. Les étoiles partagées par plusieurs secteurs ou chargées manuellement sont conservées.
- Les statistiques distinguent les secteurs, étoiles estimées, mémoire estimée, secteurs épinglés et évictions.

## API moteur

```js
engine.setGaiaCatalogMemoryBudget({
  maxSectors: 24,
  maxStars: 250000,
  maxEstimatedBytes: 96 * 1024 * 1024,
  bytesPerStar: 384
});

engine.getGaiaStreamingStats().residency;
```

Le changement de budget est appliqué immédiatement. `maxEstimatedBytes` est un budget logique estimé, pas une garantie du navigateur sur le heap réel.

## Limites connues

- Les curseurs de pagination ne sont pas encore persistés entre les rechargements de page. Le cache Gaia des pages reste géré séparément par `GaiaSectorCache`.
- La politique porte sur la résidence CPU des étoiles ; le budget GPU du `GaiaStarfieldLayer` reste contrôlé séparément par `setGaiaRenderBudget`.
- La prédiction de mouvement caméra et le préchargement cinématique restent à réaliser.
- Les tests sont locaux avec données simulées ; aucune requête live ESA Gaia TAP n'est exécutée par cette suite.
