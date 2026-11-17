# Surface — Lot 30 : capture navigateur et rapport A/B

## Objectif

Le lot 29 comparait des buffers RGBA fournis par l'appelant. Le lot 30 ajoute un adaptateur navigateur concret pour capturer le canvas WebGL de `SolarEngine`, exécuter les scénarios classique/atlas et produire un rapport HTML autonome contenant les deux captures et les mesures.

## API SolarEngine

```js
const validation = solarEngine.createSurfaceAtlasVisualValidation({
  scenarios: [
    {
      bodyId: 'earth',
      viewKey: 'earth-reference',
      cameraState: { az: 0.8, el: 0.6, dist: 8_000_000 },
    },
    {
      bodyId: 'moon',
      viewKey: 'moon-reference',
      cameraState: { az: 1.1, el: 0.7, dist: 250_000 },
    },
  ],
  frameCount: 3,
  // Facultatif : attendre que les tuiles requises soient prêtes dans l'application.
  waitUntilReady: async ({ engine, scenario, mode, timeoutMs }) => {
    // Implémenter ici la condition de stabilité propre au chargement des tuiles.
  },
});

const report = await validation.run();
const html = validation.buildHtmlReport(report);
```

`validation.getCaptures()` retourne une copie de la Map contenant les buffers RGBA et les PNG data URI (`bodyId:viewKey:mode`). L'appelant peut enregistrer la chaîne HTML comme fichier depuis son interface de développement.

## Garanties apportées

- Le temps simulé est gelé (`speed = 0`) pendant chaque scénario.
- La rotation automatique, le glissement, le zoom d'arrivée et le verrouillage de vue sont neutralisés temporairement.
- Si aucun `cameraState.focusIndex` n'est fourni, le focus est recherché à partir du `bodyId` dans les cibles tuilées.
- Les paramètres de vue et le mode Atlas d'origine sont restaurés même si une capture échoue (restauration du mode gérée par le runner du lot 29).
- Le canvas WebGL est copié dans un canvas 2D temporaire ; les pixels RGBA et un PNG sont conservés pour la comparaison et le rapport.
- Le rapport HTML inclut les captures classique/atlas, les résultats par scénario et le JSON complet.

## Synchronisation des tuiles

L'adaptateur attend un nombre configurable de frames (`frameCount`, défaut 3). Cette attente ne prouve pas que les tuiles sont toutes chargées. Pour un test reproductible, fournir `waitUntilReady` afin que l'application attende son propre critère de stabilité (par exemple, fin des requêtes attendues et absence de changement du jeu de tuiles visibles pendant plusieurs frames).

## Limites

- La lecture du canvas peut échouer si le contexte est non lisible ou si une ressource externe a contaminé le canvas ; l'erreur est remontée explicitement avec une indication CORS.
- Les contrôles utilisateur ne sont pas désactivés au niveau de tous les gestionnaires d'événements. Éviter toute interaction pendant le scénario.
- Les images du rapport sont incorporées en data URI : les rapports peuvent être volumineux en haute résolution.
- Aucune capture réelle du navigateur Gobai Space n'a été exécutée dans l'environnement de développement de ce lot. Les tests automatisés utilisent un canvas simulé.
- Le build Vite et la validation WebGL réelle restent nécessaires dans l'environnement du projet avec ses dépendances installées.

## Fichiers

- `frontend/src/moteur/core/SatelliteAtlasBrowserValidation.js`
- `frontend/src/moteur/core/SatelliteAtlasBrowserValidation.test.js`
- `frontend/src/moteur/engine/engine.jsx` (méthode `createSurfaceAtlasVisualValidation`)
- `frontend/src/moteur/core/index.js` (export)
