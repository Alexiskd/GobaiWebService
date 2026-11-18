// Contrats JSON des routes de tuiles, tels qu'attendus par le frontend.
import { Injectable } from '@nestjs/common';

@Injectable()
export class TilesService {
  // La liste des couches : mode statique, aucune couche relayée.
  layers() {
    return { provider: 'static', fallback: true, tileSize: 256, layers: [] };
  }

  // Une couche par son identifiant : elle n'existe pas en mode statique.
  layer(id: string) {
    return { id, available: false, urlTemplate: null };
  }

  // La mention d'une couche pour une zone et un zoom.
  attribution(id: string) {
    return { id, available: false, copyright: null, provider: null };
  }

  // L'état des cartes NASA Trek des satellites.
  satelliteStatus() {
    return { items: [], satellites: [] };
  }

  // Les couches NASA Trek d'un astre.
  satelliteLayers() {
    return { layers: [], items: [] };
  }

  // Le mélange des variantes lunaires n'est pas branché.
  moonBlendStatus() {
    return { database: false, variants: [] };
  }

  // Les vents du moment (Open-Meteo) ne sont pas relayés.
  earthWind() {
    return { available: false };
  }

  // La couverture nuageuse du moment (Open-Meteo) n'est pas relayée.
  earthCloudCover() {
    return { available: false };
  }

  // La table de priorité des sources de la Terre n'est pas servie.
  earthPlan() {
    return { available: false, items: [] };
  }

  // Les villes du LiDAR HD.
  lidarCities() {
    return { altitudeM: 0, items: [] };
  }
}
