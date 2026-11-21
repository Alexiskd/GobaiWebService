# Gobai Space — architecture Car / Fairing / Computing / Transmission

```text
frontend/
└── Car/                                 Application (ex-dossier src)
    ├── Engine/                          Moteurs de calcul et rendu (modélisation 3D)
    │   ├── SystemeEngine/               Orchestration, système, ressources, données orbitales
    │   │   ├── core/                    atlas/ · budget/ · galactic/ · render/ · system/ : atlas de satellites, budgets GPU, flux galactique, boucle de rendu, registres
    │   │   ├── PerivolumeEngine/        Périvolumes : gestionnaire, axiomes, géométrie, sphères dessinées (E = mc²)
    │   │   └── astronomy/               Catalogue, éléments orbitaux, éphémérides
    │   ├── AstreSolideEngine/
    │   │   ├── MapEngine/               Cartes et projections ; tiles/ · loading/ · earth/ · hex/
    │   │   ├── ReliefEngine/            Relief et géométrie d'élévation
    │   │   ├── LidarEngine/             Ancrage et rendu des nuages de points des contributions
    │   │   ├── AtmosphereEngine/        Nuages et couches atmosphériques des astres solides
    │   │   ├── BodyEngine/              Astres : types, booléens d'affichage, chargement, données, astres tuilés
    │   │   ├── OrbitEngine/             Orbites, éphémérides, rubans d'orbite, gravité
    │   │   ├── MoonEngine/              Lune : éphémérides, modèle, orbite, orbiteurs
    │   │   ├── SatelliteEngine/         Satellites naturels et leurs périvolumes
    │   │   ├── LabelEngine/             Noms des villes et des pays, frontières, lieux
    │   │   ├── CameraEngine/            Caméra : inclinaison, focus, verrouillage, vol de zoom, échelles
    │   │   ├── InputEngine/             Entrées : souris, toucher, boussole, GPS, repère de l'utilisateur
    │   │   └── PerfEngine/              Mesure des images par seconde, économie d'énergie, purge du stockage
    │   ├── AstreGazeuxEngine/
    │   │   └── AtmosphereEngine/        Atmosphères et structures des astres gazeux
    │   ├── StarEngine/                  Étoiles, systèmes stellaires, ciel
    │   ├── TextureEngine/               Textures et mosaïques de surface
    │   ├── EruptionEngine/              Volcanisme et surfaces actives
    │   └── shared/                      Bibliothèques transverses (lib/app, lib/device) et i18n
    ├── Fairing/                         Interface React, HUD (hud/node, hud/perf, hud/recherche), menus, scène, thème, hooks
    ├── Computing/                       Iframing et API
    │   ├── embed/                       Point d'entrée de la page d'embarquement (iframe)
    │   └── api/                         Client HTTP et adaptateurs de l'API (le serveur est dans backend/)
    └── Transmission/                    Mise en base de données
        └── persistence/                 Mappage et dépôt des données astronomiques
```

Les quatre branches `Engine`, `Fairing`, `Computing` et `Transmission` remplacent définitivement l'ancien découpage `Car` / `Fairing` du dossier `src`, qui n'existe plus.
