// Outils NestJS : ArgumentsHost (contexte de la requête), Catch (déclare un filtre), ExceptionFilter (interface d'un filtre), HttpException (erreur HTTP), Logger (journal).
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
// Types Express (effacés à la compilation) de la requête et de la réponse.
import type { Request, Response } from 'express';

/**
 * Toutes les erreurs sortent au même format (voir ApiErrorDto).
 * Les erreurs inattendues sont journalisées mais jamais détaillées au client.
 */
// Catch sans argument : ce filtre attrape toutes les erreurs, quelles qu'elles soient.
@Catch()
// Classe du filtre d'erreurs.
export class HttpExceptionFilter implements ExceptionFilter {
  // Journal dont chaque ligne est préfixée par « HTTP ».
  private readonly logger = new Logger('HTTP');

  // Méthode catch : appelée par NestJS pour chaque erreur, avec l'erreur et le contexte.
  catch(exception: unknown, host: ArgumentsHost) {
    // Passe en contexte HTTP.
    const http = host.switchToHttp();
    // Récupère la réponse Express.
    const res = http.getResponse<Response>();
    // Récupère la requête Express.
    const req = http.getRequest<Request>();

    // Code par défaut : 500, pour toute erreur inattendue.
    let statusCode = 500;
    // Nom d'erreur par défaut.
    let error = 'Internal Server Error';
    // Message par défaut, volontairement vague : les détails d'une erreur inattendue ne sortent jamais du serveur.
    let message: string | string[] = 'Erreur interne du serveur';

    // Si l'erreur est une erreur HTTP levée exprès (400, 404, 502…) :
    if (exception instanceof HttpException) {
      // on reprend son code ;
      statusCode = exception.getStatus();
      // et son contenu, qui est un texte ou un objet.
      const body = exception.getResponse();
      // Si c'est un texte :
      if (typeof body === 'string') {
        // il devient le message.
        message = body;
      // Sinon c'est un objet :
      } else {
        // vu comme un objet qui peut porter un message et un nom d'erreur ;
        const b = body as { message?: string | string[]; error?: string };
        // message : celui de l'objet, sinon celui de l'erreur ;
        message = b.message ?? exception.message;
        // nom : celui de l'objet, sinon le nom de la classe d'erreur.
        error = b.error ?? exception.name;
      // Fin du cas « objet ».
      }
    // Sinon, erreur inattendue (bogue, panne) :
    } else {
      // on écrit dans le journal sa pile d'appels, ou sa valeur si ce n'est pas un objet Error.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    // Fin du tri des erreurs.
    }

    // Répond avec le code retenu et le format unique : code, nom, message, adresse appelée et heure en ISO 8601.
    res.status(statusCode).json({ statusCode, error, message, path: req.url, timestamp: new Date().toISOString() });
  // Fin de catch.
  }
// Fin du filtre.
}
