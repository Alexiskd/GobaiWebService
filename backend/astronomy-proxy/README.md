# Gobai Astronomy Proxy

Microservice HTTP sans dépendance pour relayer uniquement les requêtes TAP `SELECT` vers SIMBAD et NASA Exoplanet Archive. Les destinations amont sont codées en dur ; aucune URL fournie par le client n'est utilisée comme destination réseau.

## Render

- Service Web Node, répertoire racine `backend/astronomy-proxy`.
- Commande de démarrage : `npm start`.
- Variables : `CORS_ORIGINS=https://static-u4m0.onrender.com,https://www.gobaispace.com,https://gobaispace.com`.
- Vérification : `/health`.
- Frontend : `VITE_ASTRONOMY_PROXY_URL=https://gobai-astronomy-proxy.onrender.com` avant le build statique.

Routes : `GET /tap/simbad?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=SELECT...` et `GET /tap/exoplanet?format=json&query=SELECT...`.
