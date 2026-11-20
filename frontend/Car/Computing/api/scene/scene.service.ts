// Contrats JSON des routes de la scène, tels qu'attendus par le frontend.
import { Injectable } from '@nestjs/common';

@Injectable()
export class SceneService {
  // Les frontières et littoraux restent embarqués dans l'archive statique.
  borders() {
    return { source: 'local', attribution: 'Données géographiques embarquées', count: 0, lines: [], coastlines: [] };
  }

  // La recherche distante de lieux est désactivée : le catalogue local fait foi.
  places() {
    return { provider: 'local', items: [], attribution: 'Recherche distante désactivée' };
  }

  // Les noms des villes (version 2 du format).
  placeLabels() {
    return { attribution: 'Catalogue statique', count: 0, items: [] };
  }

  // Les nuages de points ne sont pas servis.
  pointClouds() {
    return { available: false, items: [] };
  }

  // Le service LiDAR n'est pas branché.
  lidar() {
    return { available: false, items: [] };
  }

  // Les villes du LiDAR HD.
  lidarCities() {
    return { altitudeM: 0, items: [] };
  }

  // Les éphémérides restent calculées côté navigateur.
  moonEphemeris() {
    return { source: 'local', points: [] };
  }

  satelliteEphemeris() {
    return { source: 'local', satellites: [] };
  }

  moonPhases() {
    return { source: 'local', items: [] };
  }

  // L'activité solaire reste une simulation locale.
  sunRegions() {
    return { source: 'simulation locale', regions: [], flares: [] };
  }

  sunActivity() {
    return { source: 'simulation locale', flares: [] };
  }

  // Les volcans en éruption ne sont pas relayés.
  volcanoes() {
    return { available: false, items: [], features: [] };
  }

  // Toutes les couches atmosphériques relayées restent indisponibles.
  atmosphereFeed() {
    return { available: false, items: [], features: [] };
  }

  // L'assistant serveur est débranché.
  assistantConfig() {
    return { enabled: false, model: null };
  }
}
