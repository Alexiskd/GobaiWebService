# Lot 53 — corrections déploiement statique et accès aux catalogues astronomiques

## CORS SIMBAD / NASA

Le navigateur ne peut pas contourner les politiques CORS des fournisseurs TAP. Le frontend n'appelle donc plus SIMBAD et NASA directement par défaut. Il utilise `VITE_ASTRONOMY_PROXY_URL` vers un microservice Node distinct. Gaia reste sur son endpoint ESA existant.

Le proxy n'accepte que deux fournisseurs fixes, des requêtes ADQL `SELECT`, une taille maximale de requête de 32 ko, une réponse de 5 Mio, un délai amont de 25 s et 60 requêtes/minute/IP. Les origines autorisées sont listées dans `CORS_ORIGINS`.

## Déploiement Render requis

Le blueprint `render.yaml` déclare désormais le Static Site et le service `gobai-astronomy-proxy`. Le frontend doit être reconstruit avec `VITE_ASTRONOMY_PROXY_URL=https://gobai-astronomy-proxy.onrender.com`. Si le service proxy n'est pas déployé ou si l'origine du site n'est pas autorisée, les appels astronomiques échoueront avec une erreur explicite au lieu d'une erreur CORS opaque.

## Phobos / Deimos

Deux modèles GLB procéduraux low-poly sont inclus dans `frontend/public/models/` et les chemins sont servis directement par le Static Site. Ce sont des géométries de substitution irrégulières, pas des modèles photogrammétriques officiels NASA/JPL.

## Preload

Les trois balises preload vers `/api/v1/...` ont été retirées de `index.html` : le noyau statique embarque ses données et ces routes ne sont pas garanties sur le Static Site.

## Validation

Les tests unitaires du proxy vérifient l'allowlist, la restriction SELECT et les limites de ressources. Les modèles GLB sont validés par leur en-tête, version, longueur, JSON et primitives. Les tests TAP du frontend utilisent des endpoints mockés ; aucun appel réel à SIMBAD/NASA n'est prétendu.
