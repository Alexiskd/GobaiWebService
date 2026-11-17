const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function normalizeGaiaSource(row, retrievedAt = null) {
  if (!row) return null;
  const sourceId = row.source_id === undefined || row.source_id === null ? null : String(row.source_id);
  if (!sourceId) return null;
  return {
    id: `gaia-dr3:${sourceId}`,
    kind: 'star',
    source: 'ESA Gaia DR3',
    sourceTable: 'gaiadr3.gaia_source',
    sourceId,
    identifiers: [{ catalog: 'Gaia DR3', value: sourceId }],
    coordinates: { frame: 'ICRS', epoch: numberOrNull(row.ref_epoch) ?? 2016.0, raDeg: numberOrNull(row.ra), decDeg: numberOrNull(row.dec) },
    astrometry: {
      parallaxMas: numberOrNull(row.parallax),
      properMotionRaMasYr: numberOrNull(row.pmra),
      properMotionDecMasYr: numberOrNull(row.pmdec),
      radialVelocityKmS: numberOrNull(row.radial_velocity),
    },
    photometry: { gaiaG: numberOrNull(row.phot_g_mean_mag), gaiaBpMinusRp: numberOrNull(row.bp_rp) },
    provenance: { provider: 'gaia', release: 'DR3', retrievedAt, raw: row },
  };
}

export function normalizeSimbadObject(row, retrievedAt = null) {
  if (!row) return null;
  const mainId = row.main_id ?? row.mainId ?? row.id;
  if (!mainId) return null;
  return {
    id: `simbad:${String(mainId).toLowerCase()}`,
    kind: 'astronomical-object',
    source: 'CDS SIMBAD',
    sourceTable: 'basic',
    name: String(mainId),
    identifiers: [{ catalog: 'SIMBAD', value: String(mainId) }],
    coordinates: { frame: 'ICRS', epoch: null, raDeg: numberOrNull(row.ra), decDeg: numberOrNull(row.dec) },
    classification: { objectType: row.otype ?? null, spectralType: row.sp_type ?? row.sptype ?? null },
    provenance: { provider: 'simbad', retrievedAt, raw: row },
  };
}

export function normalizeExoplanet(row, retrievedAt = null) {
  if (!row) return null;
  const planetName = row.pl_name ?? row.planet_name;
  if (!planetName) return null;
  const hostname = row.hostname ?? row.pl_hostname ?? null;
  const gaiaId = row.gaia_dr3_id === null || row.gaia_dr3_id === undefined ? null : String(row.gaia_dr3_id);
  const radiusEarthDirect = numberOrNull(row.pl_rade);
  const radiusJupiter = numberOrNull(row.pl_radj);
  const identifiers = [{ catalog: 'NASA Exoplanet Archive', value: String(planetName) }];
  if (hostname) identifiers.push({ catalog: 'NASA Exoplanet Archive host', value: String(hostname) });
  if (gaiaId) identifiers.push({ catalog: 'Gaia DR3', value: gaiaId });
  return {
    id: `nasa-exoplanet:${String(planetName).toLowerCase()}`,
    kind: 'exoplanet',
    source: 'NASA Exoplanet Archive',
    sourceTable: 'pscomppars',
    name: String(planetName),
    host: hostname ? { name: String(hostname), gaiaDr3Id: gaiaId, radiusSolar: numberOrNull(row.st_rad) } : null,
    identifiers,
    coordinates: { frame: 'ICRS', epoch: null, raDeg: numberOrNull(row.ra), decDeg: numberOrNull(row.dec) },
    orbit: {
      periodDays: numberOrNull(row.pl_orbper),
      semiMajorAxisAu: numberOrNull(row.pl_orbsmax),
      eccentricity: numberOrNull(row.pl_orbeccen),
      inclinationDeg: numberOrNull(row.pl_orbincl),
      longitudeAscendingNodeDeg: numberOrNull(row.pl_orblnode),
      argumentOfPeriastronDeg: numberOrNull(row.pl_orblper),
      argumentOfPeriastronConvention: numberOrNull(row.pl_orblper) === null ? null : 'NASA as-reported; planet/star reflex convention must be checked',
      // Conservé brut ; le référentiel temporel (notamment JD/BJD) doit être validé avant calcul.
      timeOfPeriastronRawDays: numberOrNull(row.pl_orbtper),
      timeOfPeriastronSourceField: row.pl_orbtper === null || row.pl_orbtper === undefined ? null : 'pl_orbtper',
    },
    physical: {
      radiusEarth: radiusEarthDirect ?? (radiusJupiter !== null ? radiusJupiter * 11.2089 : null),
      radiusSourceField: radiusEarthDirect !== null ? 'pl_rade' : (radiusJupiter !== null ? 'pl_radj-converted-to-earth-radii' : null),
      massEarthBestEstimate: numberOrNull(row.pl_bmasse),
      massJupiterBestEstimate: numberOrNull(row.pl_bmassj),
      equilibriumTemperatureK: numberOrNull(row.pl_eqt),
    },
    system: {
      distancePc: numberOrNull(row.sy_dist),
      starCount: numberOrNull(row.sy_snum),
      planetCount: numberOrNull(row.sy_pnum),
    },
    discovery: { method: row.discoverymethod ?? null, year: numberOrNull(row.disc_year) },
    provenance: { provider: 'nasa-exoplanet-archive', table: 'pscomppars', retrievedAt, raw: row },
  };
}

export function escapeAdqlString(value) {
  return String(value).replace(/'/g, "''");
}

export function normalizeTapRows(rows, normalizer, retrievedAt) {
  return rows.map((row) => normalizer(row, retrievedAt)).filter(Boolean);
}
