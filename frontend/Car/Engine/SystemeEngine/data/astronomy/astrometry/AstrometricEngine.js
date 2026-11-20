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

const GAIA_ASTROMETRIC_PARAMETERS = Object.freeze(['ra', 'dec', 'parallax', 'pmra', 'pmdec']);
const GAIA_CORRELATION_PAIRS = Object.freeze([
  ['ra', 'dec', 'ra_dec_corr'], ['ra', 'parallax', 'ra_parallax_corr'],
  ['ra', 'pmra', 'ra_pmra_corr'], ['ra', 'pmdec', 'ra_pmdec_corr'],
  ['dec', 'parallax', 'dec_parallax_corr'], ['dec', 'pmra', 'dec_pmra_corr'],
  ['dec', 'pmdec', 'dec_pmdec_corr'], ['parallax', 'pmra', 'parallax_pmra_corr'],
  ['parallax', 'pmdec', 'parallax_pmdec_corr'], ['pmra', 'pmdec', 'pmra_pmdec_corr'],
]);

/**
 * Construit la covariance Gaia 5 paramètres dans l'ordre
 * [alpha*, delta, parallaxe, mu_alpha*, mu_delta]. Les erreurs de position
 * Gaia sont interprétées dans le plan tangent (mas), comme dans la solution.
 * Les corrélations absentes sont mises à zéro, jamais estimées.
 */
export function buildGaiaAstrometricCovariance(row) {
  if (!row || typeof row !== 'object') throw new TypeError('Une ligne Gaia DR3 est requise.');
  const errorFields = ['ra_error', 'dec_error', 'parallax_error', 'pmra_error', 'pmdec_error'];
  const errors = errorFields.map((field) => asFinite(row[field], field));
  if (errors.some((value) => value < 0)) throw new RangeError('Les incertitudes Gaia doivent être positives ou nulles.');
  const covariance = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => i === j ? errors[i] ** 2 : 0));
  const index = Object.fromEntries(GAIA_ASTROMETRIC_PARAMETERS.map((name, i) => [name, i]));
  for (const [left, right, field] of GAIA_CORRELATION_PAIRS) {
    const raw = row[field];
    const correlation = finite(raw) ? Number(raw) : 0;
    if (correlation < -1 || correlation > 1) throw new RangeError(`${field} doit être compris entre -1 et +1.`);
    const i = index[left]; const j = index[right];
    covariance[i][j] = correlation * errors[i] * errors[j];
    covariance[j][i] = covariance[i][j];
  }
  return covariance;
}

function positionFromAstrometricParameters(base, parameters, deltaYears) {
  const [raOffsetMas, decOffsetMas, parallaxMas, pmRaMasYr, pmDecMasYr, radialVelocityKmS] = parameters;
  const decRad = base.decDeg * DEG_TO_RAD;
  const cosDec = Math.cos(decRad);
  const raDeg = base.raDeg + (raOffsetMas / (3600000 * (Math.abs(cosDec) < 1e-12 ? 1e-12 : cosDec)));
  const decDeg = base.decDeg + decOffsetMas / 3600000;
  const basis = basisFromIcrs(raDeg, decDeg);
  const distancePc = 1000 / parallaxMas;
  const position = basis.radial.map((component) => component * distancePc);
  const eastSpeed = distancePc * pmRaMasYr * MAS_TO_RAD;
  const northSpeed = distancePc * pmDecMasYr * MAS_TO_RAD;
  const radialSpeed = radialVelocityKmS * KM_S_TO_PC_YR;
  const velocity = basis.radial.map((component, i) => component * radialSpeed + basis.east[i] * eastSpeed + basis.north[i] * northSpeed);
  return addScaled(position, velocity, deltaYears);
}

function multiplyPositionCovariance(jacobian, covariance) {
  const rows = 3; const dimensions = covariance.length;
  const output = Array.from({ length: rows }, () => Array(rows).fill(0));
  for (let a = 0; a < rows; a += 1) {
    for (let b = 0; b < rows; b += 1) {
      for (let i = 0; i < dimensions; i += 1) {
        for (let j = 0; j < dimensions; j += 1) output[a][b] += jacobian[a][i] * covariance[i][j] * jacobian[b][j];
      }
    }
  }
  return output;
}

/** Propagation linéarisée C_xyz = J C_astrométrie J^T (pc²). */
export function propagateAstrometricPositionCovariance({ coordinates, astrometry = {} } = {}, targetEpoch) {
  const source = validateCoordinates(coordinates);
  const fromEpoch = asFinite(coordinates?.epoch, 'coordinates.epoch');
  const toEpoch = asFinite(targetEpoch, 'targetEpoch');
  const parallax = asFinite(astrometry.parallaxMas, 'astrometry.parallaxMas');
  if (parallax <= 0) throw new RangeError('Une parallaxe positive est requise pour propager une covariance 3D.');
  const covariance = astrometry.covariance;
  if (!Array.isArray(covariance) || ![5, 6].includes(covariance.length) || covariance.some((row) => !Array.isArray(row) || row.length !== covariance.length)) {
    throw new TypeError('astrometry.covariance doit être une matrice 5x5 Gaia ou 6x6 avec vitesse radiale.');
  }
  const base = {
    raDeg: source.raDeg,
    decDeg: source.decDeg,
  };
  const parameters = [0, 0, parallax,
    finite(astrometry.properMotionRaMasYr) ? Number(astrometry.properMotionRaMasYr) : 0,
    finite(astrometry.properMotionDecMasYr) ? Number(astrometry.properMotionDecMasYr) : 0,
    finite(astrometry.radialVelocityKmS) ? Number(astrometry.radialVelocityKmS) : 0];
  const dimensions = covariance.length;
  const jacobian = Array.from({ length: 3 }, () => Array(dimensions).fill(0));
  const defaultSteps = [1e-3, 1e-3, Math.max(parallax * 1e-6, 1e-6), 1e-3, 1e-3, 1e-3];
  for (let parameterIndex = 0; parameterIndex < dimensions; parameterIndex += 1) {
    const step = defaultSteps[parameterIndex];
    const plus = [...parameters]; const minus = [...parameters];
    plus[parameterIndex] += step; minus[parameterIndex] -= step;
    if (parameterIndex === 2 && minus[parameterIndex] <= 0) minus[parameterIndex] = parameters[parameterIndex] * 0.5;
    const plusPosition = positionFromAstrometricParameters(base, plus, toEpoch - fromEpoch);
    const minusPosition = positionFromAstrometricParameters(base, minus, toEpoch - fromEpoch);
    const denominator = plus[parameterIndex] - minus[parameterIndex];
    for (let axis = 0; axis < 3; axis += 1) jacobian[axis][parameterIndex] = (plusPosition[axis] - minusPosition[axis]) / denominator;
  }
  const propagated = multiplyPositionCovariance(jacobian, covariance);
  const sigmas = propagated.map((row, i) => Math.sqrt(Math.max(0, row[i])));
  return {
    frame: 'ICRS heliocentric',
    units: 'pc^2',
    parameterOrder: dimensions === 5 ? [...GAIA_ASTROMETRIC_PARAMETERS] : [...GAIA_ASTROMETRIC_PARAMETERS, 'radial_velocity'],
    covariancePc2: propagated,
    sigmaPc: { x: sigmas[0], y: sigmas[1], z: sigmas[2] },
    jacobianPcPerParameter: jacobian,
    method: 'linearized-jacobian',
    assumptions: ['Les corrélations absentes sont nulles.', 'La vitesse radiale est indépendante si sa variance est fournie en 6e dimension.', 'La covariance décrit une approximation linéarisée au voisinage de la solution nominale.'],
  };
}

/** Normalise une ligne Gaia DR3 en enregistrement astrométrique exploitable. */
export function gaiaDR3RowToAstrometricRecord(row) {
  if (!row || typeof row !== 'object') throw new TypeError('Une ligne Gaia DR3 est requise.');
  const record = {
    id: `gaia-dr3:${String(row.source_id ?? '')}`,
    name: row.designation || `Gaia DR3 ${row.source_id ?? 'unknown'}`,
    kind: 'star',
    coordinates: { frame: 'ICRS', epoch: asFinite(row.ref_epoch, 'ref_epoch'), raDeg: asFinite(row.ra, 'ra'), decDeg: asFinite(row.dec, 'dec') },
    astrometry: {
      parallaxMas: finite(row.parallax) ? Number(row.parallax) : null,
      properMotionRaMasYr: finite(row.pmra) ? Number(row.pmra) : null,
      properMotionDecMasYr: finite(row.pmdec) ? Number(row.pmdec) : null,
      radialVelocityKmS: finite(row.radial_velocity) ? Number(row.radial_velocity) : null,
      covariance: buildGaiaAstrometricCovariance(row),
    },
    provenance: { provider: 'ESA Gaia DR3', catalog: 'gaiadr3.gaia_source', sourceId: String(row.source_id ?? ''), referenceEpoch: Number(row.ref_epoch), astrometricParamsSolved: row.astrometric_params_solved ?? null },
  };
  if (finite(row.radial_velocity_error)) {
    const base = record.astrometry.covariance;
    const expanded = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => i < 5 && j < 5 ? base[i][j] : 0));
    expanded[5][5] = Number(row.radial_velocity_error) ** 2;
    record.astrometry.covariance = expanded;
  }
  return record;
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
    const tangentialVelocityKmS = Math.hypot(
      (pmRa ?? 0) * MAS_TO_RAD * distancePc / KM_S_TO_PC_YR,
      (pmDec ?? 0) * MAS_TO_RAD * distancePc / KM_S_TO_PC_YR,
    );
    const radialVelocityKmS = radialVelocity;
    const totalSpaceVelocityKmS = Math.hypot(tangentialVelocityKmS, radialVelocityKmS ?? 0);
    const positionUncertainty = Array.isArray(astrometry.covariance)
      ? propagateAstrometricPositionCovariance({ coordinates, astrometry }, toEpoch)
      : null;
    return {
      ...result,
      frame: coordinates.frame || 'ICRS',
      epoch: toEpoch,
      sourceEpoch: fromEpoch,
      deltaYears,
      distancePc: distanceAfterPc,
      parallaxMas: distanceAfterPc > 0 ? 1000 / distanceAfterPc : null,
      positionIcrsPc: { x: propagated[0], y: propagated[1], z: propagated[2] },
      velocityIcrsPcYr: { x: velocity[0], y: velocity[1], z: velocity[2] },
      tangentialVelocityKmS,
      radialVelocityKmS,
      totalSpaceVelocityKmS,
      positionUncertainty,
      uncertaintyStatus: positionUncertainty ? 'propagated' : 'unavailable',
      method: 'space-motion-3d',
      used: { properMotionRa: pmRa !== null, properMotionDec: pmDec !== null, parallax: true, radialVelocity: radialVelocity !== null },
      warnings: [
        ...(radialVelocity === null ? ['Vitesse radiale absente : la position 3D utilise uniquement le mouvement tangentiel.'] : []),
        ...(!positionUncertainty ? ['Covariance astrométrique absente : aucune incertitude 3D n’est calculée.'] : []),
      ],
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
      positionUncertainty: result.positionUncertainty,
      uncertaintyStatus: result.uncertaintyStatus,
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
  gaiaCovarianceParameterOrder: GAIA_ASTROMETRIC_PARAMETERS,
});
