# Lot 33 — Astrometric Engine

## Objectif

Propager les coordonnées ICRS d'un objet stellaire depuis son époque de référence vers une époque cible, en exploitant les paramètres astrométriques normalisés du lot 31.

## API

- `propagateAstrometricCoordinates({ coordinates, astrometry }, targetEpoch)` : calcule une position propagée.
- `propagateAstrometricRecord(record, targetEpoch)` : conserve l'enregistrement et remplace les coordonnées par celles de l'époque cible, avec un bloc `propagation` explicatif.
- `propagateAstrometricBatch(records, targetEpoch)` : applique le calcul à un tableau.

Les époques sont des années juliennes décimales. Les coordonnées doivent être ICRS en degrés ; les mouvements propres sont en mas/an, la parallaxe en mas et la vitesse radiale en km/s.

## Méthodes numériques

Lorsque la parallaxe est strictement positive, le moteur construit une position cartésienne en parsecs et une vitesse composée des composantes tangentielle est/nord et radiale. Il propage la position en ligne droite sur l'intervalle d'époque, puis reconvertit le vecteur en RA/Dec. Cette approche gère naturellement le passage RA=0/360 et l'effet perspectif de la vitesse radiale.

Lorsque la parallaxe est absente, nulle ou négative, le moteur utilise une propagation tangentielle sur la sphère. La distance et la vitesse radiale ne sont alors pas estimables ; un avertissement explicite est renvoyé.

## Limites scientifiques

- Mouvement rectiligne uniforme : pas d'accélération, d'orbite binaire, de lentille ou de mouvement galactique modélisé.
- Pas de propagation de covariance ni d'incertitudes : les erreurs astrométriques ne sont pas fournies par le normaliseur actuel.
- Pas de précession/nutation, aberration annuelle, parallaxe topocentrique ou transformation vers un repère apparent ; la sortie reste ICRS.
- Les valeurs manquantes de mouvement propre sont traitées comme une composante nulle pour le calcul, mais leur absence reste signalée dans `used`.
- La propagation est une extrapolation cinématique des paramètres d'entrée, pas une éphéméride de précision.

## Tests

Les tests couvrent l'identité à époque constante, les deux composantes de mouvement propre, le franchissement RA 0/360, la vitesse radiale, l'absence de parallaxe, la conservation des métadonnées et les entrées invalides.
