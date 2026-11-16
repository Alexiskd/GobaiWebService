// Charge le fichier .env dans process.env avant tout le reste.
import 'dotenv/config';
// writeFileSync : écrit un fichier en entier, de façon synchrone.
import { writeFileSync } from 'fs';
// join : assemble des morceaux de chemin.
import { join } from 'path';
// Fabrique d'application de NestJS.
import { NestFactory } from '@nestjs/core';
// Module racine de l'API.
import { AppModule } from './app.module';
// Réglages communs (préfixe /api, version) : indispensables pour que les adresses du document soient les vraies.
import { configureApp } from './app.setup';
// Lecture de la configuration depuis l'environnement.
import { loadConfiguration } from '../common/configuration';
// Fonction qui construit le document OpenAPI.
import { buildOpenApiDocument } from './openapi';

/** `npm run openapi:export` → écrit `openapi.json` (sans démarrer le serveur), utile pour générer un client. */
// Déclare exportOpenApi : écrit openapi.json sans ouvrir de port.
async function exportOpenApi() {
  // Crée l'application sans journal, pour que la sortie de la commande reste propre.
  const app = await NestFactory.create(AppModule, { logger: false });
  // Applique les mêmes réglages que le vrai serveur.
  configureApp(app, loadConfiguration());
  // Initialise les modules et enregistre les routes, sans écouter sur un port.
  await app.init();
  // Chemin du fichier produit : openapi.json dans le dossier d'où la commande est lancée.
  const file = join(process.cwd(), 'openapi.json');
  // Construit le document et l'écrit en JSON indenté de deux espaces.
  writeFileSync(file, JSON.stringify(buildOpenApiDocument(app), null, 2));
  // Ferme l'application : libère ses ressources et laisse le processus se terminer.
  await app.close();
  // Indique où le fichier a été écrit.
  console.log(`OpenAPI écrit : ${file}`);
// Fin de exportOpenApi.
}
// Lance l'export dès que ce fichier est exécuté (npm run openapi:export).
exportOpenApi();
