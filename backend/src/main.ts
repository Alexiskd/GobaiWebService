// Charge le fichier .env dans process.env avant tout le reste : les variables (PORT, DATABASE_URL…) sont lisibles dès les imports suivants.
import 'dotenv/config';
// Garde des API bloquées : posé avant tout autre import, pour envelopper fetch avant le chargement des services.
import './common/api-blocklist.install';
// Fonctions de fichiers de Node : existsSync teste la présence d'un fichier, readFileSync le lit en entier de façon synchrone.
import { existsSync, readFileSync } from 'node:fs';
// Fonctions de chemins de Node : extname donne l'extension, join assemble des morceaux, resolve rend un chemin absolu, sep est le séparateur du système (/ ou \).
import { extname, join, resolve, sep } from 'node:path';
// NestFactory : la fabrique de NestJS qui crée l'application à partir du module racine.
import { NestFactory } from '@nestjs/core';
// Type (effacé à la compilation) de l'application Nest posée sur Express : donne accès à useStaticAssets.
import type { NestExpressApplication } from '@nestjs/platform-express';
// Types Express (effacés à la compilation) de la requête, de la réponse et de la fonction « au suivant » d'un middleware.
import type { NextFunction, Request, Response } from 'express';
// Module racine : il importe tous les autres modules de l'API.
import { AppModule } from './modules/app.module';
// Réglages communs de l'application (préfixe /api, version, CORS, validation) : partagés avec l'export OpenAPI.
import { configureApp } from './modules/app.setup';
// Lecture et validation des variables d'environnement, rendues sous forme d'un objet de configuration.
import { loadConfiguration } from './common/configuration';
// Résolution du secret de signature : variable d'environnement, sinon base de données, sinon éphémère.
import { resolveSessionSecret } from './common/session-secret';
// Magasin PostgreSQL des secrets du serveur.
import { postgresSecretStore } from './common/session-secret.store';
// Contenu de /.well-known/assetlinks.json : le lien entre le site et son application Android.
import { androidAssetLinks } from './common/android-asset-links';
// Calcule l'adresse publique du service (PUBLIC_URL, adresse du site sur Render, ou localhost en développement).
import { publicUrl } from './common/public-url';
// Branche la documentation Swagger sur /api/docs.
import { setupOpenApi } from './modules/openapi';
// Pages des astres pour le référencement : recherche d'une page d'après l'adresse, et rendus HTML, Markdown et llms-full.txt.
import { bodyPageFor, markdownPageFor, renderBodyMarkdown, renderBodyPage, renderLlmsFull } from './services/data/body-pages';

/**
 * Service web unique : l'API sert aussi le site compilé (frontend/dist), sur la même origine.
 * Fichiers de Vite sous /assets (noms hachés) : cache d'un an ; index.html : jamais mis en cache.
 * Toute autre route GET hors /api renvoie index.html (application monopage).
 * Page d'un astre (/mars, /titan… voir body-pages.ts) : index.html avec le titre et la description de l'astre.
 * Dossier réglable avec FRONTEND_DIST ; absent (développement avec Vite), seule l'API est servie.
 */
// Déclare serveFrontend : reçoit l'application et renvoie le dossier du site servi, ou null s'il n'y a pas de site compilé.
function serveFrontend(app: NestExpressApplication): string | null {
  // Dossier du site compilé : FRONTEND_DIST si elle est définie (espaces retirés), sinon frontend/dist, deux niveaux au-dessus de backend/dist ; resolve le rend absolu.
  const dir = resolve(process.env.FRONTEND_DIST?.trim() || join(__dirname, '..', '..', 'frontend', 'dist'));
  // Chemin complet de index.html, la page unique de l'application.
  const index = join(dir, 'index.html');
  // Pas de index.html (développement avec Vite) : on sort tout de suite avec null, seule l'API sera servie.
  if (!existsSync(index)) return null;
  // Le site compilé ne change pas pendant la vie du processus : modèle lu une fois, une page rendue par astre.
  // Lit index.html une seule fois en texte UTF-8 : il sert de modèle pour les pages des astres.
  const template = readFileSync(index, 'utf8');
  // Cache en mémoire des pages d'astres déjà rendues : identifiant de la page (slug) → HTML complet.
  const bodyPages = new Map<string, string>();

  // Versions texte pour les assistants IA : /mars.md (une page) et /llms-full.txt (tout le site), voir body-pages.ts.
  // Chemin de llms.txt, le résumé du site destiné aux assistants IA.
  const llmsPath = join(dir, 'llms.txt');
  // Prépare une fois le texte de /llms-full.txt : le contenu de llms.txt s'il existe (sinon une chaîne vide), suivi de chaque page en Markdown.
  const llmsFull = renderLlmsFull(existsSync(llmsPath) ? readFileSync(llmsPath, 'utf8') : '');
  // Premier middleware, placé avant les fichiers statiques : il répond aux versions texte (/mars.md, /llms-full.txt).
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Seules les lectures (GET et HEAD) sont concernées : toute autre méthode passe au middleware suivant.
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    // Cherche la page d'astre qui correspond à une adresse en « .md » ; undefined si l'adresse n'en est pas une.
    const page = markdownPageFor(req.path);
    // Ni page Markdown ni /llms-full.txt : cette requête n'est pas pour ce middleware, on passe au suivant.
    if (!page && req.path !== '/llms-full.txt') return next();
    // Autorise les navigateurs et les caches intermédiaires à garder la réponse une heure (3 600 secondes).
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // Envoie la réponse : type text/markdown et page de l'astre en Markdown, ou type text/plain et texte complet du site.
    res.type(page ? 'text/markdown' : 'text/plain').send(page ? renderBodyMarkdown(page) : llmsFull);
  // Fin du middleware des versions texte.
  });

  // Sert les fichiers du site compilé (scripts, styles, images) directement depuis le dossier.
  app.useStaticAssets(dir, {
    // index: false : la racine « / » ne renvoie pas index.html ici ; c'est le dernier middleware qui s'en charge, pour maîtriser son cache.
    index: false,
    // Fonction appelée pour chaque fichier servi, afin de régler ses en-têtes : reçoit la réponse et le chemin du fichier.
    setHeaders: (res, filePath) => {
      // Le fichier est-il sous /assets/ ? Vite y range les fichiers dont le nom contient une empreinte de leur contenu.
      const hashed = filePath.includes(`${sep}assets${sep}`);
      // Fichier à empreinte : cache d'un an, marqué immuable (un nouveau contenu porte un nouveau nom) ; tout autre fichier : cache d'une heure.
      res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    // Fin de la fonction setHeaders.
    },
  // Fin des options et de l'appel à useStaticAssets.
  });
  // Dernier middleware : toute adresse qui n'est ni un fichier ni l'API reçoit la page de l'application monopage.
  app.use((req: Request, res: Response, next: NextFunction) => {
    // La requête vise-t-elle l'API ? Vrai pour « /api » exactement ou pour tout chemin qui commence par « /api/ ».
    const isApi = req.path === '/api' || req.path.startsWith('/api/');
    // Un fichier introuvable (extension présente) reste une 404 : pas d'index.html à la place d'un script.
    // On passe au suivant (donc à une 404 ou à l'API) si la méthode n'est pas une lecture, si c'est l'API, ou si l'adresse porte une extension de fichier.
    if ((req.method !== 'GET' && req.method !== 'HEAD') || isApi || extname(req.path)) return next();
    // no-cache : le navigateur doit revalider la page à chaque visite, pour voir tout de suite un nouveau déploiement.
    res.setHeader('Cache-Control', 'no-cache');
    // Cherche si l'adresse est la page d'un astre (/mars, /titan…) ; undefined sinon.
    const body = bodyPageFor(req.path);
    // Si c'est une page d'astre :
    if (body) {
      // reprend la page déjà rendue dans le cache, si elle existe ;
      let html = bodyPages.get(body.slug);
      // sinon la fabrique à partir du modèle (titre, description, chiffres de l'astre), la range dans le cache et la garde dans html ;
      if (!html) bodyPages.set(body.slug, (html = renderBodyPage(template, body)));
      // envoie le HTML avec le type text/html ;
      res.type('html').send(html);
      // et termine ici : la requête est traitée.
      return;
    // Fin du cas « page d'astre ».
    }
    // Toute autre adresse : envoie index.html tel quel, l'application React fait le reste dans le navigateur.
    res.sendFile(index);
  // Fin du dernier middleware.
  });
  // Renvoie le dossier du site, pour l'afficher dans le journal au démarrage.
  return dir;
// Fin de serveFrontend.
}

// Déclare bootstrap : la fonction asynchrone qui démarre tout le service.
async function bootstrap() {
  // Lit la configuration depuis l'environnement ; une valeur invalide arrête le démarrage avec un message clair.
  const config = loadConfiguration();

  // Secret de signature des sessions et des clés d'API, résolu AVANT la création de l'application : les
  // services le lisent dans process.env dès leur constructeur (contributions.service, jwt.guard), donc il doit
  // y être posé maintenant. Ce secret n'est jamais écrit dans le dépôt : il vient de la variable
  // d'environnement, sinon de la base, sinon il est tiré pour la durée du processus.
  // Le magasin de secrets, ou null sans base configurée.
  const secretStore = postgresSecretStore();
  // La résolution.
  const { secret, source } = await resolveSessionSecret(process.env, secretStore);
  // Reposé dans l'environnement du processus, là où tous les lecteurs existants le cherchent.
  process.env.SESSION_SECRET = secret;
  // Le magasin ne sert qu'au démarrage : on referme sa connexion.
  await secretStore?.close().catch(() => undefined);
  // Le journal dit d'où vient le secret — jamais sa valeur.
  if (source === 'éphémère') console.warn('Secret   : tiré au hasard pour ce processus (ni SESSION_SECRET, ni DATABASE_URL) : sessions et clés d’API perdues au redémarrage');
  // Posé à la main, ou gardé en base.
  else console.log(`Secret   : ${source === 'environnement' ? 'SESSION_SECRET de l’environnement' : 'gardé en base (table app_secrets)'}`);

  // Crée l'application NestJS sur Express à partir du module racine ; await attend que tous les modules soient prêts.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Application Android (Trusted Web Activity) : preuve que le site et l'application ont le même propriétaire.
  // Prépare le contenu du fichier assetlinks.json à partir des variables d'environnement (nom de l'application Android, empreintes de signature).
  const assetLinks = androidAssetLinks(process.env);
  // Répond à /.well-known/assetlinks.json ; la requête n'est pas utilisée, d'où son nom _req.
  app.use('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
    // Cache d'une heure pour ce fichier.
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // Envoie le contenu préparé, en JSON.
    res.json(assetLinks);
  // Fin de la route assetlinks.json.
  });
  // Branche le site compilé ; site vaut le dossier servi, ou null s'il est absent.
  const site = serveFrontend(app);
  // Applique les réglages communs : préfixe /api, version v1, CORS, filtre d'erreurs, validation des entrées.
  configureApp(app, config);
  // Adresse publique : https://www.gobaispace.com en ligne, localhost en développement.
  // Adresse publique du service d'après le port configuré.
  const url = publicUrl(config.port);
  // Monte la documentation Swagger, avec cette adresse comme serveur proposé pour essayer les requêtes.
  setupOpenApi(app, url);
  // Ouvre le port et attend que le serveur écoute.
  await app.listen(config.port);
  // Site présent : écrit dans le journal son adresse et le dossier servi.
  if (site) console.log(`Site      : ${url}/  (${site})`);
  // Site absent : le signale et rappelle la commande qui le compile.
  else console.log('Site      : frontend/dist absent, API seule (lancez « npm run build » à la racine)');
  // Écrit dans le journal l'adresse de base de l'API.
  console.log(`API       : ${url}/api/v1`);
  // Écrit dans le journal l'adresse de la documentation.
  console.log(`Docs      : ${url}/api/docs`);
// Fin de bootstrap.
}
// Lance le démarrage dès que ce fichier est exécuté (node dist/main).
bootstrap();
