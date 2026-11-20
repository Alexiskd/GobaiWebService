# Gobai Space — JPL Horizons Core

| Lot | Contenu | État |
|---|---|---|
| 1 | Registre, gestion des périvolumes, orchestration des états et gestionnaire de ressources | Ajouté |
| 2 | Adaptateur LOD et ordonnanceur coopératif | Ajouté |
| 3 | Branchement du Core à SolarEngine et suivi dynamique des périvolumes | Ajouté, mode observation |
| 4 | Politique effective de priorité/visibilité et intégration progressive des chargements | À réaliser après validation du lot 3 |
| 5 | Gestion du cycle de vie des ressources graphiques avec propriété et références explicites | À réaliser |

Les lots 1 à 3 conservent les moteurs spécialisés existants. Les états du Core ne doivent pas déclencher de destruction graphique avant que l'ownership des ressources soit explicitement migré.
