# Lot 54 — Représentation 3D scientifique et intégrité du catalogue

## Objectif

Séparer les corps réellement référencés, les identités ambiguës, les doublons de lignes de catalogue et les limites de représentation 3D. Une absence de texture, de modèle 3D ou de tuile n'est jamais interprétée comme une absence d'astre.

## Identité et doublons

`AstronomicalCatalogIntegrity.js` audite les enregistrements avant assemblage :

- dédoublonnage automatique uniquement par identifiant exact du catalogue d'origine ;
- identifiant Gaia DR3 exact pour les étoiles, identifiant SIMBAD exact pour les lignes SIMBAD, nom canonique NASA pour les planètes NASA ;
- conservation des lignes sources fusionnées dans `sourceRecords` ;
- comparaison des coordonnées ICRS en secondes d'arc ;
- rapprochement par proximité conservé comme candidat, jamais fusionné automatiquement ;
- conflit de coordonnées pour un même identifiant exact signalé séparément.

`classifyAstronomicalExistence()` distingue `catalogued`, `sourced` et `unverified`. `catalogued` veut dire « présent dans une source identifiée », pas « preuve indépendante de réalité ». Une ligne Gaia est une mesure astrométrique, SIMBAD un référentiel de classifications et NASA Exoplanet Archive une table de paramètres planétaires.

## Inventaire du Système solaire local

Le dépôt contient deux vues techniques des satellites : `ALL_SATELLITES` (rayons, apparence et orbites de repli) et `ASTRES` (éléments orbitaux). Les 34 satellites sont représentés dans les deux fichiers, mais leurs identifiants sont uniques dans chaque table. Ces vues ne doivent pas être concaténées pour créer des meshes supplémentaires.

Référence orbitales : [JPL SSD — Planetary Satellite Mean Elements](https://ssd.jpl.nasa.gov/sats/elem/sep.html). JPL avertit que ces éléments moyens décrivent la forme générale et ne remplacent pas les éphémérides Horizons.

Commande d'audit :

```bash
npm run audit:astronomy
```

Elle contrôle les identifiants dupliqués, les satellites manquants dans la table orbitale, les divergences de demi-grand axe supérieures à 3 % entre vues et plusieurs valeurs de référence JPL.

## Corrections de données vérifiées

Les valeurs aberrantes du fichier `kepler-elements.ts` ont été corrigées pour :

- Pluton : Charon, Styx, Nix, Kerberos et Hydra ;
- Uranus : Puck ;
- Neptune : Triton, Protée et Néréide ;
- repères de référence des plans de Laplace pour Mars, Jupiter et Saturne.

Les pôles ICRF du plan de Laplace publiés par JPL sont maintenant utilisés lorsqu'ils sont disponibles (`referencePoleIcrf`). L'ancienne approximation par seuil de distance reste uniquement un repli si le pôle n'est pas fourni.

Attention : les éléments moyens JPL décrivent la forme et l'orientation générale de l'orbite. JPL précise qu'ils ne sont pas destinés au calcul d'éphémérides précises ; utiliser Horizons pour les positions de haute précision.

## Représentation des systèmes exoplanétaires

Le mode par défaut est maintenant `physical` :

- cohérence de l'échelle entre UA et rayons terrestres ;
- rayons connus convertis sans clamp visuel ;
- taille inconnue représentée par un marqueur ponctuel et explicitement signalée ;
- rayon stellaire affiché physiquement uniquement s'il est fourni ;
- aucune position 3D ni orbite orientée n'est inventée si l'inclinaison, le nœud ascendant, l'argument du périastre et sa convention ne sont pas validés.

Le mode `readable` reste disponible pour une visualisation lisible non à l'échelle, mais son statut est explicite dans le modèle de scène.

La requête NASA récupère `st_rad` pour dimensionner l'étoile hôte lorsque cette mesure existe, et `pl_radj` comme solution de repli convertie en rayons terrestres lorsque `pl_rade` manque. Référence : [NASA Exoplanet Archive — PSCompPars column definitions](https://exoplanetarchive.ipac.caltech.edu/docs/API_PSCompPars_columns.html). La table NASA PSCompPars ne fournit pas de `pl_orblnode` dans son schéma courant ; le normaliseur accepte ce champ s'il est fourni par une autre source, mais ne le fabrique pas. Le champ `pl_orblper` reste marqué comme convention à vérifier : NASA précise que la littérature utilise tantôt l'orbite de la planète, tantôt le mouvement réflexe de l'étoile, avec un décalage de 180°. Le mode physique masque donc l'orientation 3D tant que ces informations ne sont pas validées.

## Limites

- Aucun appel réseau live Gaia, SIMBAD, NASA ou JPL n'est réalisé par l'audit local.
- Les données de satellite restent un sous-ensemble, pas un inventaire exhaustif des satellites connus.
- Les éléments moyens képlériens ne modélisent pas toutes les perturbations, résonances et précessions.
- Le mode physique exoplanétaire peut masquer des corps si les données d'orientation ne sont pas suffisamment renseignées ; c'est volontaire pour éviter une position trompeuse.
