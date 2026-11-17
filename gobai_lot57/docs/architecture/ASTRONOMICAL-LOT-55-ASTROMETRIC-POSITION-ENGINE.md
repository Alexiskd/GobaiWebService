# Lot 55 — Astrometric Position Engine et Proxima Centauri

## Objectif

Transformer une astrométrie cataloguée en position 3D héliocentrique à une époque cible, puis en coordonnées de scène Gobai. Le moteur est réutilisable pour les étoiles Gaia/SIMBAD disposant d'une époque, d'une parallaxe et de paramètres de mouvement.

## Modèle physique

- Repère directionnel : ICRS.
- Coordonnées sphériques : RA/Dec en degrés.
- Parallaxe : mas, distance initiale `d(pc) = 1000 / parallax(mas)`.
- Mouvement propre RA : `mu_alpha* = d(alpha)/dt * cos(dec)`, en mas/an.
- Mouvement propre Dec : mas/an.
- Vitesse radiale : km/s, signe positif en éloignement ; négatif en approche.
- Propagation rectiligne 3D : `r(t) = r0 + v * (t - t0)` en années juliennes.
- Sortie : RA/Dec, distance, parallaxe propagée, vecteur position ICRS en pc, vecteur vitesse en pc/an et vitesses tangentiel/radiale/totale.

La propagation est une approximation rectiligne à vitesse constante. Elle n'intègre ni accélération gravitationnelle, ni orbite de Proxima autour du barycentre Alpha Centauri AB, ni covariance complète de la solution astrométrique.

## Proxima Centauri

Enregistrement fourni :

- SIMBAD ICRS J2000 : RA `217.4289422216058°`, Dec `-62.67949018907555°`.
- Parallaxe : `768.0665 mas`.
- Mouvement propre : `mu_alpha* = -3781.741 mas/an`, `mu_delta = +769.465 mas/an`.
- Vitesse radiale héliocentrique : `-20.578199 km/s`.
- Identifiant croisé Gaia DR3 : `5853498713190525696`.

**Traçabilité :** les mesures sont reprises de la fiche SIMBAD et de ses références bibliographiques ; l'identifiant Gaia DR3 est un identifiant croisé. Le jeu embarqué n'est pas présenté comme une ligne Gaia DR3 brute. Pour un calcul de précision, remplacer l'enregistrement par les colonnes natives Gaia DR3 (`ra`, `dec`, `ref_epoch`, `parallax`, `pmra`, `pmdec`, `radial_velocity`) et leur matrice de covariance.

## Intégration scène

`buildInterstellarSystemModel(starSystem, { targetEpoch })` propage le vecteur si coordonnées et parallaxe sont disponibles. `InterstellarSceneRenderer.updateSystemEpoch(id, targetEpoch)` met à jour la position globale d'un système déjà inscrit sans reconstruire le sous-système planétaire local.

Export de données de référence :

```js
import {
  calculateProximaCentauriPosition,
  createProximaCentauriAstrometricRecord,
} from './data/astronomy/index.js';

const state = calculateProximaCentauriPosition(2026, {
  parsecToSceneUnits: 1000,
});
```

## Limites et conventions

- Le calcul utilise une vitesse rectiligne constante en repère ICRS et une conversion héliocentrique pour la scène.
- La vitesse radiale SIMBAD est héliocentrique ; le calcul ne doit pas être qualifié de barycentrique.
- Les coordonnées J2000 et les paramètres de mouvement SIMBAD compilés sont propagés ensemble comme un état de référence pratique ; ce n'est pas une solution Gaia DR3 homogène native.
- Sans parallaxe positive, le moteur existant conserve la propagation tangentielle et ne fabrique pas de distance 3D.
- Les incertitudes sont signalées dans la provenance ; aucune covariance n'est inventée.

## Validation

Tests unitaires dédiés : identifiants/provenance, clonage, distance par parallaxe, déplacement temporel, rapprochement radial, conversion scène et propagation d'un système dans le renderer.
