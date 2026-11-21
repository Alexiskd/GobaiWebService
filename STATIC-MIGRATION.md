# Gobai Space — migration frontend statique

> Depuis la fusion du 20 novembre 2026 avec GobaiWebService, ce frontend est de nouveau servi avec l'API du dossier
> `backend/` (voir le README). Ce document décrit l'édition statique seule, toujours possible : sans API joignable,
> le client replie sur les contrats embarqués et les fonctions serveur listées plus bas restent indisponibles.

## Contenu de cette édition

- Frontend React/Vite uniquement.
- Composants, styles, ressources publiques, données scientifiques embarquées et moteurs 3D conservés.
- Positions de Hauméa, Makémaké et Éris préchargées dans le catalogue statique et calculées localement par le moteur orbital Kepler.
- Le proxy Node TAP et sa configuration Render sont supprimés.
- Politiques de périvolume et moteurs astrométriques/orbitaux conservés côté navigateur.

Le dossier `backend/` a été supprimé. Cette archive ne contient ni serveur NestJS, ni service Node de production, ni migration PostgreSQL.

## Configuration Render

Le blueprint `render.yaml` ne publie qu’un Static Site, sans service backend :

```yaml
services:
  - type: web
    name: static-gobai
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

Les appels frontend vers `/api` et `/api/v1` ne sont pas servis par un Static Site. Les fonctionnalités qui en dépendent restent indisponibles sans migration ou API externe : authentification, contributions, galerie personnelle, stockage PostgreSQL, paiements, assistant serveur, données relayées, certaines couches/tuiles et autres routes métier.

Les connecteurs publics directs sont conservés, mais leur accès dépend de CORS, quotas et disponibilité des fournisseurs. Aucune clé secrète ne doit être incluse dans le bundle Vite ou dans une variable `VITE_*`.

## Vérifications attendues avant mise en production

```bash
npm ci --prefix frontend
npm run verifie:imports
npm run build
npm test
```

La présente préparation ne constitue pas une validation des appels réseau réels ni des fonctionnalités qui dépendaient du backend.
