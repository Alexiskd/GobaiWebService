// Registre des fournisseurs du moteur atmosphérique (sans NestJS, donc testable seul).
//
// Chaque fournisseur déclare : les phénomènes qu'il couvre, son adresse, son rythme de rafraîchissement (le serveur ne
// l'appelle jamais plus souvent), sa licence et la mention à afficher, son quota, les variables d'environnement de sa
// clé, son rang de repli (1 : préféré) et s'il est déjà branché. Les clés ne sortent jamais du serveur : seule leur
// présence est rapportée.

/** Moteurs du module atmosphérique. */
// Type des moteurs.
export type AtmosphereEngineName = 'WildfireEngine' | 'CycloneEngine' | 'LightningEngine' | 'StormEngine' | 'PrecipitationEngine' | 'AerosolEngine' | 'AtmosphericFlowEngine';

/** Fiche d'un fournisseur. */
// Forme d'une fiche.
export interface ProviderInfo {
  // id : identifiant court, repris dans la provenance des événements.
  id: string;
  // name : nom lisible.
  name: string;
  // engine : le moteur qui l'utilise.
  engine: AtmosphereEngineName;
  // covers : ce qu'il apporte, en clair.
  covers: string;
  // url : l'adresse lue (ou la documentation pour un fournisseur pas encore branché).
  url: string;
  // refreshMs : l'intervalle minimal entre deux appels, en millisecondes.
  refreshMs: number;
  // licence : les conditions d'utilisation, en clair.
  licence: string;
  // attribution : la mention à afficher.
  attribution: string;
  // quota : la limite d'appels connue.
  quota: string;
  // keyEnv : les variables d'environnement de la clé (vide : sans clé).
  keyEnv: string[];
  // priority : rang de repli dans son moteur (1 : préféré).
  priority: number;
  // implemented : vrai si le fournisseur est branché dans ce lot.
  implemented: boolean;
// Fin de ProviderInfo.
}

// Une minute, en millisecondes.
const MIN = 60_000;
// Base des fichiers publics de NASA FIRMS (24 dernières heures, monde entier, sans clé).
const FIRMS = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire';
// Licence des données de la NASA (Earth Science Data and Information Policy).
const NASA_LICENCE = 'Données NASA libres de réutilisation, mention de la source demandée (NASA Earth Science Data Policy)';

/** Le registre complet : fournisseurs branchés puis fournisseurs prévus pour les lots suivants. */
// Liste des fournisseurs (début).
export const PROVIDERS: ProviderInfo[] = [
  // Incendies : NASA FIRMS, VIIRS sur NOAA-20 (pixels de 375 m).
  { id: 'firms-viirs-n20', name: 'NASA FIRMS · VIIRS NOAA-20', engine: 'WildfireEngine', covers: 'Points chauds (375 m), puissance radiative (FRP), heure de passage', url: `${FIRMS}/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv`, refreshMs: 30 * MIN, licence: NASA_LICENCE, attribution: 'NASA FIRMS (LANCE) · VIIRS NOAA-20', quota: 'Fichier public sans clé', keyEnv: [], priority: 1, implemented: true },
  // NASA FIRMS, VIIRS sur NOAA-21.
  { id: 'firms-viirs-n21', name: 'NASA FIRMS · VIIRS NOAA-21', engine: 'WildfireEngine', covers: 'Points chauds (375 m), puissance radiative (FRP), heure de passage', url: `${FIRMS}/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv`, refreshMs: 30 * MIN, licence: NASA_LICENCE, attribution: 'NASA FIRMS (LANCE) · VIIRS NOAA-21', quota: 'Fichier public sans clé', keyEnv: [], priority: 1, implemented: true },
  // NASA FIRMS, VIIRS sur Suomi NPP.
  { id: 'firms-viirs-snpp', name: 'NASA FIRMS · VIIRS Suomi NPP', engine: 'WildfireEngine', covers: 'Points chauds (375 m), puissance radiative (FRP), heure de passage', url: `${FIRMS}/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv`, refreshMs: 30 * MIN, licence: NASA_LICENCE, attribution: 'NASA FIRMS (LANCE) · VIIRS Suomi NPP', quota: 'Fichier public sans clé', keyEnv: [], priority: 1, implemented: true },
  // NASA FIRMS, MODIS sur Terra et Aqua (pixels de 1 km) : repli si VIIRS manque.
  { id: 'firms-modis', name: 'NASA FIRMS · MODIS Terra/Aqua', engine: 'WildfireEngine', covers: 'Points chauds (1 km), puissance radiative (FRP), heure de passage', url: `${FIRMS}/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv`, refreshMs: 30 * MIN, licence: NASA_LICENCE, attribution: 'NASA FIRMS (LANCE) · MODIS', quota: 'Fichier public sans clé', keyEnv: [], priority: 2, implemented: true },
  // Incendies déclarés par les agences (IRWIN, InciWeb…), relayés par NASA EONET.
  { id: 'eonet-wildfires', name: 'NASA EONET · incendies', engine: 'WildfireEngine', covers: 'Incendies confirmés par une agence, position, surface quand elle est publiée', url: 'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open', refreshMs: 30 * MIN, licence: NASA_LICENCE, attribution: 'NASA EONET', quota: 'API publique sans clé', keyEnv: [], priority: 1, implemented: true },
  // Cyclones : centre opérationnel américain de l'Atlantique et du Pacifique Est et Central.
  { id: 'nhc', name: 'NOAA National Hurricane Center', engine: 'CycloneEngine', covers: 'Atlantique, Pacifique Est et Central : centre, vent soutenu, pression', url: 'https://www.nhc.noaa.gov/CurrentStorms.json', refreshMs: 15 * MIN, licence: 'Domaine public (gouvernement des États-Unis)', attribution: 'NOAA NHC', quota: 'Fichier public sans clé', keyEnv: [], priority: 1, implemented: true },
  // Cyclones : prévision officielle du NHC (trajectoire à 5 jours, intensité, rayons des vents de 34, 50 et 64 nœuds), au format ATCF.
  { id: 'nhc-atcf', name: 'NOAA NHC · prévision officielle (ATCF)', engine: 'CycloneEngine', covers: 'Atlantique, Pacifique Est et Central : trajectoire prévue à 5 jours, vent, pression, rayons de vent par quadrant', url: 'https://ftp.nhc.noaa.gov/atcf/fst/', refreshMs: 15 * MIN, licence: 'Domaine public (gouvernement des États-Unis)', attribution: 'NOAA NHC', quota: 'Fichiers publics sans clé', keyEnv: [], priority: 1, implemented: true },
  // Cyclones du monde entier : trajectoires observées (JTWC, NHC) relayées par NASA EONET.
  { id: 'eonet-storms', name: 'NASA EONET · tempêtes (JTWC, NHC)', engine: 'CycloneEngine', covers: 'Monde entier : trajectoire observée toutes les 6 h et vent soutenu', url: 'https://eonet.gsfc.nasa.gov/api/v3/events?category=severeStorms&status=open', refreshMs: 30 * MIN, licence: NASA_LICENCE, attribution: 'NASA EONET · JTWC / NHC', quota: 'API publique sans clé', keyEnv: [], priority: 2, implemented: true },
  // Cyclones du monde entier : système d'alerte de l'ONU et de la Commission européenne.
  { id: 'gdacs', name: 'GDACS (ONU · Commission européenne)', engine: 'CycloneEngine', covers: 'Monde entier : position courante, vent maximal, niveau d’alerte', url: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&alertlevel=green;orange;red', refreshMs: 30 * MIN, licence: 'Utilisation libre avec mention de la source (conditions GDACS)', attribution: 'GDACS', quota: 'API publique sans clé', keyEnv: [], priority: 3, implemented: true },
  // Foudre : Xweather (Vaisala), même compte que les nuages satellite.
  { id: 'xweather-lightning', name: 'Xweather Lightning', engine: 'LightningEngine', covers: 'Impacts de foudre en temps réel (5 dernières minutes, 100 km autour du point visé en accès standard) : position, heure, polarité, intra-nuage ou nuage-sol ; couche mondiale des impacts (Raster Maps)', url: 'https://data.api.xweather.com/lightning/closest', refreshMs: 1 * MIN, licence: 'Commerciale (abonnement Xweather, option foudre)', attribution: 'Xweather (Vaisala)', quota: 'Selon l’abonnement : 1 000 impacts et 100 km par requête en accès standard', keyEnv: ['XWEATHER_CLIENT_ID', 'XWEATHER_CLIENT_SECRET'], priority: 1, implemented: true },
  // Foudre : The Weather Company.
  { id: 'twc-lightning', name: 'The Weather Company', engine: 'LightningEngine', covers: 'Foudre et orages', url: 'https://www.weathercompany.com/weather-data-apis/', refreshMs: 1 * MIN, licence: 'Commerciale', attribution: 'The Weather Company', quota: 'Selon l’abonnement', keyEnv: ['TWC_API_KEY'], priority: 2, implemented: false },
  // Foudre : capteur GLM des satellites GOES (Amériques), fichiers NetCDF publics.
  { id: 'goes-glm', name: 'NOAA GOES GLM', engine: 'LightningEngine', covers: 'Éclairs vus de l’orbite géostationnaire (Amériques), énergie optique', url: 'https://registry.opendata.aws/noaa-goes/', refreshMs: 1 * MIN, licence: 'Domaine public (gouvernement des États-Unis)', attribution: 'NOAA GOES-R GLM', quota: 'Fichiers publics (NetCDF)', keyEnv: [], priority: 3, implemented: false },
  // Foudre : Lightning Imager de Meteosat Troisième Génération (Europe, Afrique).
  { id: 'eumetsat-li', name: 'EUMETSAT Lightning Imager', engine: 'LightningEngine', covers: 'Éclairs vus de l’orbite géostationnaire (Europe, Afrique)', url: 'https://data.eumetsat.int/', refreshMs: 1 * MIN, licence: 'Politique de données EUMETSAT', attribution: 'EUMETSAT MTG-LI', quota: 'Compte EUMETSAT', keyEnv: ['EUMETSAT_CONSUMER_KEY', 'EUMETSAT_CONSUMER_SECRET'], priority: 4, implemented: false },
  // Foudre et orages : AccuWeather.
  { id: 'accuweather', name: 'AccuWeather', engine: 'LightningEngine', covers: 'Foudre, alertes orageuses', url: 'https://developer.accuweather.com/', refreshMs: 5 * MIN, licence: 'Commerciale', attribution: 'AccuWeather', quota: 'Selon l’abonnement', keyEnv: ['ACCUWEATHER_API_KEY'], priority: 5, implemented: false },
  // Cyclones : prévisions de trajectoire du CEPMMT (ECMWF).
  { id: 'ecmwf-tc', name: 'ECMWF · trajectoires cycloniques', engine: 'CycloneEngine', covers: 'Trajectoires prévues (ensemble), pression, vent', url: 'https://www.ecmwf.int/en/forecasts/datasets/open-data', refreshMs: 6 * 60 * MIN, licence: 'CC BY 4.0 (données ouvertes ECMWF)', attribution: 'ECMWF', quota: 'Données ouvertes (BUFR)', keyEnv: [], priority: 4, implemented: false },
  // Précipitations : composite mondial des radars au sol de Rain Viewer (lot 4), sans clé.
  { id: 'rainviewer', name: 'Rain Viewer · Weather Maps API', engine: 'PrecipitationEngine', covers: 'Composite des radars météorologiques au sol (plus de 1 000 radars, environ 150 pays) : réflectivité, pluie et neige distinguées, images des 2 dernières heures toutes les 10 minutes, couverture radar ; base des cellules orageuses estimées', url: 'https://api.rainviewer.com/public/weather-maps.json', refreshMs: 5 * MIN, licence: 'Gratuite pour un usage personnel ou éducatif ; mention « Rain Viewer » obligatoire', attribution: 'Rain Viewer', quota: '100 requêtes par minute et par adresse IP ; niveau de zoom 7 au plus ; jeu de couleurs Universal Blue seul ; ni prévision immédiate ni satellite depuis le 1er janvier 2026', keyEnv: [], priority: 1, implemented: true },
  // Orages : avertissements officiels du National Weather Service (lot 4), sans clé.
  { id: 'nws-alerts', name: 'NOAA National Weather Service · avertissements', engine: 'StormEngine', covers: 'États-Unis : avertissements officiels d’orages violents et de tornades en vigueur (zone, durée, grêle et rafales attendues, mode de détection, déplacement)', url: 'https://api.weather.gov/alerts/active', refreshMs: 2 * MIN, licence: 'Domaine public (gouvernement des États-Unis)', attribution: 'NOAA NWS', quota: 'API publique sans clé (en-tête User-Agent demandé)', keyEnv: [], priority: 1, implemented: true },
  // Aérosols : épaisseur optique VIIRS Deep Blue (NOAA-20, NOAA-21) en images quotidiennes de NASA GIBS (lot 5), sans clé.
  { id: 'gibs-viirs-aod', name: 'NASA GIBS · VIIRS Deep Blue AOD', engine: 'AerosolEngine', covers: 'Épaisseur optique des aérosols à 550 nm mesurée chaque jour sur terre et sur mer (NOAA-20, NOAA-21), reconvertie en valeur par la table de couleurs officielle ; aucune mesure sous les nuages, la nuit ni sur la neige', url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi', refreshMs: 60 * MIN, licence: NASA_LICENCE, attribution: 'NASA GIBS · VIIRS Deep Blue (NOAA-20, NOAA-21)', quota: 'Service public sans clé', keyEnv: [], priority: 1, implemented: true },
  // Aérosols : indice d'aérosols absorbants OMPS en images quotidiennes de NASA GIBS (lot 5), sans clé.
  { id: 'gibs-omps-ai', name: 'NASA GIBS · OMPS Aerosol Index', engine: 'AerosolEngine', covers: 'Indice d’aérosols absorbants à 380 nm (poussières, fumées), mesuré chaque jour, aussi au-dessus des nuages (NOAA-20, NOAA-21)', url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi', refreshMs: 60 * MIN, licence: NASA_LICENCE, attribution: 'NASA GIBS · OMPS Nadir Mapper (NOAA-20, NOAA-21)', quota: 'Service public sans clé', keyEnv: [], priority: 1, implemented: true },
  // Aérosols : prévision des poussières du modèle CAMS par le service WMS public de l'ECMWF (lot 5), sans clé.
  { id: 'cams-wms', name: 'Copernicus CAMS · WMS public de l’ECMWF', engine: 'AerosolEngine', covers: 'Prévision de l’épaisseur optique des poussières à 550 nm sur 48 h (transport des poussières désertiques), images telles que publiées avec leur légende', url: 'https://eccharts.ecmwf.int/wms/?token=public', refreshMs: 3 * 60 * MIN, licence: 'CC BY 4.0 pour les couches ouvertes ; mention « Contains modified Copernicus Atmosphere Monitoring Service information »', attribution: 'Copernicus Atmosphere Monitoring Service (ECMWF)', quota: 'Service public (jeton « public »)', keyEnv: [], priority: 1, implemented: true },
  // Précipitations : tuiles radar de WeatherAPI.
  { id: 'weatherapi-radar', name: 'WeatherAPI Radar', engine: 'PrecipitationEngine', covers: 'Tuiles radar animées (pluie, neige)', url: 'https://www.weatherapi.com/docs/', refreshMs: 5 * MIN, licence: 'Commerciale', attribution: 'WeatherAPI.com', quota: 'Selon l’abonnement', keyEnv: ['WEATHERAPI_KEY'], priority: 2, implemented: false },
  // Précipitations : mosaïque radar européenne OPERA.
  { id: 'opera', name: 'EUMETNET OPERA', engine: 'PrecipitationEngine', covers: 'Mosaïque radar européenne', url: 'https://www.eumetnet.eu/activities/observations-programme/current-activities/opera/', refreshMs: 15 * MIN, licence: 'Accès sur accord EUMETNET', attribution: 'EUMETNET OPERA', quota: 'Sur accord', keyEnv: ['OPERA_ACCESS_TOKEN'], priority: 3, implemented: false },
  // Précipitations : mosaïque radar américaine MRMS.
  { id: 'mrms', name: 'NOAA MRMS', engine: 'PrecipitationEngine', covers: 'Mosaïque radar des États-Unis, grêle, intensité', url: 'https://registry.opendata.aws/noaa-mrms-pds/', refreshMs: 2 * MIN, licence: 'Domaine public (gouvernement des États-Unis)', attribution: 'NOAA MRMS', quota: 'Fichiers publics (GRIB2)', keyEnv: [], priority: 4, implemented: false },
  // Aérosols : service Copernicus de surveillance de l'atmosphère.
  { id: 'cams', name: 'Copernicus CAMS', engine: 'AerosolEngine', covers: 'Poussières, sable du Sahara, fumées, pollution, prévisions de transport', url: 'https://ads.atmosphere.copernicus.eu/', refreshMs: 3 * 60 * MIN, licence: 'Licence Copernicus (libre, mention demandée)', attribution: 'Copernicus Atmosphere Monitoring Service', quota: 'Compte ADS', keyEnv: ['CAMS_ADS_KEY'], priority: 2, implemented: false },
  // Aérosols : épaisseur optique MODIS et VIIRS (NASA Earthdata).
  { id: 'earthdata-aod', name: 'NASA Earthdata · MODIS/VIIRS AOD', engine: 'AerosolEngine', covers: 'Épaisseur optique des aérosols observée par satellite', url: 'https://www.earthdata.nasa.gov/', refreshMs: 3 * 60 * MIN, licence: NASA_LICENCE, attribution: 'NASA Earthdata', quota: 'Compte Earthdata', keyEnv: ['EARTHDATA_TOKEN'], priority: 3, implemented: false },
  // Vents : modèles météo par niveau de pression (Open-Meteo, déjà utilisé pour le flux des nuages).
  { id: 'open-meteo-winds', name: 'Open-Meteo · vents par niveau', engine: 'AtmosphericFlowEngine', covers: 'Vent du moment (modèles météo) au sol, à 850, 500 et 250 hPa sur une grille de 12° × 10° ; axes des courants-jets repérés à 250 hPa', url: 'https://api.open-meteo.com/v1/forecast', refreshMs: 8 * 60 * MIN, licence: 'CC BY 4.0, usage non commercial gratuit', attribution: 'Open-Meteo (modèles météo)', quota: '10 000 appels par jour, 5 000 par heure, 600 par minute (chaque point compte pour un appel : 510 par lecture, 3 lectures par jour, nouvel essai au plus une fois par heure)', keyEnv: [], priority: 1, implemented: true },
// Fin de la liste.
];

/** Fiche publique : sans valeur de clé, avec la présence des clés et la disponibilité. */
// Forme de la fiche publique.
export interface ProviderPublic extends ProviderInfo {
  // keysPresent : vrai si toutes les variables de clé sont renseignées (vrai sans clé).
  keysPresent: boolean;
  // available : branché et clés présentes.
  available: boolean;
// Fin de ProviderPublic.
}

/** Fiches publiques de tous les fournisseurs, d'après l'environnement (seule la présence des clés est lue). */
// Fonction listProviders : l'environnement.
export function listProviders(env: Record<string, string | undefined>): ProviderPublic[] {
  // Pour chaque fournisseur :
  return PROVIDERS.map((p) => {
    // toutes ses clés sont-elles renseignées ?
    const keysPresent = p.keyEnv.every((k) => Boolean(env[k]?.trim()));
    // Fiche, sa présence de clés et sa disponibilité.
    return { ...p, keysPresent, available: p.implemented && keysPresent };
  // Fin du parcours.
  });
// Fin de listProviders.
}

/** Fiche d'un fournisseur par identifiant ; lève une erreur s'il est inconnu (faute de programmation). */
// Fonction provider : l'identifiant.
export function provider(id: string): ProviderInfo {
  // Recherche dans le registre.
  const p = PROVIDERS.find((x) => x.id === id);
  // Inconnu : erreur.
  if (!p) throw new Error(`Fournisseur atmosphérique inconnu : ${id}`);
  // Renvoie la fiche.
  return p;
// Fin de provider.
}
