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
