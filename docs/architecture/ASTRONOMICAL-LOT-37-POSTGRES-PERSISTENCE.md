# Lot 37 — PostgreSQL Astronomical Persistence Engine

## Objectif

Définir le schéma PostgreSQL et l'adaptateur de persistance des objets produits par `StarSystemEngine` (lots 31–35) et des échantillons de positions (lots 33–36). Le frontend Gobai reste un site statique : il ne doit jamais recevoir de chaîne de connexion PostgreSQL ni accéder directement à la base. Le repository est destiné à être instancié côté serveur, dans une API backend sécurisée.

## Schéma

Migration `backend/database/migrations/001_astronomical_catalog.sql` :

- `astronomical_stars` : identité canonique, identifiant Gaia DR3, astrométrie et provenance.
- `exoplanets` : paramètres physiques et orbitaux, rattachement hôte seulement si l'identifiant Gaia est exact.
- `astronomical_source_records` : conservation des réponses brutes Gaia / SIMBAD / NASA avec provenance et run de synchronisation.
- `astronomical_position_samples` : positions/velocités datées, repère et unités explicites.
- `astronomy_sync_runs` : suivi des synchronisations, compteurs et erreurs.

Index principaux : identifiants uniques, noms normalisés, identifiants hôtes Gaia, références étoiles et temps/repère des échantillons.

## API

`frontend/src/moteur/data/astronomy/persistence/` fournit :

- `mapStarSystemForPersistence(system)` : projection validée du modèle en lignes métier.
- `mapPositionSample(sample)` : validation d'un échantillon avec époque, repère et unités.
- `PostgresAstronomicalRepository` : repository utilisant un pool compatible `node-postgres`, injecté par l'appelant.
- `saveStarSystem()` : transaction SQL atomique avec upsert étoile + planètes.
- `saveSourceRecord()`, `savePositionSample()`, `startSyncRun()`, `finishSyncRun()`.

Aucune dépendance `pg` n'est ajoutée au frontend. Le pool doit être fourni par le backend; aucune connexion réelle n'est configurée dans ce lot.

## Règles scientifiques et d'intégrité

- Les identifiants Gaia DR3 sont conservés en `NUMERIC(20,0)` côté SQL afin d'éviter les pertes de précision JavaScript.
- Les positions gardent leur époque, leur repère et leurs unités. ICRS, repère orbital et repère de scène ne sont pas interchangeables.
- Les données sources et leur provenance sont conservées en JSONB.
- Une planète n'est rattachée à l'étoile persistée que si le Gaia DR3 de l'hôte correspond exactement à celui de l'étoile. Sinon `host_star_id` reste NULL.
- Les excentricités persistées sont bornées aux orbites elliptiques prises en charge par le moteur courant.

## Déploiement

1. Appliquer la migration depuis l'environnement backend avec `psql "$DATABASE_URL" -f backend/database/migrations/001_astronomical_catalog.sql`.
2. Créer un pool PostgreSQL côté serveur et injecter le pool dans `createPostgresAstronomicalRepository({ pool })`.
3. Exposer des routes backend authentifiées et limitées en débit; ne jamais exposer `DATABASE_URL` au bundle Vite.
4. Ajouter ensuite un job de synchronisation incrémentale et une politique de rétention des échantillons si le volume l'exige.

## Hors périmètre de ce lot

- Pas de connexion à une base Render réelle, ni de secret ou migration exécutée.
- Pas de job planifié ni de route HTTP backend ajoutée, car le dépôt courant est un frontend statique sans backend applicatif.
- Pas de partitionnement temporel prématuré : à envisager lorsque les volumes réels des `astronomical_position_samples` le justifieront.
