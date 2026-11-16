// Importé en premier par main.ts : enveloppe le fetch global avant que le moindre service ne soit chargé,
// pour qu'aucun module ne garde une référence au fetch d'origine.
import { installFetchGuard } from './api-blocklist';

// Pose le garde.
installFetchGuard();
