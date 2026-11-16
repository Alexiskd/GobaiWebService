// Adresse du site en ligne.
import { SITE_URL } from '../services/data/body-pages';

/**
 * Adresse publique du service, sans barre finale : celle affichée au démarrage et dans la documentation de l'API.
 *  - `PUBLIC_URL` si elle est définie ;
 *  - sur Render (variable `RENDER`), l'adresse du site : https://www.gobaispace.com ;
 *  - sinon, en développement : http://localhost:<port>.
 */
// Fonction publicUrl : reçoit le port et l'environnement (process.env par défaut) et renvoie l'adresse publique.
export function publicUrl(port: number, env: NodeJS.ProcessEnv = process.env): string {
  // PUBLIC_URL, espaces retirés, barres obliques finales retirées ; undefined si elle est absente.
  const custom = env.PUBLIC_URL?.trim().replace(/\/+$/, '');
  // Si elle est définie et non vide, c'est elle.
  if (custom) return custom;
  // Sinon : l'adresse du site sur Render (variable RENDER présente), localhost et le port en développement.
  return env.RENDER ? SITE_URL : `http://localhost:${port}`;
// Fin de publicUrl.
}
