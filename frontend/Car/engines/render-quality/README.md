# render-quality — qualité du rendu, FPS et surchauffe

Point d'entrée unique : les engines (tuiles, LiDAR, périvolume, Schwarzschild, atmosphères) lisent leurs budgets
ici au lieu de les calculer eux-mêmes.

| Fichier ou dossier | Rôle |
|---|---|
| `render-quality.module.js` | Assemble le service et ses briques ; un module par moteur 3D. |
| `render-quality.service.js` | Reçoit chaque image et chaque sonde du moteur, publie un relevé par seconde. |
| `metrics/` | Fenêtre d'une seconde (FPS, temps de frame, image la plus lente) et relevé figé. |
| `profiles/` | Profils Auto, Bas, Moyen, Haut et mode Auto (lot 2). |
| `thermal/` | Estimation de la chauffe et paliers de refroidissement (lot 3). |

## Relevé publié chaque seconde

`fps`, `frameMs`, `worstMs`, `cpuMs`, `gpuMs`, `drawCalls`, `triangles`, `gpuMemory` (`textures`, `geometries`),
`heapMb`. WebGL ne donne pas la mémoire GPU en octets : `gpuMemory` compte les textures et géométries chargées.

Aucun affichage, aucun log console.
