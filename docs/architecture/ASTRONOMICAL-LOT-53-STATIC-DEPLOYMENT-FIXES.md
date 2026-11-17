# Lot 53 — corrections déploiement statique et accès aux catalogues astronomiques

## CORS SIMBAD / NASA

Historique : le navigateur ne peut pas contourner les politiques CORS des fournisseurs TAP. Le lot 53 avait introduit un microservice Node distinct pour SIMBAD et NASA. Ce proxy a depuis été retiré au lot 58.

Le proxy n'accepte que deux fournisseurs fixes, des requêtes ADQL `SELECT`, une taille maximale de requête de 32 ko, une réponse de 5 Mio, un délai amont de 25 s et 60 requêtes/minute/IP. Les origines autorisées sont listées dans `CORS_ORIGINS`.

## Déploiement Render requis

Cette configuration est obsolète. Le blueprint Render actuel ne déclare qu’un Static Site. Les recherches SIMBAD et NASA nécessitant un proxy ne sont pas disponibles dans cette édition.

## Phobos / Deimos

Deux modèles GLB procéduraux low-poly sont inclus dans `frontend/public/models/` et les chemins sont servis directement par le Static Site. Ce sont des géométries de substitution irrégulières, pas des modèles photogrammétriques officiels NASA/JPL.

## Preload

Les trois balises preload vers `/api/v1/...` ont été retirées de `index.html` : le noyau statique embarque ses données et ces routes ne sont pas garanties sur le Static Site.

## Validation

Les tests unitaires du proxy vérifient l'allowlist, la restriction SELECT et les limites de ressources. Les modèles GLB sont validés par leur en-tête, version, longueur, JSON et primitives. Les tests TAP du frontend utilisent des endpoints mockés ; aucun appel réel à SIMBAD/NASA n'est prétendu.


> **Statut après le lot 58 :** le proxy `gobai-astronomy-proxy` décrit dans ce document a été retiré du dépôt et du blueprint Render. Les planètes naines Hauméa, Makémaké et Éris utilisent désormais des éléments orbitaux statiques embarqués. Les fonctions de recherche SIMBAD/NASA distantes ne sont pas couvertes par cette migration.
