# Gobai Space — journal des lots d'architecture

Ce fichier réunit, dans l'ordre des lots, les notes auparavant réparties en 57 fichiers dans `docs/architecture/`.
Chaque section indique son fichier d'origine.

---

<!-- Fichier d'origine : docs/architecture/CORE-ROADMAP.md -->

# Gobai Space — JPL Horizons Core

| Lot | Contenu | État |
|---|---|---|
| 1 | Registre, gestion des périvolumes, orchestration des états et gestionnaire de ressources | Ajouté |
| 2 | Adaptateur LOD et ordonnanceur coopératif | Ajouté |
| 3 | Branchement du Core à SolarEngine et suivi dynamique des périvolumes | Ajouté, mode observation |
| 4 | Politique effective de priorité/visibilité et intégration progressive des chargements | À réaliser après validation du lot 3 |
| 5 | Gestion du cycle de vie des ressources graphiques avec propriété et références explicites | À réaliser |

Les lots 1 à 3 conservent les moteurs spécialisés existants. Les états du Core ne doivent pas déclencher de destruction graphique avant que l'ownership des ressources soit explicitement migré.

---

<!-- Fichier d'origine : docs/architecture/JPL-HORIZONS-CLIENT.md -->

# Éphémérides JPL Horizons avec repli hors ligne

## Comportement

- Au démarrage de la scène, `useMoonFeeds` lance une collecte JPL Horizons depuis le navigateur.
- Le client demande les vecteurs en coordonnées écliptiques J2000 : planètes et planètes naines par rapport au Soleil, satellites par rapport à leur planète mère, Lune par rapport à la Terre.
- Les vecteurs sont collectés sur une fenêtre temporelle de 48 heures, à un pas de 6 heures, puis interpolés localement pendant le rendu.
- La collecte est relancée toutes les 6 heures. Aucun `fetch` n'est exécuté depuis `requestAnimationFrame`.
- Les positions JPL disponibles remplacent les positions locales uniquement dans la fenêtre couverte.
- En cas d'échec HTTP, CORS, réseau, quota ou hors fenêtre, le moteur existant reste le repli : VSOP87A pour les huit planètes, éléments képlériens pour les planètes naines et orbites locales pour les satellites.

## Fichiers modifiés

- `Car/Engine/AstreSolideEngine/jplHorizonsClient.jsx` : client JPL, parsing CSV, concurrence limitée et interpolation.
- `Car/Engine/AstreSolideEngine/engine.jsx` : injection des vecteurs JPL dans les positions des planètes et des satellites.
- `Car/Fairing/components/scene/useMoonFeeds.jsx` : chargement JPL direct, sans endpoints du backend pour les éphémérides.

## Limites

Le moteur dessine les corps présents dans le catalogue embarqué `ALL_SATELLITES` de l'application. Ce catalogue contient 34 satellites au moment de cette modification ; le PDF fourni répertorie davantage de satellites. Les satellites absents du catalogue ne sont donc pas ajoutés automatiquement par ce patch. Leur ajout exige des identifiants Horizons et des paramètres orbitaux/physiques statiques fiables pour garantir aussi le fonctionnement hors ligne.

Les positions JPL sont des vecteurs à pas de 6 heures, interpolés pour l'animation. Elles ne constituent pas un recalcul d'éphémérides à chaque image. Le rendu reste fluide ; le moteur local prend le relais hors de la fenêtre JPL.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-1.md -->

# Gobai Space — JPL Horizons Core, Lot 1

## Portée

Ce lot ajoute un socle indépendant du moteur graphique existant. Il ne remplace pas `SolarEngine`, `bodyLoading.jsx`, `tiledBodies.jsx`, le moteur de tuiles ni les composants React. Aucun branchement automatique au rendu n'est effectué dans ce lot : l'intégration se fera après validation des contrats et des tests.

## Modules ajoutés

- `SystemRegistry` : registre en mémoire des systèmes/astres, avec `register`, `upsert`, `get`, `remove`.
- `PerivolumeManager` : calcule la distance caméra-centre et classe chaque objet en `ACTIVE`, `BACKGROUND` ou `UNLOADED`.
- `SystemManager` : orchestre l'évaluation des périvolumes, notifie les transitions et expose un profil de charge.
- `ResourceManager` : comptage de références pour empêcher la destruction prématurée d'une texture/géométrie partagée.

## Contrat de périvolume

Les coordonnées et rayons doivent utiliser la même unité. Le calcul utilise la distance euclidienne 3D entre la caméra et le centre. `radius` définit la zone active ; `backgroundRadius` définit la zone de travail réduit. Une hystérésis de 8 % par défaut limite les oscillations aux frontières.

Les formules de surface (sphère, cube, cylindre, etc.) ne déterminent pas cette proximité : elles ne sont pas utilisées comme seuil spatial.

## Profils

| État | Rendu | Mise à jour | Priorité |
|---|---:|---:|---:|
| ACTIVE | oui | oui | 100 |
| BACKGROUND | oui | non | 20 |
| UNLOADED | non | non | 0 |

`UNLOADED` signifie que l'orchestrateur peut demander la libération des ressources graphiques qui ne sont plus référencées. Les données orbitales/scientifiques ne doivent pas être supprimées automatiquement par ce gestionnaire.

## Validation

Tests unitaires ciblés : registre, transitions/hystérésis, profil de charge, comptage de références. Le lot reste volontairement non connecté à la boucle de rendu afin de préserver le comportement existant.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-2.md -->

# Gobai Space — JPL Horizons Core, Lot 2

## Portée

Ce lot ajoute deux couches d'orchestration autonomes. Il ne modifie pas la boucle `SolarEngine.frame()` et ne change pas les seuils de LOD déjà en production dans `moteur/engine/bodyLoading.jsx`.

## LODManager

`LODManager` délègue les décisions existantes à `bodyLevel`, `planTiledBodies` et `satelliteShown`. Il centralise le calcul du niveau par astre, le budget de tuiles et l'hystérésis d'affichage des satellites. Les seuils existants restent la source de vérité.

## RenderScheduler

`RenderScheduler` exécute au plus `maxTasksPerFrame` tâches par appel à `flush()`. Les tâches les plus prioritaires passent en premier ; à priorité égale, l'ordre d'inscription est conservé. Les tâches restantes attendent les images suivantes. Une tâche peut se reprogrammer elle-même pendant son exécution. Les erreurs sont rapportées dans le résultat et au callback `onError`, sans interrompre les autres tâches sélectionnées.

## Intégration volontairement différée

Les gestionnaires sont exportés depuis `moteur/core/index.js`, mais ils ne sont pas encore branchés dans `SolarEngine`. L'étape suivante devra identifier les mises à jour coûteuses qui peuvent être déplacées dans l'ordonnanceur sans retarder les calculs physiques, les mouvements de caméra ou le rendu essentiel.

## Validation

Tests ciblés ajoutés pour le mapping des niveaux, le budget des tuiles, l'hystérésis des satellites, la priorité, la reprogrammation et la gestion des erreurs.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-3.md -->

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

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-4.md -->

# Core — Lot 4 : cadence d’activité pilotée par les périvolumes

## Objectif

Appliquer les décisions du `PerivolumeManager` aux mises à jour coûteuses des moteurs de tuiles, sans modifier les calculs orbitaux ni détruire de ressources graphiques.

## Politique

`CoreActivityPolicy` traduit l’état d’un astre en cadence :

| État | Mise à jour des tuiles |
|---|---|
| `ACTIVE` | Chaque image |
| `BACKGROUND` | Une image sur quatre (configurable) |
| `UNLOADED` | Suspendue |
| Cible actuelle | Chaque image, quel que soit l’état |

Le moteur continue d’appeler `updateBodyModel()` à chaque image afin de conserver le basculement modèle/tuiles et la continuité visuelle. Les positions orbitales, les rotations et le placement de la caméra ne sont pas déplacés vers l’ordonnanceur.

## Intégration

- `SolarEngine.initCoreOrchestration()` crée `CoreActivityPolicy`.
- `updateCoreOrchestration()` avance son compteur de frame après les positions orbitales et la caméra.
- La boucle `tiledBodies` consulte l’état du périvolume avant `tb.tiles.update()`.
- Les identifiants non présents dans le registre conservent temporairement la cadence `ACTIVE` pour assurer la compatibilité.
- `dispose()` réinitialise la politique.

## Limites explicites

Ce lot suspend l’actualisation des TileManagers pour les astres `UNLOADED`, mais ne masque pas leurs objets Three.js, ne vide pas leurs caches et n’annule pas les téléchargements déjà lancés. Ces opérations nécessitent un protocole de propriété/libération par moteur et seront traitées séparément pour éviter de supprimer des textures ou géométries partagées.

Les états restent calculés à partir des rayons et positions de scène enregistrés au lot 3. Les seuils `12 × rayon` et `40 × rayon` doivent être calibrés avec des mesures de caméra et de charge réelles avant activation d’un déchargement mémoire.

## Tests

`activity-policy.test.jsx` vérifie la cadence ACTIVE, BACKGROUND, UNLOADED, la priorité du focus et le rejet d’une cadence invalide.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-5.md -->

# Core — Lot 5 : budgets mémoire des tuiles

## Objectif

Brancher les états de périvolume sur les caches L1 GPU et L2 RAM déjà présents dans `TileLayer`, sans créer un cache parallèle.

## Profils

- `ACTIVE` : restaure les capacités nominales configurées par l'astre.
- `BACKGROUND` : réduit le budget de rétention GPU/RAM tout en conservant un minimum pour la vue courante.
- `UNLOADED` : désactive la rétention RAM et ramène le cache GPU au nombre de tuiles nécessaires à la vue courante.
- L'astre ciblé est traité comme `ACTIVE`.

## Sécurité

- Les tuiles épinglées vivent dans une table dédiée et ne sont pas évincées par ce profil.
- Les tuiles de la vue courante sont protégées pendant le trimming du cache GPU.
- Les évictions passent par le callback LRU historique `TileLayer.evict`, qui libère les textures et gère le transfert RAM.
- Aucun `dispose()` global, aucune suppression de géométrie partagée et aucune annulation des téléchargements en cours.
- Le profil `ACTIVE` restaure les capacités nominales.

## Limites

Le profil `UNLOADED` ne détruit pas les objets épinglés, les sources, les modèles 3D ou les données orbitales. Il réduit uniquement les caches de tuiles du fond actif. Les caches secondaires (relief, océan, lumières) gardent leur cycle de vie propre.

## Diagnostic

`getCoreDiagnostics()` expose les tailles et capacités GPU/RAM par astre.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-6.md -->

# Lot 6 — Cadencement des moteurs spécialisés

Le lot 6 ajoute `EngineActivityPolicy` et le raccorde à la boucle `SolarEngine`. Les moteurs spécialisés Terre (atmosphère, volcans, LiDAR des contributions et annotations) et Lune (étiquettes lunaires) sont cadencés selon l'état de périvolume de leur astre.

| Moteur | ACTIVE / ciblé | BACKGROUND | UNLOADED |
|---|---:|---:|---:|
| Atmosphère | chaque image | 1/4 | suspendu |
| Volcans | chaque image | 1/4 | suspendu |
| LiDAR (contributions) | chaque image | 1/3 | suspendu |
| Annotations Terre | chaque image | 1/2 | suspendu |
| Étiquettes Lune | chaque image | 1/2 | suspendu |

La suspension concerne les appels `update`/`sync` seulement. Les objets Three.js, textures, géométries, caches, données scientifiques et calculs orbitaux ne sont pas supprimés. Les tuiles et le basculement modèle/tuiles conservent leur traitement existant. Le moteur ciblé est toujours mis à jour à chaque image.

`getCoreDiagnostics()` expose les cadences configurées. Les tests unitaires vérifient les états, la cadence, la priorité de la cible et le rejet de profils invalides.

## Limites connues

- Les moteurs relief ne possèdent pas tous un cycle `update` autonome : ils restent pilotés par le gestionnaire de tuiles existant.
- Les systèmes d'atmosphère et LiDAR sont ici associés à la Terre, et les étiquettes lunaires à la Lune.
- Une suspension ne libère aucune mémoire ; l'éviction mémoire reste gérée par le lot 5 et les caches existants.
- Build complet et suite `tsx` à exécuter avec les dépendances installées.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-7.md -->

# Core — Lot 7 : budget adaptatif du rendu cartographique

## Objectif

Adapter le nombre d'astres dont les couches cartographiques sont actualisées simultanément en fonction des mesures de performance déjà collectées par `PerfProbe`.

## Implémentation

- `RenderBudgetPolicy.js` applique une hystérésis aux temps CPU/GPU.
- Le budget principal varie de 1 à `MAX_TILED_BODIES` (3 par défaut). Le planificateur existant peut en plus servir un astre supplémentaire à tour de rôle parmi les candidats restants.
- Deux échantillons consécutifs au-dessus de 115 % du budget temporel réduisent le budget d'un astre.
- Huit échantillons consécutifs sous 68 % du budget temporel permettent de remonter d'un astre.
- Les valeurs manquantes de chronométrie GPU sont acceptées : le CPU reste utilisable seul.
- `SolarEngine.planTiles()` utilise le budget courant ; le planificateur existant conserve sa priorité à l'astre ciblé et son tour de rôle pour les suivants.

## Ce qui n'est volontairement pas modifié

- `adaptResolution()` et `setResolution()` restent les seuls responsables du DPR adaptatif.
- Aucun shader, matériau, ombre ou géométrie n'est détruit ou remplacé.
- Le nombre d'astres affichés et les calculs orbitaux ne sont pas modifiés ; seule la cadence de mise à jour des tuiles est budgétée.
- Les appels de rendu Three.js restent inchangés.

## Diagnostics

`getCoreDiagnostics().renderBudget` expose le budget courant, ses bornes, les compteurs d'hystérésis et le dernier échantillon CPU/GPU.

## Validation

Tests unitaires couvrant la baisse, la remontée progressive, la mesure GPU et les bornes. Le build Vite et la suite complète restent à lancer dans un environnement avec les dépendances installées.

---

<!-- Fichier d'origine : docs/architecture/RENDER-LOT-8.md -->

# Lot 8 — Diagnostics du pipeline de rendu Three.js

## Objectif

Mesurer les coûts structurels déjà exposés par `PerfProbe` et `renderer.info`, puis fournir des signaux exploitables pour une optimisation ultérieure.

## Ajouts

- `RenderDiagnosticsPolicy.js` classe les appels de dessin, triangles, textures et géométries en niveaux `normal`, `warning`, `critical` ou `unknown`.
- `SolarEngine` actualise ces diagnostics au rythme de publication de `PerfProbe` (environ deux fois par seconde).
- `getCoreDiagnostics()` expose le résultat dans `renderPipeline`.
- Les recommandations ciblent le bon levier : mutualisation des matériaux/appels, LOD géométrique, audit des textures et géométries.

## Limites volontaires

Ce lot est observabilité seulement. Il ne remplace pas les matériaux, ne fusionne pas les géométries, ne change pas les shaders, ne modifie pas les ombres et ne détruit aucune ressource. Ces transformations nécessitent une cartographie des propriétaires et des dépendances de chaque objet Three.js afin de ne pas casser les moteurs spécialisés.

Les seuils par défaut sont des seuils d'alerte configurables, pas des limites universelles de WebGL. Les compteurs `renderer.info` reflètent les ressources et opérations comptabilisées par Three.js, pas une mesure directe de VRAM physique.

---

<!-- Fichier d'origine : docs/architecture/RENDER-LOT-9.md -->

# Lot 9 — mutualisation explicite des matériaux

## Changement

`SharedResourcePool` fournit un pool générique à références comptées. Une clé représente une configuration strictement identique et explicite ; le pool ne tente pas de comparer automatiquement des matériaux arbitraires.

`SatelliteSystem` utilise ce pool pour ses `MeshLambertMaterial` de sphères. Les satellites de même couleur partagent désormais un matériau au lieu d'en créer un chacun. Les géométries sphériques restent individuelles car leur rayon varie selon le satellite.

## Cycle de vie

- Chaque satellite acquiert une référence au matériau associé à sa couleur normalisée.
- `SatelliteSystem.dispose()` libère une référence par satellite.
- Le matériau n'est détruit qu'à la dernière libération.
- Les orbites et géométries individuelles gardent leur cycle de vie actuel.

## Limites

Le lot ne fusionne pas les meshes et ne promet donc pas une baisse du nombre de draw calls. Il réduit les allocations de matériaux dupliqués et centralise leur cycle de vie. Les matériaux avec uniforms, textures ou états spécifiques ne sont pas mutualisés.

## Validation

Tests unitaires du pool : création unique par clé, références, libération finale, isolation des clés et validation des entrées. Build Vite complet à effectuer dans un environnement avec les dépendances installées.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-10.md -->

# Core — Lot 10 : partage des géométries sphériques

## Objectif

Réduire les allocations de géométries identiques pour les sphères de fond des planètes, sans fusionner les meshes ni modifier leurs matériaux, positions, orbites ou propriétés de visibilité.

## Implémentation

- `core/SharedGeometry.js` construit une clé à partir des subdivisions horizontales et verticales.
- `acquireUnitSphereGeometry()` acquiert une `SphereGeometry` de rayon 1 dans le `SharedResourcePool`.
- `SolarEngine.initPlanets()` partage les géométries lorsque les subdivisions sont identiques.
- Le rayon de chaque astre est appliqué au `mesh.scale` ; les matériaux et groupes restent indépendants.
- Le parcours de destruction de scène ignore les géométries marquées comme partagées ; le pool les libère une seule fois à la destruction du moteur.
- L'aplatissement des géantes gazeuses multiplie désormais l'échelle Y existante au lieu de l'écraser.

## Limites

Ce lot réduit les allocations CPU et la duplication de buffers de géométrie. Il ne réduit pas à lui seul le nombre de draw calls : chaque planète conserve son mesh et son matériau. Les sphères de la Terre (128 × 96), des autres planètes (48 × 32) et de la Lune (96 × 64) restent des topologies distinctes.

Aucun InstancedMesh n'est introduit : les planètes ont des matériaux, des interactions, des groupes, des anneaux et des moteurs spécialisés distincts. Les fusionner dans une seule instance serait une modification de rendu risquée sans mesure préalable.

## Vérifications

- Contrôle syntaxique des modules JS et du moteur JSX (copie `.mjs`).
- Vérification statique des imports du projet.
- Smoke tests du partage, du comptage de références, de la libération finale et du rejet des subdivisions invalides.
- Build Vite et suite `tsx --test` non exécutés dans cet environnement, faute de dépendances installées.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-11.md -->

# Lot 11 — infrastructure d'instancing

## Objectif

Préparer le regroupement de meshes répétitifs partageant strictement la même géométrie et le même matériau, afin de réduire les draw calls. Le lot ajoute `InstancedMeshBatch`, wrapper léger de `THREE.InstancedMesh` avec capacité fixe et identifiants stables.

## API

- `upsert(id, matrix, color?)` ajoute ou met à jour une instance ; retourne son index, ou `false` si la capacité est atteinte.
- `remove(id)` retire une instance par compactage ; le dernier élément prend sa place.
- `has(id)` et `size` exposent l'état du batch.
- `dispose()` détruit le mesh instancié et uniquement les ressources explicitement possédées (`ownsGeometry`, `ownsMaterial`).

Les matrices sont fournies par l'appelant. Le batch ne modifie pas les transformations ni les calculs orbitaux. Géométrie et matériau sont empruntés par défaut.

## Limite volontaire de ce lot

Aucun moteur de production n'est converti automatiquement. Les objets repérés dans `ContributionLayer`, `moonOrbiters` et `lidarGlobe` n'ont pas tous les mêmes exigences de rendu (points à taille écran constante, couleurs par objet, masquage face cachée, trajectoires et cycle de vie). Les remplacer directement par des meshes instanciés changerait potentiellement leur apparence ou leur visibilité. L'intégration sera faite par famille homogène, avec validation visuelle dédiée.

## Tests

`InstancedMeshBatch.test.jsx` couvre l'upsert, la capacité, le retrait/compactage et la propriété des ressources.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-12.md -->

# Lot 12 — qualification des familles candidates à l'instancing

## Objectif

Éviter les conversions automatiques d'objets Three.js qui changeraient le picking, la visibilité individuelle ou l'apparence. `InstancingEligibility.js` fournit une politique pure et testable ; elle ne modifie pas la scène et n'alloue aucun objet GPU.

## Critères

Une famille est éligible si tous ses éléments partagent exactement la même géométrie et le même matériau, et ne demandent ni raycast individualisé, ni visibilité individuelle, ni état de shader propre à l'objet. Les éléments DOM sont exclus.

## Constats sur les candidats existants

- Les repères d'astres dans `engine.jsx` sont des éléments HTML/CSS : ils ne sont pas des meshes et ne peuvent pas être convertis en `InstancedMesh`.
- Les satellites possèdent une visibilité LOD indépendante et leurs meshes sont utilisés par le raycaster : une conversion directe exige d'abord de migrer le picking vers `instanceId` et de gérer les instances masquées.
- Les couches de points (étoiles, volcans, certains marqueurs) utilisent déjà `THREE.Points`, qui regroupe leurs sommets dans un seul objet de rendu ; les remplacer par des `InstancedMesh` n'apporterait pas automatiquement un gain.

## Portée

Ce lot ajoute un rapport d'éligibilité et ses tests, sans conversion graphique automatique. Les conversions réelles sont reportées jusqu'à ce que les contrats d'interaction et de visibilité soient migrés explicitement.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-13.md -->

# Lot 13 — pont de picking pour les instances

## Objectif

Préparer la migration des satellites vers `THREE.InstancedMesh` sans casser leur sélection individuelle.

## Changements

- `InstancedPickRegistry` associe un `InstancedMeshBatch` à ses identifiants métier.
- La résolution lit `batch.ids[instanceId]` au moment du clic : elle reste correcte après le compactage d'instances effectué par `InstancedMeshBatch.remove()`.
- `SatelliteSystem.registerInstancedPickBatch()` refuse les identifiants qui ne correspondent pas à un satellite connu.
- `SatelliteSystem.getInstancedPickables()` expose les meshes au raycaster.
- `SatelliteSystem.resolvePickHit()` convertit une intersection Three.js en objet satellite métier.
- `SolarEngine.selectAt()` sait maintenant sélectionner un satellite via `instanceId`, tout en conservant le chemin historique `sat.mesh`.

## Limite volontaire

Aucun satellite n'est encore converti en `InstancedMesh` dans ce lot. Les meshes individuels restent utilisés pour préserver le rendu, les groupes de rotation synchrone, les tuiles, le LOD et les fonctions qui attendent `sat.mesh`. Le nouveau pont rend possible une migration progressive et testable ; il ne réduit pas encore les draw calls.

## Utilisation future

Créer un `InstancedMeshBatch` avec les identifiants de satellites, ajouter son `batch.mesh` à la scène, puis enregistrer le batch avec `satelliteSystem.registerInstancedPickBatch(batch)`. Le callback de désenregistrement doit être appelé avant de retirer le batch.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-14.md -->

# Core — Lot 14 : géométrie unitaire partagée des satellites

## Décision technique

Les sphères de fond des satellites ne sont pas converties directement en `InstancedMesh` dans ce lot. Chaque satellite cartographié possède un `TileManager` avec son propre matériau, ses uniforms, son état de couverture et son facteur de sphère de fond. Regrouper ces surfaces dans un seul `InstancedMesh` imposerait de refondre le shader pour transporter ces états par instance ; le faire maintenant risquerait de casser les cartes et les transitions de fond.

Le lot applique donc une optimisation sûre : toutes les sphères satellites de topologie identique réutilisent une géométrie unitaire `SphereGeometry(1, 64, 48)`. Le rayon physique est porté par `Mesh.scale`, tandis que chaque satellite conserve son mesh, son matériau et son `TileManager` indépendants.

## Fichiers modifiés

- `frontend/src/moteur/engine/satellites.jsx`
  - Acquisition d'une géométrie unitaire partagée via `SharedResourcePool` et `acquireUnitSphereGeometry`.
  - Échelle individuelle par rayon moyen du satellite.
  - Libération unique de la géométrie après le retrait des satellites.
- `frontend/src/moteur/engine/tiles/tileManager.jsx`
  - `placeBackdrop()` ajuste désormais l'échelle du mesh plutôt que de modifier le buffer de géométrie.
  - Préserve les échelles de rayon et l'aplatissement existant des géantes gazeuses.
- `frontend/src/moteur/engine/tiles/backdropMeshScale.js`
  - Helper validant les facteurs et appliquant le ratio d'échelle sans mutation de géométrie partagée.
- Tests `.test.js` pour la mise à l'échelle et le partage de géométrie.

## Garanties

- Les meshes satellites restent distincts : sélection, visibilité, LOD, orientation synchrone et cartes restent indépendants.
- Les matériaux et uniforms propres à chaque astre ne sont pas fusionnés.
- Le facteur de fond est réversible et ne modifie plus la géométrie commune.
- La géométrie est libérée par le pool après usage.

## Limites

Ce lot réduit les duplications de buffers géométriques CPU/GPU, mais ne réduit pas les draw calls : chaque satellite garde son mesh et son matériau. L'instancing effectif nécessitera un shader de surface capable de gérer les uniforms et états de tuiles par instance, ou une stratégie de batch par compatibilité stricte.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-15.md -->

# Core — Lot 15 : contrat de données de surface par instance

## Objectif

Préparer la migration future des surfaces satellites vers un rendu mutualisé sans fusionner prématurément les matériaux ni les couches de tuiles. Les `TileManager` actuels possèdent des uniforms, des textures, des états de couverture et des transitions indépendants ; les remplacer directement par un `InstancedMesh` serait incorrect sans adapter le shader et le transport des données.

## Livrable

`frontend/src/moteur/core/SatelliteSurfaceInstanceData.js` définit un contrat CPU de 16 flottants par instance, répartis en quatre attributs `vec4` :

| Attribut | Composantes |
|---|---|
| `surface0` | rayon, aplatissement, ombrage, astre sans atmosphère |
| `surface1` | mode de couche, carte couleur active, mode détail, alpha |
| `surface2` | exagération du relief, ombrage relief, relief image, océan |
| `surface3` | lumières, type de détail, facteur de fond, visibilité |

Le module permet de packer l'état, de l'écrire dans quatre buffers `Float32Array` distincts et contigus, directement adaptables à des `InstancedBufferAttribute`.

## Garanties et limites

- Les uniforms existants ne sont ni modifiés ni remplacés.
- Aucun matériau, shader ou `TileManager` n'est fusionné dans ce lot.
- Les textures de tuiles et leurs états restent indépendants.
- Les valeurs non finies et les dimensions de buffer incohérentes sont rejetées.
- Ce contrat CPU est une préparation : il ne produit pas encore de draw call instancié ni de gain GPU mesurable.

## Étape suivante

Écrire un prototype shader distinct et isolé, puis comparer son rendu à celui du `TileManager` historique sur un seul couple de satellites avant toute migration globale.

---

<!-- Fichier d'origine : docs/architecture/CORE-LOT-16.md -->

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

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-17.md -->

# Lot 17 — Atlas multi-astre progressif

## Objectif

Fournir un gestionnaire d'atlas couleur commun aux prototypes de surface instanciée des lots 15 et 16, sans remplacer `TileLayer`, `TileManager` ni les shaders cartographiques existants.

## Modules

- `SatelliteAtlasPageAllocator` : allocation déterministe par rangées, rectangles utiles UV normalisés, gutter et réduction proportionnelle des images trop grandes.
- `SatelliteTextureAtlasManager` : pages injectées, file priorisée, budget de traitement par appel, plafond de pages, accès aux rectangles UV, libération logique et destruction des textures.
- `createCanvasSatelliteAtlasPage` : fabrique navigateur optionnelle basée sur `THREE.CanvasTexture`.
- `blitSatelliteAtlasImage` : copie une image et étend ses bords dans le gutter pour limiter les contaminations entre régions lors du filtrage/mipmapping.

## Contrat d'intégration

Le gestionnaire attend `createPage({ pageSize, index })` et `blit(page, source, allocation)`. Cela permet de tester le placement sans DOM/WebGL et de brancher ultérieurement d'autres sources (bitmap, canvas ou pipeline de décodage).

`entry.uv` est un `Float32Array([u, v, largeur, hauteur])` prêt pour `writeSatelliteAtlasRect()` du lot 16. Chaque entrée conserve la référence de sa page/texture.

## Limites connues

- Atlas couleur uniquement : relief, normal maps, lumières nocturnes, couches et états LOD ne sont pas encore regroupés.
- Allocateur shelf sans réutilisation des trous : `release()` retire la référence logique mais ne recycle pas le rectangle. Cela évite d'écraser une région encore utilisée par une instance GPU. Une future compaction devra reconstruire la page et réécrire tous les rectangles UV concernés.
- Le plafond de pages laisse les éléments non chargés dans la file ; le demandeur peut relancer `processQueue()` après libération ou augmentation de capacité.
- Le shader du lot 16 n'est pas branché au rendu de production. Aucun gain de draw calls ou équivalence visuelle n'est revendiqué.

## Validation

Les tests couvrent le placement UV, les gutters, la réduction des sources trop grandes, la priorité et le budget de chargement, le plafond de pages, la libération et le cycle de vie.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-18.md -->

# Lot 18 — Atlas de textures multi-couches synchronisées

## Objectif

Étendre le prototype d'atlas du lot 17 à plusieurs cartes de surface qui partagent une allocation UV unique. Les canaux usuels sont `color`, `elevation`, `normal` et `night`.

## Architecture

- `SatelliteMultiLayerTextureAtlasManager` possède un allocateur spatial unique par page.
- Chaque page crée une texture indépendante par canal configuré.
- Une surface reçoit une allocation et un rectangle UV communs à toutes ses couches.
- `enqueue()` accepte les couches effectivement disponibles ; les couches absentes sont optionnelles et ne sont pas exposées dans `entry.textures`.
- Les fonctions `createPage()` et `blit()` sont injectées par canal : aucun accès DOM/WebGL n'est nécessaire pour tester la logique.
- La file est priorisée et `processQueue(maxItems)` borne le nombre de surfaces traitées par appel.

## Contrat d'intégration des canaux

Chaque canal doit fournir `createPage({ pageSize, index, channel })`, qui retourne au minimum `{ texture }`, et `blit(page, source, allocation, channel)`. Le callback `createPage` doit initialiser la page avec une valeur neutre adaptée au type de données, y compris lorsque certaines couches ne sont pas présentes :

- `color` : fond de couleur défini par le moteur de surface ;
- `elevation` : hauteur neutre/plate ;
- `normal` : normale tangentielle neutre (typiquement RGB 128, 128, 255) ;
- `night` : noir.

Pour Three.js r128, les textures de données (`elevation`, `normal`) doivent rester en espace linéaire et ne pas subir de conversion colorimétrique sRGB. La couleur visible (`color`) peut utiliser l'encodage sRGB si les sources le nécessitent. Le canal `night` dépend du pipeline de composition choisi. Le choix du format GPU, du type de données et des filtres doit rester cohérent avec les sources réelles.

## Mipmaps et filtrage

Le gestionnaire ne force pas de configuration Three.js : les callbacks créent les textures. Pour les textures utilisant des mipmaps, prévoir un gutter suffisant et une extrusion des bords dans chaque canal. Vérifier le comportement aux niveaux mipmap inférieurs ; un gutter de 4 px est une valeur de départ, pas une garantie pour tous les niveaux.

## Limites connues

- Prototype de gestion, pas encore branché sur `TileLayer` ni sur les chargements réels des astres.
- Aucune conversion automatique de données d'altitude en texture, ni génération de normales depuis une heightmap.
- Aucun shader de fusion color/elevation/normal/night n'est intégré ici.
- Les allocations libérées ne sont pas recyclées ; éviter d'écraser un rectangle encore référencé par une instance GPU.
- Les pages et leurs textures sont créées par les callbacks ; le gestionnaire ne décide pas de leur format, encodage, filtrage ou politique de mipmaps.
- Aucune réduction de draw calls ou validation visuelle n'est revendiquée à ce stade.

## Tests

`SatelliteMultiLayerTextureAtlas.test.js` vérifie la synchronisation UV, les couches optionnelles, la priorité, le budget de traitement, les erreurs de configuration et la libération des textures.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-19.md -->

# Lot 19 — Pont expérimental atlas → TileLayer

## But

Le lot 18 fournit des textures multi-couches et une allocation UV commune. Le lot 19 ajoute un adaptateur explicite vers les uniforms qui existent déjà dans `moteur/engine/tiles/tileLayer.jsx` et `tileShaders.jsx`.

## Correspondances prises en charge

| Canal atlas | Uniform TileLayer | Rectangle UV | Activation |
|---|---|---|---|
| `color` | `map` | `baseRect` | déjà consommée par le shader |
| `elevation` | `hMap` | `hRect` | `hHas = 1` |
| `night` | `ltMap` | `ltRect` | `ltHas = 1` |
| `normal` | — | — | en attente d'un shader normal dédié |

`composeSatelliteAtlasUvRect()` compose le rectangle d'une tuile avec celui de l'entrée atlas. L'adaptateur accepte un `tileRect` local, par défaut `[0, 0, 1, 1]`.

## Utilisation explicite

```js
import { bindSatelliteAtlasEntryToTileUniforms } from '../core/SatelliteAtlasTileBinding.js';

const result = bindSatelliteAtlasEntryToTileUniforms(atlasEntry, tileMaterial.uniforms, {
  tileRect: [0, 0, 1, 1],
});
// result.applied : canaux effectivement reliés
// result.pending : canaux non pris en charge ou uniforms absents
```

## Limites et précautions

- Cet adaptateur n'est pas appelé automatiquement par `TileLayer` et n'active aucun chargement atlas dans le moteur en production.
- L'ownership des textures reste au gestionnaire atlas. Le code appelant doit conserver l'atlas en vie tant que les matériaux référencent ses textures.
- Les canaux altitude doivent être encodés dans le format attendu par `hTex()` dans `tileShaders.jsx` (encodage Terrarium). Une image d'altitude arbitraire ne devient pas compatible par simple branchement.
- Les lumières doivent conserver le format, l'espace colorimétrique et les paramètres attendus par le shader nocturne existant.
- Les normales ne sont pas branchées : le shader TileLayer actuel ne déclare pas de sampler normal dédié.
- Aucun gain de performances, réduction de draw calls, rendu visuel ou compatibilité GPU n'est revendiqué à ce stade.
- Ne pas appeler `dispose()` sur l'atlas tant qu'un matériau utilise une de ses textures.

## Validation

Tests Node du calcul UV, du branchement des trois uniforms existants, du signalement des normales en attente et des entrées invalides. Vérification statique des imports. Le build Vite et le rendu WebGL ne sont pas validés dans cet environnement si les dépendances ne sont pas installées.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-20.md -->

# Surface — Lot 20 : pipeline atlas opt-in dans TileLayer

## Objectif

Introduire un premier chemin réel de copie des images de fond des tuiles vers l'atlas multi-couches, tout en conservant le chemin historique comme repli.

## Changements

- `SatelliteTileAtlasPipeline` encapsule l'enqueue, le traitement borné, la liaison aux uniforms et la libération logique.
- `TileLayer` accepte `surfaceAtlasPipeline` en option. La valeur par défaut `null` conserve strictement le rendu historique.
- À l'installation d'une tuile, seule la couche couleur est proposée à l'atlas. Si elle est immédiatement prête, `map` et `baseRect` pointent vers l'atlas. Si l'atlas est plein, en attente ou en erreur, les uniforms historiques restent intacts.
- À la destruction d'une tuile, l'entrée logique `tile:<key>` est libérée. Le pipeline ne détruit pas l'atlas, qui reste propriété de l'appelant.

## Activation expérimentale

Créer un `SatelliteMultiLayerTextureAtlasManager` avec un canal `color` (factory de page et blit compatibles avec le navigateur), l'encapsuler dans `SatelliteTileAtlasPipeline`, puis passer cette instance à la construction de `TileLayer` sous le paramètre `surfaceAtlasPipeline`.

## Limites et sécurité

- Désactivé par défaut : aucun astre n'est modifié sans activation explicite.
- Première intégration réelle limitée à la couleur. Altitude et nuit restent sur leurs chargeurs spécialisés ; le canal normal n'est pas branché au shader.
- L'image source reste conservée par le système de textures classique : ce lot valide le flux d'intégration, pas encore une réduction de mémoire GPU.
- Les allocations d'atlas libérées ne sont pas recyclées ; éviter les activations sur des sessions longues sans stratégie de compaction.
- Aucune promesse de réduction des draw calls : une tuile reste un mesh.
- Build Vite, validation visuelle et mesures WebGL réelles restent à effectuer dans l'environnement avec dépendances et GPU.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-21.md -->

# Lot 21 — Références et comptabilité mémoire de l’atlas

## Objectif

Sécuriser le cycle de vie logique des entrées d’atlas multi-couches et fournir une estimation reproductible de la mémoire des pages.

## Changements

- `SatelliteMultiLayerTextureAtlasManager.retain(id)` incrémente le nombre de références d’une entrée et de sa page.
- `release(id)` décrémente une référence et ne retire l’entrée qu’à la dernière libération.
- `getMemoryStats()` expose pages, canaux, entrées vivantes, références, slots et estimation mémoire RGBA8.
- `SatelliteTileAtlasPipeline` retient l’entrée lorsqu’une tuile est raccordée et la libère lors de son détachement.
- `dispose()` détruit les textures des pages et remet à zéro les compteurs.

## Garanties et limites

Les pages restent allouées jusqu’à `dispose()`. Les slots ne sont pas recyclés et aucune éviction GPU de page n’est réalisée : c’est volontaire, car plusieurs matériaux peuvent encore référencer une page partagée. La mémoire affichée est une estimation RGBA8 (`pageSize × pageSize × 4 × nombre de canaux × nombre de pages`), sans tenir compte précisément des mipmaps, du format réel, de l’alignement ou du pilote graphique. Elle ne constitue pas une mesure GPU.

Le lot ne prétend donc pas réduire la mémoire GPU ; il rend le cycle de vie explicite et mesurable avant d’implémenter une éviction sûre avec remplacement des textures dans tous les matériaux concernés.

## Validation

Tests Node sans DOM ni WebGL : références multiples, libération finale, persistance de la page, compteurs et estimation mémoire.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-22.md -->

# Lot 22 — Éviction sûre des pages atlas GPU

## Objectif

Permettre de récupérer réellement les textures GPU des pages atlas devenues inutilisées, sans détruire une page encore référencée par une tuile.

## Changements

- `SatelliteMultiLayerTextureAtlasManager.evictIdlePages()` évince les pages dont le compteur de références est nul.
- Toutes les entrées appartenant à une page évincée sont invalidées avant destruction de ses textures.
- Les textures de chaque canal sont détruites via `texture.dispose()` et le callback de page éventuel.
- Les indices de pages libérés sont réutilisables ; les indices des pages encore vivantes restent stables.
- À saturation de `maxPages`, le gestionnaire tente automatiquement d'évincer une page inactive avant de refuser une nouvelle allocation.
- `getPageCount()` et `getMemoryStats()` comptent les pages réellement vivantes, pas les trous dans le tableau interne.

## Contrat de sécurité

Chaque tuile ou matériau qui conserve une texture d'atlas doit appeler `retain(id)` et appeler `release(id)` uniquement après avoir cessé de référencer cette texture. Une page dont le compteur de références est supérieur à zéro ne peut pas être évincée. Quand une page est détruite, toutes ses entrées sont invalidées ; les consommateurs doivent donc traiter une entrée absente comme un cache miss et recharger la source.

L'éviction est explicite et peut aussi être déclenchée automatiquement lorsque le budget `maxPages` est atteint. Elle ne modifie pas les matériaux Three.js à la place des consommateurs : le protocole retain/release constitue la garantie de non-destruction prématurée.

## Limites

- L'estimation mémoire reste une estimation RGBA8, pas une mesure GPU du navigateur.
- Le pipeline TileLayer garde le chargement classique comme repli ; il doit appeler `release` au moment où le matériau cesse effectivement d'utiliser la page.
- Pas de compactage des slots à l'intérieur d'une page vivante.
- Pas de validation visuelle WebGL ni de mesure de mémoire réelle dans ce lot.

## Validation

Tests Node sans DOM/WebGL : éviction des pages inactives, protection des pages retenues, destruction des textures multi-couches, réutilisation d'index, éviction automatique à saturation et cohérence des compteurs.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-24.md -->

# Gobai Space — Surface Lot 24 : pont Atlas / GPU Memory Budget

## Objectif

Relier les pages du `SatelliteMultiLayerTextureAtlasManager` au `SatelliteGpuMemoryBudgetManager` afin que les allocations de pages soient comptabilisées, épinglées lorsqu'une tuile les utilise et évincées via une opération ciblée et sûre.

## Nouveaux éléments

- `SatelliteAtlasGpuBudgetBridge.js` : inscrit chaque page d'atlas dans le budget, calcule une estimation RGBA8, synchronise les références, épingle/désépingle les pages et délègue l'éviction à `atlas.evictPage(index, expectedPage)`.
- `SatelliteAtlasGpuBudgetBridge.test.js` : tests d'inscription, de protection des pages utilisées, d'éviction par budget et d'isolation par astre.
- `SatelliteMultiLayerTextureAtlasManager.getPageInfo()` : expose les informations nécessaires à l'adaptateur sans dépendre d'un rendu WebGL.
- `SatelliteMultiLayerTextureAtlasManager.evictPage()` : éviction ciblée, refusée si la page possède encore des références.
- `SatelliteTileAtlasPipeline` accepte maintenant `memoryBudgetBridge` et `bodyId`. Le pont reste optionnel ; le chemin classique reste inchangé sans ce paramètre.

## Règle d'isolation par astre

Une page d'atlas appartient à un seul `bodyId`. L'allocateur ne mélange donc pas les tuiles de plusieurs astres dans une même page. Cette contrainte permet d'attribuer la mémoire au bon budget et d'appliquer les états `ACTIVE`, `BACKGROUND` et `UNLOADED`.

Pour utiliser le pont, fournir `bodyId` lors de `enqueue()` ou lors de `SatelliteTileAtlasPipeline.attach()`. Une page sans propriétaire ne peut pas être inscrite dans un budget par astre.

## Cycle de vie

1. Le pipeline crée une entrée atlas.
2. `retainEntry(id)` retient l'entrée et synchronise l'inscription de sa page.
3. Une page avec références est épinglée dans le gestionnaire GPU.
4. `releaseEntry(id)` libère la référence puis désépingle la page si aucune tuile ne la référence.
5. Si le budget est dépassé, le gestionnaire appelle l'éviction ciblée ; l'atlas vérifie une seconde fois l'absence de références avant de détruire les textures.
6. `sync()` réconcilie les pages supprimées directement par le plafond interne de l'atlas.

## Estimation mémoire

Par défaut : `pageSize × pageSize × 4 octets × nombre de canaux`. Pour une page 2048² et quatre canaux RGBA8, cela représente 64 Mio, hors mipmaps, alignements et allocations internes du pilote. Le calcul reste une estimation, pas une mesure GPU réelle.

Un callback `bytesPerPage(info)` permet de remplacer cette estimation si les formats ou profondeurs de texture diffèrent.

## Limites

- Le pont n'est pas encore créé automatiquement par `SolarEngine` : il doit être instancié et injecté dans le pipeline.
- Le `bodyId` doit être transmis par l'appelant ; aucune déduction automatique à partir du nom de tuile n'est faite.
- Les pages restent comptées en RGBA8 par défaut, même si un canal utilise un autre format.
- Aucune mesure de VRAM réelle ni validation navigateur/WebGL n'a été effectuée.
- L'isolation par astre peut créer davantage de pages partiellement remplies ; c'est un compromis assumé pour garantir une attribution mémoire fiable.

## Validation

Les tests Node couvrent l'inscription, le comptage, le pin/unpin, la protection des pages référencées, l'éviction ciblée, la priorité d'état et l'intégration au pipeline opt-in. Le rendu GPU réel et le build Vite restent à valider dans l'environnement du projet avec ses dépendances installées.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-25.md -->

# Lot 25 — Orchestration centrale du budget GPU

## Objectif

Raccorder le budget GPU des surfaces au cycle de vie de `SolarEngine` et aux décisions de `PerivolumeManager`, tout en gardant les pipelines d'atlas opt-in. Le moteur central possède l'orchestrateur et le budget ; les atlas conservent la propriété de leurs pages et textures.

## Architecture livrée

- `SatelliteGpuBudgetOrchestrator.js` crée ou reçoit un `SatelliteGpuMemoryBudgetManager`.
- `SolarEngine.initCoreOrchestration()` crée l'orchestrateur avec un budget global initial de 512 Mio et un budget par astre de 256 Mio.
- `SolarEngine.updateCoreOrchestration()` transmet les décisions `ACTIVE`, `BACKGROUND` et `UNLOADED` à l'orchestrateur. Le budget est réévalué lorsque les états de périvolume changent ; les allocations et modifications de plafonds déclenchent aussi leur propre contrôle. Cela évite de parcourir toutes les ressources à chaque frame lorsque la situation est stable.
- `SolarEngine.getSurfaceGpuBudgetManager()` expose le gestionnaire afin de construire des `SatelliteAtlasGpuBudgetBridge` compatibles.
- `SolarEngine.registerSurfaceAtlasBudgetBridge(bridge)` enregistre explicitement un bridge et renvoie une fonction de désinscription. La désinscription appelle `bridge.dispose()` ; l'atlas reste la propriété de son créateur.
- `setSurfaceGpuGlobalBudget(bytes)` et `setSurfaceGpuBodyBudget(bodyId, bytes)` permettent d'ajuster les plafonds.
- `getCoreDiagnostics()` expose `gpuMemoryBudget` : budget global, octets comptabilisés, ressources épinglées, état par astre, bridges et dernières évictions.

## Cycle de destruction

Les gestionnaires de tuiles sont détruits avant l'orchestrateur GPU. Cet ordre est important : les pipelines peuvent encore libérer des références d'atlas pendant `tiles.dispose()`. L'orchestrateur détruit ensuite les bridges, qui retirent leurs inscriptions du budget sans détruire les atlas externes.

Le bridge d'atlas supprime également son entrée locale lorsqu'un callback d'éviction détruit effectivement une page, afin d'éviter de conserver une référence de suivi périmée.

## Utilisation future d'un pipeline atlas

```js
const budgetManager = solarEngine.getSurfaceGpuBudgetManager();
const bridge = new SatelliteAtlasGpuBudgetBridge({
  atlas,
  budgetManager,
});
const unregister = solarEngine.registerSurfaceAtlasBudgetBridge(bridge);

// À la fermeture du propriétaire du pipeline :
unregister();
```

Le code ci-dessus est le contrat d'intégration. Le lot 25 ne crée pas lui-même d'atlas de production et ne passe pas automatiquement `surfaceAtlasPipeline` aux `TileLayer` existants. L'activation de l'atlas reste donc expérimentale et explicite.

## Limites et validation

- Les valeurs sont des estimations logiques, pas une mesure physique du GPU navigateur.
- Aucun atlas n'est créé automatiquement par `SolarEngine` dans ce lot.
- Les budgets par astre ne s'appliquent aux pages atlas que lorsqu'un bridge correspondant est enregistré.
- Le build Vite et la validation WebGL nécessitent l'installation des dépendances et un navigateur ; ils ne sont pas remplacés par les tests Node.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-26.md -->

# Lot 26 — Raccordement expérimental des atlas à TileLayer

## Portée

Le pipeline atlas couleur est maintenant instancié par `SolarEngine` pour la Terre et la Lune. Le calcul des UV corrige aussi la conversion des coordonnées Canvas (origine haut-gauche) vers les UV WebGL (v=1 au nord), en cohérence avec `tileGeometry.jsx` et `flipY=true`. Chaque astre dispose de son propre `SatelliteMultiLayerTextureAtlasManager` (canal `color` uniquement), de son `SatelliteAtlasGpuBudgetBridge` et de son `SatelliteTileAtlasPipeline`. `TileManager` transmet le pipeline et `bodyId` à `TileLayer`; les tuiles installées peuvent ainsi remplacer leur uniform `map` et `baseRect` par la page atlas.

## Sécurité / repli

- L'activation est limitée à `earth` et `moon`.
- Si Canvas, atlas ou budget ne peuvent pas être initialisés, le chargement historique reste actif.
- L'altitude, les normales, les lumières nocturnes et les overlays ne sont pas migrés.
- Les textures source historiques restent libérées par le cycle de vie normal de `TileLayer`.
- Les tuiles libèrent leur référence atlas avant la destruction des pages.
- Les atlas sont détruits après les `TileManager`, avant le budget central.

## Mémoire

Une page 2048² RGBA8 représente 16 Mio sans mipmaps. Comme le canal couleur active une chaîne mipmap complète, le pont budgète environ 21,33 Mio par page (facteur 4/3). Il s’agit d’une estimation, pas d’une mesure GPU réelle. Le maximum local est de quatre pages par astre; le budget central peut évincer les pages inactives.

## Diagnostics

`SolarEngine.getCoreDiagnostics().surfaceAtlas` expose, par astre, le nombre de pages, les entrées, les références, l'estimation mémoire et les statistiques du bridge.

## Validation à effectuer dans le navigateur

Le pipeline est désormais instancié automatiquement sur Terre et Lune, mais le build Vite, le rendu visuel, l'orientation UV, le comportement mipmap et les gains de mémoire/performance doivent encore être mesurés dans un navigateur WebGL réel. Le fallback classique doit être comparé avant activation de tout autre canal.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-27.md -->

# Gobai Space — Lot 27 : validation structurelle et diagnostics de surface atlas

## Objectif

Ajouter une instrumentation vérifiable au pipeline expérimental Terre/Lune avant de conclure à un gain visuel ou de performance. Le lot mesure les attaches, replis, concordances d'UV et métriques de rendu déjà fournies par `PerfProbe`.

## Modules

- `frontend/src/moteur/core/SatelliteSurfaceAtlasDiagnostics.js`
  - `validateSatelliteAtlasTileBinding(entry, uniforms)` vérifie que l'entrée est prête, que `uniforms.map` référence la texture couleur de l'atlas, que `baseRect` correspond au rectangle UV et que celui-ci reste dans `[0, 1]`.
  - `SatelliteSurfaceAtlasDiagnostics` comptabilise les attaches, replis, libérations et validations par astre.
  - Les échantillons `PerfProbe` (`cpuMs`, `gpuMs`, appels, triangles, textures, géométries) sont conservés dans une fenêtre bornée.
  - `compareModes()` permet de comparer deux séries seulement si un appelant les a explicitement étiquetées avec deux modes distincts.
- `SatelliteTileAtlasPipeline.js` transmet les résultats d'attache et de libération à l'instrumentation et vérifie la liaison après le binding.
- `engine.jsx` partage une instance de diagnostics entre les pipelines Terre/Lune et y enregistre les mesures de scène publiées par `PerfProbe`.
- `getCoreDiagnostics()` expose `surfaceAtlasValidation`.

## Ce que les mesures permettent

- Détecter un uniforme `map` qui ne référence pas la texture atlas attendue.
- Détecter un rectangle UV incohérent ou hors des limites de la page.
- Quantifier les attaches réussies et les replis par cause et par astre.
- Consulter les métriques globales de scène et comparer des séries étiquetées explicitement.

## Limites et interprétation

- Cette validation est structurelle : elle ne compare pas les pixels rendus, les coutures visibles, le filtrage réel ou les couleurs à l'écran.
- Les mesures `PerfProbe` et `renderer.info` concernent la scène entière ; elles ne peuvent pas être attribuées exclusivement à la Terre ou à la Lune.
- Le moteur ne bascule pas automatiquement entre un rendu classique et un rendu atlas. Il n'existe donc pas encore de benchmark A/B automatique.
- `gpuMs` reste `null` si le navigateur ne fournit pas l'extension de chronométrage GPU.
- Les compteurs `renderer.info.memory.textures` et les octets estimés des atlas ne sont pas une mesure directe de la mémoire physique GPU.
- Le rendu WebGL doit encore être contrôlé dans un navigateur avec des vues rapprochées, des transitions de zoom et des captures comparatives.

## Validation exécutée

Les tests Node couvrent les contrôles UV, la référence de texture, les compteurs, les replis, les fenêtres bornées et les comparaisons de séries. Ils ne remplacent pas un test visuel navigateur.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-28.md -->

# Lot 28 — Bascule A/B classique / atlas

## Objectif

Comparer à chaud le rendu classique de `TileLayer` et le rendu atlas couleur sur les mêmes tuiles, sans reconstruire la scène ni re-télécharger les images.

## Modifications

- `SatelliteTileAtlasPipeline` conserve, pour chaque tuile raccordée, la texture classique originale et son rectangle `baseRect`.
- `setMode('classic')` restaure ces uniforms, mais conserve les références logiques atlas pour permettre un retour immédiat.
- `setMode('atlas')` rebranche les entrées atlas encore disponibles et valide la correspondance texture/UV.
- Les tuiles ajoutées pendant le mode classique sont également préparées dans l'atlas ; elles peuvent être activées sans rechargement.
- `release()` et `dispose()` restaurent d'abord les uniforms classiques, puis relâchent les références atlas.
- `SatelliteSurfaceAtlasDiagnostics.clearFrameSamples()` réinitialise uniquement la fenêtre de mesures, sans effacer les compteurs d'attaches.
- `SolarEngine` expose `setSurfaceAtlasMode`, `resetSurfaceAtlasBenchmark` et `getSurfaceAtlasComparison`.
- Les échantillons de frame sont étiquetés `classic-reference`, `atlas-active` ou `mixed-scene-atlas-experimental`.

## API d'expérimentation

```js
// Basculer tous les corps raccordés vers le rendu classique.
solarEngine.setSurfaceAtlasMode('classic');

// Basculer tous les corps raccordés vers l'atlas.
solarEngine.setSurfaceAtlasMode('atlas');

// Basculer un seul corps (les mesures deviennent globales/mixed si l'autre reste différent).
solarEngine.setSurfaceAtlasMode('classic', 'earth');

// Effacer la fenêtre de mesures avant une séquence A/B.
solarEngine.resetSurfaceAtlasBenchmark();

// Lire la comparaison des fenêtres enregistrées.
solarEngine.getSurfaceAtlasComparison();
```

## Protocole A/B manuel

1. Ouvrir la même scène et attendre que les tuiles Terre/Lune soient stables.
2. Appeler `resetSurfaceAtlasBenchmark()`.
3. Appeler `setSurfaceAtlasMode('classic')`, attendre la stabilisation, puis laisser tourner au moins 10 à 20 secondes.
4. Appeler `setSurfaceAtlasMode('atlas')`, attendre la stabilisation, puis laisser tourner la même durée.
5. Lire `getSurfaceAtlasComparison()` ou `getCoreDiagnostics().surfaceAtlasComparison`.
6. Refaire la séquence plusieurs fois, dans l'ordre inverse également, pour réduire le biais lié au démarrage et à la chauffe.
7. Capturer manuellement les mêmes vues/cadrages en mode classique et atlas pour contrôler coutures, orientation UV et mipmaps.

## Interprétation et limites

- `PerfProbe` et `renderer.info` mesurent toujours la scène entière. Les différences A/B ne sont donc pas attribuables exclusivement à la Terre ou à la Lune.
- Le mode classique restaure l'affichage d'origine, mais garde volontairement les pages atlas retenues en mémoire pour permettre le retour instantané. Le nombre de textures GPU n'est donc pas une comparaison mémoire « à froid ».
- Pour mesurer la mémoire réellement libérée, il faut comparer deux sessions séparées (ou redémarrer le moteur entre les configurations), pas seulement basculer le mode à chaud.
- Les captures d'écran ne sont pas générées automatiquement ; le contrôle visuel reste manuel.
- Le pipeline concerne toujours uniquement la couche couleur. Altitude, normales et lumières nocturnes conservent leurs chargeurs existants.
- Ce lot ne revendique aucun gain de FPS, de draw calls ou de mémoire avant mesure dans un navigateur réel.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-29.md -->

# Surface — Lot 29 : validation visuelle A/B

## Objectif

Ajouter un banc de comparaison visuelle indépendant du navigateur et du moteur de capture. L'application fournit les captures RGBA et les callbacks de cadrage/mode ; le module calcule les différences et produit un rapport exploitable.

## API

- `compareSatelliteAtlasVisualFrames(classic, atlas, options)` compare deux buffers RGBA de mêmes dimensions : différence absolue moyenne, différences par canal, maximum et ratio de pixels modifiés.
- `analyzeSatelliteAtlasTileBoundaries(frame, { vertical, horizontal })` mesure les sauts de luminance de part et d'autre des frontières connues.
- `SatelliteAtlasVisualValidationRunner` exécute les scénarios successivement en classique puis atlas, restaure le cadrage si `setView` retourne une fonction, et restaure toujours le mode initial.
- `serializeSatelliteAtlasVisualReport(report)` exporte le rapport en JSON.

## Utilisation attendue

Le consommateur fournit des scénarios avec `bodyId` et `viewKey`, puis implémente :

1. `getMode()` pour lire le mode initial ;
2. `setMode(mode, bodyId)` pour basculer uniquement l'astre visé ;
3. `setView(scenario)` pour fixer caméra, temps orbital, éclairage et état des tuiles ; peut retourner une fonction de restauration ;
4. `captureFrame({ mode, bodyId, viewKey })` pour retourner `{ width, height, data }`, avec `data` contenant exactement `width * height * 4` valeurs RGBA.

Exemple de limites : `maxMeanAbsoluteDifference: 1.5` et `maxChangedPixelRatio: 0.01`. Ces seuils sont des paramètres de départ, pas des seuils scientifiques universels ; ils doivent être calibrés sur des captures déterministes.

## Interprétation des coutures

La mesure aux frontières est descriptive. Une forte différence de luminance entre deux pixels adjacents n'est pas nécessairement une couture : elle peut correspondre à une vraie limite géographique. Le rapport doit comparer les mêmes coordonnées sur les captures classique et atlas. Le delta atlas moins classique est plus pertinent qu'une valeur absolue isolée.

## Limites

- Aucun navigateur n'est lancé et aucune capture GPU n'est effectuée par ce module.
- Le cadrage, le temps, les lumières, le chargement des tuiles et l'attente de stabilité sont à la charge de `setView`.
- Les captures sont séquentielles ; une scène animée non figée peut produire des différences non liées à l'atlas.
- Le module n'exporte pas de PNG et ne réalise pas de comparaison perceptuelle ; il compare les valeurs RGBA brutes.
- Aucune amélioration de FPS ou de qualité n'est revendiquée sans exécution réelle dans le navigateur.

---

<!-- Fichier d'origine : docs/architecture/SURFACE-LOT-30.md -->

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

---

<!-- Fichier d'origine : docs/architecture/ASTROMETRIC-ENGINE-LOT-33.md -->

# Lot 33 — Astrometric Engine

## Objectif

Propager les coordonnées ICRS d'un objet stellaire depuis son époque de référence vers une époque cible, en exploitant les paramètres astrométriques normalisés du lot 31.

## API

- `propagateAstrometricCoordinates({ coordinates, astrometry }, targetEpoch)` : calcule une position propagée.
- `propagateAstrometricRecord(record, targetEpoch)` : conserve l'enregistrement et remplace les coordonnées par celles de l'époque cible, avec un bloc `propagation` explicatif.
- `propagateAstrometricBatch(records, targetEpoch)` : applique le calcul à un tableau.

Les époques sont des années juliennes décimales. Les coordonnées doivent être ICRS en degrés ; les mouvements propres sont en mas/an, la parallaxe en mas et la vitesse radiale en km/s.

## Méthodes numériques

Lorsque la parallaxe est strictement positive, le moteur construit une position cartésienne en parsecs et une vitesse composée des composantes tangentielle est/nord et radiale. Il propage la position en ligne droite sur l'intervalle d'époque, puis reconvertit le vecteur en RA/Dec. Cette approche gère naturellement le passage RA=0/360 et l'effet perspectif de la vitesse radiale.

Lorsque la parallaxe est absente, nulle ou négative, le moteur utilise une propagation tangentielle sur la sphère. La distance et la vitesse radiale ne sont alors pas estimables ; un avertissement explicite est renvoyé.

## Limites scientifiques

- Mouvement rectiligne uniforme : pas d'accélération, d'orbite binaire, de lentille ou de mouvement galactique modélisé.
- Pas de propagation de covariance ni d'incertitudes : les erreurs astrométriques ne sont pas fournies par le normaliseur actuel.
- Pas de précession/nutation, aberration annuelle, parallaxe topocentrique ou transformation vers un repère apparent ; la sortie reste ICRS.
- Les valeurs manquantes de mouvement propre sont traitées comme une composante nulle pour le calcul, mais leur absence reste signalée dans `used`.
- La propagation est une extrapolation cinématique des paramètres d'entrée, pas une éphéméride de précision.

## Tests

Les tests couvrent l'identité à époque constante, les deux composantes de mouvement propre, le franchissement RA 0/360, la vitesse radiale, l'absence de parallaxe, la conservation des métadonnées et les entrées invalides.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-34-EXOPLANET-ORBITAL-ENGINE.md -->

# Lot 34 — Exoplanet Orbital Engine

## Objectif

Calculer l'état képlérien d'une exoplanète à une date julienne donnée, dans un repère cartésien centré sur son étoile hôte. Le module est indépendant du rendu Three.js et du cycle de vie de `SolarEngine`.

## API

```js
import {
  solveKeplerEquation,
  calculateExoplanetPosition,
  calculateExoplanetRecordPosition,
  calculateExoplanetBatch,
} from './moteur/data/astronomy/index.js';

const state = calculateExoplanetPosition({
  periodDays: 11.186,
  semiMajorAxisAu: 0.0485,
  eccentricity: 0.04,
  inclinationDeg: 89,
  longitudeAscendingNodeDeg: 0,
  argumentOfPeriastronDeg: 120,
  periastronEpochJulianDate: 2459000.5,
}, 2460000.5);
```

`position` est exprimée en AU et `velocity` en AU/jour. Les angles d'orientation suivent la convention Ω (nœud ascendant), i (inclinaison), ω (argument du périastre). Les coordonnées sont centrées sur l'étoile hôte.

## Calculs

1. Détermination de l'anomalie moyenne à partir d'un temps de passage au périastre explicitement exprimé en JD, ou d'une anomalie moyenne associée à une époque JD.
2. Résolution de `E - e sin(E) = M` par Newton avec repli par dichotomie.
3. Calcul de la position et de la vitesse dans le plan orbital.
4. Rotation vers le repère de référence par Ω, i et ω.
5. Demi-grand axe fourni directement ou dérivé de la période et de la masse stellaire avec la troisième loi de Kepler (masse planétaire négligée).

## Données NASA et prudence sur les époques

Le normaliseur NASA expose `pl_orblper` comme `argumentOfPeriastronDeg` (convention publiée conservée comme « as-reported ») et `pl_orbtper` comme `timeOfPeriastronRawDays`. La documentation NASA décrit `pl_orblper` comme l'argument du périastre, avec des conventions de publication pouvant différer entre l'orbite de la planète et le mouvement réflexe de l'étoile ; elle décrit `pl_orbtper` comme un temps de périastre en jours juliens. Le code conserve ce temps brut et ne le convertit **pas automatiquement** en `periastronEpochJulianDate` : l'appelant doit valider la convention de temps (JD/BJD et référence utilisée), puis fournir `periastronEpochJulianDate` ou `meanAnomalyAtEpochDeg` avec `epochJulianDate`. Le nœud ascendant Ω n'est pas fourni par cette sélection de colonnes et doit être fourni séparément ou rester à zéro avec avertissement.

Le catalogue NASA ne fournit pas toujours tous les éléments d'orientation ou la phase orbitale. Les angles manquants sont provisoirement mis à zéro et accompagnés d'avertissements ; cela permet un aperçu géométrique, pas une orientation orbitale scientifiquement déterminée.

## Limites

- Orbites elliptiques uniquement (`0 <= e < 1`). Les trajectoires paraboliques et hyperboliques ne sont pas prises en charge.
- Pas d'intégration N-corps, de perturbations, de précession, de marées ou de résonances.
- Le calcul est képlérien à deux corps ; la masse de la planète est négligée dans la dérivation de `a`.
- Le repère de sortie est un repère orbital de référence local, pas automatiquement ICRS, équatorial apparent ou le repère monde Three.js.
- Pas encore de liaison au `Exoplanet Engine` (lot 36) ni au `Star Engine` (lot 35).
- Les tests sont analytiques/synthétiques ; aucune position de catalogue n'a été validée contre une éphéméride externe.

---

<!-- Fichier d'origine : docs/architecture/STAR-SYSTEM-ENGINE-LOT-35.md -->

# Lot 35 — Star System Engine Integration

## Objectif

Assembler les enregistrements Gaia DR3, SIMBAD et NASA Exoplanet Archive dans un modèle de système stellaire exploitable par les moteurs de rendu Gobai Space, sans confondre rapprochement probable et identité vérifiée.

## Nouveau module

`frontend/src/moteur/engine/star/StarSystemEngine.js`

Exports :

- `buildStarSystems(records, options)` : assemblage déterministe et sans accès réseau.
- `StarSystemEngine` : façade sur `AstronomicalCatalogService`.
- `createStarSystemEngine(options)` : factory.

## Règles d'identité et de rattachement

1. Deux enregistrements stellaires ne sont réunis automatiquement que si leur identifiant Gaia DR3 est strictement identique.
2. Une proximité de coordonnées ICRS reste un candidat de revue ; elle ne fusionne pas les étoiles.
3. Une exoplanète est attachée automatiquement à son étoile uniquement si `host.gaiaDr3Id` correspond à un identifiant Gaia présent.
4. Une correspondance par nom d'hôte reste dans `candidatePlanetHosts` et n'est jamais attachée automatiquement.
5. Les enregistrements et leur provenance sont conservés dans le système résultant.

## Propagation astrométrique

Si `targetEpochJulianYear` est fourni et que l'enregistrement Gaia possède une époque, des coordonnées et des données astrométriques, le moteur utilise `propagateAstrometricRecord` du lot 33. L'époque cible est une année julienne décimale, pas une date JD.

## Orbites d'exoplanètes

Si `targetJulianDate` est fourni, le moteur appelle le lot 34 pour chaque planète rattachée. Les phases orbitales manquantes ne sont pas inventées : l'état devient `unavailable` avec le motif d'indisponibilité. Les paramètres de phase validés peuvent être fournis dans `orbitOverridesByPlanetId`.

## Exemple

```js
import { createAstronomicalCatalogService } from './data/astronomy/index.js';
import { createStarSystemEngine } from './engine/star/StarSystemEngine.js';

const catalogService = createAstronomicalCatalogService();
const starEngine = createStarSystemEngine({ catalogService });
const systems = await starEngine.resolveByName('Proxima Centauri', {
  targetEpochJulianYear: 2026.0,
  targetJulianDate: 2461350.5,
});
```

Les appels réseau utilisent les endpoints TAP déjà définis dans le lot 31. Les contraintes CORS, disponibilité des fournisseurs, limites TAP et besoins éventuels d'un proxy restent applicables.

## Limites

- Ce lot ne crée pas de coordonnées mondiales 3D pour le rendu : il conserve ICRS et les positions orbitales relatives à l'étoile.
- Il ne transforme pas les repères ICRS/galactiques/orbitaux vers le repère Three.js de la scène.
- Les rapprochements SIMBAD/Gaia fondés uniquement sur les coordonnées demandent toujours une validation externe.
- Les phases et époques NASA restent conditionnées par leur disponibilité et leurs conventions temporelles.
- Pas de dynamique N-corps, perturbations, précession, incertitudes ou propagation de covariance.
- Le StarSystemEngine est une nouvelle couche d'intégration dans `moteur/engine/star` ; il ne prétend pas remplacer un éventuel moteur de rendu stellaire spécialisé.

---

<!-- Fichier d'origine : docs/architecture/EXOPLANET-SCENE-ENGINE-LOT-36.md -->

# Lot 36 — Exoplanet Scene Engine

## Objectif

Transformer le modèle de systèmes stellaires du lot 35 en un modèle de scène puis en objets Three.js : étoile hôte, planètes, positions et courbes orbitales.

## Modules

- `frontend/src/moteur/engine/exoplanets/ExoplanetSceneEngine.js`
  - `buildExoplanetSceneModel(system, options)` : modèle indépendant du renderer.
  - `sampleOrbit(orbit, segments, scale)` : échantillonnage d'une ellipse képlérienne.
  - `orbitalReferenceToScene(position)` : conversion d'axes vers la convention Three.js Gobai `(x, z, -y)`.
  - `createExoplanetSystemGroup(THREE, model, options)` : construction d'un groupe Three.js, étoile, sphères planétaires et lignes d'orbite.
- `ExoplanetSceneEngine.test.js` : tests du modèle, des axes, des orbites et des cas incomplets.

## Contrat scientifique et repères

Les positions orbitales sont exprimées en AU dans un repère cartésien local `ORBITAL-REFERENCE` centré sur l'étoile hôte. Le mapping `(x,y,z) -> (x,z,-y)` ne fait que réordonner les axes pour la convention de scène Gobai ; ce n'est pas une transformation vers ICRS, J2000 ou le repère galactique. Le modèle garde cette distinction dans son champ `frame`.

Les trajectoires sont des ellipses idéales calculées à partir des éléments disponibles. Une orbite n'est pas tracée si son demi-grand axe ou son excentricité est invalide. Une position n'est pas inventée si aucune phase orbitale exploitable n'est disponible. Les tailles des sphères sont des rayons visuels compressés, pas des distances ou rayons physiques à l'échelle.

## Intégration

Le constructeur Three.js reçoit `THREE` en dépendance afin de rester testable sans contexte WebGL. Il retourne un `THREE.Group` autonome, avec `userData.updateFromModel(nextModel)` pour actualiser les positions, et `userData.dispose()` pour libérer les ressources détenues. Le groupe n'est pas encore injecté dans la boucle centrale `engine.jsx` ou `SolarScene.jsx` : le lot fournit la brique de rendu, pas une activation globale de l'interface.

## Limites

- Pas de transformation ICRS vers le repère orbital local : les éléments orbitaux sont locaux à l'étoile.
- Pas de calcul de barycentre étoile-planète ni de perturbations multi-corps.
- Pas de texture réaliste, atmosphère, éclairage physique, transit ou occultation.
- Pas de validation navigateur/WebGL dans cet environnement.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-37-POSTGRES-PERSISTENCE.md -->

# Lot 37 — PostgreSQL Astronomical Persistence Engine

## Objectif

Définir le schéma PostgreSQL et l'adaptateur de persistance des objets produits par `StarSystemEngine` (lots 31–35) et des échantillons de positions (lots 33–36). Le frontend Gobai reste un site statique : il ne doit jamais recevoir de chaîne de connexion PostgreSQL ni accéder directement à la base. Le repository est destiné à être instancié côté serveur, dans une API backend sécurisée.

## Schéma

Migration `backend/database/migrations/001_astronomical_catalog.sql` :

- `astronomical_stars` : identité canonique, identifiant Gaia DR3, astrométrie et provenance.
- `exoplanets` : paramètres physiques et orbitaux, rattachement hôte seulement si l'identifiant Gaia est exact.
- `astronomical_source_records` : conservation des réponses brutes Gaia / SIMBAD / NASA avec provenance et run de synchronisation.
- `astronomical_position_samples` : positions/velocités datées, repère et unités explicites.
- `astronomy_sync_runs` : suivi des synchronisations, compteurs et erreurs.

Index principaux : identifiants uniques, noms normalisés, identifiants hôtes Gaia, références étoiles et temps/repère des échantillons.

## API

`frontend/src/moteur/data/astronomy/persistence/` fournit :

- `mapStarSystemForPersistence(system)` : projection validée du modèle en lignes métier.
- `mapPositionSample(sample)` : validation d'un échantillon avec époque, repère et unités.
- `PostgresAstronomicalRepository` : repository utilisant un pool compatible `node-postgres`, injecté par l'appelant.
- `saveStarSystem()` : transaction SQL atomique avec upsert étoile + planètes.
- `saveSourceRecord()`, `savePositionSample()`, `startSyncRun()`, `finishSyncRun()`.

Aucune dépendance `pg` n'est ajoutée au frontend. Le pool doit être fourni par le backend; aucune connexion réelle n'est configurée dans ce lot.

## Règles scientifiques et d'intégrité

- Les identifiants Gaia DR3 sont conservés en `NUMERIC(20,0)` côté SQL afin d'éviter les pertes de précision JavaScript.
- Les positions gardent leur époque, leur repère et leurs unités. ICRS, repère orbital et repère de scène ne sont pas interchangeables.
- Les données sources et leur provenance sont conservées en JSONB.
- Une planète n'est rattachée à l'étoile persistée que si le Gaia DR3 de l'hôte correspond exactement à celui de l'étoile. Sinon `host_star_id` reste NULL.
- Les excentricités persistées sont bornées aux orbites elliptiques prises en charge par le moteur courant.

## Déploiement

1. Appliquer la migration depuis l'environnement backend avec `psql "$DATABASE_URL" -f backend/database/migrations/001_astronomical_catalog.sql`.
2. Créer un pool PostgreSQL côté serveur et injecter le pool dans `createPostgresAstronomicalRepository({ pool })`.
3. Exposer des routes backend authentifiées et limitées en débit; ne jamais exposer `DATABASE_URL` au bundle Vite.
4. Ajouter ensuite un job de synchronisation incrémentale et une politique de rétention des échantillons si le volume l'exige.

## Hors périmètre de ce lot

- Pas de connexion à une base Render réelle, ni de secret ou migration exécutée.
- Pas de job planifié ni de route HTTP backend ajoutée, car le dépôt courant est un frontend statique sans backend applicatif.
- Pas de partitionnement temporel prématuré : à envisager lorsque les volumes réels des `astronomical_position_samples` le justifieront.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-38-SCIENTIFIC-END-TO-END-VALIDATION.md -->

# Lot 38 — Validation scientifique et end-to-end astronomique

## Objectif

Ajouter une validation déterministe et hors ligne du pipeline astronomique Gobai Space : catalogue normalisé, résolution d'identité, propagation astrométrique, calcul orbital, modèle de scène et mapping PostgreSQL.

## Module

`frontend/src/moteur/data/astronomy/validation/AstronomicalValidationSuite.js`

API publique :

- `validateAstronomicalPipeline(records, options)` retourne un rapport structuré sans interrompre le traitement.
- `assertAstronomicalPipelineValid(records, options)` retourne le rapport ou lève une erreur portant `error.report` en cas d'échec.

## Contrôles exécutés

1. Assemblage du catalogue et des systèmes stellaires.
2. Rattachement automatique d'une exoplanète uniquement par identifiant Gaia DR3 exact ; les correspondances de nom ou de coordonnées restent des candidates.
3. Domaine des coordonnées ICRS : ascension droite `[0, 360[` et déclinaison `[-90, +90]`.
4. Solutions képlériennes : convergence, position 3D finie et résidu sous le seuil configuré (1e-9 par défaut).
5. Génération des modèles de scène et finitude des positions.
6. Mapping des systèmes vers le modèle de persistance.
7. Contrat d'enregistrement d'une position dans le repère `GOBAI-SCENE`.
8. Signalement explicite des validations réseau et PostgreSQL non réalisées.

## Conventions et limites

- Le repère orbital de référence n'est pas le repère ICRS.
- La projection scène du moteur exoplanète utilise `(x, y, z) -> (x, z, -y)` et n'est pas une transformation astronomique vers ICRS.
- Les positions de scène sont exprimées en unités de scène, pas en AU.
- Les tests sont synthétiques et déterministes ; ils ne constituent pas une validation avec les services Gaia, SIMBAD ou NASA en production.
- Aucune connexion PostgreSQL n'est ouverte et aucune migration n'est appliquée.
- Le rendu WebGL réel et les performances navigateur doivent être vérifiés dans l'environnement de déploiement.

## Correction de contrat

Le mapper de positions acceptait par erreur `GOBAl-SCENE` (lettre « l ») alors que la migration SQL attend `GOBAI-SCENE` (lettre « I »). Le lot 38 aligne le mapper sur la contrainte SQL et ajoute un test de contrat.

## Commandes de validation

```bash
node --test $(find src -name '*.test.js' -print)
node scripts/verifie-imports.mjs src
```

---

<!-- Fichier d'origine : docs/architecture/LOT-39-INTERSTELLAR-SYSTEMS-AND-PERIVOLUME-AXIOMS.md -->

# Lot 39 — Systèmes exoplanétaires et axiomes de périvolume

## Objectif

Étendre Gobai Space après les lots 1–38 avec une découverte de systèmes exoplanétaires par cône de recherche céleste, une préparation directe des modèles de scène et une politique explicite des quatre axiomes de périvolume.

## Sources astronomiques

- ESA Gaia DR3 TAP : astrométrie, parallaxe, mouvements propres, vitesse radiale et recherche de sources dans un cône ICRS.
- CDS SIMBAD TAP : résolution des noms et enrichissement par classification ; recherche spatiale pour relier une source Gaia à un nom SIMBAD candidat.
- NASA Exoplanet Archive TAP / `pscomppars` : planètes confirmées et paramètres de leur système hôte.

La jointure automatique planète-étoile reste conditionnée à l'identifiant Gaia DR3 exact. Une correspondance SIMBAD par coordonnées est une candidate, pas une preuve d'identité.

## API catalogue ajoutée

`AstronomicalCatalogService` expose désormais :

- `searchSimbadCone({ raDeg, decDeg, radiusDeg, limit })`
- `findExoplanetsByGaiaHostId(gaiaSourceId, options)`
- `searchExoplanetSystemsCone({ raDeg, decDeg, radiusDeg, limit })`
- `listKnownExoplanets(options)`

`AstronomicalSystemExplorer` orchestre Gaia + NASA dans un cône ICRS, enrichit via SIMBAD lorsque demandé, assemble les systèmes et produit les modèles de scène Three.js.

## Axiomes de périvolume

| Niveau | Relation | Effet sur le partenaire quand l'un est ACTIVE |
|---|---|---|
| Système Terre / Système Soleil | interne | partenaire plafonné à BACKGROUND |
| Système Soleil / Proxima Centauri | externe | partenaire UNLOADED |
| Terre / Lune | interne | partenaire plafonné à BACKGROUND |
| Terre / Mercure | externe | partenaire UNLOADED |

Les IDs sont configurables avec `createGobaiPerivolumeAxioms({ ids })`, afin de les mapper sur les identifiants réels de l'application. Si les deux volumes sont actifs simultanément, la priorité revient au plus proche en distance normalisée `distance / radius` ; en cas d’égalité, le premier membre déclaré dans `members` gagne.

Quand la caméra quitte les deux périvolumes, le système revient aux états géométriques ordinaires. Les règles ne détruisent pas les données astronomiques : elles contrôlent les profils de rendu et de mise à jour exposés par `SystemManager`.

## Géométrie

Les fonctions `perivolumeCube`, `perivolumeBox`, `perivolumeSphere` et `perivolumeCylinder` calculent les aires de surface des frontières (unités²), conformément aux formules fournies. `verifyIsoperimetricInequality` vérifie `A³ >= 36πV²`. `containsPerivolumePoint` fournit le test de point dans une zone 3D.

L'aire de surface n'est pas utilisée comme rayon de chargement : la géométrie de proximité et la surface frontière sont deux notions séparées.

## Utilisation

```js
import { createAstronomicalCatalogService, createAstronomicalSystemExplorer } from './moteur/data/astronomy/index.js';
import { SystemManager, createGobaiPerivolumeAxioms } from './moteur/core/index.js';

const catalog = createAstronomicalCatalogService();
const explorer = createAstronomicalSystemExplorer({ catalogService: catalog });
const result = await explorer.searchSystemsInCone({ raDeg: 217.4, decDeg: -62.6, radiusDeg: 2, limit: 100 });

// Pour chaque système : explorer.buildScene(system, { auToSceneUnits: 100 })
// Puis explorer.createThreeGroup(THREE, system, options) pour créer le groupe Three.js.

const systemManager = new SystemManager({ registry, perivolumeManager, axioms: createGobaiPerivolumeAxioms({
  earthSystem: 'ID_REEL_SYSTEME_TERRE', solarSystem: 'ID_REEL_SYSTEME_SOLAIRE',
  proximaSystem: 'ID_REEL_PROXIMA', earth: 'ID_REEL_TERRE', moon: 'ID_REEL_LUNE', mercury: 'ID_REEL_MERCURE',
}) });
```

## Limites et intégration

- Les TAP sont interrogés directement depuis le client par le service existant ; CORS et disponibilité des fournisseurs doivent être testés dans le navigateur de production. Un proxy backend est préférable pour la résilience et le cache centralisé.
- La recherche NASA est limitée aux lignes `pscomppars` et donc aux paramètres composites publiés dans cette table ; elle ne représente pas tous les candidats non confirmés.
- Gaia DR3 n'est pas un catalogue d'exoplanètes : il sert à identifier et positionner les étoiles hôtes.
- La scène orbitale est un repère local de système, pas une transformation ICRS vers coordonnées globales de la galaxie.
- Les IDs canoniques d'axiomes sont des valeurs par défaut de configuration et doivent être mappés sur les IDs réels de Gobai.

## Raccordement au moteur de scène existant

`frontend/src/moteur/engine/engine.jsx` applique maintenant les états effectifs de `SystemManager` (et non uniquement les états géométriques bruts) pour la cadence des moteurs spécialisés et des tuiles.

- `system:earth` est centré sur la Terre ; son rayon couvre au minimum la distance Terre-Lune et le périvolume de la Lune.
- `system:solar` est centré sur le Soleil ; son rayon est calculé à partir de l'astre ciblé le plus éloigné enregistré dans le moteur.
- Les axiomes astres sont mappés sur les IDs de scène `earth`, `moon`, `mercury`.
- `registerExternalSystemPerivolume({ id: 'system:proxima-centauri', center, radius })` permet d'enregistrer un système externe uniquement après son placement dans le repère global de la scène ; `updateExternalSystemPerivolume` actualise son centre et `unregisterExternalSystemPerivolume` le retire.

Le groupe orbital retourné par `AstronomicalSystemExplorer` est local à son étoile hôte. Son origine doit être placée dans un repère global correctement transformé avant d'enregistrer le périvolume de Proxima. Aucune conversion ICRS vers la scène galactique n'est inventée dans ce lot.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-40-INTERSTELLAR-SCENE-RENDERER.md -->

# Lot 40 — Interstellar Scene Renderer

## But

Placer un système stellaire distant dans le repère global Gobai à partir de coordonnées ICRS et d'une distance mesurée. Le système planétaire conserve son repère orbital local et est placé comme enfant du groupe stellaire global.

## Transformation

1. RA/Dec ICRS + distance (parallaxe positive ou distance propagée) -> vecteur cartésien héliocentrique en parsecs.
2. Repère ICRS `(x,y,z)` -> axes scène Gobai `(x,z,-y)`.
3. Multiplication par `parsecToSceneUnits` et ajout de `origin`.

Valeur par défaut : 100 unités de scène par parsec. Cette valeur est une échelle de navigation configurable, pas une échelle physique certifiée de la scène existante. Il faut confirmer l'orientation et la position de l'origine solaire par rapport au repère de caméra avant de l'utiliser en production.

## API

- `icrsToHeliocentricParsecs()`
- `icrsParsecsToScene()`
- `buildInterstellarSystemModel()`
- `createInterstellarSystemGroup()`
- `InterstellarSceneRenderer.addSystem() / focusSystem() / removeSystem()`

## Limites

- Sans parallaxe positive ou distance propagée, le système est signalé `position-unavailable` et n'est pas placé arbitrairement.
- Le changement d'axes ne constitue pas une transformation ICRS vers ICRF/J2000, galactique ou une orientation caméra calibrée ; le repère reste explicitement ICRS.
- La navigation est exposée par contrôleur, mais le raccordement automatique à l'interface de navigation principale doit être fait par le composant appelant.

## Exemple d'intégration statique

```js
import * as THREE from 'three';
import { createAstronomicalCatalogService, createAstronomicalSystemExplorer,
  createInterstellarSceneRenderer } from './moteur/data/astronomy/index.js';

const explorer = createAstronomicalSystemExplorer({ catalogService: createAstronomicalCatalogService() });
const result = await explorer.resolveByName('Proxima Centauri', {
  targetEpochJulianYear: 2026,
  includeExoplanets: true,
});
const proxima = result.systems.find((item) => /proxima/i.test(item.star?.name || ''));
if (!proxima) throw new Error('Aucun système Proxima exploitable dans les résultats du catalogue.');
const renderer = createInterstellarSceneRenderer({ THREE, scene, camera, controls,
  origin: { x: 0, y: 0, z: 0 }, parsecToSceneUnits: 100 });
const entry = renderer.addSystem(proxima, { targetJulianDate: 2461350.5 });
renderer.focusSystem(entry.model.sourceSystemId);
```

Les identifiants Gaia doivent être disponibles pour un rattachement automatique strict des planètes à leur hôte. Si le fournisseur ne fournit pas de distance, aucun placement global n'est inventé.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-41-INTERSTELLAR-PERIVOLUME-COORDINATOR.md -->

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

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-42-MAIN-ENGINE-INTEGRATION.md -->

# Lot 42 — Intégration interstellaire dans le moteur principal

## Objectif

Raccorder les lots 40 et 41 au `SolarEngine` existant, sans ajouter de backend et sans remplacer la boucle de rendu Three.js.

## Intégration

- `SolarEngine.initInterstellarIntegration()` instancie le client Gaia/SIMBAD/NASA et `InterstellarSceneRenderer` sur la scène Three.js principale.
- `loadInterstellarSystemByName(name)` recherche un système depuis le navigateur, calcule son modèle astrométrique et le place dans le repère global.
- `registerInterstellarSystem(starSystem)` ajoute le groupe au graphe de scène, enregistre son périvolume et ajoute une cible caméra.
- `focusInterstellarSystem(id)` déplace la caméra avec le mécanisme de focus existant.
- `removeInterstellarSystem(id)` libère le groupe, retire le périvolume et retire la cible de navigation.
- `getInterstellarSystems()` expose l'état des systèmes déjà chargés.
- Les positions planétaires sont recalculées à l'époque julienne courante, au maximum une fois par seconde, uniquement lorsque le système est `ACTIVE`.

## Cohérence des unités

Le Système solaire utilise `AU_UNITS` unités de scène par unité astronomique. Le placement global utilise donc :

`parsecToSceneUnits = AU_UNITS × 206264.80624709636`

Cette échelle permet de placer Proxima à environ 1,3 parsec, dans la portée du plan lointain de la caméra logarithmique existante. Les orbites exoplanétaires sont également exprimées en unités astronomiques et emploient le même `AU_UNITS` pour conserver leur échelle physique relative au Système solaire.

## Origine flottante

Les positions orbitales utilisent `AU_UNITS` pour rester cohérentes avec les unités du Système solaire. La scène du Système solaire recentre ses objets autour de `SolarEngine.target`. Les groupes interstellaires sont donc repositionnés à chaque frame à `positionGlobale - target`. La position globale des systèmes et la caméra sont converties dans le même repère pour évaluer les périvolumes : `cameraGlobale = cameraLocale + target`.

## Périvolumes

- Proxima Centauri utilise l'identifiant canonique `system:proxima-centauri`, correspondant à l'axiome externe Soleil / Proxima.
- Le rayon par défaut couvre au minimum 10 UA et s'élargit pour couvrir les orbites connues.
- `ACTIVE` garde le groupe visible et prioritaire.
- `BACKGROUND` garde le groupe visible mais marque sa simulation comme suspendue.
- `UNLOADED` masque le groupe et marque sa simulation comme suspendue. Les ressources ne sont pas détruites automatiquement dans ce lot.

## Interface

Le catalogue des astres comporte une section « Systèmes extrasolaires » avec recherche par nom, chargement à la demande et commande « Voir ». La valeur initiale est Proxima Centauri.

## Limites

- Les requêtes publiques Gaia, SIMBAD et NASA partent directement du navigateur ; elles dépendent de la disponibilité réseau et des règles CORS des fournisseurs.
- La résolution du nom doit fournir une position astrométrique avec distance exploitable. Sinon le système n'est pas ajouté à la scène globale.
- Le rendu est visuel et à échelle physique cohérente pour les positions globales et les unités orbitales, mais les tailles de sphères restent des tailles visuelles.
- Le groupe distant est masqué en `UNLOADED`, mais la destruction/recréation GPU et l'annulation de requêtes en vol ne sont pas implémentées ici.
- Le build Vite et les appels réels aux fournisseurs doivent être exécutés dans l'environnement de déploiement.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-43-GPU-NETWORK-LIFECYCLE.md -->

# Lot 43 — GPU & Network Lifecycle Manager

## Objectif

Rendre effectifs les états `ACTIVE`, `BACKGROUND` et `UNLOADED` pour les systèmes stellaires externes, en particulier lors des transitions de périvolume pilotées par `SystemManager`.

## Gestion GPU

- `InterstellarResourceLifecycleManager` centralise les transitions de ressources par identifiant de système.
- En `UNLOADED`, le sous-groupe planétaire est retiré de la scène et ses géométries et matériaux sont détruits via les hooks du renderer.
- En `ACTIVE` ou `BACKGROUND`, le sous-groupe est reconstruit à partir du modèle astronomique conservé en mémoire.
- Le groupe racine (repère global et cible de navigation) est conservé afin de garder l'identité de la cible et le périvolume.
- Le passage `BACKGROUND` conserve les ressources mais le profil de scène décide de son rendu et l'actualisation orbitale reste suspendue puisque seul `ACTIVE` est simulé.

## Réseau et cache

- Les recherches déclenchées par `loadInterstellarSystemByName` utilisent un `AbortController` par requête de nom ; une nouvelle recherche du même nom annule la précédente.
- La suppression du moteur annule toutes les recherches en cours.
- Les tâches réseau associées à un système déjà enregistré peuvent être raccordées via `attachInterstellarRequestController(id, controller)` ; le cycle de vie les annule en `UNLOADED` ou à la suppression du système.
- `AstronomicalCatalogService` garde son cache mémoire LRU/TTL (15 min, 100 entrées par défaut). Les réponses mises en cache évitent une nouvelle requête réseau.
- Une requête déjà terminée n'est pas annulable ; une entrée astronomique déjà résolue est conservée pour permettre la reconstruction GPU sans nouvel appel réseau.

## Limites

- La recherche initiale du catalogue est une action utilisateur préalable à l'enregistrement du périvolume ; elle ne peut donc pas être annulée par une sortie de périvolume qui n'existe pas encore. Les tâches réseau ultérieures doivent explicitement être raccordées avec `attachInterstellarRequestController`.
- Le cache reste en mémoire vive, sans IndexedDB ni persistance entre sessions.
- La libération porte sur les ressources Three.js propres au sous-groupe exoplanétaire ; elle ne purge pas le cache scientifique CPU.
- Les appels Gaia/SIMBAD/NASA n'ont pas été testés sur des services distants dans cet environnement.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-44-INTERSTELLAR-LOD-STREAMING.md -->

# Lot 44 — Interstellar LOD & progressive scene budget

## Objectif

Réduire le coût de rendu des systèmes extrasolaires déjà connus du moteur en adaptant le niveau de détail à leur taille apparente à l'écran. Le lot prolonge le cycle GPU/network du lot 43 et ne modifie pas les quatre axiomes de périvolume.

## Niveaux de détail

- `STAR` : étoile hôte seule ; les meshes planétaires et les lignes d'orbite sont masqués.
- `PLANETS` : étoile et planètes dont une position est disponible ; lignes d'orbite masquées.
- `DETAILED` : étoile, planètes positionnées et lignes d'orbite.

La décision utilise la taille apparente du système, calculée avec son demi-grand axe orbital maximal, la distance caméra, la hauteur du viewport et le champ de vue vertical. Une hystérésis distincte à l'entrée et à la sortie limite les oscillations de niveau.

## Budgets

Le gestionnaire limite par défaut à huit systèmes affichant leurs planètes, dont deux au niveau détaillé. Le système actuellement focalisé est prioritaire à taille apparente égale. Les systèmes masqués par la politique de périvolume ne consomment pas le budget d'admission LOD.

## Intégration

- `InterstellarLODManager.js` : calculs indépendants de Three.js, budgets et hystérésis.
- `InterstellarSceneRenderer.setSystemLOD()` : applique les niveaux aux objets de la scène.
- `SolarEngine.updateInterstellarLOD()` : évalue les systèmes toutes les six images et conserve les décisions sur les groupes.
- Les décisions LOD restent indépendantes des états `ACTIVE`, `BACKGROUND`, `UNLOADED`. Le gestionnaire GPU du lot 43 reste seul responsable de la libération des géométries et matériaux.

## Limites explicites

Ce lot réalise un streaming progressif du niveau de détail en scène, pas un téléchargement réseau progressif des catalogues ou des planètes. Les modèles astronomiques restent en mémoire JavaScript. Les objets `STAR` ne sont pas remplacés par des billboards/instances GPU : leur géométrie sphérique reste utilisée. Les seuils sont des valeurs initiales à calibrer sur navigateur et GPU réels. Aucun test WebGL réel ni benchmark de FPS n'est revendiqué.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-45-GALACTIC-SPATIAL-INDEX.md -->

# Lot 45 — Galactic Spatial Index

## Objectif

Ajouter une structure spatiale 3D pour interroger efficacement les systèmes stellaires connus, sans parcourir tout le catalogue pour chaque recherche de proximité.

## Architecture livrée

- `GalacticSpatialIndex` maintient un registre d'identifiants, positions cartésiennes héliocentriques en parsecs et métadonnées.
- Un KD-tree équilibré est reconstruit paresseusement après les insertions, déplacements ou suppressions.
- `queryRadius` retourne les voisins dans un rayon, triés par distance.
- `nearest` retourne les plus proches dans une limite de distance facultative.
- Une grille de secteurs 3D (taille par défaut : 10 pc) fournit des clés déterministes et un accès direct aux membres d'un secteur.
- `SolarEngine` indexe les systèmes extrasolaires enregistrés à partir de `model.heliocentricParsecs` et retire les entrées lors de leur suppression.

## API moteur

- `queryInterstellarSystemsNear(positionPc, radiusPc, options)` — recherche de proximité en parsecs dans le repère héliocentrique.
- `getGalacticSpatialStats()` — nombre de systèmes, secteurs et taille de secteur.

## Limites explicites

Ce lot indexe uniquement les systèmes déjà chargés/enregistrés dans le moteur. Il ne télécharge pas automatiquement des catalogues complets, ne crée pas de données Gaia fictives et ne réalise pas encore le streaming réseau des secteurs. La grille de secteurs est un index secondaire; les requêtes de rayon utilisent le KD-tree. Les coordonnées doivent être dans le même repère héliocentrique ICRS et exprimées en parsecs.

## Compatibilité

Les quatre axiomes de périvolume, le gestionnaire de ressources GPU/réseau, le LOD et la configuration Render statique sont conservés. Aucun backend n'est ajouté.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-46-GALACTIC-SECTOR-STREAMING.md -->

# Lot 46 — Galactic Sector Streaming

## Objectif

Ajouter une résidence spatiale des secteurs autour de la caméra, au-dessus de l’index KD-tree du lot 45. Le gestionnaire n’est pas un fournisseur de données : il organise les systèmes déjà présents dans l’index.

## Architecture

- `GalacticSpatialIndex` conserve les systèmes connus et leur clé de secteur.
- `GalacticSectorStreamingManager` active les systèmes proches avec hystérésis (entrée 50 pc, sortie 65 pc).
- `SolarEngine.updateGalacticSectorStreaming()` convertit la caméra globale en parsecs et recalcule la résidence toutes les 12 images.
- Le rendu sectoriel ne remplace pas les axiomes : le profil du `SystemManager` doit aussi autoriser le rendu. La libération GPU et l’annulation réseau restent sous le contrôle de `InterstellarResourceLifecycleManager`.

## API

- `update(centerPc, { force })` : calcule les secteurs et systèmes résidents.
- `isResident(id)` : indique si un système est dans la zone de streaming.
- `getStats()` : compte les secteurs, systèmes visibles et rayons.
- `dispose()` : vide et désactive le gestionnaire.

## Limites connues

Ce lot ne télécharge pas encore de tuiles Gaia DR3 ni de secteurs absents de l’index. Il ne réalise pas d’instancing massif GPU, ni d’Octree. Il fournit la couche de résidence/culling spatial nécessaire avant d’ajouter un fournisseur de secteurs asynchrones. Les coordonnées caméra sont converties avec l’échelle parsec/scene du moteur ; les données doivent rester dans le même repère ICRS.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-47-GAIA-DR3-SECTOR-STREAMING.md -->

# Lot 47 — Gaia DR3 Sector Streaming

## Objectif

Ajouter une première voie de chargement réel et explicite du catalogue Gaia DR3 dans l'application statique, avec cache navigateur et rendu stellaire groupé. Aucun appel catalogue n'est déclenché automatiquement au démarrage.

## Modules

- `GaiaSectorCache.js` : cache IndexedDB versionné, TTL 24 h, repli mémoire si IndexedDB est absent ou inaccessible.
- `GaiaDR3SectorStreamer.js` : requêtes Gaia TAP à la demande, limite de concurrence, annulation, déduplication des chargements et conversion de parallaxe positive en distance `pc = 1000 / parallax_mas`.
- `GaiaStarfieldLayer.js` : couche `THREE.Points` unique avec attributs de position et couleur, mise à jour de l'origine flottante.
- `engine.jsx` : API `loadGaiaDR3Cone`, `loadGaiaDR3AroundCamera`, `cancelGaiaDR3Streaming`, `getGaiaStreamingStats`.

## Référentiel et limites scientifiques

Les positions sont converties depuis RA/Dec ICRS en coordonnées cartésiennes héliocentriques avec la distance inverse de parallaxe. Les parallaxes nulles ou négatives sont exclues : aucune distance n'est inventée. Cette conversion ne corrige pas la parallaxe pour son biais statistique et ne propage pas le mouvement propre à une époque différente. Le champ Gaia utilisé est celui de la release DR3 et les positions sont affichées dans le référentiel de catalogue.

## Limites opérationnelles

- `searchGaiaCone` est un cône céleste limité à 5 degrés et plafonné par `maxRows` du service.
- Un lot ne constitue pas un téléchargement exhaustif d'un secteur spatial 3D ; il s'agit d'une tuile de ciel paramétrée par RA/Dec/rayon.
- IndexedDB peut être indisponible en navigation privée ou selon les politiques du navigateur ; le cache mémoire prend alors le relais.
- Les requêtes ESA TAP peuvent échouer selon réseau, disponibilité du service et CORS navigateur.
- Le rendu `THREE.Points` groupe les étoiles d'un lot dans un seul objet de rendu. Il ne remplace pas encore un pipeline GPU multi-tuiles, ni le chargement paginé complet du catalogue.
- Aucun proxy backend n'est introduit ; la configuration Render reste statique.

## API

```js
await engine.loadGaiaDR3Cone({ raDeg: 83.8, decDeg: -5.4, radiusDeg: 1, limit: 500 });
await engine.loadGaiaDR3AroundCamera({ radiusDeg: 1, limit: 500 });
engine.cancelGaiaDR3Streaming();
engine.getGaiaStreamingStats();
```

`loadGaiaDR3AroundCamera` déduit uniquement la direction ICRS de la caméra ; il ne calcule pas un volume spatial 3D centré sur la caméra. La caméra doit être distincte de l'origine solaire.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-48-GALACTIC-GPU-INSTANCING.md -->

# Lot 48 — Galactic GPU Instancing & Massive Star Rendering

## Objectif

Optimiser la couche de rendu Gaia DR3 sans modifier le fournisseur de données du lot 47 ni introduire de backend. Les étoiles sont regroupées dans un unique objet `THREE.Points` et transférées au GPU au moyen de buffers typés réutilisables.

## Changements

- `GaiaStarfieldLayer` préalloue les buffers position/couleur avec une capacité qui croît par paliers (minimum 256, puis doublement jusqu'au besoin).
- Les attributs utilisent `DynamicDrawUsage` lorsqu'il est disponible et sont marqués `needsUpdate` après écriture.
- `setDrawRange` limite le nombre de sommets effectivement dessinés sans recréer l'objet `THREE.Points`.
- LOD CPU avant upload : filtre de résidence, magnitude maximale, distance maximale, puis tri par magnitude croissante et plafond `maxStars`.
- L'origine flottante recalcule les positions dans le buffer existant, sans remplacer les attributs tant que la capacité suffit.
- Statistiques ajoutées : étoiles résidentes/rendues, troncature, capacité, estimation des octets GPU et budget actif.
- `engine.setGaiaRenderBudget(options)` permet d'ajuster le LOD à chaud sans recharger Gaia.

## API

```js
engine.setGaiaRenderBudget({
  maxStars: 250_000,
  maxMagnitude: 15,
  maxDistancePc: 100,
  pointSize: 2.0,
});

engine.getGaiaStreamingStats();
```

`maxStars` est un plafond de rendu, pas une promesse de téléchargement. Le lot 47 limite encore les réponses Gaia à 500 enregistrements par cône ; il faut donc un lot de pagination/partitionnement de catalogue avant de pouvoir alimenter des buffers de centaines de milliers d'étoiles depuis Gaia.

## Limites et exactitude

- `THREE.Points` correspond à un rendu de points GPU groupés (un draw call), pas à `THREE.InstancedMesh` : un mesh par étoile serait inutile pour des sprites ponctuels.
- Le filtre de magnitude et la distance sont appliqués côté CPU lors de la préparation des buffers.
- Le budget mémoire rapporté estime uniquement les deux buffers `Float32Array` (positions + couleurs), sans compter la géométrie, le matériau, les objets JavaScript ni les allocations internes du navigateur/GPU.
- Le plafond par défaut est 1 000 000 de sommets côté renderer, mais la limite d'acquisition Gaia du lot 47 reste 500 lignes par cône.
- Aucun benchmark matériel GPU ni validation visuelle navigateur n'est revendiqué ici.

## Validation

Les tests unitaires couvrent la conversion d'axes ICRS, le draw range, la réutilisation des buffers, la résidence, les filtres de magnitude/distance et le plafond de rendu.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-49-GAIA-PAGINATION.md -->

# Lot 49 — Gaia DR3 keyset pagination & progressive catalog loading

## Objectif

Étendre le chargement ponctuel du lot 47 en pages bornées, sans OFFSET et sans backend. Les pages sont ordonnées par `source_id` croissant et la page suivante applique `source_id > <dernier source_id>`.

## Changements

- `AstronomicalCatalogService.searchGaiaCone` accepte `sourceIdAfter`, valide le curseur comme entier décimal et l'intègre à l'ADQL.
- Le cache TAP distingue chaque curseur afin qu'une page ne soit jamais confondue avec une autre.
- `GaiaDR3SectorStreamer.loadConePages` charge jusqu'à `maxPages` pages (1 à 100), conserve un seul exemplaire par identifiant Gaia et vérifie la progression du curseur.
- `engine.loadGaiaDR3ConePages` indexe les nouvelles étoiles dans l'index galactique et alimente le starfield GPU.
- L'appel est toujours explicite : aucune requête n'est lancée au démarrage.

## API

```js
const result = await engine.loadGaiaDR3ConePages({
  raDeg: 83.8,
  decDeg: -5.4,
  radiusDeg: 1,
  limit: 500,
  maxPages: 10,
});
```

`limit` est la taille de page (plafonnée à 500 par le service). `maxPages` borne le travail réseau. Le résultat expose `pagesLoaded`, `count`, `hasMore` et `nextSourceIdAfter`.

## Limites et garanties

- Pagination par clé : pas de `OFFSET`, donc pas de décalage croissant des pages.
- Les pages sont triées par `source_id`, pas par magnitude ; la sélection visuelle du renderer continue ensuite de prioriser les magnitudes.
- Une limite de pages empêche les téléchargements sans fin. Pour continuer un chargement interrompu, relancer avec `sourceIdAfter: result.nextSourceIdAfter` dans un nouvel appel `engine.loadGaiaDR3ConePages`, ou augmenter `maxPages`.
- Les résultats sont une fenêtre de requête, pas un export complet de Gaia DR3. Le TAP public peut limiter ou interrompre des requêtes volumineuses.
- Les étoiles sans parallaxe positive exploitable restent exclues de la conversion 3D.
- Aucun service backend, worker Render ou stockage serveur n'est ajouté.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-50-GALACTIC-SECTOR-SCHEDULER.md -->

# Lot 50 — Galactic Sector Scheduler

## Objectif

Relier le catalogue Gaia DR3 à la direction de la caméra, tout en gardant le chargement réseau désactivé au démarrage. Le planificateur travaille sur des tuiles angulaires ICRS (RA/Dec) : ce sont des secteurs de catalogue céleste, distincts des secteurs cartésiens 3D de `GalacticSpatialIndex`.

## Architecture

- `GalacticSectorScheduler` construit une tuile centrale et jusqu'à quatre tuiles cardinales autour de la direction caméra.
- Les tuiles sont classées par distance angulaire à la caméra.
- Une file bornée et une concurrence configurable empêchent les rafales réseau.
- Les requêtes de tuiles sorties du voisinage désiré sont annulées.
- Les secteurs chargés sont dédupliqués en mémoire ; les pages individuelles restent cachées par `GaiaSectorCache`.
- À la sortie du voisinage, les étoiles possédées uniquement par cette tuile sont retirées de l'index spatial et du starfield ; les étoiles partagées par une autre tuile ou chargées manuellement sont conservées.
- La pagination keyset reprend avec `source_id > nextSourceIdAfter`.
- Un plafond `maxPagesPerSector` limite la quantité de données récupérée par tuile.
- Les erreurs appliquent un délai de retry.

## API moteur

Le streaming est désactivé par défaut. Pour l'activer explicitement :

```js
engine.setGaiaAutoStreaming(true, {
  radiusDeg: 1,
  maxPages: 1,
  maxPagesPerSector: 5,
  maxConcurrent: 1,
  maxPrefetchSectors: 5,
});
```

Pour l'arrêter :

```js
engine.setGaiaAutoStreaming(false);
```

Les statistiques du planificateur sont exposées via `engine.getGaiaStreamingStats().scheduler`.

## Limites

- Les tuiles sont angulaires et non des cubes cartésiens de parsecs. La conversion Gaia vers parsecs et l'index 3D restent réalisés par la couche de données existante.
- Le scheduler suit la direction radiale caméra-Soleil ; il ne déduit pas encore le frustum optique exact.
- Le cache et la liste des secteurs chargés vivent dans la session navigateur. Le cache IndexedDB conserve les pages selon la politique existante.
- La sélection de source reste limitée par les réponses TAP, la magnitude et les parallaxes disponibles ; ce lot ne constitue pas un miroir complet de Gaia DR3.
- Aucun backend, worker Render, service serveur ou téléchargement au démarrage n'est ajouté.

## Validation

Les tests couvrent le désactivé par défaut, la file bornée, la normalisation RA, la déduplication, l'annulation et le délai de retry. Les tests réseau utilisent un streamer simulé ; la disponibilité réelle du TAP ESA doit être vérifiée depuis le navigateur.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-51-GALACTIC-CATALOG-RESIDENCY.md -->

# Lot 51 — Galactic Catalog Memory & Residency

## Objectif

Empêcher le catalogue Gaia DR3 chargé en mémoire de croître sans limite pendant la navigation galactique. Le lot ajoute une politique de résidence CPU LRU, coordonnée avec les secteurs angulaires du planificateur du lot 50.

## Politique active

- Plafond initial : 24 secteurs, 250 000 identifiants-étoiles comptés par secteur et 96 Mio estimés.
- Estimation prudente : 384 octets par étoile (objet JS, identifiants, index et marge d'allocation). Ce n'est pas une mesure exacte du heap V8.
- Les secteurs du champ courant sont épinglés ; ils ne sont pas évincés par la politique LRU.
- Les secteurs hors champ sont classés par dernière activité. Le plus ancien est évincé jusqu'au retour sous les plafonds.
- L'éviction passe par `GalacticSectorScheduler.evictSector`, puis par le mécanisme existant de retrait des propriétaires d'étoiles. Les étoiles partagées par plusieurs secteurs ou chargées manuellement sont conservées.
- Les statistiques distinguent les secteurs, étoiles estimées, mémoire estimée, secteurs épinglés et évictions.

## API moteur

```js
engine.setGaiaCatalogMemoryBudget({
  maxSectors: 24,
  maxStars: 250000,
  maxEstimatedBytes: 96 * 1024 * 1024,
  bytesPerStar: 384
});

engine.getGaiaStreamingStats().residency;
```

Le changement de budget est appliqué immédiatement. `maxEstimatedBytes` est un budget logique estimé, pas une garantie du navigateur sur le heap réel.

## Limites connues

- Les curseurs de pagination ne sont pas encore persistés entre les rechargements de page. Le cache Gaia des pages reste géré séparément par `GaiaSectorCache`.
- La politique porte sur la résidence CPU des étoiles ; le budget GPU du `GaiaStarfieldLayer` reste contrôlé séparément par `setGaiaRenderBudget`.
- La prédiction de mouvement caméra et le préchargement cinématique restent à réaliser.
- Les tests sont locaux avec données simulées ; aucune requête live ESA Gaia TAP n'est exécutée par cette suite.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-52-PREDICTIVE-GALACTIC-STREAMING.md -->

# Lot 52 — Predictive Galactic Streaming

## Objectif

Anticiper la direction de déplacement de la caméra céleste afin de demander une tuile Gaia supplémentaire avant qu'elle ne devienne le centre du champ observé. Le mécanisme complète le planificateur borné du lot 50 et la résidence mémoire du lot 51.

## Fonctionnement

- Échantillonnage des coordonnées ICRS (RA/Dec) à chaque mise à jour du planificateur.
- Calcul du déplacement angulaire avec correction du cosinus de la déclinaison et gestion du passage RA 0°/360°.
- Estimation de vitesse angulaire en degrés par seconde.
- Projection linéaire à horizon borné, plafonnée en distance angulaire.
- Ajout d'au plus une tuile prédictive, après les tuiles du champ courant dans la priorité de chargement.
- Épinglage de cette tuile par le gestionnaire de résidence tant qu'elle fait partie du voisinage demandé.
- Aucun chargement supplémentaire si la caméra est immobile ou si le déplacement est inférieur au seuil.

## Paramètres moteur

Le planificateur du moteur est configuré avec :

| Paramètre | Valeur |
|---|---:|
| Horizon de prédiction | 1 200 ms |
| Déplacement maximal projeté | 2° |
| Vitesse minimale | 0,15°/s |
| Tuiles prédictives simultanées | 1 |
| Concurrence réseau | 1 |
| File maximale | 8 |

La prédiction ne change pas les plafonds de pagination Gaia par secteur. Elle reste soumise aux limites de file, de concurrence et de mémoire des lots précédents.

## Limites

La projection est cinématique et linéaire : elle ne modélise ni accélération, ni inertie réelle de caméra, ni trajectoire de navigation complexe. Les coordonnées de vue restent celles dérivées du vecteur Soleil-caméra, et non un véritable frustum optique. Les appels ESA Gaia n'ont pas été exécutés en direct pendant les tests.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-53-STATIC-DEPLOYMENT-FIXES.md -->

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

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-54-SCIENTIFIC-REPRESENTATION-AND-IDENTITY.md -->

# Lot 54 — Représentation 3D scientifique et intégrité du catalogue

## Objectif

Séparer les corps réellement référencés, les identités ambiguës, les doublons de lignes de catalogue et les limites de représentation 3D. Une absence de texture, de modèle 3D ou de tuile n'est jamais interprétée comme une absence d'astre.

## Identité et doublons

`AstronomicalCatalogIntegrity.js` audite les enregistrements avant assemblage :

- dédoublonnage automatique uniquement par identifiant exact du catalogue d'origine ;
- identifiant Gaia DR3 exact pour les étoiles, identifiant SIMBAD exact pour les lignes SIMBAD, nom canonique NASA pour les planètes NASA ;
- conservation des lignes sources fusionnées dans `sourceRecords` ;
- comparaison des coordonnées ICRS en secondes d'arc ;
- rapprochement par proximité conservé comme candidat, jamais fusionné automatiquement ;
- conflit de coordonnées pour un même identifiant exact signalé séparément.

`classifyAstronomicalExistence()` distingue `catalogued`, `sourced` et `unverified`. `catalogued` veut dire « présent dans une source identifiée », pas « preuve indépendante de réalité ». Une ligne Gaia est une mesure astrométrique, SIMBAD un référentiel de classifications et NASA Exoplanet Archive une table de paramètres planétaires.

## Inventaire du Système solaire local

Le dépôt contient deux vues techniques des satellites : `ALL_SATELLITES` (rayons, apparence et orbites de repli) et `ASTRES` (éléments orbitaux). Les 34 satellites sont représentés dans les deux fichiers, mais leurs identifiants sont uniques dans chaque table. Ces vues ne doivent pas être concaténées pour créer des meshes supplémentaires.

Référence orbitales : [JPL SSD — Planetary Satellite Mean Elements](https://ssd.jpl.nasa.gov/sats/elem/sep.html). JPL avertit que ces éléments moyens décrivent la forme générale et ne remplacent pas les éphémérides Horizons.

Commande d'audit :

```bash
npm run audit:astronomy
```

Elle contrôle les identifiants dupliqués, les satellites manquants dans la table orbitale, les divergences de demi-grand axe supérieures à 3 % entre vues et plusieurs valeurs de référence JPL.

## Corrections de données vérifiées

Les valeurs aberrantes du fichier `kepler-elements.ts` ont été corrigées pour :

- Pluton : Charon, Styx, Nix, Kerberos et Hydra ;
- Uranus : Puck ;
- Neptune : Triton, Protée et Néréide ;
- repères de référence des plans de Laplace pour Mars, Jupiter et Saturne.

Les pôles ICRF du plan de Laplace publiés par JPL sont maintenant utilisés lorsqu'ils sont disponibles (`referencePoleIcrf`). L'ancienne approximation par seuil de distance reste uniquement un repli si le pôle n'est pas fourni.

Attention : les éléments moyens JPL décrivent la forme et l'orientation générale de l'orbite. JPL précise qu'ils ne sont pas destinés au calcul d'éphémérides précises ; utiliser Horizons pour les positions de haute précision.

## Représentation des systèmes exoplanétaires

Le mode par défaut est maintenant `physical` :

- cohérence de l'échelle entre UA et rayons terrestres ;
- rayons connus convertis sans clamp visuel ;
- taille inconnue représentée par un marqueur ponctuel et explicitement signalée ;
- rayon stellaire affiché physiquement uniquement s'il est fourni ;
- aucune position 3D ni orbite orientée n'est inventée si l'inclinaison, le nœud ascendant, l'argument du périastre et sa convention ne sont pas validés.

Le mode `readable` reste disponible pour une visualisation lisible non à l'échelle, mais son statut est explicite dans le modèle de scène.

La requête NASA récupère `st_rad` pour dimensionner l'étoile hôte lorsque cette mesure existe, et `pl_radj` comme solution de repli convertie en rayons terrestres lorsque `pl_rade` manque. Référence : [NASA Exoplanet Archive — PSCompPars column definitions](https://exoplanetarchive.ipac.caltech.edu/docs/API_PSCompPars_columns.html). La table NASA PSCompPars ne fournit pas de `pl_orblnode` dans son schéma courant ; le normaliseur accepte ce champ s'il est fourni par une autre source, mais ne le fabrique pas. Le champ `pl_orblper` reste marqué comme convention à vérifier : NASA précise que la littérature utilise tantôt l'orbite de la planète, tantôt le mouvement réflexe de l'étoile, avec un décalage de 180°. Le mode physique masque donc l'orientation 3D tant que ces informations ne sont pas validées.

## Limites

- Aucun appel réseau live Gaia, SIMBAD, NASA ou JPL n'est réalisé par l'audit local.
- Les données de satellite restent un sous-ensemble, pas un inventaire exhaustif des satellites connus.
- Les éléments moyens képlériens ne modélisent pas toutes les perturbations, résonances et précessions.
- Le mode physique exoplanétaire peut masquer des corps si les données d'orientation ne sont pas suffisamment renseignées ; c'est volontaire pour éviter une position trompeuse.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-55-ASTROMETRIC-POSITION-ENGINE.md -->

# Lot 55 — Astrometric Position Engine et Proxima Centauri

## Objectif

Transformer une astrométrie cataloguée en position 3D héliocentrique à une époque cible, puis en coordonnées de scène Gobai. Le moteur est réutilisable pour les étoiles Gaia/SIMBAD disposant d'une époque, d'une parallaxe et de paramètres de mouvement.

## Modèle physique

- Repère directionnel : ICRS.
- Coordonnées sphériques : RA/Dec en degrés.
- Parallaxe : mas, distance initiale `d(pc) = 1000 / parallax(mas)`.
- Mouvement propre RA : `mu_alpha* = d(alpha)/dt * cos(dec)`, en mas/an.
- Mouvement propre Dec : mas/an.
- Vitesse radiale : km/s, signe positif en éloignement ; négatif en approche.
- Propagation rectiligne 3D : `r(t) = r0 + v * (t - t0)` en années juliennes.
- Sortie : RA/Dec, distance, parallaxe propagée, vecteur position ICRS en pc, vecteur vitesse en pc/an et vitesses tangentiel/radiale/totale.

La propagation est une approximation rectiligne à vitesse constante. Elle n'intègre ni accélération gravitationnelle, ni orbite de Proxima autour du barycentre Alpha Centauri AB, ni covariance complète de la solution astrométrique.

## Proxima Centauri

Enregistrement fourni :

- SIMBAD ICRS J2000 : RA `217.4289422216058°`, Dec `-62.67949018907555°`.
- Parallaxe : `768.0665 mas`.
- Mouvement propre : `mu_alpha* = -3781.741 mas/an`, `mu_delta = +769.465 mas/an`.
- Vitesse radiale héliocentrique : `-20.578199 km/s`.
- Identifiant croisé Gaia DR3 : `5853498713190525696`.

**Traçabilité :** les mesures sont reprises de la fiche SIMBAD et de ses références bibliographiques ; l'identifiant Gaia DR3 est un identifiant croisé. Le jeu embarqué n'est pas présenté comme une ligne Gaia DR3 brute. Pour un calcul de précision, remplacer l'enregistrement par les colonnes natives Gaia DR3 (`ra`, `dec`, `ref_epoch`, `parallax`, `pmra`, `pmdec`, `radial_velocity`) et leur matrice de covariance.

## Intégration scène

`buildInterstellarSystemModel(starSystem, { targetEpoch })` propage le vecteur si coordonnées et parallaxe sont disponibles. `InterstellarSceneRenderer.updateSystemEpoch(id, targetEpoch)` met à jour la position globale d'un système déjà inscrit sans reconstruire le sous-système planétaire local.

Export de données de référence :

```js
import {
  calculateProximaCentauriPosition,
  createProximaCentauriAstrometricRecord,
} from './data/astronomy/index.js';

const state = calculateProximaCentauriPosition(2026, {
  parsecToSceneUnits: 1000,
});
```

## Limites et conventions

- Le calcul utilise une vitesse rectiligne constante en repère ICRS et une conversion héliocentrique pour la scène.
- La vitesse radiale SIMBAD est héliocentrique ; le calcul ne doit pas être qualifié de barycentrique.
- Les coordonnées J2000 et les paramètres de mouvement SIMBAD compilés sont propagés ensemble comme un état de référence pratique ; ce n'est pas une solution Gaia DR3 homogène native.
- Sans parallaxe positive, le moteur existant conserve la propagation tangentielle et ne fabrique pas de distance 3D.
- Les incertitudes sont signalées dans la provenance ; aucune covariance n'est inventée.

## Validation

Tests unitaires dédiés : identifiants/provenance, clonage, distance par parallaxe, déplacement temporel, rapprochement radial, conversion scène et propagation d'un système dans le renderer.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-56-GAIA-COVARIANCE.md -->

# Lot 56 — Gaia DR3 et incertitudes astrométriques 3D

## Objectif

Propager les incertitudes de la solution astrométrique Gaia DR3 jusqu'à la position cartésienne héliocentrique à une époque cible. Le lot ne fabrique aucune incertitude pour les enregistrements SIMBAD qui ne publient pas les erreurs et corrélations nécessaires.

## Données Gaia demandées

`AstronomicalCatalogService` sélectionne désormais les champs Gaia DR3 suivants :

- paramètres : `ra`, `dec`, `parallax`, `pmra`, `pmdec`, `radial_velocity`, `ref_epoch` ;
- erreurs : `ra_error`, `dec_error`, `parallax_error`, `pmra_error`, `pmdec_error`, `radial_velocity_error` ;
- corrélations : `ra_dec_corr`, `ra_parallax_corr`, `ra_pmra_corr`, `ra_pmdec_corr`, `dec_parallax_corr`, `dec_pmra_corr`, `dec_pmdec_corr`, `parallax_pmra_corr`, `parallax_pmdec_corr`, `pmra_pmdec_corr` ;
- contrôle de solution : `astrometric_params_solved`.

La référence d'époque est `ref_epoch`, exprimée en années juliennes. `pmra` suit la convention Gaia `mu_alpha* = mu_alpha cos(dec)`.

## Matrice de covariance

La matrice Gaia 5x5 suit l'ordre :

`[alpha*, delta, parallax, pmra, pmdec]`

Les termes diagonaux sont les variances issues des erreurs publiées. Les termes hors diagonale sont `rho_ij * sigma_i * sigma_j`. Une corrélation absente est mise à zéro et signalée comme hypothèse, elle n'est pas interpolée.

Si `radial_velocity_error` est présent, une sixième dimension indépendante est ajoutée pour la vitesse radiale. Cette indépendance est une hypothèse explicite ; ce n'est pas une covariance RV-astrométrie fournie par Gaia.

## Propagation

La position nominale utilise le mouvement rectiligne 3D du Lot 55. La covariance cartésienne est calculée par linéarisation :

`C_xyz = J C_astrometry J^T`

`J` est le jacobien numérique de la position cartésienne en parsecs par rapport aux paramètres astrométriques. La sortie contient la covariance 3x3 en pc² et les écarts-types marginaux `sigmaPc.x/y/z`.

Cette covariance est locale/linéarisée. Elle ne remplace pas une propagation non linéaire Monte-Carlo, en particulier pour les parallaxes de faible rapport signal/bruit, ni une modélisation de l'accélération gravitationnelle.

## API

```js
import {
  gaiaDR3RowToAstrometricRecord,
  propagateAstrometricPositionCovariance,
  propagateAstrometricRecord,
} from './data/astronomy/index.js';

const record = gaiaDR3RowToAstrometricRecord(rawGaiaDr3Row);
const propagated = propagateAstrometricRecord(record, 2030.0);
// propagated.propagation ne contient que les métadonnées de propagation.
// La covariance 3D détaillée est disponible via :
const uncertainty = propagateAstrometricPositionCovariance(record, 2030.0);
```

`propagateAstrometricCoordinates(record, epoch)` ajoute automatiquement `positionUncertainty` si `record.astrometry.covariance` est fournie. Le renderer interstellaire expose cet état via `astrometricState`.

## Proxima Centauri

L'enregistrement embarqué du Lot 55 reste une compilation SIMBAD et ne possède pas de covariance Gaia native : le moteur n'y ajoute donc aucune ellipse artificielle. Le service Gaia peut récupérer la ligne DR3 brute via `findGaiaSource('5853498713190525696')`. Les valeurs, erreurs et corrélations réellement retournées par ESA doivent être utilisées à la place de la compilation SIMBAD pour un résultat Gaia homogène à `ref_epoch`.

## Limites

- Les corrélations absentes sont nulles.
- La vitesse radiale est considérée indépendante dans la matrice 6x6 si son erreur est fournie.
- Pas de covariance de vitesse radiale croisée publiée/ingérée.
- Pas de propagation Monte-Carlo.
- Pas de correction du biais de parallaxe ni de modèle de mouvement accéléré / binaire.
- Les erreurs en position sont utilisées dans le plan tangent local ; les sorties sont des écarts-types marginaux cartésiens, pas les axes propres d'un ellipsoïde diagonalisé.

## Validation

Tests unitaires : construction de covariance 5x5, symétrie, rejet des corrélations hors limites, normalisation de lignes Gaia, ajout optionnel de l'erreur RV, propagation de covariance 3D et intégration au résultat astrométrique.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-57-PROXIMA-OVERVIEW-RECONSTRUCTION.md -->

# Lot 57 — Proxima Centauri visible dans la vue globale

## Objectif

Le Système solaire conserve son échelle locale actuelle (AU_UNITS). Proxima Centauri est désormais pré-enregistrée au démarrage, sans requête réseau, et son système planétaire est reconstitué en mode lisible/schématique.

## Placement global

- La direction et la distance relative de Proxima proviennent de son enregistrement astrométrique de référence (ICRS, parallaxe et propagation temporelle).
- Le placement interstellaire utilise une échelle d'aperçu compressée : **1 pc d'affichage = 512 UA de scène**.
- Le facteur de compression par rapport à la distance physique est `206264.806247 / 512 ≈ 402.86`.
- Pour Proxima (environ 1.30 pc), la distance d'affichage est environ 667 UA de scène, soit environ 15.6 millions d'unités avec `AU_UNITS=23455`.
- Cette compression ne modifie pas les dimensions ni les orbites du Système solaire. Elle s'applique uniquement aux coordonnées interstellaires globales.
- La limite de zoom caméra existante (`MAX_DISTANCE=6e7`) permet d'englober cette position.

## Rendu

- Un marqueur stellaire global rouge-orangé, indépendant du détail local, est maintenu à environ 9 pixels de diamètre.
- Le LOD `STAR` montre ce marqueur ; `PLANETS` et `DETAILED` montrent le système planétaire local.
- Le système est ajouté au catalogue et au spatial index dès l'initialisation.
- Le périvolume local reste de 10 UA ; le rayon de résidence visuelle `BACKGROUND` est porté à 3 pc d'affichage.
- L'axiome externe Soleil/Proxima est conservé : quand un système est réellement actif dans son périvolume, l'autre est déchargé.
- La cible caméra de Proxima utilise sa position globale, et non la position locale recentrée par l'origine flottante.

## Reconstitution locale

- Proxima Centauri : étoile de type M, couleur rouge-orangé, rayon indicatif.
- Proxima b : un marqueur planétaire, orbite elliptique et période approximatives.
- Le plan orbital est volontairement schématique ; il ne s'agit pas d'une solution orbitale 3D certifiée.
- Le Système solaire n'est pas touché par cette simplification.

## Limites

- La compression interstellaire est une convention de visualisation non linéaire entre systèmes, pas une échelle physique uniforme avec le Système solaire.
- La position dans le ciel conserve l'orientation ICRS, mais l'objet doit se trouver dans le champ de caméra pour être visible à l'écran.
- Le rendu réel dans le navigateur et le build Vite doivent être confirmés après installation des dépendances.

## Cause de l'absence dans la version précédente

Trois conditions empêchaient l'affichage au dézoom : le catalogue ne pré-enregistrait pas Proxima au démarrage ; l'échelle parsec physique plaçait l'étoile à plusieurs milliards d'unités, au-delà du zoom maximal ; enfin, le rayon BACKGROUND par défaut ne couvrait que quelques dizaines d'UA. Le lot corrige ces trois points.

---

<!-- Fichier d'origine : docs/architecture/ASTRONOMICAL-LOT-58-STATIC-DWARF-PLANETS.md -->

# Lot 58 — Planètes naines statiques et suppression du proxy backend

## Objectif

Précharger Hauméa, Makémaké et Éris dans le catalogue des corps du Système solaire. Leur position héliocentrique est calculée par le moteur orbital Kepler déjà présent dans le frontend. Aucun appel backend ou Horizons n'est requis pour leur affichage ou leur déplacement orbital.

## Données orbitales

Les éléments osculateurs sont issus des solutions NIMA du service LESIA / Lucky Star pour les objets 136108, 136472 et 136199, à l'époque JD 2460800.5 (2025-05-05 TDB). Ils sont ramenés au format commun du moteur (éléments J2000 avec moyen mouvement linéaire). Le calcul de scène est une propagation képlérienne à deux corps destinée à la visualisation, et non une intégration N-corps ni une éphéméride Horizons haute précision.

## Architecture statique

- Les trois entrées sont dans `frontend/src/moteur/data/astronomy/data/dwarf-planets.data.ts`.
- `bodies.data.ts` les fusionne automatiquement dans `PLANETS`, triées par demi-grand axe.
- `planetOrbits.jsx` calcule leurs positions à la date courante comme les autres corps sans série VSOP87A.
- Le dossier `backend/` et le service `gobai-astronomy-proxy` sont retirés de cette livraison.
- `render.yaml` ne déclare plus qu'un Static Site.

## Validation

Le test `dwarfPlanetStatic.test.jsx` vérifie la présence des trois corps, la validité des éléments et la production de positions 3D finies à l'époque 2026-11-17.
