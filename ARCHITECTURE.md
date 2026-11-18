# Gobai Space — architecture Car / Fairing / Computing / Transmission

```text
frontend/
└── Car/                                 Application (ex-dossier src)
    ├── Engine/                          Moteurs de calcul et rendu (modélisation 3D)
    │   ├── SystemeEngine/               Orchestration, système, ressources, données orbitales
    │   │   ├── core/                    Scheduler, LOD, budgets GPU, ressources
    │   │   └── data/astronomy/          Catalogue, éléments orbitaux, éphémérides
    │   ├── AstreSolideEngine/
    │   │   ├── MapEngine/               Cartes, projections, tuiles
    │   │   ├── ReliefEngine/            Relief et géométrie d'élévation
    │   │   ├── LidarEngine/             Points, ancrage et drapage LiDAR
    │   │   └── AtmosphereEngine/        Nuages et couches atmosphériques des astres solides
    │   ├── AstreGazeuxEngine/
    │   │   └── AtmosphereEngine/        Atmosphères et structures des astres gazeux
    │   ├── StarEngine/                  Étoiles, systèmes stellaires, ciel
    │   ├── TextureEngine/               Textures et mosaïques de surface
    │   ├── EruptionEngine/              Volcanisme et surfaces actives
    │   └── shared/                      Bibliothèques transverses et i18n
    ├── Fairing/                         Interface React, HUD, menus, scène, thème, hooks
    ├── Computing/                       Iframing et API
    │   ├── embed/                       Point d'entrée de la page d'embarquement (iframe)
    │   └── api/                         API NestJS (contrôleurs, services) et client HTTP des adaptateurs
    └── Transmission/                    Mise en base de données
        └── persistence/                 Mappage et dépôt des données astronomiques
```

Les quatre branches `Engine`, `Fairing`, `Computing` et `Transmission` remplacent définitivement l'ancien découpage `Car` / `Fairing` du dossier `src`, qui n'existe plus.
