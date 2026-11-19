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

Les positions de Hauméa, Makémaké et Éris sont intégrées au catalogue local et calculées par le moteur orbital Kepler côté navigateur. Le proxy Node TAP a été retiré ; les recherches stellaires distantes ne sont donc pas garanties dans cette édition statique.

## Limites sans backend

Supprimer le backend ne transforme pas les routes serveur en fonctionnalités statiques. Les fonctionnalités dépendant de `/api` ou `/api/v1` (authentification, contributions, galerie personnelle, PostgreSQL, paiements, assistant serveur, proxys, certaines couches, tuiles, données atmosphériques et LiDAR relayés) ne sont pas fournies par cette archive et peuvent être indisponibles sur le site statique. Les appels directs vers des fournisseurs publics restent distincts de ces routes.

Ne jamais placer de clé privée, secret ou identifiant de base de données dans une variable `VITE_*` : ces valeurs sont incorporées au JavaScript livré au navigateur. Si une API tierce exige un secret ou un proxy, elle nécessite un service externe séparé.

## API NestJS dans Computing

L'API du frontend est traduite en NestJS dans `frontend/Car/Computing/api`. Le site statique n'en dépend pas : sans API joignable, le client de `Computing/api` replie sur les mêmes contrats embarqués. Pour la lancer localement : `npm install && npm start` dans ce dossier (hôte 127.0.0.1, port réglable par `API_PORT`).

### Collection galerie raccordée à PostgreSQL

Le module `galerie` de l'API expose `GET /galerie` : il lit la table PostgreSQL définie par `GALERIE_TABLE` (défaut : `galerie_items`) via `DATABASE_URL`. Le mappage de colonnes est souple (`url`/`file`, `title`/`titre`/`name`, `folder`/`dossier`/`album`, `kind`/`mime`), avec repli gracieux sur `{"total":0,"folders":[]}` en cas d'absence de `DATABASE_URL` ou d'erreur SQL.

Pour déployer ce module sur Render, créez un **Web Service** avec :

- Racine du dépôt : `frontend/Car/Computing/api`
- Commande de build : `npm install`
- Commande de démarrage : `npm start`
- Variable d'environnement : `DATABASE_URL` = chaîne de connexion fournie par votre instance Render PostgreSQL

## Déploiement manuel

`autoDeploy: false` est conservé : le déploiement doit être déclenché manuellement dans Render. Aucun commit, push, pull request ou déploiement n'a été effectué par cette livraison.
