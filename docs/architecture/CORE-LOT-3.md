# Gobai Space — JPL Horizons Core, Lot 3

## Objectif

Brancher le Core central à `SolarEngine` sans remplacer les calculs orbitaux, les gestionnaires de tuiles, les couches spécialisées ou la boucle de rendu historique.

## Branchement réalisé

- `SolarEngine.initCoreOrchestration()` crée `SystemRegistry`, `PerivolumeManager`, `SystemManager`, `ResourceManager` et `RenderScheduler`.
- Les cibles déjà construites par `initFocusTargets()` sont enregistrées dans le registre. Leurs positions restent fournies par les fonctions `get()` du moteur existant.
- Les périvolumes sont initialisés avec un rayon actif égal à 12 rayons de l'astre et un rayon d'arrière-plan égal à 40 rayons. Ce sont des seuils initiaux d'orchestration, pas des paramètres physiques JPL.
- `updateCoreOrchestration()` actualise les centres mobiles après `updateBodies()` et `updateCamera()`, puis évalue les transitions par rapport à la position de la caméra.
- Les 100 dernières transitions sont conservées et `getCoreDiagnostics()` expose un instantané de diagnostic.
- `dispose()` détruit les gestionnaires du Core. Les ressources Three.js historiques restent libérées par leurs propriétaires existants.

## Périvolumes dynamiques

`PerivolumeManager.updateCenter(id, center)` permet de déplacer le centre d'un périvolume sans perdre son état courant. La validation rejette les coordonnées non finies et renvoie `false` si l'identifiant n'est pas enregistré.

## Limites volontaires de ce lot

- Les états `ACTIVE`, `BACKGROUND` et `UNLOADED` sont observés et diagnostiqués ; ils ne commandent pas encore `visible`, `tiles.update()`, les téléchargements ou la destruction de ressources.
- `RenderScheduler` est instancié et vidé à chaque image, mais aucune tâche critique ou non critique de l'ancien moteur n'a été déplacée dans ce lot.
- `ResourceManager` est prêt, mais les ressources Three.js existantes ne lui sont pas encore transférées. Cela évite une double libération ou une libération prématurée de textures partagées.
- Le LOD existant dans `bodyLoading.jsx` et son chemin de rendu ne sont pas remplacés.
- Les rayons de périvolume (12× et 40× le rayon de l'astre) sont des valeurs de départ à calibrer avec des mesures de transition et de performance.

## Validation effectuée

- Vérification des imports du projet : 435 fichiers et 796 imports vérifiés, sans import manquant.
- Vérification syntaxique du fichier `engine.jsx` par Node après copie temporaire en `.mjs`.
- Smoke tests Node sur le registre, les périvolumes dynamiques, le gestionnaire, l'ordonnanceur et le cycle de vie des ressources : réussis.
- Build Vite et suite complète de tests non exécutés : les dépendances `node_modules` ne sont pas présentes dans l'environnement de travail.
