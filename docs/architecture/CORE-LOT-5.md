# Core — Lot 5 : budgets mémoire des tuiles

## Objectif

Brancher les états de périvolume sur les caches L1 GPU et L2 RAM déjà présents dans `TileLayer`, sans créer un cache parallèle.

## Profils

- `ACTIVE` : restaure les capacités nominales configurées par l'astre.
- `BACKGROUND` : réduit le budget de rétention GPU/RAM tout en conservant un minimum pour la vue courante.
- `UNLOADED` : désactive la rétention RAM et ramène le cache GPU au nombre de tuiles nécessaires à la vue courante.
- L'astre ciblé est traité comme `ACTIVE`.

## Sécurité

- Les tuiles épinglées vivent dans une table dédiée et ne sont pas évincées par ce profil.
- Les tuiles de la vue courante sont protégées pendant le trimming du cache GPU.
- Les évictions passent par le callback LRU historique `TileLayer.evict`, qui libère les textures et gère le transfert RAM.
- Aucun `dispose()` global, aucune suppression de géométrie partagée et aucune annulation des téléchargements en cours.
- Le profil `ACTIVE` restaure les capacités nominales.

## Limites

Le profil `UNLOADED` ne détruit pas les objets épinglés, les sources, les modèles 3D ou les données orbitales. Il réduit uniquement les caches de tuiles du fond actif. Les caches secondaires (relief, océan, lumières) gardent leur cycle de vie propre.

## Diagnostic

`getCoreDiagnostics()` expose les tailles et capacités GPU/RAM par astre.
