# Lot 31 — Fondations des catalogues astronomiques externes

## Objectif

Ajouter une couche de données scientifique indépendante du rendu Three.js, avec trois fournisseurs publics : ESA Gaia DR3, CDS SIMBAD et NASA Exoplanet Archive. Ce lot fournit les clients TAP, les requêtes ciblées, la normalisation et un cache LRU à durée de vie limitée.

## Arborescence

```text
frontend/src/moteur/data/astronomy/
├── index.js
└── providers/
    ├── TapClient.js
    ├── AstronomicalCatalogCache.js
    ├── AstronomicalDataNormalizer.js
    ├── AstronomicalCatalogService.js
    └── index.js
```

## API disponible

```js
import { createAstronomicalCatalogService } from './moteur/data/astronomy/index.js';

const catalog = createAstronomicalCatalogService({
  maxRows: 100,
  timeoutMs: 30000,
});

const gaia = await catalog.findGaiaSource('5853498713190525696');
const nearbyStars = await catalog.searchGaiaCone({
  raDeg: 217.4,
  decDeg: -62.6,
  radiusDeg: 0.25,
  limit: 50,
});
const resolved = await catalog.resolveSimbadName('Proxima Centauri');
const planets = await catalog.findExoplanetsByHost('Proxima Cen');
const planet = await catalog.findExoplanet('Proxima Cen b');
```

Toutes les méthodes acceptent un second argument `{ signal }` pour annuler une requête. Le service accepte aussi `fetchImpl`, `endpoints`, `timeoutMs`, `maxRows` et un cache injecté, afin de permettre les tests, les miroirs et un futur proxy.

## Sources et tables

| Fournisseur | Endpoint TAP | Table | Champs exploités |
|---|---|---|---|
| ESA Gaia DR3 | `https://gea.esac.esa.int/tap-server/tap/sync` | `gaiadr3.gaia_source` | source_id, RA/Dec, parallaxe, mouvements propres, vitesse radiale, photométrie G/BP-RP, époque de référence |
| CDS SIMBAD | `https://simbad.cds.unistra.fr/simbad/sim-tap/sync` | `basic` + `ident` | identifiant principal, coordonnées, type d'objet, type spectral |
| NASA Exoplanet Archive | `https://exoplanetarchive.ipac.caltech.edu/TAP/sync` | `pscomppars` | noms, hôte, paramètres orbitaux et physiques, distance, coordonnées, Gaia DR3 ID |

`pscomppars` est utilisé pour obtenir une ligne composite par planète ; les paramètres ne sont pas nécessairement issus d'une solution statistiquement auto-cohérente. Pour les études bibliographiques ou les solutions multiples, le futur connecteur devra aussi exploiter `ps`.

## Modèle normalisé

- Les identifiants Gaia sont conservés en chaînes : leur valeur peut dépasser la précision entière exacte de JavaScript.
- Les coordonnées sont exprimées en degrés dans le repère ICRS.
- Gaia DR3 conserve l'époque de référence fournie (`ref_epoch`, habituellement 2016.0) ; elle n'est pas transformée en position « actuelle » dans ce lot.
- Parallaxe et mouvements propres sont conservés en mas et mas/an.
- Les valeurs absentes restent `null` : aucune distance n'est déduite d'une parallaxe négative ou non significative.
- Les paramètres exoplanétaires gardent leurs unités explicites dans les noms de propriétés : jours, AU, degrés, rayons terrestres, masses terrestres/Joviennes, kelvins et parsecs.
- Chaque enregistrement conserve sa provenance et la ligne brute du fournisseur pour audit.

## Cache et limites réseau

Le cache est mémoire uniquement, LRU, avec TTL par défaut de 15 minutes et 100 entrées maximum. Aucune donnée astronomique n'est persistée dans `localStorage`. Les requêtes sont plafonnées à 100 lignes par défaut (maximum configurable de 500), avec un délai maximal de 30 secondes.

Les TAP sont interrogés en HTTP GET avec paramètres encodés. Les endpoints publics ne garantissent pas tous un accès navigateur CORS identique. En cas de blocage CORS, il faudra fournir un proxy HTTP de même origine via `endpoints` ; ce lot ne crée pas de backend et ne contourne pas les politiques CORS.

SIMBAD possède trois endpoints configurables, avec repli séquentiel vers les miroirs Harvard et IDIA si le service primaire échoue. Les miroirs peuvent avoir une fraîcheur de données différente ; la provenance du endpoint effectivement utilisé est conservée.

## Non inclus dans ce lot

- Aucun appel réseau réel n'est exécuté pendant les tests automatisés : les transports sont simulés.
- Pas encore de résolution croisée automatique Gaia ↔ SIMBAD ↔ NASA.
- Pas de propagation astrométrique à une date cible, conversion galactique/héliocentrique ou transformation en coordonnées de scène.
- Pas d'insertion dans le Star Engine ou l'Exoplanet Engine.
- Pas de persistance PostgreSQL : le projet ciblé ici est le frontend statique ; la base et son API relèveront d'un lot backend distinct.
- Pas de téléchargement massif des catalogues : seules des requêtes ciblées et bornées sont prévues.

## Validation locale

```bash
node --test src/moteur/data/astronomy/providers/*.test.js
node scripts/verifie-imports.mjs src
```

Le build Vite complet nécessite les dépendances du projet (`npm ci`).

## Documentation des fournisseurs

- Gaia TAP / astroquery : https://docs.astropy.org/projects/astroquery/en/stable/gaia/gaia.html
- SIMBAD TAP : https://simbad.u-strasbg.fr/Pages/guide/sim-url.htx
- NASA TAP : https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html
- NASA PS / PSCompPars schema : https://exoplanetarchive.ipac.caltech.edu/docs/API_TD_columns.html
