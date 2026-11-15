# Moteur atmosphérique de Gobai Space

Ce document décrit l'architecture du moteur atmosphérique, ce que contient le lot 1 et ce que prévoient les lots suivants. Il donne aussi, pour chaque source, sa licence et son quota.

## Principes

- **Format commun.** Chaque lecture d'un fournisseur devient un `AtmosphericEvent` (`backend/src/services/atmosphere/atmospheric-event.ts`). Un événement porte :
  - un identifiant unique et stable ;
  - son type ;
  - sa position et sa géométrie ;
  - son altitude ;
  - ses heures de détection et de validité ;
  - son intensité ;
  - sa confiance, de 0 à 1 ;
  - ses provenances : fournisseur, identifiant, heure de mesure et heure de lecture ;
  - sa résolution spatiale et temporelle ;
  - son statut : `observé`, `estimé` ou `prévu`.
- **Déduplication entre sources.** Deux lectures sont le même phénomène si elles ont la même clé (le nom d'un cyclone, par exemple) ou si elles sont proches à la fois dans l'espace et dans le temps. Elles sont alors réunies en un seul événement. Cet événement garde toutes les provenances et toutes les mesures (`details.readings`), si bien que les contradictions entre sources restent visibles.
- **Rien sans source fiable.** `AtmosphericEventManager` écarte un événement et note la raison dans les cas suivants :
  - il est périmé (l'âge maximal dépend de son type) ;
  - sa confiance est inférieure à 0,5 ;
  - il n'a aucune provenance ;
  - sa position est hors du globe.

  La route `/atmosphere/health` liste ces exclusions.
- **Aucun appel par image.** Chaque fournisseur est lu au plus une fois par période de rafraîchissement, fixée dans le registre `providers.ts`. Le cache `TtlCache` fonctionne ainsi :
  - les demandes simultanées partagent une seule lecture ;
  - si un fournisseur est en panne, sa dernière donnée connue est rendue, marquée périmée ;
  - après un échec, le fournisseur n'est pas rappelé pendant 2 minutes, pour respecter les quotas.

  Côté navigateur, les calques se rafraîchissent toutes les 15 à 30 minutes, et seulement quand l'onglet est visible.
- **Tuiles géographiques.** Le globe est découpé en tuiles de 10°.
  - La vue d'ensemble reçoit les points chauds agrégés en cellules de 0,5°.
  - En vue rapprochée, en dessous d'environ 3 000 km d'altitude, les points chauds arrivent un par un, tuile par tuile, autour du point visé : 16 tuiles au plus, 48 gardées en mémoire, 60 000 points au plus.
- **Clés.** Les clés restent sur le serveur. `/atmosphere/providers` indique seulement si elles sont présentes, jamais leur valeur.

## Lot 1 : ce qui est livré

| Moteur | Sources branchées (sans clé) | Données | Rendu |
|---|---|---|---|
| WildfireEngine | NASA FIRMS : VIIRS sur NOAA-20, NOAA-21 et Suomi NPP ; MODIS sur Terra et Aqua. NASA EONET pour les incendies déclarés | Points chauds avec position, heure de passage, satellite, puissance radiative (FRP), confiance, jour ou nuit. Incendies confirmés par une agence | Cellules agrégées vues de loin, points un par un vus de près, **anneaux pour les incendies confirmés**. Couleur selon la FRP, pâlissement avec l'âge, fenêtre de 3, 6, 12 ou 24 h |
| CycloneEngine | NOAA NHC (`CurrentStorms.json`). NASA EONET (trajectoires JTWC et NHC). GDACS | Centre, vent soutenu, pression, catégorie de Saffir-Simpson, trajectoire observée, déplacement estimé, contradictions entre sources | Tourbillon procédural posé sur le globe : bandes spiralées, œil à partir de la catégorie 1, rotation antihoraire au nord et horaire au sud. Trajectoire observée en ruban |
| AtmosphericEventManager | Toutes les sources ci-dessus | Format commun, déduplication, exclusions, contrôle | Sans objet |

Le lot 1 ajoute aussi la catégorie **Atmosphère** dans Paramètres. On y trouve :
- l'interrupteur des nuages et de l'atmosphère des planètes solides, qui se trouvait jusque-là dans « Repères » ;
- les interrupteurs Incendies et Cyclones, chacun avec son opacité et son intensité ;
- la fenêtre de temps des incendies ;
- la liste des calques à venir.

Routes du serveur, sous `/api/v1/atmosphere` :
- `fires` : points chauds agrégés et incendies confirmés ;
- `fires/tiles/{tx}/{ty}` : détail d'une tuile ;
- `cyclones` ;
- `events?types=&bbox=&limit=` : événements au format commun ;
- `providers` ;
- `health`.

### Distinctions imposées

- **Point chaud ou incendie confirmé.**
  - Un point chaud FIRMS est un pixel anormalement chaud. Il est observé mais **non confirmé** (`confirmed: false`), et il est dessiné comme un point lumineux.
  - Un incendie déclaré par une agence est marqué `confirmed: true` et dessiné comme un anneau.
  - Un point chaud peu sûr (VIIRS « low », MODIS sous 50 %) n'est affiché que si un autre satellite le confirme.
- **Observé, estimé ou prévu.**
  - La trajectoire d'un cyclone est observée : ce sont les positions publiées par les agences.
  - Son déplacement est estimé à partir des deux dernières positions.
  - Aucune trajectoire prévue n'est dessinée tant qu'aucune source de prévision n'est branchée.
- **Symbole ou géométrie mesurée.** La taille du tourbillon est un symbole par catégorie, de 150 à 440 km de rayon, car les rayons de vent ne sont pas encore fournis. Le sens de rotation, lui, est physique.

### Ce que les sources du lot 1 ne permettent pas

- **Rayons de vent des cyclones.** Le NHC les publie dans ses avis texte et ses fichiers SIG, mais pas dans le JSON.
- **Trajectoires prévues.** Elles sont disponibles en KMZ ou shapefile au NHC, et en BUFR à l'ECMWF.
- **Panaches de fumée.** Il faut les aérosols du CAMS.
- **Cyclones hors saison.** Un cyclone dont la dernière position date de plus de 36 h est écarté et listé avec sa raison. Le 15 novembre 2026, par exemple, Cempaka et Pena n'avaient plus de position récente.

## Lots suivants

| Lot | Moteur | Sources | Prérequis |
|---|---|---|---|
| 2 | CycloneEngine (suite) | Rayons de vent et trajectoire prévue : NHC SIG, ECMWF open data | Lecture KMZ/shapefile et BUFR, ou lecture des avis texte |
| 3 | LightningEngine | Xweather Lightning. Les clés `XWEATHER_CLIENT_ID` et `XWEATHER_CLIENT_SECRET` existent déjà sur Render | Vérifier que l'abonnement inclut la foudre. Prévoir un rendu procédural de l'éclair, distinct de la position mesurée |
| 3 | LightningEngine (repli) | NOAA GOES GLM, EUMETSAT MTG-LI, The Weather Company, AccuWeather | GLM : NetCDF public. LI : compte EUMETSAT. Les deux autres : clés `TWC_API_KEY` et `ACCUWEATHER_API_KEY` |
| 4 | StormEngine et PrecipitationEngine | WeatherAPI Radar, EUMETNET OPERA, NOAA MRMS | `WEATHERAPI_KEY`, accord OPERA, lecture GRIB2 pour MRMS |
| 5 | AerosolEngine | Copernicus CAMS, NASA Earthdata (AOD de MODIS et VIIRS) | `CAMS_ADS_KEY`, `EARTHDATA_TOKEN` |
| 6 | AtmosphericFlowEngine | Open-Meteo, vents par niveau de pression (déjà utilisé pour le flux des nuages) | Grille par altitude, rendu vectoriel 3D animé |

Ces fournisseurs sont déjà inscrits dans le registre avec `implemented: false`. `/atmosphere/providers` indique lesquels ont leurs clés.

## Licences et quotas des sources branchées

| Source | Licence | Quota | Rafraîchissement |
|---|---|---|---|
| NASA FIRMS, fichiers 24 h | Données NASA libres, mention demandée | Fichiers publics sans clé | 30 min |
| NASA EONET | Données NASA libres, mention demandée | API publique sans clé | 30 min |
| NOAA NHC | Domaine public | Fichier public | 15 min |
| GDACS | Utilisation libre avec mention | API publique sans clé | 30 min |

Les mentions s'affichent dans la fenêtre des sources quand un calque est allumé.

## Tests

- **Serveur.** Les specs des modules purs se trouvent dans `backend/src/services/atmosphere/*.spec.ts`. Elles couvrent :
  - la lecture FIRMS, la fusion entre satellites, les seuils, l'agrégation et le détail ;
  - la lecture d'EONET, NHC et GDACS ;
  - la fusion des cyclones, les contradictions et les exclusions ;
  - la déduplication et le gestionnaire ;
  - le cache, les tuiles et le registre.

  Elles s'écrivent comme des specs jest. Pour les lancer : `npm test` dans `backend/`.
- **Navigateur.** Les tests couvrent `fireMath`, `cycloneMath` et `atmosphereSettings`, avec le lanceur `node --test`.
