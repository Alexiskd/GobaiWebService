# Lot 39 — Systèmes exoplanétaires et axiomes de périvolume

## Objectif

Étendre Gobai Space après les lots 1–38 avec une découverte de systèmes exoplanétaires par cône de recherche céleste, une préparation directe des modèles de scène et une politique explicite des quatre axiomes de périvolume.

## Sources astronomiques

- ESA Gaia DR3 TAP : astrométrie, parallaxe, mouvements propres, vitesse radiale et recherche de sources dans un cône ICRS.
- CDS SIMBAD TAP : résolution des noms et enrichissement par classification ; recherche spatiale pour relier une source Gaia à un nom SIMBAD candidat.
- NASA Exoplanet Archive TAP / `pscomppars` : planètes confirmées et paramètres de leur système hôte.

La jointure automatique planète-étoile reste conditionnée à l'identifiant Gaia DR3 exact. Une correspondance SIMBAD par coordonnées est une candidate, pas une preuve d'identité.

## API catalogue ajoutée

`AstronomicalCatalogService` expose désormais :

- `searchSimbadCone({ raDeg, decDeg, radiusDeg, limit })`
- `findExoplanetsByGaiaHostId(gaiaSourceId, options)`
- `searchExoplanetSystemsCone({ raDeg, decDeg, radiusDeg, limit })`
- `listKnownExoplanets(options)`

`AstronomicalSystemExplorer` orchestre Gaia + NASA dans un cône ICRS, enrichit via SIMBAD lorsque demandé, assemble les systèmes et produit les modèles de scène Three.js.

## Axiomes de périvolume

| Niveau | Relation | Effet sur le partenaire quand l'un est ACTIVE |
|---|---|---|
| Système Terre / Système Soleil | interne | partenaire plafonné à BACKGROUND |
| Système Soleil / Proxima Centauri | externe | partenaire UNLOADED |
| Terre / Lune | interne | partenaire plafonné à BACKGROUND |
| Terre / Mercure | externe | partenaire UNLOADED |

Les IDs sont configurables avec `createGobaiPerivolumeAxioms({ ids })`, afin de les mapper sur les identifiants réels de l'application. Si les deux volumes sont actifs simultanément, la priorité revient au plus proche en distance normalisée `distance / radius` ; en cas d’égalité, le premier membre déclaré dans `members` gagne.

Quand la caméra quitte les deux périvolumes, le système revient aux états géométriques ordinaires. Les règles ne détruisent pas les données astronomiques : elles contrôlent les profils de rendu et de mise à jour exposés par `SystemManager`.

## Géométrie

Les fonctions `perivolumeCube`, `perivolumeBox`, `perivolumeSphere` et `perivolumeCylinder` calculent les aires de surface des frontières (unités²), conformément aux formules fournies. `verifyIsoperimetricInequality` vérifie `A³ >= 36πV²`. `containsPerivolumePoint` fournit le test de point dans une zone 3D.

L'aire de surface n'est pas utilisée comme rayon de chargement : la géométrie de proximité et la surface frontière sont deux notions séparées.

## Utilisation

```js
import { createAstronomicalCatalogService, createAstronomicalSystemExplorer } from './moteur/data/astronomy/index.js';
import { SystemManager, createGobaiPerivolumeAxioms } from './moteur/core/index.js';

const catalog = createAstronomicalCatalogService();
const explorer = createAstronomicalSystemExplorer({ catalogService: catalog });
const result = await explorer.searchSystemsInCone({ raDeg: 217.4, decDeg: -62.6, radiusDeg: 2, limit: 100 });

// Pour chaque système : explorer.buildScene(system, { auToSceneUnits: 100 })
// Puis explorer.createThreeGroup(THREE, system, options) pour créer le groupe Three.js.

const systemManager = new SystemManager({ registry, perivolumeManager, axioms: createGobaiPerivolumeAxioms({
  earthSystem: 'ID_REEL_SYSTEME_TERRE', solarSystem: 'ID_REEL_SYSTEME_SOLAIRE',
  proximaSystem: 'ID_REEL_PROXIMA', earth: 'ID_REEL_TERRE', moon: 'ID_REEL_LUNE', mercury: 'ID_REEL_MERCURE',
}) });
```

## Limites et intégration

- Les TAP sont interrogés directement depuis le client par le service existant ; CORS et disponibilité des fournisseurs doivent être testés dans le navigateur de production. Un proxy backend est préférable pour la résilience et le cache centralisé.
- La recherche NASA est limitée aux lignes `pscomppars` et donc aux paramètres composites publiés dans cette table ; elle ne représente pas tous les candidats non confirmés.
- Gaia DR3 n'est pas un catalogue d'exoplanètes : il sert à identifier et positionner les étoiles hôtes.
- La scène orbitale est un repère local de système, pas une transformation ICRS vers coordonnées globales de la galaxie.
- Les IDs canoniques d'axiomes sont des valeurs par défaut de configuration et doivent être mappés sur les IDs réels de Gobai.

## Raccordement au moteur de scène existant

`frontend/src/moteur/engine/engine.jsx` applique maintenant les états effectifs de `SystemManager` (et non uniquement les états géométriques bruts) pour la cadence des moteurs spécialisés et des tuiles.

- `system:earth` est centré sur la Terre ; son rayon couvre au minimum la distance Terre-Lune et le périvolume de la Lune.
- `system:solar` est centré sur le Soleil ; son rayon est calculé à partir de l'astre ciblé le plus éloigné enregistré dans le moteur.
- Les axiomes astres sont mappés sur les IDs de scène `earth`, `moon`, `mercury`.
- `registerExternalSystemPerivolume({ id: 'system:proxima-centauri', center, radius })` permet d'enregistrer un système externe uniquement après son placement dans le repère global de la scène ; `updateExternalSystemPerivolume` actualise son centre et `unregisterExternalSystemPerivolume` le retire.

Le groupe orbital retourné par `AstronomicalSystemExplorer` est local à son étoile hôte. Son origine doit être placée dans un repère global correctement transformé avant d'enregistrer le périvolume de Proxima. Aucune conversion ICRS vers la scène galactique n'est inventée dans ce lot.
