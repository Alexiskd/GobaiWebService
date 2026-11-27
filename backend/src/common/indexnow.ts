// Adresse du site et liste des pages (astres et fenêtres), la même source que le sitemap.
import { BODY_PAGES, SITE_URL, WINDOW_PAGES } from '../services/core/data/body-pages';

/**
 * IndexNow : prévient Bing, Yandex, Seznam, Naver… (et par Bing, ChatGPT Search et DuckDuckGo) que les pages du
 * site ont changé, dès qu'une nouvelle version est en ligne.
 *
 * Envoyé par le serveur lui-même, une minute après son démarrage sur Render : la nouvelle version a alors passé la
 * sonde de santé et reçoit le trafic. Plus besoin d'un événement GitHub que Render n'envoie pas toujours.
 * Seulement en production (variable RENDER), hors prévisualisation (IS_PULL_REQUEST), et si INDEXNOW_KEY est définie.
 */

// Point d'entrée commun d'IndexNow : il relaie à tous les moteurs participants.
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Adresses à soumettre : l'accueil puis chaque page du sitemap. */
// Déclare indexNowUrls : renvoie la liste des adresses complètes.
export function indexNowUrls(): string[] {
  // Accueil, puis une adresse par astre et par fenêtre, sans doublon.
  return [...new Set([`${SITE_URL}/`, ...[...BODY_PAGES, ...WINDOW_PAGES].map((p) => `${SITE_URL}/${p.slug}`)])];
// Fin de indexNowUrls.
}

/** La soumission automatique est-elle active ? Renvoie la clé si oui, null sinon. */
// Déclare indexNowKey : lit l'environnement et renvoie la clé à utiliser, ou null.
export function indexNowKey(env: NodeJS.ProcessEnv = process.env): string | null {
  // Clé IndexNow, espaces retirés.
  const key = env.INDEXNOW_KEY?.trim();
  // Pas de clé, pas sur Render, ou prévisualisation : rien à envoyer.
  if (!key || !env.RENDER || env.IS_PULL_REQUEST === 'true') return null;
  // Format exigé par IndexNow : 8 à 128 caractères parmi lettres, chiffres et tirets.
  return /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : null;
// Fin de indexNowKey.
}

/** Envoie la liste à IndexNow ; renvoie le code HTTP (200 ou 202 = accepté). Ne lève jamais. */
// Déclare submitIndexNow : reçoit la clé, les adresses et la fonction fetch (remplaçable dans les tests).
export async function submitIndexNow(key: string, urls: string[], fetchImpl: typeof fetch = fetch): Promise<number> {
  // Hôte officiel : www.gobaispace.com.
  const host = new URL(SITE_URL).host;
  // Essaie l'envoi.
  try {
    // Requête POST en JSON : hôte, clé, adresse du fichier de clé (servi par main.ts) et adresses.
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList: urls }),
    });
    // Code de la réponse.
    return res.status;
  // Erreur réseau : 0, sans faire tomber le serveur.
  } catch {
    return 0;
  }
// Fin de submitIndexNow.
}

/** Programme l'envoi une minute après le démarrage (production seulement). */
// Déclare scheduleIndexNow : ne fait rien sans clé ; sinon programme l'envoi et écrit le résultat dans le journal.
export function scheduleIndexNow(env: NodeJS.ProcessEnv = process.env, delayMs = 60_000): void {
  // Clé, ou null si la soumission est désactivée.
  const key = indexNowKey(env);
  // Désactivée : on sort.
  if (!key) return;
  // Minuterie qui ne retient pas le processus à l'arrêt (unref).
  const timer = setTimeout(() => {
    // Adresses du sitemap.
    const urls = indexNowUrls();
    // Envoi, puis une ligne de journal.
    void submitIndexNow(key, urls).then((status) =>
      console.log(`IndexNow  : ${urls.length} adresses soumises (${status === 200 || status === 202 ? `accepté, ${status}` : `refusé, ${status}`})`),
    );
  }, delayMs) as unknown as { unref?: () => void };
  // Sous Node, la minuterie ne retient pas le processus.
  timer.unref?.();
// Fin de scheduleIndexNow.
}
