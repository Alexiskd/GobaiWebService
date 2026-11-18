# Méthodologie de relief planétaire — adaptation Terre / Lune vers Mars

## 1. Principe

Le moteur sépare trois produits qui ne doivent pas être confondus :

1. **Albédo / imagerie** : couleur de surface (Viking/CTX).
2. **DEM** : valeur numérique d'altitude par pixel, en mètres.
3. **Hillshade** : image calculée à partir du DEM pour donner une impression de relief ; elle ne doit jamais être décodée comme une altitude.

La Terre utilise déjà le principe DEM → tuiles Terrarium → déplacement du maillage et calcul des normales. La Lune applique le même pipeline aux mesures laser LOLA. Mars reprend maintenant cette architecture, mais avec les mesures altimétriques MOLA et les données HRSC-MOLA comme source de secours.

## 2. Sources et référentiels

- **Mars MOLA MEGDR** : grille mondiale issue des mesures laser de Mars Global Surveyor. Le produit topographique est exprimé au-dessus de l'aréoïde martien. La version 128 pixels/degré correspond à environ 463 m/pixel à l'équateur. Les produits MOLA sont disponibles en plusieurs résolutions et en tuiles polaires spécifiques.
- **Mars HRSC-MOLA Blend DEM** : produit combinant MOLA et HRSC pour apporter davantage de détail là où les données HRSC sont disponibles.
- **Lune LOLA** : le DEM LOLA est une grille issue des mesures altimétriques laser, interpolées/binnées sur une grille régulière. C'est la méthode retenue pour préserver les cratères et bassins.
- **Terre** : SRTM / Copernicus / Mapterhorn illustrent le pipeline de mosaïquage, de traitement des valeurs manquantes, de rééchantillonnage et de rendu des altitudes.

Pour Mars, la carte MOLA « color shaded relief » de Trek est uniquement une représentation colorisée et ombrée. Elle ne constitue pas une couche numérique d'altitude. Le service de relief demande donc un raster DEM numérique en pixels flottants (F32).

## 3. Pipeline par tuile

1. Calculer l'emprise géographique XYZ dans la projection équirectangulaire martienne (MarsEC0).
2. Convertir longitude/latitude en mètres avec le rayon de référence de 3 396 190 m.
3. Interroger l'ImageServer DEM avec `pixelType=F32`, `format=tiff`, interpolation bilinéaire et une image 256 × 256.
4. Décoder le TIFF en `Float32Array`.
5. Garder les valeurs signées en mètres au-dessus de l'aréoïde ; transformer les valeurs nodata et les valeurs hors plage plausible en `NaN`.
6. Réencoder la grille en Terrarium PNG : `H = R × 256 + G + B / 256 − 32768`. Le décalage 32768 conserve les altitudes négatives des bassins.
7. Mettre en cache mémoire et, si `DATABASE_URL` est configurée, dans PostgreSQL.
8. Le shader décode les pixels, calcule les pentes à partir des voisins et applique l'ombrage. Les normales suivent le relief, sans utiliser les couleurs de l'image comme substitut d'altitude.

## 4. Modèle GLB

Le modèle 3D échantillonne le DEM sur une grille longitude/latitude. Pour chaque sommet :

`r = R_Mars + (altitude_m / 1000) × facteur_exagération`

Puis conversion sphérique vers XYZ, génération des UV, des triangles et des normales. Le facteur d'exagération est un paramètre visuel ; la valeur d'altitude d'origine reste en mètres et n'est pas modifiée. Le modèle est généré à la demande à partir des tuiles numériques, avec 360, 720 ou 1 440 colonnes.

## 5. Résolution et limites

- MOLA global : 128 pixels/degré, environ 463 m/pixel à l'équateur.
- Les zones polaires ont des produits spécifiques ; la grille équirectangulaire globale ne doit pas être présentée comme une couverture polaire haute résolution.
- Les données HRSC peuvent améliorer localement la résolution ; la résolution n'est pas uniforme sur toute la planète.
- Les trous interpolés dans les produits sources restent des estimations de la donnée source. Le pipeline ne prétend pas créer de détails topographiques absents.
- Le niveau de modèle global actuel est volontairement grossier pour rester raisonnable en mémoire. Les tuiles à zoom supérieur gardent les détails locaux pour le rendu interactif.

## 6. Réglages et routes

- `GET /api/v1/tiles/mars-relief/status` : état de la source et du cache.
- `GET /api/v1/tiles/mars-relief/{z}/{x}/{y}.png` : tuile d'altitude Terrarium.
- `GET /api/v1/tiles/mars-relief/model.glb?cols=720&exaggeration=1` : modèle global GLB.
- `MARS_RELIEF_IMAGESERVER_URL` : ImageServer numérique HRSC-MOLA/USGS principal.
- `MARS_RELIEF_FALLBACK_IMAGESERVER_URL` : ImageServer MOLA global de NASA Mars Trek en secours.

## Références

- NASA/PDS Geosciences Node, MGS MOLA MEGDR : https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
- NASA PDS, MOLA MEGDR 128 ppd : https://pds.nasa.gov/ds-view/pds/viewCollection.jsp?identifier=urn:nasa:pds:mgs_mola_topography_derived:data_meg128
- USGS Astrogeology, Mars MGS MOLA DEM 463 m : https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m
- NASA Mars Trek API : https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- NASA Moon Trek LOLA GDRDEM : https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/LRO/LOLA/GDR/GDRDEM.htm
