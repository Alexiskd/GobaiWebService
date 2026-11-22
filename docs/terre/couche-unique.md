# Terre : une seule couche fusionnée

La Terre n'a plus qu'une couche d'imagerie, `earth-hd`. Elle fusionne toutes les sources, s'adapte au zoom et intègre
une carte marine (NOAA vue de l'espace, GEBCO en zoom).

Le travail se fait en cinq lots, une PR chacun :

1. inventaire, puis suppression des anciennes couches et interrupteurs (PR #56) ;
2. couche fusionnée et table de priorité des sources, servie par le serveur (PR #57) ;
3. paliers de zoom et budget de tuiles (PR #58) ;
4. carte marine NOAA / GEBCO (PR #59) ;
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
| Relief 3D | Paramètres › Cartographie en relief | désactivé |
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
- **Nuages et atmosphère de la Terre** : interrupteur à part, désactivé par défaut. Les nuages sont simulés : la météo en
  temps réel (Xweather, Open-Meteo, Rain Viewer) a été retirée de l'app le 20 novembre 2026. L'interrupteur « Atmosphère de Vénus et de
  Mars » reste activé.
- **Moniteur de performance** (Paramètres) : il s'affiche aussi sur téléphone et ajoute deux lignes pour la Terre :
  - première image et globe entier affichés, depuis l'ouverture de la page ;
  - requêtes de tuiles, octets reçus et requêtes annulées.

  C'est là que se relèvent les mesures sur iPhone.

## Lot 2 : couche fusionnée et table de priorité des sources

- **Table de priorité servie par le serveur** : `GET /api/v1/tiles/earth/plan` (`earth-plan.ts`), gardée un jour par le
  navigateur (`Cache-Control: public, max-age=86400, stale-while-revalidate=604800`). Pour chaque source :
  - son rang (1 = la plus prioritaire), dans l'ordre de la liste des sources ;
  - son emprise, ses niveaux natifs et son niveau bas de vue de loin ;
  - ses adresses chargeables par le navigateur ; sans adresse, la tuile passe par le relais.

  Les rangs : orthophotos nationales, de la plus petite emprise à la plus grande (l'IGN sur la France), puis Sentinel-2
  partout ailleurs, puis NASA GIBS pour les plus petits niveaux.
- **Le navigateur ne garde aucune règle en dur** : la description de la couche donne l'adresse de la table (`plan`) ; la
  source la lit (`earthPlan.jsx`) et en tire son plan de chargement direct.
- **Choix par cellule hexagonale** (`cellCandidates`, `earthDirect.jsx`) :
  - chaque tuile est rattachée à la cellule hexagonale qui contient son centre (fréquence 2^(z−3), une cellule couvre
    environ une tuile et demie de côté) ;
  - les sources dont l'emprise contient le centre de la cellule passent en premier, dans l'ordre de la table ;
  - toutes les tuiles d'une cellule prennent donc la même source ; les suivantes restent le repli (tuile vide hors du
    territoire, panne).
- **Aucun cache côté serveur** : le relais ne garde plus aucune tuile (seuls les téléchargements simultanés d'une même
  tuile sont partagés pendant leur trajet) et ses tuiles sont envoyées en `Cache-Control: no-store`.
- **Gardés tels quels** : colorimétrie commune (`ColorStats`), fondus entre niveaux des cellules, mosaïque instantanée
  (niveaux 0 à 3) comme fond immédiat.

Contrôle au banc, avec une table d'essai (une source « France », une source « monde ») :
- la table est lue une fois ;
- autour de Paris, les tuiles de France viennent de la source nationale, le reste de la source mondiale.

Sur le banc, la carte graphique logicielle ralentit tant la page que des chargements directs dépassent leur délai et
repassent par le relais (16 sur 70). Ce n'est pas le cas sur un vrai appareil.

## Lot 3 : paliers de zoom et budget de tuiles

La table du serveur (version 2) donne huit paliers, de l'espace à la rue. Le palier se choisit d'après la distance
affichée : l'altitude de la caméra en km. Chaque palier fixe le niveau de tuile le plus fin, un nombre maximal de tuiles
(ordinateur, téléphone) et les détails affichés.

| Palier | Jusqu'à | Niveau max | Tuiles ordinateur / téléphone | Océans | Côtes | Routes | Noms | Carte marine |
|---|---|---|---|---|---|---|---|---|
| Rue | 0,4 km | 19 | 560 / 420 | relief | oui | oui | oui | GEBCO |
| Quartier | 3 km | 19 | 560 / 420 | relief | oui | oui | oui | GEBCO |
| Ville | 40 km | 17 | 560 / 420 | relief | oui | oui | oui | GEBCO |
| Région | 400 km | 14 | 520 / 400 | relief | oui | oui | oui | fondu NOAA → GEBCO |
| Pays | 2 500 km | 10 | 440 / 340 | teinte | oui | non | oui | fondu NOAA → GEBCO |
| Continent | 9 000 km | 8 | 360 / 280 | teinte | oui | non | oui | NOAA |
| Planète (un palier tous les 10 000 km) | 10 000 à 300 000 km | 6 à 4 | 480 / 360 à 320 / 240 | teinte | non | non | non | NOAA |
| Espace | au-delà | 3 | 170 / 170 | teinte | non | non | non | NOAA |

- Le navigateur prend les paliers dans la table ; sans table, rien ne change (aucune limite).
- Budget : les tuiles les plus prioritaires (centre de l'écran d'abord) ; les autres cellules gardent un niveau moins
  fin. En mode économie d'énergie, le budget passe à 60 % (64 tuiles au moins).
- Chargement limité au champ (`fieldOnly` dans la table) : pas de préchargement hors champ, et les tuiles hors champ
  quittent la carte graphique dès qu'elles ne sont plus voulues (leurs ancêtres restent pour le repli ; la mosaïque
  instantanée reste épinglée).
- Les routes ne sont demandées qu'aux paliers qui les affichent.
- Le moniteur de performance affiche le palier en cours, son niveau max et le budget de l'appareil.

Mesures au banc (même banc que le lot 1 ; vue lointaine, puis vol vers Paris à 300 km d'altitude, 45 s) :

| Mesure | Ordinateur, lot 2 | lot 3 | Téléphone, lot 2 | lot 3 |
|---|---|---|---|---|
| Palier, vue lointaine | aucun | Planète | aucun | Planète |
| Budget de tuiles, vue lointaine | sans limite | 120 | sans limite | 100 |
| Palier à 300 km | aucun | Région | aucun | Région |
| Budget de tuiles à 300 km | sans limite | 260 | sans limite | 200 |
| Tuiles sur la carte graphique à 300 km | 12 | 9 | 7 | 7 |
| Requêtes de tuiles après le vol | 5 | 5 | 8 | 8 |
| Requêtes hors du champ (à plus de 40° de Paris) | 0 | 0 | 0 | 0 |

Sur le banc (environ 1 image par seconde), le vol n'atteint que les niveaux 7 et 8 : le budget n'y est pas atteint. Le
plafond des niveaux et le budget se vérifient sur l'appareil, avec le moniteur (ligne « Palier »).

## Lot 4 : carte marine NOAA / GEBCO

La table du serveur (version 3) décrit la carte marine (`marine`) ; le navigateur la fait sous le masque de la mer des
altitudes Terrarium, gardé tel quel (l'eau peu profonde des côtes, au-dessus de −10 m, garde l'image satellite ; la
pleine mer, sous −50 m, montre la carte marine).

| Niveau des tuiles | Étape (colonne « marine » des paliers) | Image des fonds |
|---|---|---|
| 0 à 8 (espace, planète, continent) | NOAA | Teinte des océans NOAA NCEI, ETOPO 2022 |
| 9 à 14 (pays, région) | fondu | NOAA fondue dans GEBCO, part de GEBCO de 1/7 à 6/7 niveau par niveau |
| 15 et plus (ville, quartier, rue) | GEBCO | GEBCO 2026 seule, en relief ombré, avec isobathes |

- Seuils : la colonne « marine » des paliers de la table (dernier niveau NOAA, premier niveau GEBCO). Changer la table
  sur le serveur déplace le passage, sans toucher au navigateur.
- Durée du fondu : `marine.fadeMs` (600 ms), appliquée aux fondus entre niveaux de la Terre, donc au passage NOAA →
  GEBCO. « Réduire les animations » du système garde un changement immédiat.
- Isobathes : tirées de la carte plate colorée de GEBCO (`GEBCO_LATEST_2`, nouveau relais `earth-gebco-flat`, en PNG) ;
  chaque limite entre deux bandes de couleur (12 bandes de luminance) suit une ligne d'égale profondeur. Tracées en
  pleine mer seulement, trait assombri de 45 %. Pas de profondeur écrite sur les lignes.
- Seules les images utiles au niveau de la tuile sont demandées : NOAA seule au loin, NOAA et GEBCO pendant le fondu,
  GEBCO et sa carte plate de près ; au-delà du niveau 10, elles sont découpées dans leur ancêtre de niveau 10.
- Mentions : dans la table (`marine.credits`) et dans la fenêtre Node, onglet « Sources et Entreprises » (NOAA NCEI
  ETOPO 2022, GEBCO 2026, « pas pour la navigation »).
- `EARTH_SEAFLOOR=0` coupe la carte marine (table `marine: null`).

Contrôle dans le vrai navigateur (banc, images d'essai : NOAA bleu foncé, GEBCO bleu, carte plate en deux bandes) :

| Tuile | Couleur obtenue | Images demandées |
|---|---|---|
| Niveau 5 | NOAA seule (20, 40, 120) | NOAA |
| Niveau 12 | fondu à 4/7 (31, 69, 143) | NOAA et GEBCO (niveau 10) |
| Niveau 15 | GEBCO seule (40, 90, 160), 1 024 pixels d'isobathe | GEBCO et carte plate (niveau 10) |

Vue lointaine : 19 images NOAA (niveaux 0 à 2), aucune image GEBCO. Durée des fondus lue dans la table : 600 ms (0 avec
« réduire les animations »).

## Lot 5 : mesures finales (banc)

Comparaison entre l'application d'avant le lot 1 (`f757a70`) et celle d'après le lot 4 (`21b8dc4`), sur le même banc
que le lot 1 : Chrome sans écran, carte graphique logicielle (SwiftShader, environ 1 image par seconde), tuiles
d'essai servies en local. Les deux versions fondent les fonds marins : GEBCO partout avant, carte marine NOAA / GEBCO
après. Sur le banc, tout le globe est de la mer (altitude d'essai : −4 000 m), ce qui donne le pire cas : chaque tuile
demande aussi son image des fonds et ses altitudes. Les temps ne valent que les uns par rapport aux autres.

Ouverture (depuis le chargement de la page) :

| Mesure | Ordinateur 1440 × 900, avant | après | Téléphone 393 × 852, avant | après |
|---|---|---|---|---|
| Première image de la Terre | 18,0 s | 12,5 s | 27,1 s | 9,8 s |
| Globe entier affiché (mosaïque instantanée, 85 tuiles) | 202,4 s | 158,7 s | 310,0 s | 140,8 s |
| Requêtes de tuiles de la Terre | 85 | 98 | 85 | 85 |
| Requêtes de la carte marine (images des fonds et altitudes) | 170 | 170 | 170 | 170 |
| Requêtes nuages et vent | 3 | 0 | 3 | 0 |
| Requêtes au total | 297 | 306 | 305 | 302 |

Vol vers Paris à 300 km d'altitude (45 s) :

| Mesure | Ordinateur, avant | après | Téléphone, avant | après |
|---|---|---|---|---|
| Tuiles de la Terre chargées pendant le vol | 16 | 27 | 16 | 32 |
| Tuiles demandées hors du champ (à plus de 40° de Paris) | 0 | 0 | 0 | 0 |
| Niveau le plus fin atteint | 7 | 7 | 8 | 8 |
| Requêtes de la carte marine | 8 | 8 | 8 | 10 |

Poids du code de l'application, minifié, avec three.js, sans MUI (le banc remplace MUI) : 2 939 116 octets avant,
2 945 556 après (+ 6 440 octets ; + 3 080 octets compressé : table, paliers, carte marine, moniteur).

Lecture :
- La première image arrive plus tôt (− 31 % sur ordinateur, − 64 % sur téléphone), et le globe entier aussi (− 22 % et
  − 55 %).
- Pendant le vol, 1,7 à 2 fois plus de tuiles arrivent dans le même temps.
- Les 13 tuiles de plus à l'ouverture sur ordinateur viennent vraisemblablement de chargements directs trop lents sur
  ce banc, redemandés au relais (comme au lot 2, non recompté ici) ; le téléphone n'en a aucune.
- Aucune requête hors du champ, avant comme après.
- Nuages et vent ne sont plus demandés à l'ouverture.
- Le banc est saturé : les tuiles de la carte graphique n'y sont pas encore prêtes au bout de 45 s (0 avant comme
  après), et le budget des paliers n'y est jamais atteint.

### Sur iPhone (≥ 15) et sur ordinateur

Ces mesures ne peuvent pas être faites dans cet environnement : pas d'appareil, pas de vraie carte graphique, réseau
coupé. Après déploiement sur Render, ouvrir le moniteur de performance (il s'affiche aussi sur téléphone) et relever :

- « Terre » : première tuile, globe prêt, requêtes, octets reçus, annulations ;
- « Palier » : palier en cours, niveau le plus fin, budget de tuiles de l'appareil ;
- images par seconde, en vue de l'espace, au palier Région et au palier Ville, avec et sans économie d'énergie.

Les relever sur iPhone ≥ 15 (Safari) et sur ordinateur (Chrome), avant et après un vol de l'espace vers une côte, pour
voir aussi le passage NOAA → GEBCO et les isobathes.

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

Aucune autre source ne sera ajoutée sans accord. Le WMS de GEBCO n'a pas de couche d'isobathes : elles sont tirées
des couleurs de `GEBCO_LATEST_2` (même grille, même service), sans nouvelle source.
