# Éphémérides JPL Horizons avec repli hors ligne

## Comportement

- Au démarrage de la scène, `useMoonFeeds` lance une collecte JPL Horizons depuis le navigateur.
- Le client demande les vecteurs en coordonnées écliptiques J2000 : planètes et planètes naines par rapport au Soleil, satellites par rapport à leur planète mère, Lune par rapport à la Terre.
- Les vecteurs sont collectés sur une fenêtre temporelle de 48 heures, à un pas de 6 heures, puis interpolés localement pendant le rendu.
- La collecte est relancée toutes les 6 heures. Aucun `fetch` n'est exécuté depuis `requestAnimationFrame`.
- Les positions JPL disponibles remplacent les positions locales uniquement dans la fenêtre couverte.
- En cas d'échec HTTP, CORS, réseau, quota ou hors fenêtre, le moteur existant reste le repli : VSOP87A pour les huit planètes, éléments képlériens pour les planètes naines et orbites locales pour les satellites.

## Fichiers modifiés

- `src/Car/AstreSolideEngine/jplHorizonsClient.jsx` : client JPL, parsing CSV, concurrence limitée et interpolation.
- `src/Car/AstreSolideEngine/engine.jsx` : injection des vecteurs JPL dans les positions des planètes et des satellites.
- `src/Fairing/components/scene/useMoonFeeds.jsx` : chargement JPL direct, sans endpoints du backend pour les éphémérides.

## Limites

Le moteur dessine les corps présents dans le catalogue embarqué `ALL_SATELLITES` de l'application. Ce catalogue contient 34 satellites au moment de cette modification ; le PDF fourni répertorie davantage de satellites. Les satellites absents du catalogue ne sont donc pas ajoutés automatiquement par ce patch. Leur ajout exige des identifiants Horizons et des paramètres orbitaux/physiques statiques fiables pour garantir aussi le fonctionnement hors ligne.

Les positions JPL sont des vecteurs à pas de 6 heures, interpolés pour l'animation. Elles ne constituent pas un recalcul d'éphémérides à chaque image. Le rendu reste fluide ; le moteur local prend le relais hors de la fenêtre JPL.
