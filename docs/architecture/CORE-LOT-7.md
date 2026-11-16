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
