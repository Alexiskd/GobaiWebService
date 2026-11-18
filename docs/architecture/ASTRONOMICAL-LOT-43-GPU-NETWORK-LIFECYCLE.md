# Lot 43 — GPU & Network Lifecycle Manager

## Objectif

Rendre effectifs les états `ACTIVE`, `BACKGROUND` et `UNLOADED` pour les systèmes stellaires externes, en particulier lors des transitions de périvolume pilotées par `SystemManager`.

## Gestion GPU

- `InterstellarResourceLifecycleManager` centralise les transitions de ressources par identifiant de système.
- En `UNLOADED`, le sous-groupe planétaire est retiré de la scène et ses géométries et matériaux sont détruits via les hooks du renderer.
- En `ACTIVE` ou `BACKGROUND`, le sous-groupe est reconstruit à partir du modèle astronomique conservé en mémoire.
- Le groupe racine (repère global et cible de navigation) est conservé afin de garder l'identité de la cible et le périvolume.
- Le passage `BACKGROUND` conserve les ressources mais le profil de scène décide de son rendu et l'actualisation orbitale reste suspendue puisque seul `ACTIVE` est simulé.

## Réseau et cache

- Les recherches déclenchées par `loadInterstellarSystemByName` utilisent un `AbortController` par requête de nom ; une nouvelle recherche du même nom annule la précédente.
- La suppression du moteur annule toutes les recherches en cours.
- Les tâches réseau associées à un système déjà enregistré peuvent être raccordées via `attachInterstellarRequestController(id, controller)` ; le cycle de vie les annule en `UNLOADED` ou à la suppression du système.
- `AstronomicalCatalogService` garde son cache mémoire LRU/TTL (15 min, 100 entrées par défaut). Les réponses mises en cache évitent une nouvelle requête réseau.
- Une requête déjà terminée n'est pas annulable ; une entrée astronomique déjà résolue est conservée pour permettre la reconstruction GPU sans nouvel appel réseau.

## Limites

- La recherche initiale du catalogue est une action utilisateur préalable à l'enregistrement du périvolume ; elle ne peut donc pas être annulée par une sortie de périvolume qui n'existe pas encore. Les tâches réseau ultérieures doivent explicitement être raccordées avec `attachInterstellarRequestController`.
- Le cache reste en mémoire vive, sans IndexedDB ni persistance entre sessions.
- La libération porte sur les ressources Three.js propres au sous-groupe exoplanétaire ; elle ne purge pas le cache scientifique CPU.
- Les appels Gaia/SIMBAD/NASA n'ont pas été testés sur des services distants dans cet environnement.
