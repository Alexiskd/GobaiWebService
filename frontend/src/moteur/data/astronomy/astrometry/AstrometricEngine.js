const JULIAN_YEAR_DAYS = 365.25;
const SECONDS_PER_JULIAN_YEAR = JULIAN_YEAR_DAYS * 86400;
const KM_PER_PARSEC = 3.0856775814913673e13;
const KM_S_TO_PC_YR = SECONDS_PER_JULIAN_YEAR / KM_PER_PARSEC;
const MAS_TO_RAD = Math.PI / (180 * 3600 * 1000);
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const finite = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const asFinite = (value, name) => {
  if (!finite(value)) throw new TypeError(`${name} doit être un nombre fini.`);
  return Number(value);
};
const addScaled = (a, b, scale) => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
const norm = (v) => Math.hypot(v[0], v[1], v[2]);
const normalize = (v) => {
  const length = norm(v);
  if (!Number.isFinite(length) || length === 0) throw new RangeError('Vecteur astrométrique nul ou invalide.');
  return v.map((component) => component / length);
};

function basisFromIcrs(raDeg, decDeg) {
  const ra = raDeg * DEG_TO_RAD;
  const dec = decDeg * DEG_TO_RAD;
  const cosRa = Math.cos(ra); const sinRa = Math.sin(ra);
  const cosDec = Math.cos(dec); const sinDec = Math.sin(dec);
  return {
    radial: [cosDec * cosRa, cosDec * sinRa, sinDec],
    east: [-sinRa, cosRa, 0],
    north: [-sinDec * cosRa, -sinDec * sinRa, cosDec],
  };
}

function coordinatesFromVector(vector) {
  const [x, y, z] = normalize(vector);
  const raDeg = ((Math.atan2(y, x) * RAD_TO_DEG) % 360 + 360) % 360;
  const decDeg = Math.atan2(z, Math.hypot(x, y)) * RAD_TO_DEG;
  return { raDeg, decDeg };
}

function validateCoordinates(coordinates) {
  const raDeg = asFinite(coordinates?.raDeg, 'raDeg');
  const decDeg = asFinite(coordinates?.decDeg, 'decDeg');
  if (decDeg < -90 || decDeg > 90) throw new RangeError('decDeg doit être compris entre -90 et +90 degrés.');
  return { raDeg: ((raDeg % 360) + 360) % 360, decDeg };
}

/**
 * Propage une position ICRS entre deux époques en années juliennes.
 * Avec une parallaxe positive, le calcul utilise un vecteur 3D et la vitesse
 * radiale (si disponible), ce qui prend en compte le mouvement perspectif.
 * Sans parallaxe exploitable, une propagation tangentielle sur la sphère est
 * utilisée ; elle ne peut pas modéliser la vitesse radiale ni le mouvement
 * perspectif.
 */
export function propagateAstrometricCoordinates({ coordinates, astrometry = {} } = {}, targetEpoch) {
  const source = validateCoordinates(coordinates);
  const fromEpoch = asFinite(coordinates?.epoch, 'coordinates.epoch');
  const toEpoch = asFinite(targetEpoch, 'targetEpoch');
  const deltaYears = toEpoch - fromEpoch;
  const pmRa = finite(astrometry.properMotionRaMasYr) ? Number(astrometry.properMotionRaMasYr) : null;
  const pmDec = finite(astrometry.properMotionDecMasYr) ? Number(astrometry.properMotionDecMasYr) : null;
  const parallax = finite(astrometry.parallaxMas) ? Number(astrometry.parallaxMas) : null;
  const radialVelocity = finite(astrometry.radialVelocityKmS) ? Number(astrometry.radialVelocityKmS) : null;

  if (parallax !== null && parallax > 0) {
    const distancePc = 1000 / parallax;
    const basis = basisFromIcrs(source.raDeg, source.decDeg);
    const position = basis.radial.map((component) => component * distancePc);
    const velocity = [0, 0, 0];
    if (pmRa !== null) {
      const eastSpeedPcYr = distancePc * pmRa * MAS_TO_RAD;
      for (let i = 0; i < 3; i += 1) velocity[i] += basis.east[i] * eastSpeedPcYr;
    }
    if (pmDec !== null) {
      const northSpeedPcYr = distancePc * pmDec * MAS_TO_RAD;
      for (let i = 0; i < 3; i += 1) velocity[i] += basis.north[i] * northSpeedPcYr;
    }
    if (radialVelocity !== null) {
      const radialSpeedPcYr = radialVelocity * KM_S_TO_PC_YR;
      for (let i = 0; i < 3; i += 1) velocity[i] += basis.radial[i] * radialSpeedPcYr;
    }
    const propagated = addScaled(position, velocity, deltaYears);
    const distanceAfterPc = norm(propagated);
    const result = coordinatesFromVector(propagated);
    return {
      ...result,
      frame: coordinates.frame || 'ICRS',
      epoch: toEpoch,
      sourceEpoch: fromEpoch,
      deltaYears,
      distancePc: distanceAfterPc,
      parallaxMas: distanceAfterPc > 0 ? 1000 / distanceAfterPc : null,
      method: 'space-motion-3d',
      used: { properMotionRa: pmRa !== null, properMotionDec: pmDec !== null, parallax: true, radialVelocity: radialVelocity !== null },
      warnings: [],
    };
  }

  const warnings = ['Parallaxe absente ou non positive : propagation tangentielle sans distance ni vitesse radiale.'];
  const basis = basisFromIcrs(source.raDeg, source.decDeg);
  const eastRate = (pmRa ?? 0) * MAS_TO_RAD;
  const northRate = (pmDec ?? 0) * MAS_TO_RAD;
  const tangent = [
    basis.east[0] * eastRate + basis.north[0] * northRate,
    basis.east[1] * eastRate + basis.north[1] * northRate,
    basis.east[2] * eastRate + basis.north[2] * northRate,
  ];
  const propagatedDirection = addScaled(basis.radial, tangent, deltaYears);
  return {
    ...coordinatesFromVector(propagatedDirection),
    frame: coordinates.frame || 'ICRS',
    epoch: toEpoch,
    sourceEpoch: fromEpoch,
    deltaYears,
    distancePc: null,
    parallaxMas: null,
    method: 'tangent-plane-no-distance',
    used: { properMotionRa: pmRa !== null, properMotionDec: pmDec !== null, parallax: false, radialVelocity: false },
    warnings,
  };
}

/** Accepte directement un enregistrement normalisé par le lot 31. */
export function propagateAstrometricRecord(record, targetEpoch) {
  if (!record || typeof record !== 'object' || !record.coordinates) throw new TypeError('Un enregistrement avec coordinates est requis.');
  const result = propagateAstrometricCoordinates(record, targetEpoch);
  return {
    ...record,
    coordinates: { ...record.coordinates, raDeg: result.raDeg, decDeg: result.decDeg, epoch: result.epoch, frame: result.frame },
    propagation: {
      method: result.method,
      sourceEpoch: result.sourceEpoch,
      targetEpoch: result.epoch,
      deltaYears: result.deltaYears,
      distancePc: result.distancePc,
      parallaxMas: result.parallaxMas,
      used: result.used,
      warnings: result.warnings,
    },
  };
}

export function propagateAstrometricBatch(records, targetEpoch) {
  if (!Array.isArray(records)) throw new TypeError('records doit être un tableau.');
  return records.map((record) => propagateAstrometricRecord(record, targetEpoch));
}

export const ASTROMETRIC_ENGINE_CONSTANTS = Object.freeze({
  julianYearDays: JULIAN_YEAR_DAYS,
  secondsPerJulianYear: SECONDS_PER_JULIAN_YEAR,
  kmPerParsec: KM_PER_PARSEC,
  kmPerSecondToParsecPerYear: KM_S_TO_PC_YR,
  masToRadians: MAS_TO_RAD,
});
