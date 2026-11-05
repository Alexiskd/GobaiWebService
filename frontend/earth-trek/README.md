# Trek de la Terre — Esri World Imagery, Mapbox, Maxar (Vantor)

## Backend (NestJS)

1. Copier `backend/src/earth-trek/` dans `backend/src/earth-trek/`.
2. Dans `app.module.ts` :
   ```ts
   import { EarthTrekModule } from './earth-trek/earth-trek.module';
   @Module({ imports: [/* … */, EarthTrekModule] })
   ```
3. Ajouter les clés de `.env.earth-trek.example` au `.env` du backend, puis redémarrer.
   Esri fonctionne sans clé ; Mapbox et Maxar n'apparaissent qu'avec leur clé.
4. Tests : `npx tsx --test src/earth-trek/earth-trek.core.test.ts`

Routes (préfixe global `api/v1`) :

| Route | Rôle |
|---|---|
| `GET /api/v1/earth-trek/layers` | fonds et disponibilité (aucune clé exposée) |
| `GET /api/v1/earth-trek/stops` | étapes du tour du monde |
| `GET /api/v1/earth-trek/tiles/:couche/:z/:x/:y` | tuile, via proxy et cache mémoire |
| `GET /api/v1/earth-trek/layers/:couche/attribution` | mention de source |

Le middleware sert aussi ces fonds sur la route générique `…/tiles/:couche/:z/:x/:y` utilisée par le moteur 3D.

## Frontend

1. Copier `frontend/src/earthTrek/` dans `src/earthTrek/`.
2. Remplacer `src/components/GlobalComponents.jsx` et `src/components/AdaptiveComponents.jsx`.

Bouton **Trek Terre** dans la barre du bas : choix de l'imagerie, 24 étapes, visite guidée automatique.
Les fonds configurés apparaissent aussi dans **Informations → Fond de carte · Terre**.

## Conditions des fournisseurs

- **Esri** : sans jeton, service public d'Esri ; pour un usage commercial, un jeton ArcGIS Location Platform.
- **Mapbox** : la mention « © Mapbox © OpenStreetMap » doit rester visible.
- **Maxar** (Vantor depuis octobre 2025) : clé Maxar Geospatial Platform, valable 180 jours par défaut.
