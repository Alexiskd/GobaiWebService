# Core — Lot 16 : prototype de shader multi-astre instancié

## Objectif

Évaluer une première voie de rendu mutualisé pour plusieurs sphères satellites avec un matériau et une texture atlas communs, sans remplacer le pipeline cartographique actuel.

## Livrable

`frontend/src/moteur/core/SatelliteSurfaceBatchPrototype.js` fournit :

- un vertex shader GLSL 1 utilisant `instanceMatrix` et les attributs `surface0..surface3` préparés au lot 15 ;
- un fragment shader de prototype qui lit une texture couleur commune (`uSurfaceAtlas`) et applique un éclairage diffus simple ;
- un rectangle UV par instance (`atlasRect`) pour sélectionner la région du satellite dans l'atlas ;
- un constructeur injecté `createSatelliteSurfaceBatchPrototype({ THREE, capacity, atlasTexture })` qui crée une sphère unitaire, ses `InstancedBufferAttribute`, un `ShaderMaterial` et un `InstancedMesh` ;
- validation et écriture des rectangles UV.

Le prototype est limité aux surfaces opaques, à une texture couleur et à une direction solaire commune. Le rayon et l'aplatissement sont portés par `surface0`; les matrices d'instance portent la position et l'orientation dans le repère du groupe.

## Pourquoi il n'est pas branché dans TileLayer

Le pipeline réel `TileLayer` ne possède pas une texture couleur unique par astre. Chaque tuile crée son propre `ShaderMaterial` et ses propres uniforms/échantillons : `map`, `ovMap`, `parentMap`, relief (`hMap`), fond des océans (`oMap`), lumières nocturnes (`ltMap`, `lgMap`), cartes globales, masques, rectangles UV, fondu parent/enfant et paramètres d'éclairage. Les données changent indépendamment pendant le chargement et le LOD.

Un atlas couleur unique ne reproduit donc pas le comportement actuel. Le prototype ne traite pas encore :

- les tuiles multiples et leur couverture/LOD ;
- le relief géométrique, bathymétrie et ombrage de relief ;
- les overlays, pan-sharpening et textures globales ;
- les lumières nocturnes et leurs mipmaps ;
- les shaders d'éclairage spécifiques Terre/Lune ;
- la transparence, les transitions et la profondeur logarithmique.

Pour une vraie migration, il faudra choisir entre un atlas multi-couches avec rectangles et pages synchronisés, ou des groupes de batches par combinaison de textures/matériaux. Il faudra également vérifier les limites de textures, d'attributs vertex et de samplers sur WebGL 1, ainsi que les gutters/mipmaps de l'atlas pour éviter le bleeding.

## Validation et limites

Les tests du lot vérifient le contrat UV et la présence des chemins d'instancing dans les sources GLSL. Ils ne compilent pas le shader sur GPU et ne prouvent pas l'équivalence visuelle. Aucun satellite réel n'est migré et aucun gain de draw calls n'est revendiqué.
