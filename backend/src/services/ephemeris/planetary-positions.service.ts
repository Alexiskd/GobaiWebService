import { Injectable } from '@nestjs/common';
import { PLANETS } from '../data/bodies.data';

const D = Math.PI / 180;
const LIGHT_MINUTES_PER_AU = 8.317;
const UNIX_EPOCH_JD = 2440587.5;
const J2000_JD = 2451545;

export type Vec3 = [number, number, number];

@Injectable()
export class EphemerisService {
  /** Jour julien d'un instant (ms depuis l'epoch Unix). */
  julianDay(timeMs: number): number {
    return timeMs / 864e5 + UNIX_EPOCH_JD;
  }

  /**
   * Position héliocentrique (UA) à `T` siècles juliens depuis J2000, dans le repère
   * de la scène (x, z-écliptique, -y). `meanAnomalyDeg` force l'anomalie moyenne.
   */
  heliocentric(el: number[], T: number, meanAnomalyDeg?: number): Vec3 {
    const a = el[0] + el[1] * T;
    const e = el[2] + el[3] * T;
    const I = (el[4] + el[5] * T) * D;
    const L = el[6] + el[7] * T;
    const wp = el[8] + el[9] * T;
    const Om = (el[10] + el[11] * T) * D;

    let M = (meanAnomalyDeg === undefined ? L - wp : meanAnomalyDeg) * D;
    M = Math.atan2(Math.sin(M), Math.cos(M));
    let E = M;
    for (let i = 0; i < 8; i++) E = M + e * Math.sin(E);

    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const w = wp * D - Om;
    const cw = Math.cos(w), sw = Math.sin(w);
    const cO = Math.cos(Om), sO = Math.sin(Om);
    const cI = Math.cos(I), sI = Math.sin(I);

    const xe = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
    const ye = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
    const ze = sw * sI * xp + cw * sI * yp;
    return [xe, ze, -ye];
  }

  /** Positions de toutes les planètes à l'instant donné (défaut : maintenant). */
  snapshot(timeMs: number = Date.now()) {
    const jd = this.julianDay(timeMs);
    const T = (jd - J2000_JD) / 36525;
    return {
      time: new Date(timeMs).toISOString(),
      julianDay: jd,
      planets: PLANETS.map((p) => {
        const au = this.heliocentric(p.elements, T);
        const distanceAu = Math.hypot(...au);
        return {
          name: p.name,
          au,
          distanceAu,
          lightMinutes: distanceAu * LIGHT_MINUTES_PER_AU,
        };
      }),
    };
  }
}
