# Moteur orbital simplifié

Le moteur utilise deux calculs locaux :

- **Planètes** : les fonctions existantes de `planetOrbits.jsx` (VSOP87 lorsqu'une série est disponible, sinon éléments képlériens).
- **Satellites naturels** : cercle orbital calculé à partir de `aKm` et `periodDays`, avec époque de référence J2000. Si le pôle du parent est connu, le plan du cercle est orienté selon ce pôle.

La position et la vitesse du satellite sont calculées dans `satelliteMath.jsx`. La vitesse est estimée par différence centrée entre deux positions proches.

Aucun appel réseau, aucune requête JPL Horizons et aucune table d'éphémérides distante ne sont nécessaires.

## Limite du modèle satellite

Les satellites utilisent une orbite circulaire indicative. Le catalogue actuel ne fournit pas systématiquement les paramètres complets (`e`, `i`, `Ω`, `ω`, `M0`) nécessaires à une propagation képlérienne elliptique individualisée. Les trajectoires ne doivent donc pas être interprétées comme des éphémérides de précision.
