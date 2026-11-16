# Gobai Space — frontend statique

Cette édition est une copie indépendante de Gobai Space, préparée pour être publiée comme **site statique**. Elle conserve l’interface React, les composants MUI, le moteur 3D Three.js, les styles, les ressources publiques et les données scientifiques locales. Aucun serveur NestJS, PostgreSQL ou processus Node de production n’est nécessaire pour servir les fichiers compilés.

## Lancer en local

```bash
cd frontend
npm install
npm run dev
```

## Construire

Depuis la racine :

```bash
npm install --prefix frontend
npm run build
```

Les fichiers prêts à publier sont générés dans `frontend/dist`. `render.yaml` configure Render en mode Static Site et `frontend/public/_redirects` active le fallback des routes SPA.

## Fonctionnement autonome

Les calculs des orbites planétaires (VSOP87A et Kepler) et les tables statiques des planètes et satellites sont embarqués dans `frontend/src/moteur/data/astronomy`. La scène solaire peut donc charger ses corps principaux sans appeler l’API Gobai. Les villes ne sont pas préchargées dans cette édition.

## Fonctions nécessitant encore un service

Les fonctionnalités qui dépendaient de routes `/api/v1` ne sont pas automatiquement disponibles dans une édition statique : comptes, contributions, galerie personnelle, paiements, assistant serveur, données atmosphériques relayées, certaines couches et tuiles, LiDAR côté serveur, recherche de lieux et données de villes. Elles nécessitent une migration séparée vers des données statiques ou des fournisseurs publics accessibles directement depuis le navigateur. Les fournisseurs tiers peuvent aussi imposer CORS, quotas ou clés d’accès. Ne jamais placer de secret serveur dans les variables `VITE_*`.

## Dépôt source

Le dépôt GitHub original n’a pas été modifié. Cette livraison est une copie de travail ; aucun commit, push, pull request ni déploiement n’a été effectué. Voir `STATIC-MIGRATION.md` pour le détail des limites.
# static-gobai
