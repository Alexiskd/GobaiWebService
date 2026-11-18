# Gobai Space — édition 100 % frontend / Render Static Site

Cette archive contient uniquement le frontend React/Vite et ses ressources. Le dossier `backend/`, les services NestJS et la migration PostgreSQL ont été retirés. Aucun serveur applicatif n'est nécessaire pour publier les fichiers compilés.

## Configuration Render

Le fichier `render.yaml` décrit un service `web` avec `runtime: static`.

| Paramètre Render | Valeur |
|---|---|
| Type | Static Site |
| Root Directory | vide (racine du dépôt) |
| Build Command | `npm ci --prefix frontend && npm run build --prefix frontend` |
| Publish Directory | `frontend/dist` |
| Auto-Deploy | désactivé (`autoDeploy: false`) |
| Start Command | aucun |

Dans Render, créer un **New + → Static Site**, connecter le dépôt et reprendre ces valeurs si le Blueprint n'est pas utilisé. Aucun `DATABASE_URL`, port ou variable secrète n'est requis pour servir le frontend statique.

## Commandes locales

```bash
npm ci --prefix frontend
npm run dev
npm run build
npm run preview
npm test
```

Le build sort dans `frontend/dist`. Le fichier `frontend/public/_redirects` contient `/* /index.html 200` pour le fallback des routes React.

## Fonctionnalités autonomes

Les composants React, MUI, le moteur 3D Three.js, les données astronomiques locales, les calculs orbitaux, le moteur stellaire/exoplanétaire, les périvolumes et leurs politiques de chargement sont conservés dans le frontend.

Les connecteurs publics Gaia TAP, SIMBAD TAP et NASA Exoplanet Archive restent des appels navigateur directs. Leur fonctionnement dépend des politiques CORS, des quotas et de la disponibilité des fournisseurs.

## Limites sans backend

Supprimer le backend ne transforme pas les routes serveur en fonctionnalités statiques. Les fonctionnalités dépendant de `/api` ou `/api/v1` (authentification, contributions, galerie personnelle, PostgreSQL, paiements, assistant serveur, proxys, certaines couches, tuiles, données atmosphériques et LiDAR relayés) ne sont pas fournies par cette archive et peuvent être indisponibles sur le site statique. Les appels directs vers des fournisseurs publics restent distincts de ces routes.

Ne jamais placer de clé privée, secret ou identifiant de base de données dans une variable `VITE_*` : ces valeurs sont incorporées au JavaScript livré au navigateur. Si une API tierce exige un secret ou un proxy, elle nécessite un service externe séparé.

## Déploiement manuel

`autoDeploy: false` est conservé : le déploiement doit être déclenché manuellement dans Render. Aucun commit, push, pull request ou déploiement n'a été effectué par cette livraison.
