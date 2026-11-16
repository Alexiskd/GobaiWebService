# Lot 42 — Intégration interstellaire dans le moteur principal

## Objectif

Raccorder les lots 40 et 41 au `SolarEngine` existant, sans ajouter de backend et sans remplacer la boucle de rendu Three.js.

## Intégration

- `SolarEngine.initInterstellarIntegration()` instancie le client Gaia/SIMBAD/NASA et `InterstellarSceneRenderer` sur la scène Three.js principale.
- `loadInterstellarSystemByName(name)` recherche un système depuis le navigateur, calcule son modèle astrométrique et le place dans le repère global.
- `registerInterstellarSystem(starSystem)` ajoute le groupe au graphe de scène, enregistre son périvolume et ajoute une cible caméra.
- `focusInterstellarSystem(id)` déplace la caméra avec le mécanisme de focus existant.
- `removeInterstellarSystem(id)` libère le groupe, retire le périvolume et retire la cible de navigation.
- `getInterstellarSystems()` expose l'état des systèmes déjà chargés.
- Les positions planétaires sont recalculées à l'époque julienne courante, au maximum une fois par seconde, uniquement lorsque le système est `ACTIVE`.

## Cohérence des unités

Le Système solaire utilise `AU_UNITS` unités de scène par unité astronomique. Le placement global utilise donc :

`parsecToSceneUnits = AU_UNITS × 206264.80624709636`

Cette échelle permet de placer Proxima à environ 1,3 parsec, dans la portée du plan lointain de la caméra logarithmique existante. Les orbites exoplanétaires sont également exprimées en unités astronomiques et emploient le même `AU_UNITS` pour conserver leur échelle physique relative au Système solaire.

## Origine flottante

Les positions orbitales utilisent `AU_UNITS` pour rester cohérentes avec les unités du Système solaire. La scène du Système solaire recentre ses objets autour de `SolarEngine.target`. Les groupes interstellaires sont donc repositionnés à chaque frame à `positionGlobale - target`. La position globale des systèmes et la caméra sont converties dans le même repère pour évaluer les périvolumes : `cameraGlobale = cameraLocale + target`.

## Périvolumes

- Proxima Centauri utilise l'identifiant canonique `system:proxima-centauri`, correspondant à l'axiome externe Soleil / Proxima.
- Le rayon par défaut couvre au minimum 10 UA et s'élargit pour couvrir les orbites connues.
- `ACTIVE` garde le groupe visible et prioritaire.
- `BACKGROUND` garde le groupe visible mais marque sa simulation comme suspendue.
- `UNLOADED` masque le groupe et marque sa simulation comme suspendue. Les ressources ne sont pas détruites automatiquement dans ce lot.

## Interface

Le catalogue des astres comporte une section « Systèmes extrasolaires » avec recherche par nom, chargement à la demande et commande « Voir ». La valeur initiale est Proxima Centauri.

## Limites

- Les requêtes publiques Gaia, SIMBAD et NASA partent directement du navigateur ; elles dépendent de la disponibilité réseau et des règles CORS des fournisseurs.
- La résolution du nom doit fournir une position astrométrique avec distance exploitable. Sinon le système n'est pas ajouté à la scène globale.
- Le rendu est visuel et à échelle physique cohérente pour les positions globales et les unités orbitales, mais les tailles de sphères restent des tailles visuelles.
- Le groupe distant est masqué en `UNLOADED`, mais la destruction/recréation GPU et l'annulation de requêtes en vol ne sont pas implémentées ici.
- Le build Vite et les appels réels aux fournisseurs doivent être exécutés dans l'environnement de déploiement.
