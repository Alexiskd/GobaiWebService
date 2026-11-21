# Astre Solide Engine

Moteur des corps solides : planètes telluriques, lunes, astéroïdes et planètes naines. Il délègue les fonctions spécialisées à ses sous-moteurs.

## Sous-moteurs

- `MapEngine/`, `ReliefEngine/`, `LidarEngine/`, `AtmosphereEngine/` — cartes, relief, nuages de points (contributions), atmosphère.
- `BodyEngine/` — types d'astres, booléens d'affichage, chargement, données, astres tuilés.
- `OrbitEngine/` — orbites, éphémérides, rubans d'orbite, gravité.
- `MoonEngine/` — la Lune : éphémérides, modèle, orbite, orbiteurs.
- `SatelliteEngine/` — satellites naturels et périvolumes.
- `LabelEngine/` — noms des villes et des pays, frontières, lieux.
- `CameraEngine/` — inclinaison, focus, verrouillage, vol de zoom, échelles.
- `InputEngine/` — souris, toucher, boussole, GPS, repère de l'utilisateur.
- `PerfEngine/` — images par seconde, économie d'énergie, purge du stockage.

À la racine restent le moteur (`engine.jsx`), le magasin du HUD et quelques modules transverses.
