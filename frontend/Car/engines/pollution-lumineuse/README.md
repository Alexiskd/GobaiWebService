# pollution-lumineuse — les lumières de la nuit au-dessus du globe CesiumJS

Le sol de la Terre est dessiné par CesiumJS (engine `astre-solide`) : les lumières de la nuit des tuiles three.js n'y
sont plus. Cette engine les remet en **couche three.js**, posée au-dessus du globe et **sous les nuages** :

- une coque à 3 km au-dessus du sol, rattachée au repère des tuiles de la Terre (elle tourne avec elle) ;
- la mosaïque mondiale des lumières (atlas 2025 de David Lorenz en couleurs naturelles, déjà chargée par les tuiles
  de la Terre), lue en Web Mercator ;
- seulement sur la face de nuit (crépuscule de +0,05 à −0,12 du cosinus solaire), en lumière ajoutée ;
- mêmes réglages que les tuiles : interrupteur « lumières de la nuit », vue de nuit, bouton « Ombre ».

La coque vit sur son propre calque (`POLLUTION_LAYER` = 6) : la scène three.js ne la dessine jamais elle-même. La
couche posée au-dessus du globe (`engine.renderAtmosphereOverlay`) la dessine en premier (`renderOrder` −10), puis
l'atmosphère et les nuages par-dessus, et seulement quand le globe dessine la Terre.

| Fichier | Rôle |
|---|---|
| `pollution-lumineuse.layer.js` | La coque, son matériau, son calque, ses réglages (Soleil, ombre). |
| `pollution-lumineuse.shader.js` | Shaders : position dans la mosaïque, part de nuit, lumière ajoutée. |
| `pollution-lumineuse.math.js` | Mêmes calculs en JavaScript, testés. |
