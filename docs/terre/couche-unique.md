# Terre : une seule couche fusionnée

La Terre n'a plus qu'une couche d'imagerie, `earth-hd`. Elle fusionne toutes les sources, s'adapte au zoom et intègre
une carte marine (NOAA vue de l'espace, GEBCO en zoom).

Le travail se fait en cinq lots, une PR chacun :

1. inventaire, puis suppression des anciennes couches et interrupteurs ;
2. couche fusionnée et table de priorité des sources, servie par le serveur ;
3. paliers de zoom et budget de tuiles ;
4. carte marine NOAA / GEBCO ;
5. mesures finales sur iPhone et sur ordinateur.

## Inventaire (avant le lot 1)

### Imagerie

| Élément | Code | Contenu |
|---|---|---|
| `earth-hd`, couche unique | serveur : `earth-sources.ts`, `earth-imagery.service.ts`, route `tiles/earth/:layerId/:z/:x/:y` ; navigateur : `tiles/earthDirect.jsx` | 17 sources nationales ou régionales (IGN, Luxembourg, Suisse, Belgique, Pays-Bas, Autriche, Tchéquie, quatre Länder, Espagne, Italie, Pologne, Japon, Nouvelle-Galles du Sud, USGS), puis Sentinel-2 EOX (niveaux 0 à 14), puis NASA GIBS Blue Marble (niveaux 0 à 8). Choix tuile par tuile, la source la plus détaillée d'abord, en cascade rapprochée. Le navigateur charge lui-même les sources qui l'autorisent (CORS) ; le serveur relaie les services WMS |
| Mosaïque instantanée | `engine/tiledBodies.jsx` (`pinnedMaxZoom: 3`) | Niveaux 0 à 3 de la couche unique (85 tuiles), gardés en mémoire : fond immédiat pendant le chargement |
| `earth-live`, Terre à l'instant T | `earth-live.ts` | GOES Est et Ouest, Meteosat, Himawari, jusqu'au niveau 7. **Retirée par le lot 1** |
| `earth-gebco`, `earth-ncei` | `earth-seafloor.ts` | Fonds marins proposés comme fonds de carte à part. **Retirés de la liste par le lot 1** ; leurs relais restent (voir plus bas) |
| `sentinel2`, `ign-ortho` | `LEGACY` dans `earth-imagery.service.ts` | Anciennes couches à source unique, servies sans être listées. **Supprimées par le lot 1** |
| NASA GIBS, fournisseur de la Terre | `providers/gibs-tile.provider.ts`, `map-imagery.service.ts` | Ancien fond de secours, plus jamais utilisé depuis la couche unique. **Supprimé par le lot 1** (GIBS reste une source de la couche unique) |
| Dans le shader des tuiles | `tiles/seafloorFusion.jsx`, `tiles/nightLights.jsx`, `tiles/relief.jsx` | Fonds GEBCO fondus au large d'après les altitudes Terrarium, lumières de la nuit, relief Mapterhorn puis AWS |

### Calques qui ne sont pas de l'imagerie

| Calque | Interrupteur | Par défaut |
|---|---|---|
| Rues et routes (OpenFreeMap) | Paramètres › Cartographie | désactivé |
| Frontières et littoraux (Natural Earth) | Paramètres › Cartographie | désactivé |
| Nuages et atmosphère de la Terre (Xweather, sinon Open-Meteo ; vent Open-Meteo) | Paramètres › Atmosphère | **désactivé depuis le lot 1** (avant : un seul interrupteur, activé, partagé avec Vénus et Mars) |
| Noms des villes, noms des pays | Paramètres › Cartographie | désactivés |
| Volcans en éruption | Paramètres › Cartographie | désactivé |
| Lumières de la nuit, vue de la pollution lumineuse | Paramètres › Cartographie | activées / désactivée |
| Relief 3D, LiDAR HD, points LiDAR 3D | Paramètres › Cartographie en relief | désactivés |
| Ma position | Paramètres › Ma position | à la demande |
| Moteur atmosphérique : incendies, cyclones, foudre, précipitations, orages, aérosols, vents | Paramètres › Atmosphère | désactivés |

### Interface avant le lot 1

- Informations › Terre : liste « Fond de carte · Terre » de quatre fonds (`earth-hd`, `earth-live`, `earth-gebco`,
  `earth-ncei`), chacun avec son bouton de téléchargement (`engine/layerDownload.jsx`).
- Code mort lié : routes et noms « inclus dans un fond hybride » (`useEarthDisplay.jsx`), calque superposé générique
  de la Terre (`useTileBases.jsx`), réglage `routes` de l'assistant. Aucun fond de la Terre n'est hybride et aucun
  calque superposé générique n'existe : tout a été retiré.

### Mécanique des tuiles (gardée)

- Découpage hexagonal (`engine/hexGrid.jsx`, `tiles/hexCells.jsx`, `tiles/hexDisplay.jsx`), avec fondus entre niveaux.
- Navigateur sans serveur : tuiles chargées chez les fournisseurs, rien n'est gardé sur l'appareil.
- Colorimétrie commune : `ColorStats` (`tiles/earthDirect.jsx`) accorde chaque source nationale sur la mosaïque mondiale.
- Fond presque noir pendant le chargement : champ `backdrop: '#0b0f16'` (`engine/tiledBodies.jsx`).
- `tiles/netLoads.jsx` :
  - vraie annulation des téléchargements ;
  - délai d'abandon adaptatif, de 1,5 à 8 s ;
  - limite de téléchargements simultanés par serveur ;
  - compteurs de la session.
- Lectures de pixels dans un Worker (`tiles/tilePixels.worker.js`).
- Préchargement prédictif : 1,5 s d'avance, cône de 120°.
- 300 images en mémoire vive et 16 téléchargements simultanés.

## Lot 1 : ce qui change

- **Une seule entrée « Terre »**, dans Paramètres › Cartographie : description et sources de la couche unique, et un
  seul bouton de téléchargement (`terre-couche-fusionnee.png`). La liste des fonds de la Terre est retirée du panneau
  Informations, qui ne garde que l'état du chargement.
- **Serveur** :
  - `/tiles/layers` ne liste plus pour la Terre que `earth-hd`, nommée « Terre » ;
  - le fournisseur annoncé de la Terre est `earth-hd` ;
  - une couche inconnue répond 404 au lieu de passer par GIBS.
- **Fonds marins** : `earth-gebco` et `earth-ncei` ne sont plus des fonds de carte. Leurs relais de tuiles restent :
  - GEBCO est déjà fondu au large dans la couche unique ;
  - la NOAA (ETOPO 2022) sera la teinte des océans vue de l'espace au lot 4.
- **Nuages et atmosphère de la Terre** : interrupteur à part, désactivé par défaut. Tant qu'il est désactivé, ni les
  nuages Xweather, ni la couverture nuageuse, ni le vent ne sont demandés. L'interrupteur « Atmosphère de Vénus et de
  Mars » reste activé.
- **Moniteur de performance** (Paramètres) : il s'affiche aussi sur téléphone et ajoute deux lignes pour la Terre :
  - première image et globe entier affichés, depuis l'ouverture de la page ;
  - requêtes de tuiles, octets reçus et requêtes annulées.

  C'est là que se relèvent les mesures sur iPhone.

## Mesures avant et après le lot 1 (banc)

Banc d'interface : Chrome sans écran, carte graphique logicielle (SwiftShader, environ 1 image par seconde), tuiles
d'essai servies en local. Les temps n'ont de valeur que les uns par rapport aux autres. Les images par seconde du banc
ne veulent rien dire : celles de l'iPhone se relèvent sur l'appareil, avec le moniteur.

| Mesure | Ordinateur 1440 × 900, avant | après | Téléphone 393 × 852, avant | après |
|---|---|---|---|---|
| Première image de la Terre (depuis l'ouverture) | 7,4 s | 5,5 s | 9,2 s | 5,1 s |
| Globe entier affiché (85 tuiles) | 73,1 s | 54,1 s | 105,4 s | 72,2 s |
| Requêtes de tuiles de la Terre | 85 | 85 | 85 | 85 |
| Requêtes nuages et vent à l'ouverture | 3 | 0 | 3 | 0 |
| Requêtes au total | 125 | 122 | 129 | 126 |

Poids du code de l'application, minifié, avec three.js, sans MUI (le banc remplace MUI) : 2 939 116 octets avant,
2 939 383 après (+ 267 octets ; + 67 octets compressé). C'est le coût du moniteur de la Terre et de l'entrée « Terre ».
Le vrai bundle mobile (Vite, avec MUI) se mesure au build de Render.

## Carte marine (lot 4) : sources vérifiées

| Source | Rôle | Licence | Mention | Débit |
|---|---|---|---|---|
| NOAA NCEI, ETOPO 2022 (service « DEM Global Mosaic », relief ombré en couleurs) | Vue de l'espace : teinte des océans | CC0 1.0, domaine public | NOAA National Centers for Environmental Information. 2022 : ETOPO 2022 15 Arc-Second Global Relief Model. doi:10.25921/fd45-gt74 | Aucune limite publiée |
| GEBCO, grille GEBCO_2026 (publiée en avril 2026 ; couches WMS `GEBCO_Latest` sur 2026 depuis août 2026) | Zoom : relief des fonds, isobathes | Domaine public, à ne pas utiliser pour la navigation | GEBCO Compilation Group (2026) GEBCO_2026 Grid, doi:10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa | Aucune limite publiée |

Aucune autre source ne sera ajoutée sans accord. Le WMS de GEBCO n'a pas de couche d'isobathes : elles seront
tirées des couleurs de `GEBCO_Latest_2`, sans nouvelle source.
