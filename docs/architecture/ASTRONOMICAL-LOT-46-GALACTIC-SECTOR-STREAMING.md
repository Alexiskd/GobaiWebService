# Lot 46 — Galactic Sector Streaming

## Objectif

Ajouter une résidence spatiale des secteurs autour de la caméra, au-dessus de l’index KD-tree du lot 45. Le gestionnaire n’est pas un fournisseur de données : il organise les systèmes déjà présents dans l’index.

## Architecture

- `GalacticSpatialIndex` conserve les systèmes connus et leur clé de secteur.
- `GalacticSectorStreamingManager` active les systèmes proches avec hystérésis (entrée 50 pc, sortie 65 pc).
- `SolarEngine.updateGalacticSectorStreaming()` convertit la caméra globale en parsecs et recalcule la résidence toutes les 12 images.
- Le rendu sectoriel ne remplace pas les axiomes : le profil du `SystemManager` doit aussi autoriser le rendu. La libération GPU et l’annulation réseau restent sous le contrôle de `InterstellarResourceLifecycleManager`.

## API

- `update(centerPc, { force })` : calcule les secteurs et systèmes résidents.
- `isResident(id)` : indique si un système est dans la zone de streaming.
- `getStats()` : compte les secteurs, systèmes visibles et rayons.
- `dispose()` : vide et désactive le gestionnaire.

## Limites connues

Ce lot ne télécharge pas encore de tuiles Gaia DR3 ni de secteurs absents de l’index. Il ne réalise pas d’instancing massif GPU, ni d’Octree. Il fournit la couche de résidence/culling spatial nécessaire avant d’ajouter un fournisseur de secteurs asynchrones. Les coordonnées caméra sont converties avec l’échelle parsec/scene du moteur ; les données doivent rester dans le même repère ICRS.
