# Gobai Space — JPL Horizons Core, Lot 1

## Portée

Ce lot ajoute un socle indépendant du moteur graphique existant. Il ne remplace pas `SolarEngine`, `bodyLoading.jsx`, `tiledBodies.jsx`, le moteur de tuiles ni les composants React. Aucun branchement automatique au rendu n'est effectué dans ce lot : l'intégration se fera après validation des contrats et des tests.

## Modules ajoutés

- `SystemRegistry` : registre en mémoire des systèmes/astres, avec `register`, `upsert`, `get`, `remove`.
- `PerivolumeManager` : calcule la distance caméra-centre et classe chaque objet en `ACTIVE`, `BACKGROUND` ou `UNLOADED`.
- `SystemManager` : orchestre l'évaluation des périvolumes, notifie les transitions et expose un profil de charge.
- `ResourceManager` : comptage de références pour empêcher la destruction prématurée d'une texture/géométrie partagée.

## Contrat de périvolume

Les coordonnées et rayons doivent utiliser la même unité. Le calcul utilise la distance euclidienne 3D entre la caméra et le centre. `radius` définit la zone active ; `backgroundRadius` définit la zone de travail réduit. Une hystérésis de 8 % par défaut limite les oscillations aux frontières.

Les formules de surface (sphère, cube, cylindre, etc.) ne déterminent pas cette proximité : elles ne sont pas utilisées comme seuil spatial.

## Profils

| État | Rendu | Mise à jour | Priorité |
|---|---:|---:|---:|
| ACTIVE | oui | oui | 100 |
| BACKGROUND | oui | non | 20 |
| UNLOADED | non | non | 0 |

`UNLOADED` signifie que l'orchestrateur peut demander la libération des ressources graphiques qui ne sont plus référencées. Les données orbitales/scientifiques ne doivent pas être supprimées automatiquement par ce gestionnaire.

## Validation

Tests unitaires ciblés : registre, transitions/hystérésis, profil de charge, comptage de références. Le lot reste volontairement non connecté à la boucle de rendu afin de préserver le comportement existant.
