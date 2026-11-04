import { Injectable, NotFoundException } from '@nestjs/common';
import { normalize } from '../../common/text';
import { MOON, PLANETS, SUN } from '../data/bodies.data';
import type { PlanetData } from '../data/bodies.data';

@Injectable()
export class BodiesService {
  all() {
    return { sun: SUN, moon: MOON, planets: PLANETS };
  }

  planet(name: string): PlanetData {
    const wanted = normalize(name);
    const found = PLANETS.find((p) => normalize(p.name) === wanted);
    if (!found) {
      throw new NotFoundException(`Planète inconnue : « ${name} ». Valeurs possibles : ${PLANETS.map((p) => p.name).join(', ')}.`);
    }
    return found;
  }
}
