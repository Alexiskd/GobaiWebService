import { executeTapQuery } from './TapClient.js';
import { AstronomicalCatalogCache } from './AstronomicalCatalogCache.js';
import { escapeAdqlString, normalizeExoplanet, normalizeGaiaSource, normalizeSimbadObject, normalizeTapRows } from './AstronomicalDataNormalizer.js';

const ASTRONOMY_PROXY_BASE = String(import.meta.env?.VITE_ASTRONOMY_PROXY_URL || '').trim().replace(/\/$/, '');

export const ASTRONOMICAL_PROVIDERS = Object.freeze({
  gaia: { id: 'gaia', label: 'ESA Gaia DR3', endpoint: 'https://gea.esac.esa.int/tap-server/tap/sync', table: 'gaiadr3.gaia_source' },
  simbad: {
    id: 'simbad', label: 'CDS SIMBAD', endpoints: [
      'https://simbad.cds.unistra.fr/simbad/sim-tap/sync',
      'https://simbad.cfa.harvard.edu/simbad/sim-tap/sync',
      'https://simbad.idia.ac.za/simbad/sim-tap/sync',
    ], table: 'basic',
  },
  exoplanet: { id: 'exoplanet', label: 'NASA Exoplanet Archive', endpoint: 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync', table: 'pscomppars' },
});

const GAIA_COLUMNS = 'source_id,ra,dec,parallax,pmra,pmdec,radial_velocity,phot_g_mean_mag,bp_rp,ref_epoch';
const EXOPLANET_COLUMNS = 'pl_name,hostname,gaia_dr3_id,discoverymethod,disc_year,pl_orbper,pl_orbsmax,pl_orbeccen,pl_orbincl,pl_orblper,pl_orbtper,pl_rade,pl_bmasse,pl_bmassj,pl_eqt,sy_dist,sy_snum,sy_pnum,ra,dec';

export class AstronomicalCatalogService {
  constructor({ fetchImpl = globalThis.fetch, cache = new AstronomicalCatalogCache(), timeoutMs = 30000, endpoints = {}, maxRows = 100 } = {}) {
    this.fetchImpl = fetchImpl;
    this.cache = cache;
    this.timeoutMs = timeoutMs;
    this.maxRows = Math.max(1, Math.min(500, Math.floor(maxRows)));
    this.endpoints = {
      gaia: endpoints.gaia || ASTRONOMICAL_PROVIDERS.gaia.endpoint,
      // En production statique, SIMBAD et NASA passent obligatoirement par le proxy Gobai.
      // Les endpoints directs ne sont autorisés que lorsqu'ils sont explicitement injectés (tests/outils).
      simbad: endpoints.simbad || (ASTRONOMY_PROXY_BASE ? [`${ASTRONOMY_PROXY_BASE}/tap/simbad`] : []),
      exoplanet: endpoints.exoplanet || (ASTRONOMY_PROXY_BASE ? `${ASTRONOMY_PROXY_BASE}/tap/exoplanet` : null),
    };
  }

  async _query(provider, endpoint, query, signal, cacheKey, tapOptions = {}) {
    if (!endpoint) throw new Error(`Proxy astronomique non configuré pour ${provider} : définir VITE_ASTRONOMY_PROXY_URL avant le build statique.`);
    const cached = this.cache.get(cacheKey);
    if (cached) return { ...cached, cache: 'hit' };
    const result = await executeTapQuery({ provider, endpoint, query, signal, fetchImpl: this.fetchImpl, timeoutMs: this.timeoutMs, tapOptions });
    const normalized = { ...result, cache: 'miss' };
    this.cache.set(cacheKey, normalized);
    return normalized;
  }

  async _simbadQuery(query, signal, cacheKey) {
    const endpoints = (Array.isArray(this.endpoints.simbad) ? this.endpoints.simbad : [this.endpoints.simbad]).filter(Boolean);
    if (!endpoints.length) throw new Error('Proxy astronomique non configuré : définir VITE_ASTRONOMY_PROXY_URL sur le service Gobai Astronomy Proxy.');
    let lastError;
    for (const endpoint of endpoints.filter(Boolean)) {
      try { return await this._query('simbad', endpoint, query, signal, `${cacheKey}:${endpoint}`); }
      catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
      }
    }
    throw lastError || new Error('Aucun endpoint SIMBAD disponible.');
  }

  async findGaiaSource(sourceId, { signal } = {}) {
    const id = String(sourceId ?? '').trim();
    if (!/^\d+$/.test(id)) throw new TypeError('sourceId Gaia DR3 doit être un entier décimal.');
    const query = `SELECT TOP 1 ${GAIA_COLUMNS} FROM gaiadr3.gaia_source WHERE source_id = ${id}`;
    const result = await this._query('gaia', this.endpoints.gaia, query, signal, `gaia:id:${id}`);
    return { ...result, records: normalizeTapRows(result.rows, normalizeGaiaSource, result.retrievedAt) };
  }

  async searchGaiaCone({ raDeg, decDeg, radiusDeg = 0.1, limit = 50, sourceIdAfter = null } = {}, { signal } = {}) {
    const ra = Number(raDeg); const dec = Number(decDeg); const radius = Number(radiusDeg);
    if (!Number.isFinite(ra) || ra < 0 || ra > 360 || !Number.isFinite(dec) || dec < -90 || dec > 90 || !Number.isFinite(radius) || radius <= 0 || radius > 5) {
      throw new TypeError('Coordonnées ou rayon invalides (rayon maximal : 5 degrés).');
    }
    const top = Math.max(1, Math.min(this.maxRows, Math.floor(limit)));
    const cursor = sourceIdAfter === null || sourceIdAfter === undefined ? null : String(sourceIdAfter);
    if (cursor !== null && !/^\d+$/.test(cursor)) throw new TypeError('Curseur Gaia source_id invalide.');
    const cursorFilter = cursor === null ? '' : ` AND source_id > ${cursor}`;
    // Pagination par clé (source_id), stable entre les pages et sans OFFSET coûteux.
    const query = `SELECT TOP ${top} ${GAIA_COLUMNS} FROM gaiadr3.gaia_source WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${ra},${dec},${radius}))${cursorFilter} ORDER BY source_id ASC`;
    const result = await this._query('gaia', this.endpoints.gaia, query, signal, `gaia:cone:${ra}:${dec}:${radius}:${top}:after:${cursor ?? 'start'}`);
    return { ...result, records: normalizeTapRows(result.rows, normalizeGaiaSource, result.retrievedAt) };
  }

  async resolveSimbadName(name, { signal, limit = 10 } = {}) {
    const clean = String(name ?? '').trim();
    if (!clean || clean.length > 160) throw new TypeError('Nom SIMBAD invalide.');
    const top = Math.max(1, Math.min(50, Math.floor(limit)));
    const escaped = escapeAdqlString(clean);
    const query = `SELECT TOP ${top} b.main_id,b.ra,b.dec,b.otype,b.sp_type FROM basic AS b JOIN ident AS i ON i.oidref=b.oid WHERE i.id='${escaped}'`;
    const result = await this._simbadQuery(query, signal, `simbad:name:${clean.toLowerCase()}:${top}`);
    return { ...result, records: normalizeTapRows(result.rows, normalizeSimbadObject, result.retrievedAt) };
  }

  async searchSimbadCone({ raDeg, decDeg, radiusDeg = 0.01, limit = 20 } = {}, { signal } = {}) {
    const ra = Number(raDeg); const dec = Number(decDeg); const radius = Number(radiusDeg);
    if (!Number.isFinite(ra) || ra < 0 || ra > 360 || !Number.isFinite(dec) || dec < -90 || dec > 90
      || !Number.isFinite(radius) || radius <= 0 || radius > 5) {
      throw new TypeError('Coordonnées SIMBAD invalides (rayon maximal : 5 degrés).');
    }
    const top = Math.max(1, Math.min(50, Math.floor(limit)));
    const query = `SELECT TOP ${top} b.main_id,b.ra,b.dec,b.otype,b.sp_type FROM basic AS b WHERE 1=CONTAINS(POINT('ICRS',b.ra,b.dec),CIRCLE('ICRS',${ra},${dec},${radius})) ORDER BY b.main_id`;
    const result = await this._simbadQuery(query, signal, `simbad:cone:${ra}:${dec}:${radius}:${top}`);
    return { ...result, records: normalizeTapRows(result.rows, normalizeSimbadObject, result.retrievedAt) };
  }

  async findExoplanetsByHost(hostName, { signal, limit = 50 } = {}) {
    const clean = String(hostName ?? '').trim();
    if (!clean || clean.length > 160) throw new TypeError('Nom d’étoile hôte invalide.');
    const top = Math.max(1, Math.min(this.maxRows, Math.floor(limit)));
    const escaped = escapeAdqlString(clean);
    const query = `SELECT TOP ${top} ${EXOPLANET_COLUMNS} FROM pscomppars WHERE lower(hostname)=lower('${escaped}') ORDER BY pl_name`;
    const result = await this._query('nasa-exoplanet-archive', this.endpoints.exoplanet, query, signal, `exoplanets:host:${clean.toLowerCase()}:${top}`, { requestParam: null, languageParam: null, formatParam: 'format', queryParam: 'query' });
    return { ...result, records: normalizeTapRows(result.rows, normalizeExoplanet, result.retrievedAt) };
  }

  async findExoplanetsByGaiaHostId(gaiaSourceId, { signal, limit = 50 } = {}) {
    const id = String(gaiaSourceId ?? '').trim();
    if (!/^\d+$/.test(id)) throw new TypeError('gaiaSourceId doit être un entier décimal.');
    const top = Math.max(1, Math.min(this.maxRows, Math.floor(limit)));
    const query = `SELECT TOP ${top} ${EXOPLANET_COLUMNS} FROM pscomppars WHERE gaia_dr3_id=${id} ORDER BY pl_name`;
    const result = await this._query('nasa-exoplanet-archive', this.endpoints.exoplanet, query, signal, `exoplanets:gaia-host:${id}:${top}`, { requestParam: null, languageParam: null, formatParam: 'format', queryParam: 'query' });
    return { ...result, records: normalizeTapRows(result.rows, normalizeExoplanet, result.retrievedAt) };
  }

  async searchExoplanetSystemsCone({ raDeg, decDeg, radiusDeg = 5, limit = 100 } = {}, { signal } = {}) {
    const ra = Number(raDeg); const dec = Number(decDeg); const radius = Number(radiusDeg);
    if (!Number.isFinite(ra) || ra < 0 || ra > 360 || !Number.isFinite(dec) || dec < -90 || dec > 90
      || !Number.isFinite(radius) || radius <= 0 || radius > 30) {
      throw new TypeError('Coordonnées invalides (rayon NASA maximal : 30 degrés).');
    }
    const top = Math.max(1, Math.min(this.maxRows, Math.floor(limit)));
    const query = `SELECT TOP ${top} ${EXOPLANET_COLUMNS} FROM pscomppars WHERE sy_pnum > 0 AND 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${ra},${dec},${radius})) ORDER BY hostname,pl_name`;
    const result = await this._query('nasa-exoplanet-archive', this.endpoints.exoplanet, query, signal, `exoplanets:cone:${ra}:${dec}:${radius}:${top}`, { requestParam: null, languageParam: null, formatParam: 'format', queryParam: 'query' });
    return { ...result, records: normalizeTapRows(result.rows, normalizeExoplanet, result.retrievedAt) };
  }

  async listKnownExoplanets({ signal, limit = 100 } = {}) {
    const top = Math.max(1, Math.min(this.maxRows, Math.floor(limit)));
    const query = `SELECT TOP ${top} ${EXOPLANET_COLUMNS} FROM pscomppars WHERE sy_pnum > 0 ORDER BY hostname,pl_name`;
    const result = await this._query('nasa-exoplanet-archive', this.endpoints.exoplanet, query, signal, `exoplanets:known:${top}`, { requestParam: null, languageParam: null, formatParam: 'format', queryParam: 'query' });
    return { ...result, records: normalizeTapRows(result.rows, normalizeExoplanet, result.retrievedAt) };
  }

  async findExoplanet(planetName, { signal } = {}) {
    const clean = String(planetName ?? '').trim();
    if (!clean || clean.length > 160) throw new TypeError('Nom de planète invalide.');
    const escaped = escapeAdqlString(clean);
    const query = `SELECT TOP 5 ${EXOPLANET_COLUMNS} FROM pscomppars WHERE lower(pl_name)=lower('${escaped}')`;
    const result = await this._query('nasa-exoplanet-archive', this.endpoints.exoplanet, query, signal, `exoplanets:planet:${clean.toLowerCase()}`, { requestParam: null, languageParam: null, formatParam: 'format', queryParam: 'query' });
    return { ...result, records: normalizeTapRows(result.rows, normalizeExoplanet, result.retrievedAt) };
  }

  async resolveCrossReferences({ name = null, gaiaSourceId = null, coordinates = null, includeExoplanets = true, coordinateToleranceArcsec = 1 } = {}, { signal } = {}) {
    const records = [];
    const requests = [];
    if (gaiaSourceId !== null && gaiaSourceId !== undefined) requests.push(this.findGaiaSource(gaiaSourceId, { signal }));
    if (coordinates) requests.push(this.searchGaiaCone({ ...coordinates, radiusDeg: Math.min(5, Math.max(0.0001, Number(coordinateToleranceArcsec) / 3600 * 3)), limit: this.maxRows }, { signal }));
    if (name) requests.push(this.resolveSimbadName(name, { signal, limit: 10 }));
    const results = await Promise.all(requests);
    for (const result of results) records.push(...(result.records || []));
    let exoplanetQueryCount = 0;
    if (includeExoplanets && gaiaSourceId !== null && gaiaSourceId !== undefined) {
      const exoplanets = await this.findExoplanetsByGaiaHostId(gaiaSourceId, { signal, limit: this.maxRows });
      records.push(...(exoplanets.records || []));
      exoplanetQueryCount = 1;
    } else if (includeExoplanets && name) {
      const exoplanets = await this.findExoplanetsByHost(name, { signal, limit: this.maxRows });
      records.push(...(exoplanets.records || []));
      exoplanetQueryCount = 1;
    }
    return { records, queryCount: requests.length + exoplanetQueryCount, retrievedAt: new Date().toISOString() };
  }

  clearCache() { this.cache.clear(); }
  getCacheStats() { return { entries: this.cache.size, ttlMs: this.cache.ttlMs, maxEntries: this.cache.maxEntries }; }
}

export function createAstronomicalCatalogService(options) { return new AstronomicalCatalogService(options); }
