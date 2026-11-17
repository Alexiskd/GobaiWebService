# Lot 56 — Gaia DR3 et incertitudes astrométriques 3D

## Objectif

Propager les incertitudes de la solution astrométrique Gaia DR3 jusqu'à la position cartésienne héliocentrique à une époque cible. Le lot ne fabrique aucune incertitude pour les enregistrements SIMBAD qui ne publient pas les erreurs et corrélations nécessaires.

## Données Gaia demandées

`AstronomicalCatalogService` sélectionne désormais les champs Gaia DR3 suivants :

- paramètres : `ra`, `dec`, `parallax`, `pmra`, `pmdec`, `radial_velocity`, `ref_epoch` ;
- erreurs : `ra_error`, `dec_error`, `parallax_error`, `pmra_error`, `pmdec_error`, `radial_velocity_error` ;
- corrélations : `ra_dec_corr`, `ra_parallax_corr`, `ra_pmra_corr`, `ra_pmdec_corr`, `dec_parallax_corr`, `dec_pmra_corr`, `dec_pmdec_corr`, `parallax_pmra_corr`, `parallax_pmdec_corr`, `pmra_pmdec_corr` ;
- contrôle de solution : `astrometric_params_solved`.

La référence d'époque est `ref_epoch`, exprimée en années juliennes. `pmra` suit la convention Gaia `mu_alpha* = mu_alpha cos(dec)`.

## Matrice de covariance

La matrice Gaia 5x5 suit l'ordre :

`[alpha*, delta, parallax, pmra, pmdec]`

Les termes diagonaux sont les variances issues des erreurs publiées. Les termes hors diagonale sont `rho_ij * sigma_i * sigma_j`. Une corrélation absente est mise à zéro et signalée comme hypothèse, elle n'est pas interpolée.

Si `radial_velocity_error` est présent, une sixième dimension indépendante est ajoutée pour la vitesse radiale. Cette indépendance est une hypothèse explicite ; ce n'est pas une covariance RV-astrométrie fournie par Gaia.

## Propagation

La position nominale utilise le mouvement rectiligne 3D du Lot 55. La covariance cartésienne est calculée par linéarisation :

`C_xyz = J C_astrometry J^T`

`J` est le jacobien numérique de la position cartésienne en parsecs par rapport aux paramètres astrométriques. La sortie contient la covariance 3x3 en pc² et les écarts-types marginaux `sigmaPc.x/y/z`.

Cette covariance est locale/linéarisée. Elle ne remplace pas une propagation non linéaire Monte-Carlo, en particulier pour les parallaxes de faible rapport signal/bruit, ni une modélisation de l'accélération gravitationnelle.

## API

```js
import {
  gaiaDR3RowToAstrometricRecord,
  propagateAstrometricPositionCovariance,
  propagateAstrometricRecord,
} from './data/astronomy/index.js';

const record = gaiaDR3RowToAstrometricRecord(rawGaiaDr3Row);
const propagated = propagateAstrometricRecord(record, 2030.0);
// propagated.propagation ne contient que les métadonnées de propagation.
// La covariance 3D détaillée est disponible via :
const uncertainty = propagateAstrometricPositionCovariance(record, 2030.0);
```

`propagateAstrometricCoordinates(record, epoch)` ajoute automatiquement `positionUncertainty` si `record.astrometry.covariance` est fournie. Le renderer interstellaire expose cet état via `astrometricState`.

## Proxima Centauri

L'enregistrement embarqué du Lot 55 reste une compilation SIMBAD et ne possède pas de covariance Gaia native : le moteur n'y ajoute donc aucune ellipse artificielle. Le service Gaia peut récupérer la ligne DR3 brute via `findGaiaSource('5853498713190525696')`. Les valeurs, erreurs et corrélations réellement retournées par ESA doivent être utilisées à la place de la compilation SIMBAD pour un résultat Gaia homogène à `ref_epoch`.

## Limites

- Les corrélations absentes sont nulles.
- La vitesse radiale est considérée indépendante dans la matrice 6x6 si son erreur est fournie.
- Pas de covariance de vitesse radiale croisée publiée/ingérée.
- Pas de propagation Monte-Carlo.
- Pas de correction du biais de parallaxe ni de modèle de mouvement accéléré / binaire.
- Les erreurs en position sont utilisées dans le plan tangent local ; les sorties sont des écarts-types marginaux cartésiens, pas les axes propres d'un ellipsoïde diagonalisé.

## Validation

Tests unitaires : construction de covariance 5x5, symétrie, rejet des corrélations hors limites, normalisation de lignes Gaia, ajout optionnel de l'erreur RV, propagation de covariance 3D et intégration au résultat astrométrique.
