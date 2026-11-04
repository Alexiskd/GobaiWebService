import { Global, Module } from '@nestjs/common';
import { loadConfiguration } from '../common/configuration';

/** Jeton d'injection : `@Inject(APP_CONFIG) config: AppConfig`. */
export const APP_CONFIG = 'APP_CONFIG';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfiguration() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
