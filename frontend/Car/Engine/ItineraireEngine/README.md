# ItineraireEngine — modélisation d'un itinéraire

Modélise l'itinéraire renvoyé par `POST /api/v1/position/itineraire` (voir `backend/src/services/locations/position/itinerary.ts`).
Le modèle de l'utilisateur (Claude ou Mistral, avec sa clé) découpe le trajet A → B en **étapes** ; chaque étape a un
moyen de locomotion (`mode`) et **son moteur** :

| Dimension | Moyens (lignes de `modeTable.js`) |
|---|---|
| **3D** — véhicules volants (`FLIGHT_MODES`) | `avion`, `helicoptere`, `fusee`, `drone`, `ballon`, `planeur`, `autre-vol` |
| **2D** — véhicules qui roulent, marchent, glissent ou naviguent (`GROUND_MODES`) | `marche`, `course`, `velo`, `trottinette`, `moto`, `voiture`, `bus`, `tramway`, `metro`, `train`, `bateau`, `ski`, `cheval`, `autre-sol` |

Un moyen que le backend ne connaît pas (« tuk-tuk », « jetpack »…) prend le moteur générique de sa catégorie
(`autre-sol` ou `autre-vol`).

## Fichiers
- `geo.js` — géométrie sphérique pure : distance, grand cercle, cap, rééchantillonnage, lissage, projection.
- `groundEngine.js` — fabrique des moteurs 2D : tracé lissé selon le moyen, rééchantillonné, avec arrêts (bus, tram, métro, train).
- `flightEngine.js` — fabrique des moteurs 3D : grand cercle et profil d'altitude propre au véhicule (montée, croisière, descente ; arc de fusée).
- `modeTable.js` — une ligne de données par moyen de locomotion (style, vitesse, profil d'altitude) ; le moteur
  mutable `createModeEngine` (dans `modes.js`) devient le moteur d'un moyen à partir de sa ligne. Ajouter un moyen =
  ajouter une ligne.
- `modes.js` — registre, `modelSegment`, `modelItinerary`, `locate` (position sur l'ensemble au fil du temps).
- `render2d.js` — rendu canvas 2D (carte, tracés, arrêts, A et B, véhicule).
- `render3d.js` — rendu three.js (globe, trace au sol, trajectoire en altitude exagérée, véhicule ; glisser = tourner, molette = zoom).

L'interface est `Fairing/components/menus/Trajet/ItineraireView.jsx` (bouton « Itinéraire » de la fenêtre Trajet).
Tests : `node --test geo.test.js engines.test.js render2d.test.js` (le rendu 3D, qui demande WebGL, n'est pas testé ici).
