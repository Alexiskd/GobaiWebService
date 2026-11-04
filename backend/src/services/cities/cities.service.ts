import { Injectable } from '@nestjs/common';
import { normalize } from '../../common/text';
import { CITIES } from '../data/cities.data';
import type { City } from '../data/cities.data';

export interface FindCitiesOptions {
  q?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class CitiesService {
  /**
   * Villes dans l'ordre d'importance d'origine (il pilote la taille des halos urbains sur la Terre).
   * `total` compte les résultats du filtre avant pagination.
   */
  find({ q, limit, offset = 0 }: FindCitiesOptions = {}): { total: number; items: City[] } {
    const needle = q ? normalize(q.trim()) : '';
    const matches = needle ? CITIES.filter((c) => normalize(c.name).includes(needle)) : CITIES;
    const end = limit === undefined ? undefined : offset + limit;
    return { total: matches.length, items: matches.slice(offset, end) };
  }
}
