# Lot 41 — Interstellar Perivolume Coordinator

## But

Appliquer les décisions ACTIVE/BACKGROUND/UNLOADED aux groupes de scène, après évaluation géométrique et application des axiomes de concurrence.

## Règles

- ACTIVE : groupe visible, simulation autorisée, priorité 100.
- BACKGROUND : groupe visible, simulation suspendue, priorité 20.
- UNLOADED : groupe masqué, simulation suspendue, priorité 0.
- Relation interne : le système partenaire est plafonné à BACKGROUND.
- Relation externe : le système partenaire est déchargé (UNLOADED).

## API

`InterstellarPerivolumeCoordinator.register()`, `attachGroup()`, `updateCenter()`, `update(cameraPosition)`, `getProfile()`, `unregister()`.

Le coordinateur n'efface pas les géométries : `UNLOADED` masque le groupe et marque la simulation comme suspendue. La libération effective de la mémoire GPU relève du gestionnaire de ressources du moteur appelant.

## Exemple

```js
const runtime = new InterstellarPerivolumeCoordinator();
runtime.register({ id: 'system:solar', center: [0, 0, 0], radius: 50, group: solarGroup });
runtime.register({ id: 'system:proxima-centauri', center: proximaScenePosition, radius: 50, group: proximaGroup });
const states = runtime.update(camera.position.toArray());
```

Les identifiants doivent correspondre aux IDs des axiomes. Les quatre paires standard sont fournies par `createGobaiPerivolumeAxioms()` ; un système doit être enregistré pour que la paire soit évaluée.
