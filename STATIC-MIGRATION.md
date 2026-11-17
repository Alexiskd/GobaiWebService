# Gobai Space — migration frontend statique

## Contenu de cette édition

- Frontend React/Vite uniquement.
- Composants, styles, ressources publiques, données scientifiques embarquées et moteurs 3D conservés.
- Connecteurs publics Gaia TAP, SIMBAD TAP et NASA Exoplanet Archive exécutés directement depuis le navigateur lorsque les fournisseurs autorisent CORS.
- Politiques de périvolume et moteurs astrométriques/orbitaux conservés côté navigateur.

Le dossier `backend/` a été supprimé. Cette archive ne contient ni serveur NestJS, ni service Node de production, ni migration PostgreSQL.

## Configuration Render

Le blueprint `render.yaml` publie un Static Site :

```yaml
services:
  - type: web
    name: gobai-space-static
    runtime: static
    buildCommand: npm ci --prefix frontend && npm run build --prefix frontend
    staticPublishPath: frontend/dist
    autoDeploy: false
```

Dans le tableau de bord Render :

- Type : Static Site
- Root Directory : vide
- Build Command : `npm ci --prefix frontend && npm run build --prefix frontend`
- Publish Directory : `frontend/dist`
- Start Command : aucun
- Auto-Deploy : désactivé

Le fallback SPA est configuré dans `frontend/public/_redirects`.

## Limites fonctionnelles

Les appels frontend vers `/api` et `/api/v1` ne sont pas servis par un Static Site. Les fonctionnalités qui en dépendent restent indisponibles sans migration ou API externe : authentification, contributions, galerie personnelle, stockage PostgreSQL, paiements, assistant serveur, données relayées, certaines couches/tuiles, LiDAR serveur et autres routes métier.

Les connecteurs publics directs sont conservés, mais leur accès dépend de CORS, quotas et disponibilité des fournisseurs. Aucune clé secrète ne doit être incluse dans le bundle Vite ou dans une variable `VITE_*`.

## Vérifications attendues avant mise en production

```bash
npm ci --prefix frontend
npm run verifie:imports
npm run build
npm test
```

La présente préparation ne constitue pas une validation des appels réseau réels ni des fonctionnalités qui dépendaient du backend.
