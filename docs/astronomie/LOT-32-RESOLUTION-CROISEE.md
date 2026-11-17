# Lot 32 — Résolution croisée des identités astronomiques

## Objectif

Construire un graphe de références entre les enregistrements Gaia DR3, SIMBAD et NASA Exoplanet Archive, sans fusionner automatiquement des objets sur la seule base d'un nom ou d'une proximité de coordonnées.

## Modules

- `frontend/src/moteur/data/astronomy/providers/AstronomicalCrossReferenceResolver.js`
- `frontend/src/moteur/data/astronomy/providers/AstronomicalCrossReferenceResolver.test.js`

## Règles d'identité

1. Un identifiant Gaia DR3 strictement identique constitue une preuve d'identité exploitable pour un lien automatique.
2. Une proximité angulaire ICRS produit uniquement un candidat à vérifier. Le calcul utilise la distance de grand cercle et tient compte du passage RA 0°/360°.
3. Un nom d'hôte identique entre SIMBAD et NASA produit un candidat, jamais une fusion automatique.
4. Une exoplanète est reliée automatiquement à son étoile hôte seulement si NASA fournit un `gaia_dr3_id` correspondant exactement à un enregistrement Gaia présent.
5. Les enregistrements non résolus restent distincts. Les sources et les identifiants d'origine ne sont pas écrasés.

## API

```js
import { resolveAstronomicalCrossReferences } from './moteur/data/astronomy/index.js';

const graph = resolveAstronomicalCrossReferences(records, {
  coordinateToleranceArcsec: 1,
  maxCoordinateCandidates: 5,
});
```

Le résultat expose `entities`, `links`, `planetHostLinks`, une politique d'identité et des statistiques. Chaque lien indique `automatic`, `confidence`, `relation` et `evidence`.

Le service TAP dispose également de `resolveCrossReferences({ name, gaiaSourceId, coordinates, includeExoplanets }, { signal })` pour collecter les enregistrements nécessaires. La construction du graphe reste une opération distincte et explicite.

## Précautions scientifiques

- La tolérance angulaire est configurable (0 à 60 secondes d'arc) et ne remplace pas les incertitudes astrométriques.
- Les époques et les mouvements propres ne sont pas propagés dans ce lot. Une correspondance par coordonnées entre Gaia DR3 (époque de référence 2016.0) et SIMBAD peut donc être trompeuse pour les objets à fort mouvement propre.
- Les noms peuvent être ambigus, translittérés ou changer selon les catalogues.
- Un `gaia_dr3_id` absent ne signifie pas que l'hôte n'existe pas dans Gaia.
- `pscomppars` peut présenter une ligne composite par planète ; la résolution ne choisit pas entre des solutions bibliographiques multiples.

## Validation

```bash
node --test src/moteur/data/astronomy/providers/*.test.js
node scripts/verifie-imports.mjs src
```

Les tests de ce lot sont déterministes et n'effectuent aucun appel réseau réel.

## Hors périmètre

- Pas de fusion persistante ni d'écriture PostgreSQL.
- Pas de propagation astrométrique à une époque commune.
- Pas de résolution probabiliste fondée sur les covariances ou les incertitudes des catalogues.
- Pas de création automatique d'objets dans Star Engine ou Exoplanet Engine.
