// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Service de la liste des sites externes autorisés en CORS (table allowed_origins).
import { AllowedOriginsService } from '../services/store/allowed-origins.service';

/**
 * Module autonome (sans dépendance) de la liste des sites autorisés en CORS, pour que StoreModule (qui
 * l'enregistre après paiement) et EngineModule (qui la consulte pour la clé du moteur) puissent tous deux
 * l'importer sans dépendre l'un de l'autre. main.ts le lit aussi (app.get) pour construire le délégué CORS.
 */
@Module({
  // Service du module, construit directement par NestJS.
  providers: [AllowedOriginsService],
  // Exporté : vers les modules qui l'importent, et vers main.ts (app.get).
  exports: [AllowedOriginsService],
// Fin de la déclaration.
})
// Classe du module des sites autorisés.
export class OriginsModule {}
