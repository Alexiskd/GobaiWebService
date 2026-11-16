# Lot 38 — Validation scientifique et end-to-end astronomique

## Objectif

Ajouter une validation déterministe et hors ligne du pipeline astronomique Gobai Space : catalogue normalisé, résolution d'identité, propagation astrométrique, calcul orbital, modèle de scène et mapping PostgreSQL.

## Module

`frontend/src/moteur/data/astronomy/validation/AstronomicalValidationSuite.js`

API publique :

- `validateAstronomicalPipeline(records, options)` retourne un rapport structuré sans interrompre le traitement.
- `assertAstronomicalPipelineValid(records, options)` retourne le rapport ou lève une erreur portant `error.report` en cas d'échec.

## Contrôles exécutés

1. Assemblage du catalogue et des systèmes stellaires.
2. Rattachement automatique d'une exoplanète uniquement par identifiant Gaia DR3 exact ; les correspondances de nom ou de coordonnées restent des candidates.
3. Domaine des coordonnées ICRS : ascension droite `[0, 360[` et déclinaison `[-90, +90]`.
4. Solutions képlériennes : convergence, position 3D finie et résidu sous le seuil configuré (1e-9 par défaut).
5. Génération des modèles de scène et finitude des positions.
6. Mapping des systèmes vers le modèle de persistance.
7. Contrat d'enregistrement d'une position dans le repère `GOBAI-SCENE`.
8. Signalement explicite des validations réseau et PostgreSQL non réalisées.

## Conventions et limites

- Le repère orbital de référence n'est pas le repère ICRS.
- La projection scène du moteur exoplanète utilise `(x, y, z) -> (x, z, -y)` et n'est pas une transformation astronomique vers ICRS.
- Les positions de scène sont exprimées en unités de scène, pas en AU.
- Les tests sont synthétiques et déterministes ; ils ne constituent pas une validation avec les services Gaia, SIMBAD ou NASA en production.
- Aucune connexion PostgreSQL n'est ouverte et aucune migration n'est appliquée.
- Le rendu WebGL réel et les performances navigateur doivent être vérifiés dans l'environnement de déploiement.

## Correction de contrat

Le mapper de positions acceptait par erreur `GOBAl-SCENE` (lettre « l ») alors que la migration SQL attend `GOBAI-SCENE` (lettre « I »). Le lot 38 aligne le mapper sur la contrainte SQL et ajoute un test de contrat.

## Commandes de validation

```bash
node --test $(find src -name '*.test.js' -print)
node scripts/verifie-imports.mjs src
```
