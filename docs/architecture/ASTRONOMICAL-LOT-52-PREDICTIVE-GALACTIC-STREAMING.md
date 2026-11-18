# Lot 52 — Predictive Galactic Streaming

## Objectif

Anticiper la direction de déplacement de la caméra céleste afin de demander une tuile Gaia supplémentaire avant qu'elle ne devienne le centre du champ observé. Le mécanisme complète le planificateur borné du lot 50 et la résidence mémoire du lot 51.

## Fonctionnement

- Échantillonnage des coordonnées ICRS (RA/Dec) à chaque mise à jour du planificateur.
- Calcul du déplacement angulaire avec correction du cosinus de la déclinaison et gestion du passage RA 0°/360°.
- Estimation de vitesse angulaire en degrés par seconde.
- Projection linéaire à horizon borné, plafonnée en distance angulaire.
- Ajout d'au plus une tuile prédictive, après les tuiles du champ courant dans la priorité de chargement.
- Épinglage de cette tuile par le gestionnaire de résidence tant qu'elle fait partie du voisinage demandé.
- Aucun chargement supplémentaire si la caméra est immobile ou si le déplacement est inférieur au seuil.

## Paramètres moteur

Le planificateur du moteur est configuré avec :

| Paramètre | Valeur |
|---|---:|
| Horizon de prédiction | 1 200 ms |
| Déplacement maximal projeté | 2° |
| Vitesse minimale | 0,15°/s |
| Tuiles prédictives simultanées | 1 |
| Concurrence réseau | 1 |
| File maximale | 8 |

La prédiction ne change pas les plafonds de pagination Gaia par secteur. Elle reste soumise aux limites de file, de concurrence et de mémoire des lots précédents.

## Limites

La projection est cinématique et linéaire : elle ne modélise ni accélération, ni inertie réelle de caméra, ni trajectoire de navigation complexe. Les coordonnées de vue restent celles dérivées du vecteur Soleil-caméra, et non un véritable frustum optique. Les appels ESA Gaia n'ont pas été exécutés en direct pendant les tests.
