/**
 * Mois civil des dons dans un fuseau horaire donné (Europe/Paris par défaut) : le plafond repart à zéro le 1er à 00:00
 * heure locale, changement d'heure compris.
 */
export interface DonationPeriod {
  /** Mois au format `AAAA-MM`. */
  month: string;
  /** Début du mois (inclus), ISO 8601 UTC. */
  startsAt: string;
  /** Début du mois suivant = remise à zéro du plafond (exclu), ISO 8601 UTC. */
  resetsAt: string;
}

/** Date et heure murales d'un instant dans `timeZone`. */
function wallClock(t: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** Décalage du fuseau à l'instant `t`, en millisecondes (Paris : +1 h l'hiver, +2 h l'été). */
function offsetMs(t: number, timeZone: string): number {
  const w = wallClock(t, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(t / 1000) * 1000;
}

/** Instant UTC du 1er du mois (`month0` de 0 à 11, débordement accepté) à 00:00 heure locale. */
function monthStart(year: number, month0: number, timeZone: string): number {
  const guess = Date.UTC(year, month0, 1);
  let t = guess - offsetMs(guess, timeZone);
  t = guess - offsetMs(t, timeZone); // second passage : exact autour d'un changement d'heure
  return t;
}

export function donationPeriod(now: number, timeZone: string): DonationPeriod {
  const { year, month } = wallClock(now, timeZone);
  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    startsAt: new Date(monthStart(year, month - 1, timeZone)).toISOString(),
    resetsAt: new Date(monthStart(year, month, timeZone)).toISOString(),
  };
}
