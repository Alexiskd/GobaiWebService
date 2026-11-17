# Gobai Space — architecture Fairing / Car

```text
Interface
└── Fairing/                         Interface React, HUD, menus, scene, theme, hooks

Car/                                 Moteurs de calcul et rendu
├── SystemeEngine/                   Orchestration, système, ressources, données orbitales
│   ├── api/                         Adaptateurs réseau historiques (à supprimer pour full-static)
│   ├── contributions/
│   ├── core/                        Scheduler, LOD, budgets GPU, ressources
│   └── data/astronomy/              Catalogue, éléments orbitaux, éphémérides
├── AstreSolideEngine/
│   ├── MapEngine/                   Cartes, projections, tuiles
│   ├── ReliefEngine/                Relief et géométrie d'élévation
│   ├── LidarEngine/                 Points, ancrage et drapage LiDAR
│   └── AtmosphereEngine/            Nuages et couches atmosphériques des astres solides
├── AstreGazeuxEngine/
│   └── AtmosphereEngine/            Atmosphères et structures des astres gazeux
├── StarEngine/                      Étoiles, systèmes stellaires, ciel
├── TextureEngine/                   Textures et mosaïques de surface
├── EruptionEngine/                  Volcanisme et surfaces actives
└── shared/                          Bibliothèques transverses et i18n
```

Les déplacements conservent les noms des modules et réécrivent les imports relatifs. Les répertoires `Fairing` et `Car` remplacent définitivement `composante` et `moteur`.
