// Injectable : rend le service injectable.
import { Injectable } from '@nestjs/common';
// Fonction qui retire les accents et les majuscules d'un texte.
import { normalize } from '../../common/text';
// Liste des villes, dans leur ordre d'importance.
import { CITIES } from '../data/cities.data';
// Type (effacé à la compilation) d'une ville.
import type { City } from '../data/cities.data';

// Forme des options de recherche.
export interface FindCitiesOptions {
  // q : le texte cherché.
  q?: string;
  // limit : le nombre maximal de résultats.
  limit?: number;
  // offset : le nombre de résultats à sauter.
  offset?: number;
// Fin de FindCitiesOptions.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des villes.
export class CitiesService {
  /**
   * Villes dans l'ordre d'importance d'origine (il pilote la taille des halos urbains sur la Terre).
   * `total` compte les résultats du filtre avant pagination.
   */
  // Méthode find : reçoit les options (aucune par défaut, offset à 0) et renvoie le total et la page de villes.
  find({ q, limit, offset = 0 }: FindCitiesOptions = {}): { total: number; items: City[] } {
    // Texte cherché, nettoyé de ses espaces, sans accents ni majuscules ; vide sans recherche.
    const needle = q ? normalize(q.trim()) : '';
    // Villes dont le nom contient ce texte ; toutes les villes sans recherche.
    const matches = needle ? CITIES.filter((c) => normalize(c.name).includes(needle)) : CITIES;
    // Indice de fin de la page : aucun sans limite, sinon offset + limit.
    const end = limit === undefined ? undefined : offset + limit;
    // Renvoie le nombre de villes trouvées et la tranche demandée.
    return { total: matches.length, items: matches.slice(offset, end) };
  // Fin de find.
  }
// Fin du service.
}
