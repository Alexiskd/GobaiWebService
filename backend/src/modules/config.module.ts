// Global rend un module disponible partout sans l'importer ; Module déclare un module.
import { Global, Module } from '@nestjs/common';
// Fonction qui lit et valide les variables d'environnement.
import { loadConfiguration } from '../common/configuration';

/** Jeton d'injection : `@Inject(APP_CONFIG) config: AppConfig`. */
// Nom du jeton sous lequel la configuration est enregistrée : c'est lui qu'on passe à @Inject ou à inject: […].
export const APP_CONFIG = 'APP_CONFIG';

// Module global : APP_CONFIG est injectable dans tous les modules sans import.
@Global()
// Ouvre la déclaration du module.
@Module({
  // Un seul service fourni : la configuration, lue une seule fois par cette fabrique au démarrage.
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfiguration() }],
  // Exporte le jeton pour que les autres modules puissent l'injecter.
  exports: [APP_CONFIG],
// Fin de la déclaration.
})
// Classe du module de configuration, importée en premier par le module racine.
export class ConfigModule {}
