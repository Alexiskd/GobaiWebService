const TAU = 2 * Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const DAYS_PER_YEAR = 365.25;
const GAUSSIAN_K = 0.01720209895; // AU^(3/2) / day, compatible with solar masses

const isFiniteNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const requiredNumber = (value, name) => {
  if (!isFiniteNumber(value)) throw new TypeError(`${name} doit être un nombre fini.`);
  return Number(value);
};
const optionalNumber = (value, fallback = null) => isFiniteNumber(value) ? Number(value) : fallback;
const wrapRadians = (angle) => ((angle % TAU) + TAU) % TAU;

/** Résout E - e sin(E) = M pour une orbite elliptique. */
export function solveKeplerEquation(meanAnomalyRad, eccentricity, { tolerance = 1e-13, maxIterations = 32 } = {}) {
  const M = requiredNumber(meanAnomalyRad, 'meanAnomalyRad');
  const e = requiredNumber(eccentricity, 'eccentricity');
  if (e < 0 || e >= 1) throw new RangeError('eccentricity doit être compris dans [0, 1[ pour une orbite elliptique.');
  if (!(tolerance > 0) || !Number.isFinite(tolerance)) throw new RangeError('tolerance doit être positive.');
  if (!Number.isInteger(maxIterations) || maxIterations < 1) throw new RangeError('maxIterations doit être un entier positif.');

  const normalizedM = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI;
  let E = e < 0.8 ? normalizedM : Math.sign(normalizedM || 1) * Math.PI;
  let converged = false;
  let iterations = 0;
  for (; iterations < maxIterations; iterations += 1) {
    const f = E - e * Math.sin(E) - normalizedM;
    const derivative = 1 - e * Math.cos(E);
    const step = f / derivative;
    E -= step;
    if (Math.abs(step) <= tolerance) { converged = true; iterations += 1; break; }
  }
  if (!converged) {
    // Bisection on the monotonic elliptic Kepler equation: robust near e -> 1.
    let low = -Math.PI; let high = Math.PI;
    for (let i = 0; i < 96; i += 1) {
      E = (low + high) / 2;
      const residual = E - e * Math.sin(E) - normalizedM;
      if (Math.abs(residual) <= tolerance) { converged = true; iterations += i + 1; break; }
      if (residual > 0) high = E; else low = E;
    }
  }
  if (!converged) throw new Error('La résolution de l’équation de Kepler n’a pas convergé.');
  const residual = E - e * Math.sin(E) - normalizedM;
  return { eccentricAnomalyRad: wrapRadians(E), residual, iterations, converged };
}

function deriveSemiMajorAxisAu(periodDays, centralMassSolar) {
  // Kepler's third law, including the supplied central mass; planet mass is neglected.
  const periodYears = periodDays / DAYS_PER_YEAR;
  return Math.cbrt(centralMassSolar * periodYears * periodYears);
}

function rotatePerifocalToReference({ x, y, vx, vy }, inclinationRad, ascendingNodeRad, argumentPeriastronRad) {
  const cosO = Math.cos(ascendingNodeRad); const sinO = Math.sin(ascendingNodeRad);
  const cosI = Math.cos(inclinationRad); const sinI = Math.sin(inclinationRad);
  const cosW = Math.cos(argumentPeriastronRad); const sinW = Math.sin(argumentPeriastronRad);
  const r11 = cosO * cosW - sinO * sinW * cosI;
  const r12 = -cosO * sinW - sinO * cosW * cosI;
  const r21 = sinO * cosW + cosO * sinW * cosI;
  const r22 = -sinO * sinW + cosO * cosW * cosI;
  const r31 = sinW * sinI;
  const r32 = cosW * sinI;
  return {
    x: r11 * x + r12 * y, y: r21 * x + r22 * y, z: r31 * x + r32 * y,
    vx: r11 * vx + r12 * vy, vy: r21 * vx + r22 * vy, vz: r31 * vx + r32 * vy,
  };
}

function resolveMeanAnomaly(orbit, targetJulianDate) {
  const periodDays = requiredNumber(orbit.periodDays, 'orbit.periodDays');
  if (periodDays <= 0) throw new RangeError('orbit.periodDays doit être strictement positif.');
  if (isFiniteNumber(orbit.periastronEpochJulianDate)) {
    return { meanAnomalyRad: TAU * (targetJulianDate - Number(orbit.periastronEpochJulianDate)) / periodDays, epochSource: 'periastron-epoch-jd' };
  }
  if (isFiniteNumber(orbit.meanAnomalyAtEpochDeg) && isFiniteNumber(orbit.epochJulianDate)) {
    return { meanAnomalyRad: Number(orbit.meanAnomalyAtEpochDeg) * DEG_TO_RAD + TAU * (targetJulianDate - Number(orbit.epochJulianDate)) / periodDays, epochSource: 'mean-anomaly-epoch-jd' };
  }
  throw new TypeError('Fournir periastronEpochJulianDate ou meanAnomalyAtEpochDeg avec epochJulianDate.');
}

/**
 * Calcule la position et la vitesse képlériennes d'une exoplanète.
 * Sortie : position en AU et vitesse en AU/jour dans un repère cartésien centré sur l'étoile.
 * Les angles d'orientation suivent la convention classique Ω, i, ω.
 */
export function calculateExoplanetPosition(orbit = {}, targetJulianDate, { centralMassSolar = null, gravitationalParameterAu3Day2 = null } = {}) {
  const targetJD = requiredNumber(targetJulianDate, 'targetJulianDate');
  const periodDays = requiredNumber(orbit.periodDays, 'orbit.periodDays');
  if (periodDays <= 0) throw new RangeError('orbit.periodDays doit être strictement positif.');
  const eccentricity = requiredNumber(orbit.eccentricity, 'orbit.eccentricity');
  if (eccentricity < 0 || eccentricity >= 1) throw new RangeError('Seules les orbites elliptiques (0 <= e < 1) sont prises en charge.');

  const warnings = [];
  let semiMajorAxisAu = optionalNumber(orbit.semiMajorAxisAu);
  if (semiMajorAxisAu === null) {
    const mass = optionalNumber(centralMassSolar);
    if (mass === null || mass <= 0) throw new TypeError('orbit.semiMajorAxisAu ou centralMassSolar positif est requis.');
    semiMajorAxisAu = deriveSemiMajorAxisAu(periodDays, mass);
    warnings.push('Demi-grand axe dérivé de la troisième loi de Kepler ; masse planétaire négligée.');
  }
  if (semiMajorAxisAu <= 0) throw new RangeError('semiMajorAxisAu doit être strictement positif.');

  const phase = resolveMeanAnomaly(orbit, targetJD);
  const meanAnomalyRad = wrapRadians(phase.meanAnomalyRad);
  const solution = solveKeplerEquation(meanAnomalyRad, eccentricity);
  const E = solution.eccentricAnomalyRad;
  const cosE = Math.cos(E); const sinE = Math.sin(E);
  const beta = Math.sqrt(1 - eccentricity * eccentricity);
  const xOrbital = semiMajorAxisAu * (cosE - eccentricity);
  const yOrbital = semiMajorAxisAu * beta * sinE;
  const radiusAu = semiMajorAxisAu * (1 - eccentricity * cosE);

  let mu = optionalNumber(gravitationalParameterAu3Day2);
  if (mu === null) {
    const mass = optionalNumber(centralMassSolar);
    mu = mass !== null && mass > 0 ? GAUSSIAN_K * GAUSSIAN_K * mass : (TAU / periodDays) ** 2 * semiMajorAxisAu ** 3;
  }
  if (mu <= 0) throw new RangeError('Le paramètre gravitationnel doit être positif.');
  const meanMotion = Math.sqrt(mu / semiMajorAxisAu ** 3);
  const denominator = 1 - eccentricity * cosE;
  const vxOrbital = -semiMajorAxisAu * meanMotion * sinE / denominator;
  const vyOrbital = semiMajorAxisAu * meanMotion * beta * cosE / denominator;

  const inclinationDeg = optionalNumber(orbit.inclinationDeg, 0);
  const ascendingNodeDeg = optionalNumber(orbit.longitudeAscendingNodeDeg, 0);
  let argumentPeriastronDeg = optionalNumber(orbit.argumentOfPeriastronDeg);
  if (argumentPeriastronDeg === null) {
    const longitudePeriastron = optionalNumber(orbit.longitudePeriastronDeg);
    argumentPeriastronDeg = longitudePeriastron === null ? 0 : longitudePeriastron - ascendingNodeDeg;
  }
  if (!isFiniteNumber(orbit.inclinationDeg)) warnings.push('Inclinaison absente : valeur 0° utilisée.');
  if (!isFiniteNumber(orbit.longitudeAscendingNodeDeg)) warnings.push('Longitude du nœud ascendant absente : valeur 0° utilisée.');
  if (!isFiniteNumber(orbit.argumentOfPeriastronDeg) && !isFiniteNumber(orbit.longitudePeriastronDeg)) warnings.push('Orientation du périastre absente : argument 0° utilisé.');

  const positionVelocity = rotatePerifocalToReference(
    { x: xOrbital, y: yOrbital, vx: vxOrbital, vy: vyOrbital },
    inclinationDeg * DEG_TO_RAD,
    ascendingNodeDeg * DEG_TO_RAD,
    argumentPeriastronDeg * DEG_TO_RAD,
  );
  const trueAnomalyRad = Math.atan2(beta * sinE, cosE - eccentricity);
  return {
    bodyId: orbit.bodyId ?? null,
    epochJulianDate: targetJD,
    frame: orbit.frame || 'ORBITAL-REFERENCE',
    units: { position: 'AU', velocity: 'AU/day', angles: 'deg' },
    position: { x: positionVelocity.x, y: positionVelocity.y, z: positionVelocity.z },
    velocity: { x: positionVelocity.vx, y: positionVelocity.vy, z: positionVelocity.vz },
    orbitalState: {
      semiMajorAxisAu, eccentricity, periodDays, radiusAu,
      meanAnomalyDeg: meanAnomalyRad * RAD_TO_DEG,
      eccentricAnomalyDeg: E * RAD_TO_DEG,
      trueAnomalyDeg: wrapRadians(trueAnomalyRad) * RAD_TO_DEG,
      inclinationDeg, longitudeAscendingNodeDeg: ascendingNodeDeg,
      argumentOfPeriastronDeg: argumentPeriastronDeg,
    },
    solver: { method: 'elliptic-kepler-newton-bisection', iterations: solution.iterations, residual: solution.residual, converged: solution.converged },
    epochSource: phase.epochSource,
    warnings,
  };
}

/** Adapte un enregistrement exoplanète normalisé ; l'époque de phase doit être fournie explicitement. */
export function calculateExoplanetRecordPosition(record, targetJulianDate, options = {}) {
  if (!record || record.kind !== 'exoplanet' || !record.orbit) throw new TypeError('Un enregistrement exoplanète normalisé est requis.');
  const result = calculateExoplanetPosition({ ...record.orbit, bodyId: record.id, ...(options.orbitOverrides || {}) }, targetJulianDate, options);
  if (record.orbit.argumentOfPeriastronConvention) {
    result.warnings.push('Argument du périastre NASA conservé selon la convention publiée ; vérifier planète versus mouvement réflexe de l’étoile.');
  }
  if (isFiniteNumber(record.orbit.timeOfPeriastronRawDays) && !isFiniteNumber(options.orbitOverrides?.periastronEpochJulianDate)) {
    result.warnings.push('Le temps de périastre NASA brut n’a pas été utilisé ; valider son échelle temporelle avant de le mapper vers periastronEpochJulianDate.');
  }
  return result;
}

export function calculateExoplanetBatch(records, targetJulianDate, options = {}) {
  if (!Array.isArray(records)) throw new TypeError('records doit être un tableau.');
  return records.map((record) => calculateExoplanetRecordPosition(record, targetJulianDate, options));
}

export const EXOPLANET_ORBITAL_CONSTANTS = Object.freeze({ daysPerJulianYear: DAYS_PER_YEAR, gaussianGravitationalConstantAu: GAUSSIAN_K, radiansPerDegree: DEG_TO_RAD });
