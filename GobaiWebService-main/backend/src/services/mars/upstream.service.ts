// Buffer : le tampon d'octets de Node.
import { Buffer } from 'node:buffer';
// Outils NestJS : injection par jeton, service injectable.
import { Inject, Injectable } from '@nestjs/common';
// Jeton d'injection de la configuration de Mars, et son type.
import { MARS_CONFIG, type MarsConfig } from './mars.config';

// Forme des options d'un appel.
export interface UpstreamRequestOptions {
  // timeoutMs : délai maximal (facultatif).
  timeoutMs?: number;
  // maxBytes : taille maximale de la réponse (facultatif).
  maxBytes?: number;
  // accept : en-tête Accept (facultatif).
  accept?: string;
  // headers : autres en-têtes (facultatif).
  headers?: Record<string, string>;
// Fin de UpstreamRequestOptions.
}

// Forme d'une réponse.
export interface UpstreamResponse {
  // url : l'adresse appelée.
  url: string;
  // status : le code HTTP.
  status: number;
  // contentType : le type de contenu.
  contentType: string | null;
  // contentLength : la taille annoncée.
  contentLength: number | null;
  // etag : l'en-tête ETag.
  etag: string | null;
  // lastModified : la date de dernière modification.
  lastModified: string | null;
  // cacheControl : l'en-tête Cache-Control.
  cacheControl: string | null;
  // buffer : les octets.
  buffer: Buffer;
  // bytes : leur nombre.
  bytes: number;
  // durationMs : la durée de la lecture.
  durationMs: number;
// Fin de UpstreamResponse.
}

// Forme d'une réponse JSON : une réponse, plus
export interface UpstreamJsonResponse<T> extends UpstreamResponse {
  // data : les données lues.
  data: T;
// Fin de UpstreamJsonResponse.
}

// Forme du résultat d'un test.
export interface UpstreamProbe {
  // url : l'adresse testée.
  url: string;
  // status : le code HTTP, ou null.
  status: number | null;
  // ok : réussi ou non.
  ok: boolean;
  // contentType : le type de contenu.
  contentType: string | null;
  // latencyMs : la durée du test.
  latencyMs: number;
  // error : l'erreur, ou null.
  error: string | null;
// Fin de UpstreamProbe.
}

// Forme des options d'un test.
export interface UpstreamProbeOptions {
  // timeoutMs : délai maximal (facultatif).
  timeoutMs?: number;
  // accept : en-tête Accept (facultatif).
  accept?: string;
  // headers : autres en-têtes (facultatif).
  headers?: Record<string, string>;
// Fin de UpstreamProbeOptions.
}

// Classe MarsUpstreamError : l'erreur d'un serveur source.
export class MarsUpstreamError extends Error {
  // Constructeur ; ses paramètres :
  constructor(
    // le message ;
    message: string,
    // le code HTTP, gardé ;
    readonly status: number,
    // l'adresse, gardée.
    readonly url: string,
  // Corps du constructeur :
  ) {
    // passe le message à Error ;
    super(message);
    // fixe le nom de l'erreur.
    this.name = 'MarsUpstreamError';
  // Fin du constructeur.
  }
// Fin de la classe.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des appels aux serveurs sources de Mars.
export class MarsUpstreamService {
  // Constructeur : la configuration, demandée par son jeton.
  constructor(@Inject(MARS_CONFIG) private readonly config: MarsConfig) {}

  // Méthode fetchBinary ; ses paramètres :
  async fetchBinary(
    // l'adresse ;
    url: string,
    // les options, vides par défaut.
    options: UpstreamRequestOptions = {},
  // Elle renvoie la réponse.
  ): Promise<UpstreamResponse> {
    // Envoie la requête.
    const response = await this.request(url, options);
    // Lit le corps et renvoie la réponse.
    return this.readBody(response, url, options);
  // Fin de fetchBinary.
  }

  // Méthode fetchText ; ses paramètres :
  async fetchText(
    // l'adresse ;
    url: string,
    // les options.
    options: UpstreamRequestOptions = {},
  // Elle renvoie la réponse, plus son texte.
  ): Promise<UpstreamResponse & { text: string }> {
    // Télécharge les octets.
    const result = await this.fetchBinary(url, options);
    // Y ajoute le texte, lu en UTF-8.
    return { ...result, text: result.buffer.toString('utf8') };
  // Fin de fetchText.
  }

  // Méthode fetchJson ; ses paramètres :
  async fetchJson<T>(
    // l'adresse ;
    url: string,
    // les options, avec un jeton d'accès facultatif.
    options: UpstreamRequestOptions & { token?: string } = {},
  // Elle renvoie la réponse, plus ses données.
  ): Promise<UpstreamJsonResponse<T>> {
    // Copie des en-têtes.
    const headers = { ...options.headers };
    // S'il y a un jeton,
    if (options.token) {
      // ajoute l'en-tête Authorization.
      headers.Authorization = `Bearer ${options.token}`;
    // Fin du cas.
    }

    // Télécharge les octets, avec
    const result = await this.fetchBinary(url, {
      // les options,
      ...options,
      // les en-têtes,
      headers,
      // et l'en-tête Accept, JSON par défaut.
      accept: options.accept ?? 'application/json',
    // Fin du téléchargement.
    });

    // Essaie
    try {
      // de lire le JSON ;
      const data = JSON.parse(result.buffer.toString('utf8')) as T;
      // et de le renvoyer avec la réponse.
      return { ...result, data };
    // En cas d'échec :
    } catch {
      // erreur de serveur source,
      throw new MarsUpstreamError(
        // avec ce message,
        'La réponse amont n’est pas un JSON valide.',
        // le code 502,
        502,
        // et l'adresse.
        url,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
  // Fin de fetchJson.
  }

  // Méthode probe ; ses paramètres :
  async probe(
    // l'adresse ;
    url: string,
    // les options.
    options: UpstreamProbeOptions = {},
  // Elle renvoie le résultat du test.
  ): Promise<UpstreamProbe> {
    // Délai : celui des options, sinon celui des tests de santé.
    const timeoutMs = options.timeoutMs ?? this.config.healthTimeoutMs;
    // Heure de départ.
    const startedAt = Date.now();

    // Essaie :
    try {
      // appelle l'adresse,
      const response = await fetch(url, {
        // en GET,
        method: 'GET',
        // en suivant les redirections,
        redirect: 'follow',
        // avec abandon au bout du délai,
        signal: AbortSignal.timeout(timeoutMs),
        // et ces en-têtes :
        headers: {
          // le User-Agent de la configuration,
          'user-agent': this.config.userAgent,
          // l'en-tête Accept, « tout » par défaut,
          accept: options.accept ?? '*/*',
          // et ceux des options.
          ...options.headers,
        // Fin des en-têtes.
        },
      // Fin de l'appel.
      });

      // Abandonne la lecture du corps.
      await response.body?.cancel();

      // Renvoie
      return {
        // l'adresse ;
        url,
        // le code HTTP ;
        status: response.status,
        // réussi ou non ;
        ok: response.ok,
        // le type de contenu ;
        contentType: normalizeHeader(response.headers.get('content-type')),
        // la durée ;
        latencyMs: Date.now() - startedAt,
        // l'erreur : aucune si c'est réussi, sinon « HTTP <code> ».
        error: response.ok ? null : `HTTP ${response.status}`,
      // Fin de l'objet.
      };
    // En cas d'échec :
    } catch (error) {
      // renvoie
      return {
        // l'adresse ;
        url,
        // pas de code ;
        status: null,
        // non réussi ;
        ok: false,
        // pas de type de contenu ;
        contentType: null,
        // la durée ;
        latencyMs: Date.now() - startedAt,
        // la description de l'erreur.
        error: describeFetchError(error),
      // Fin de l'objet.
      };
    // Fin du cas.
    }
  // Fin de probe.
  }

  // Méthode privée request ; ses paramètres :
  private async request(
    // l'adresse ;
    url: string,
    // les options.
    options: UpstreamRequestOptions,
  // Elle renvoie la réponse HTTP.
  ): Promise<Response> {
    // Délai : celui des options, sinon celui de la configuration.
    const timeoutMs = options.timeoutMs ?? this.config.httpTimeoutMs;

    // Réponse HTTP.
    let response: Response;
    // Essaie :
    try {
      // appelle l'adresse,
      response = await fetch(url, {
        // en GET,
        method: 'GET',
        // en suivant les redirections,
        redirect: 'follow',
        // avec abandon au bout du délai,
        signal: AbortSignal.timeout(timeoutMs),
        // et ces en-têtes :
        headers: {
          // le User-Agent de la configuration,
          'user-agent': this.config.userAgent,
          // l'en-tête Accept, « tout » par défaut,
          accept: options.accept ?? '*/*',
          // et ceux des options.
          ...options.headers,
        // Fin des en-têtes.
        },
      // Fin de l'appel.
      });
    // En cas d'échec :
    } catch (error) {
      // erreur de serveur source,
      throw new MarsUpstreamError(
        // avec la description de l'erreur,
        `Requête amont impossible : ${describeFetchError(error)}`,
        // le code 504 si le délai est dépassé, sinon 502,
        error instanceof Error && error.name === 'TimeoutError' ? 504 : 502,
        // et l'adresse.
        url,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Réponse en erreur :
    if (!response.ok) {
      // abandonne la lecture du corps ;
      await response.body?.cancel();
      // erreur de serveur source,
      throw new MarsUpstreamError(
        // avec le code reçu dans le message,
        `Le service amont a répondu HTTP ${response.status}.`,
        // ce même code,
        response.status,
        // et l'adresse.
        url,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Renvoie la réponse.
    return response;
  // Fin de request.
  }

  // Méthode privée readBody ; ses paramètres :
  private async readBody(
    // la réponse HTTP ;
    response: Response,
    // l'adresse ;
    url: string,
    // les options.
    options: UpstreamRequestOptions,
  // Elle renvoie la réponse lue.
  ): Promise<UpstreamResponse> {
    // Taille maximale : celle des options, sinon celle de la configuration.
    const maxBytes = options.maxBytes ?? this.config.maxUpstreamBytes;
    // Taille annoncée,
    const contentLength = readContentLength(
      // lue dans l'en-tête Content-Length.
      response.headers.get('content-length'),
    // Fin de la lecture.
    );

    // Taille annoncée trop grande :
    if (contentLength !== null && contentLength > maxBytes) {
      // abandonne la lecture du corps ;
      await response.body?.cancel();
      // erreur de serveur source,
      throw new MarsUpstreamError(
        // « Réponse amont trop volumineuse »,
        `Réponse amont trop volumineuse (${contentLength} octets, limite ${maxBytes}).`,
        // le code 502,
        502,
        // et l'adresse.
        url,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Heure de départ.
    const startedAt = Date.now();
    // Lit les octets.
    const buffer = Buffer.from(await response.arrayBuffer());
    // Durée de la lecture.
    const durationMs = Date.now() - startedAt;

    // Taille réelle trop grande :
    if (buffer.length > maxBytes) {
      // erreur de serveur source,
      throw new MarsUpstreamError(
        // « Réponse amont trop volumineuse »,
        `Réponse amont trop volumineuse (${buffer.length} octets, limite ${maxBytes}).`,
        // le code 502,
        502,
        // et l'adresse.
        url,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Renvoie
    return {
      // l'adresse ;
      url,
      // le code HTTP ;
      status: response.status,
      // le type de contenu ;
      contentType: normalizeHeader(response.headers.get('content-type')),
      // la taille annoncée ;
      contentLength,
      // l'ETag ;
      etag: normalizeHeader(response.headers.get('etag')),
      // la date de dernière modification ;
      lastModified: normalizeHeader(response.headers.get('last-modified')),
      // l'en-tête Cache-Control ;
      cacheControl: normalizeHeader(response.headers.get('cache-control')),
      // les octets ;
      buffer,
      // leur nombre ;
      bytes: buffer.length,
      // la durée de la lecture.
      durationMs,
    // Fin de l'objet.
    };
  // Fin de readBody.
  }
// Fin du service.
}

// Fonction normalizeHeader.
function normalizeHeader(value: string | null): string | null {
  // Valeur absente :
  if (!value) {
    // null.
    return null;
  // Fin du cas.
  }
  // Retire les espaces des bords.
  const trimmed = value.trim();
  // La renvoie, ou null si elle est vide.
  return trimmed.length > 0 ? trimmed : null;
// Fin de normalizeHeader.
}

// Fonction readContentLength.
function readContentLength(value: string | null): number | null {
  // Valeur absente :
  if (!value) {
    // null.
    return null;
  // Fin du cas.
  }

  // La lit comme un entier.
  const parsed = Number.parseInt(value, 10);
  // Le renvoie s'il est fini et positif ou nul, sinon null.
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
// Fin de readContentLength.
}

// Fonction describeFetchError.
function describeFetchError(error: unknown): string {
  // Si c'est une erreur :
  if (error instanceof Error) {
    // délai dépassé ou abandon :
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      // « délai d'attente dépassé ».
      return 'délai d’attente dépassé';
    // Fin du cas.
    }
    // Sinon son message.
    return error.message;
  // Fin du cas.
  }

  // Sinon son texte.
  return String(error);
// Fin de describeFetchError.
}
