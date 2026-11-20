// Contrôleur du domaine galerie : la collection personnelle de photos et vidéos.
import { Controller, Get } from '@nestjs/common';
import { GalerieService } from './galerie.service';

// Déclare et exporte le contrôleur Galerie.
@Controller()
export class GalerieController {
  // Le service de la galerie.
  constructor(private readonly galerie: GalerieService) {}

  // La collection : { total, folders } ; chaque dossier regroupe ses médias.
  @Get('/galerie')
  collection() {
    return this.galerie.collection();
  }
}
