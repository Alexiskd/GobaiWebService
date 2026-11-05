import { fmtLat, fmtLon, nf } from '@/lib/format';

const EARTH_RADIUS_KM = 6371;

const finite = (value) => Number.isFinite(value);

export const moonFacts = (m) => [
  { term: 'Phase', value: `${m.phase} · ${m.lit} % éclairée`, note: finite(m.ageDays) ? `${nf(m.ageDays, 1)} j depuis la nouvelle lune` : null },
  { term: 'Distance', value: `${nf(m.distKm)} km`, note: `lumière : ${nf(m.lightSeconds, 3)} s${m.source ? ` · position ${m.source}` : ''}` },
  m.libration && { term: 'Libration', value: `${fmtLon(m.libration.lon)} · ${fmtLat(m.libration.lat)}`, note: 'point de la Lune vu au centre depuis la Terre' },
  m.subSolar && { term: 'Soleil au zénith', value: `${fmtLon(m.subSolar.lon)} · ${fmtLat(m.subSolar.lat)}`, note: 'point subsolaire ; le terminateur est à 90° de là' },
].filter(Boolean);

export const planetFacts = (body, def) => {
  const facts = [];
  if (finite(def.radius)) {
    facts.push({ term: 'Diamètre', value: `${nf(2 * def.radius * EARTH_RADIUS_KM)} km`, note: `${nf(def.radius, 3)} rayon terrestre` });
  }
  if (finite(def.rotation) && def.rotation !== 0) {
    const absRot = Math.abs(def.rotation);
    const rotation = absRot >= 2 ? `${nf(absRot, 2)} j` : `${nf(absRot * 24, 1)} h`;
    facts.push({ term: 'Rotation', value: `${rotation}${def.rotation < 0 ? ' (rétrograde)' : ''}`, note: 'un tour sur elle-même' });
  }
  if (finite(body?.au)) {
    facts.push({ term: 'Distance au Soleil', value: `${nf(body.au, 3)} UA`, note: finite(body.lightMinutes) ? `lumière : ${nf(body.lightMinutes, 1)} min` : null });
  }
  // Troisième loi de Kepler (demi-grand axe en UA) ; ignorée si les éléments orbitaux manquent.
  const semiMajor = def.elements?.[0];
  if (finite(semiMajor) && semiMajor > 0) {
    const periodYears = Math.pow(semiMajor, 1.5);
    facts.push({ term: 'Période orbitale', value: periodYears < 1 ? `${nf(periodYears * 365.25)} j` : `${nf(periodYears, 2)} ans`, note: 'un tour autour du Soleil' });
  }
  return facts;
};
