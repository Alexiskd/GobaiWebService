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
| CycloneEngine, lot 2 | NOAA NHC, prévision officielle au format ATCF (`ftp.nhc.noaa.gov/atcf/fst/<id>.fst`) | Trajectoire prévue jusqu'à 5 jours (vent, pression, catégorie à chaque échéance), rayons des vents de 34, 50 et 64 nœuds par quadrant | Trajectoire prévue en pointillés, contours des vents en jaune, orange et rouge, tourbillon à la taille réelle des vents de 34 nœuds |
| LightningEngine, lot 3 | Xweather Lightning (réseau Vaisala) : API pour les impacts, Raster Maps (`lightning-strikes`) pour la couche mondiale | Impacts des 5 dernières minutes dans 100 km autour du point visé : position, heure, nature (nuage-sol ou intra-nuage), courant de crête et polarité, capteurs, chi². Fréquence, densité par km², zones actives | Couche mondiale des impacts récents vue de loin. De près, un point à chaque impact mesuré, puis une lueur et un éclair ramifié **procéduraux**, rejoués ×10 dans l'ordre réel |
| PrecipitationEngine, lot 4 | Rain Viewer, API publique Weather Maps (composite des radars au sol), sans clé | Réflectivité (dBZ) de la pluie et de la neige, retrouvée pixel par pixel à partir de la table officielle des couleurs « Universal Blue » (tuiles demandées sans lissage). Couverture radar. Images des 2 dernières heures, toutes les 10 minutes | Vue mondiale (1 024 px) et bloc de détail de 2,4 km par pixel autour du point visé. Couleurs calculées par le shader à partir de la mesure ; bords lissés sans inventer de pluie faible. Animation des 50 dernières minutes (images passées, jamais une prévision). Ligne de la limite de portée des radars ; zones sans radar légèrement assombries |
| StormEngine, lot 4 | Cellules **estimées** d'après les mêmes images radar. NOAA NWS : avertissements officiels d'orages violents et de tornades (`api.weather.gov/alerts/active`), sans clé | Cellule : zone d'au moins 40 dBZ avec un noyau d'au moins 45 dBZ, sur la grille mondiale de 2 048 px (environ 20 km par pixel à l'équateur). Suivie sur 3 images (20 minutes) : persistance, trajectoire, déplacement estimé. Avertissement : zone, durée, grêle et rafales attendues, détection (radar ou observé), déplacement publié | Anneau à la taille de la cellule, coloré selon son maximum ; en tirets si elle n'est vue que sur une image ; flèche du déplacement estimé sur 30 minutes. Contour des avertissements (rouge : tornade ; jaune : orage violent ; doublé : observé) |
| AtmosphericEventManager | Toutes les sources ci-dessus | Format commun, déduplication, exclusions, contrôle | Sans objet |

Le lot 1 ajoute aussi la catégorie **Atmosphère** dans Paramètres. On y trouve :
- l'interrupteur des nuages et de l'atmosphère des planètes solides, qui se trouvait jusque-là dans « Repères » ;
- les interrupteurs Incendies et Cyclones, chacun avec son opacité et son intensité ;
- la fenêtre de temps des incendies ;
- depuis le lot 4, les interrupteurs Précipitations (radar) et Orages : opacité, intensité, animation, limite de portée des radars, légendes et mention de Rain Viewer ;
- la liste des calques à venir.

Routes du serveur, sous `/api/v1/atmosphere` :
- `fires` : points chauds agrégés et incendies confirmés ;
- `fires/tiles/{tx}/{ty}` : détail d'une tuile ;
- `cyclones` ;
- `lightning?lon=&lat=` et `lightning/tiles/{z}/{x}/{y}` (lot 3) ;
- `radar` : images disponibles et codage des tuiles (lot 4) ;
- `radar/{id}/{z}/{x}/{y}` : tuile décodée, PNG RVB dont le rouge porte la pluie, le vert la neige (code = dBZ + 11, 0 = aucun écho) et le bleu la couverture radar (lot 4) ;
- `storms` : cellules estimées et avertissements officiels (lot 4) ;
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
  - La trajectoire prévue (statut « prévu ») et les rayons de vent (statut « estimé ») viennent de la prévision officielle du NHC. Une prévision de plus de 18 h n'est pas affichée ; une alerte le signale.
- **Mesure, estimation et avertissement (lot 4).**
  - Le radar mesure la réflectivité. L'intensité en mm/h en est **estimée** par la relation de Marshall-Palmer ; la légende le dit.
  - Une cellule convective est une **estimation** (`status: 'estimé'`, `confirmed: false`) : le radar ne voit pas la foudre, et une forte réflectivité peut venir de grêle fondante ou d'un écho parasite. Une cellule vue sur une seule image porte un drapeau et s'affiche en tirets.
  - Un avertissement du NWS est une **confirmation officielle** (`confirmed: true`) ; il est « observé » si le NWS indique un phénomène observé, « estimé » s'il est indiqué par le radar.
  - Hors de portée des radars (océans, une grande partie de l'Afrique et de l'Asie centrale), **rien n'est dessiné** : l'absence d'écho n'y veut pas dire l'absence de pluie, et ces zones sont assombries.
- **Symbole ou géométrie mesurée.** Quand le NHC publie les rayons de vent, le tourbillon prend le rayon moyen des vents de 34 nœuds. Sinon, sa taille est un symbole par catégorie, de 150 à 440 km de rayon. Le sens de rotation est physique.

### Ce que les sources du lot 1 ne permettent pas

- **Prévisions hors des bassins du NHC.** Pacifique Ouest, océan Indien et hémisphère sud (JTWC, JMA, ECMWF) : aucune source keyless au format vérifiable n'est branchée. Ces cyclones restent affichés sans trajectoire prévue ni rayons de vent.
- **Panaches de fumée.** Il faut les aérosols du CAMS.
- **Prévision immédiate des précipitations.** Rain Viewer l'a retirée de l'accès gratuit le 1er janvier 2026 ; seules les images passées sont animées.
- **Orages hors de portée des radars**, et avertissements officiels hors des États-Unis (MeteoAlarm décrit ses zones par des codes de région, sans contour : non branché).
- **Cyclones hors saison.** Un cyclone dont la dernière position date de plus de 36 h est écarté et listé avec sa raison. Le 15 novembre 2026, par exemple, Cempaka et Pena n'avaient plus de position récente.

## Lots suivants

| Lot | Moteur | Sources | Prérequis |
|---|---|---|---|
| 2 (livré) | CycloneEngine (suite) | Rayons de vent et trajectoire prévue : NHC, format ATCF | Bassins du NHC seulement ; les autres bassins attendent une source vérifiable (ECMWF en BUFR, JTWC) |
| 3 (livré) | LightningEngine | Xweather Lightning, avec les clés `XWEATHER_CLIENT_ID` et `XWEATHER_CLIENT_SECRET` déjà sur Render | Accès standard : 5 min, 100 km, 1 000 impacts par requête. L'option Enterprise ouvrirait les emprises rectangulaires et 24 h d'historique. Sans l'option foudre, la réponse d'erreur de Xweather est affichée telle quelle |
| 3 | LightningEngine (repli) | NOAA GOES GLM, EUMETSAT MTG-LI, The Weather Company, AccuWeather | GLM : NetCDF public. LI : compte EUMETSAT. Les deux autres : clés `TWC_API_KEY` et `ACCUWEATHER_API_KEY` |
| 4 (livré) | PrecipitationEngine et StormEngine | Rain Viewer (radar mondial, sans clé), NOAA NWS (avertissements, sans clé) | Accès gratuit de Rain Viewer : usage personnel ou éducatif, mention obligatoire, niveau 7 au plus, 100 requêtes par minute et par adresse IP, ni prévision ni satellite |
| 4 | PrecipitationEngine (repli) | WeatherAPI Radar, EUMETNET OPERA, NOAA MRMS | `WEATHERAPI_KEY`, accord OPERA, lecture GRIB2 pour MRMS |
| 5 | AerosolEngine | Copernicus CAMS, NASA Earthdata (AOD de MODIS et VIIRS) | `CAMS_ADS_KEY`, `EARTHDATA_TOKEN` |
| 6 | AtmosphericFlowEngine | Open-Meteo, vents par niveau de pression (déjà utilisé pour le flux des nuages) | Grille par altitude, rendu vectoriel 3D animé |

Ces fournisseurs sont déjà inscrits dans le registre avec `implemented: false`. `/atmosphere/providers` indique lesquels ont leurs clés.

## Licences et quotas des sources branchées

| Source | Licence | Quota | Rafraîchissement |
|---|---|---|---|
| NASA FIRMS, fichiers 24 h | Données NASA libres, mention demandée | Fichiers publics sans clé | 30 min |
| NASA EONET | Données NASA libres, mention demandée | API publique sans clé | 30 min |
| NOAA NHC | Domaine public | Fichier public | 15 min |
| NOAA NHC, prévision ATCF | Domaine public | Fichier public par cyclone actif | 15 min |
| GDACS | Utilisation libre avec mention | API publique sans clé | 30 min |
| Xweather Lightning | Commerciale (abonnement, option foudre) | Selon l'abonnement : 1 000 impacts et 100 km par requête en accès standard | 1 min par cellule d'un demi-degré, partagée ; couche mondiale toutes les 2 min (16 tuiles) |
| Rain Viewer, Weather Maps API | Gratuite pour un usage personnel ou éducatif ; mention « Rain Viewer » obligatoire (fenêtre des sources et légende, avec lien) | 100 requêtes par minute et par adresse IP : le serveur s'en tient à 80 et garde chaque tuile le temps de vie de l'image (2 h) | Index toutes les 5 min. Une nouvelle image toutes les 10 min coûte 4 tuiles (vue mondiale) et 16 tuiles (détection des cellules) ; un bloc de détail, 4 tuiles par image |
| NOAA NWS, avertissements | Domaine public | API publique sans clé (User-Agent demandé) | 2 min |

Les mentions s'affichent dans la fenêtre des sources quand un calque est allumé.

## Tests

- **Serveur.** Les specs des modules purs se trouvent dans `backend/src/services/atmosphere/*.spec.ts`. Elles couvrent :
  - la lecture FIRMS, la fusion entre satellites, les seuils, l'agrégation et le détail ;
  - la lecture d'EONET, NHC et GDACS ;
  - la fusion des cyclones, les contradictions et les exclusions ;
  - la déduplication et le gestionnaire ;
  - le cache, les tuiles, la limite de débit et le registre ;
  - la lecture et l'écriture du format PNG (cinq filtres, palette et transparence), la table « Universal Blue » et le décodage des tuiles radar ;
  - la détection des cellules (seuils, taille minimale, antiméridien), leur suivi et leur format commun ;
  - la lecture des avertissements du NWS (annulations, exercices, expirations, zones absentes, déplacement publié).

  Elles s'écrivent comme des specs jest. Pour les lancer : `npm test` dans `backend/`.
- **Navigateur.** Les tests couvrent `fireMath`, `cycloneMath`, `lightningMath`, `radarMath` et `atmosphereSettings`, avec le lanceur `node --test`.
