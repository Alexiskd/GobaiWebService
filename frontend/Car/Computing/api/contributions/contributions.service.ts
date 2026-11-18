// Contrats JSON des routes de contributions et de comptes.
import { Injectable } from '@nestjs/common';

@Injectable()
export class ContributionsService {
  // Les contributions de placement LiDAR : aucune en mode statique.
  list() {
    return { items: [], persistent: false };
  }
}
