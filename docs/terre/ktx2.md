# Tuiles KTX2 de la Terre vue de loin

Les niveaux 0 à 6 de la Terre (couches `sentinel2` et `gibs`) peuvent être préconvertis en KTX2 et stockés dans BP
(table `earth_ktx2`). Une tuile KTX2 reste compressée dans la mémoire graphique : bien moins de mémoire et de chauffe
qu'un JPEG décodé, surtout sur iPhone.

- **Lecture** : `GET /api/v1/tiles/earth-ktx2/:layer/:z/:x/:y` (404 si la tuile n'est pas en base : l'app prend le JPEG),
  `GET /api/v1/tiles/earth-ktx2/status` (nombre de tuiles par couche et niveau).
- **Écriture** : uniquement par le script de préconversion, qui lit `DATABASE_URL` (aucune route d'écriture).

## Lancer la préconversion

Sur une machine qui a `basisu` dans le PATH (https://github.com/BinomialLLC/basis_universal) et l'adresse **externe**
de la base BP dans `DATABASE_URL` :

```
cd backend
npm run earth:ktx2                  # sentinel2 et gibs, niveaux 0 à 6
npm run earth:ktx2 -- gibs          # une couche
npm run earth:ktx2 -- sentinel2 4   # une couche, niveaux 0 à 4
```

Le script saute les tuiles déjà en base : on peut l'interrompre et le relancer. Sentinel-2 : seules les tuiles qui
touchent ses latitudes (−70° à 86°) sont converties ; le sud vient de GIBS.
