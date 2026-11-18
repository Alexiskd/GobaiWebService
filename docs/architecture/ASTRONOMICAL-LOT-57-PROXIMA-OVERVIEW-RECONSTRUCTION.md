# Lot 57 — Proxima Centauri visible dans la vue globale

## Objectif

Le Système solaire conserve son échelle locale actuelle (AU_UNITS). Proxima Centauri est désormais pré-enregistrée au démarrage, sans requête réseau, et son système planétaire est reconstitué en mode lisible/schématique.

## Placement global

- La direction et la distance relative de Proxima proviennent de son enregistrement astrométrique de référence (ICRS, parallaxe et propagation temporelle).
- Le placement interstellaire utilise une échelle d'aperçu compressée : **1 pc d'affichage = 512 UA de scène**.
- Le facteur de compression par rapport à la distance physique est `206264.806247 / 512 ≈ 402.86`.
- Pour Proxima (environ 1.30 pc), la distance d'affichage est environ 667 UA de scène, soit environ 15.6 millions d'unités avec `AU_UNITS=23455`.
- Cette compression ne modifie pas les dimensions ni les orbites du Système solaire. Elle s'applique uniquement aux coordonnées interstellaires globales.
- La limite de zoom caméra existante (`MAX_DISTANCE=6e7`) permet d'englober cette position.

## Rendu

- Un marqueur stellaire global rouge-orangé, indépendant du détail local, est maintenu à environ 9 pixels de diamètre.
- Le LOD `STAR` montre ce marqueur ; `PLANETS` et `DETAILED` montrent le système planétaire local.
- Le système est ajouté au catalogue et au spatial index dès l'initialisation.
- Le périvolume local reste de 10 UA ; le rayon de résidence visuelle `BACKGROUND` est porté à 3 pc d'affichage.
- L'axiome externe Soleil/Proxima est conservé : quand un système est réellement actif dans son périvolume, l'autre est déchargé.
- La cible caméra de Proxima utilise sa position globale, et non la position locale recentrée par l'origine flottante.

## Reconstitution locale

- Proxima Centauri : étoile de type M, couleur rouge-orangé, rayon indicatif.
- Proxima b : un marqueur planétaire, orbite elliptique et période approximatives.
- Le plan orbital est volontairement schématique ; il ne s'agit pas d'une solution orbitale 3D certifiée.
- Le Système solaire n'est pas touché par cette simplification.

## Limites

- La compression interstellaire est une convention de visualisation non linéaire entre systèmes, pas une échelle physique uniforme avec le Système solaire.
- La position dans le ciel conserve l'orientation ICRS, mais l'objet doit se trouver dans le champ de caméra pour être visible à l'écran.
- Le rendu réel dans le navigateur et le build Vite doivent être confirmés après installation des dépendances.

## Cause de l'absence dans la version précédente

Trois conditions empêchaient l'affichage au dézoom : le catalogue ne pré-enregistrait pas Proxima au démarrage ; l'échelle parsec physique plaçait l'étoile à plusieurs milliards d'unités, au-delà du zoom maximal ; enfin, le rayon BACKGROUND par défaut ne couvrait que quelques dizaines d'UA. Le lot corrige ces trois points.
