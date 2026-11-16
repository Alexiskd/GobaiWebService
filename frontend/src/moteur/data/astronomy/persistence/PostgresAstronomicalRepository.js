import { mapStarSystemForPersistence, mapPositionSample } from './AstronomicalPersistenceMapper.js';

const STAR_UPSERT = `INSERT INTO astronomical_stars
(canonical_key, gaia_dr3_source_id, primary_name, ra_deg, dec_deg, parallax_mas, proper_motion_ra_mas_yr, proper_motion_dec_mas_yr, radial_velocity_km_s, reference_epoch_jyear, astrometry, provenance, source_payload, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,NOW())
ON CONFLICT (canonical_key) DO UPDATE SET gaia_dr3_source_id=EXCLUDED.gaia_dr3_source_id, primary_name=EXCLUDED.primary_name, ra_deg=EXCLUDED.ra_deg, dec_deg=EXCLUDED.dec_deg, parallax_mas=EXCLUDED.parallax_mas, proper_motion_ra_mas_yr=EXCLUDED.proper_motion_ra_mas_yr, proper_motion_dec_mas_yr=EXCLUDED.proper_motion_dec_mas_yr, radial_velocity_km_s=EXCLUDED.radial_velocity_km_s, reference_epoch_jyear=EXCLUDED.reference_epoch_jyear, astrometry=EXCLUDED.astrometry, provenance=EXCLUDED.provenance, source_payload=EXCLUDED.source_payload, source_retrieved_at=NOW(), updated_at=NOW() RETURNING id`;
const PLANET_UPSERT = `INSERT INTO exoplanets
(canonical_key,nasa_pl_name,host_name,host_gaia_dr3_source_id,host_star_id,host_link_status,orbital_period_days,semi_major_axis_au,eccentricity,inclination_deg,argument_periastron_deg,periastron_epoch_jd,radius_earth,mass_earth,physical,orbit,discovery,provenance,source_payload,updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,NOW())
ON CONFLICT (canonical_key) DO UPDATE SET nasa_pl_name=EXCLUDED.nasa_pl_name,host_name=EXCLUDED.host_name,host_gaia_dr3_source_id=EXCLUDED.host_gaia_dr3_source_id,host_star_id=EXCLUDED.host_star_id,host_link_status=EXCLUDED.host_link_status,orbital_period_days=EXCLUDED.orbital_period_days,semi_major_axis_au=EXCLUDED.semi_major_axis_au,eccentricity=EXCLUDED.eccentricity,inclination_deg=EXCLUDED.inclination_deg,argument_periastron_deg=EXCLUDED.argument_periastron_deg,periastron_epoch_jd=EXCLUDED.periastron_epoch_jd,radius_earth=EXCLUDED.radius_earth,mass_earth=EXCLUDED.mass_earth,physical=EXCLUDED.physical,orbit=EXCLUDED.orbit,discovery=EXCLUDED.discovery,provenance=EXCLUDED.provenance,source_payload=EXCLUDED.source_payload,source_retrieved_at=NOW(),updated_at=NOW() RETURNING id`;

const json = (value) => JSON.stringify(value ?? {});

/** Repository serveur PostgreSQL. Injecter un pool compatible node-postgres (pool.connect/query). */
export class PostgresAstronomicalRepository {
  constructor({ pool } = {}) {
    if (!pool || typeof pool.connect !== 'function') throw new TypeError('Un pool PostgreSQL avec connect() est requis.');
    this.pool = pool;
  }

  async saveStarSystem(system) {
    const mapped = mapStarSystemForPersistence(system);
    const client = await this.pool.connect();
    let committed = false;
    try {
      await client.query('BEGIN');
      const star = mapped.star;
      const starResult = await client.query(STAR_UPSERT, [star.canonicalKey, star.gaiaDr3SourceId, star.primaryName, star.raDeg, star.decDeg, star.parallaxMas, star.properMotionRaMasYr, star.properMotionDecMasYr, star.radialVelocityKmS, star.referenceEpochJyear, json(star.astrometry), json(star.provenance), json(star.sourcePayload)]);
      const starId = starResult.rows[0].id;
      const savedPlanets = [];
      for (const planet of mapped.planets) {
        const result = await client.query(PLANET_UPSERT, [planet.canonicalKey, planet.nasaPlName, planet.hostName, planet.hostGaiaDr3SourceId, planet.hostLinkStatus === 'verified-gaia-id' ? starId : null, planet.hostLinkStatus, planet.orbitalPeriodDays, planet.semiMajorAxisAu, planet.eccentricity, planet.inclinationDeg, planet.argumentPeriastronDeg, planet.periastronEpochJd, planet.radiusEarth, planet.massEarth, json(planet.physical), json(planet.orbit), json(planet.discovery), json(planet.provenance), json(planet.sourcePayload)]);
        savedPlanets.push({ id: result.rows[0].id, canonicalKey: planet.canonicalKey });
      }
      await client.query('COMMIT'); committed = true;
      return { star: { id: starId, canonicalKey: star.canonicalKey }, planets: savedPlanets, committed };
    } catch (error) {
      if (!committed) { try { await client.query('ROLLBACK'); } catch { /* preserve original error */ } }
      throw error;
    } finally { client.release(); }
  }

  async saveSourceRecord({ provider, externalId, objectKind, payload, retrievedAt = null, syncRunId = null } = {}) {
    if (!['gaia', 'simbad', 'nasa-exoplanet-archive'].includes(provider)) throw new TypeError('Fournisseur astronomique invalide.');
    if (!['star', 'exoplanet', 'identifier'].includes(objectKind)) throw new TypeError('Type d’objet source invalide.');
    if (!String(externalId ?? '').trim() || payload === undefined) throw new TypeError('Identifiant externe et payload requis.');
    const result = await this.pool.query(`INSERT INTO astronomical_source_records (provider,external_id,object_kind,payload,retrieved_at,sync_run_id)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6)
      ON CONFLICT (provider,external_id,object_kind) DO UPDATE SET payload=EXCLUDED.payload,retrieved_at=EXCLUDED.retrieved_at,sync_run_id=EXCLUDED.sync_run_id
      RETURNING id,provider,external_id,object_kind`, [provider,String(externalId),objectKind,json(payload),retrievedAt,syncRunId]);
    return result.rows[0];
  }

  async savePositionSample(sample) {
    const row = mapPositionSample(sample);
    const result = await this.pool.query(`INSERT INTO astronomical_position_samples (object_key,epoch_jd,frame,x,y,z,vx,vy,vz,units,source,metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
      ON CONFLICT (object_key,epoch_jd,frame,source) DO UPDATE SET x=EXCLUDED.x,y=EXCLUDED.y,z=EXCLUDED.z,vx=EXCLUDED.vx,vy=EXCLUDED.vy,vz=EXCLUDED.vz,units=EXCLUDED.units,metadata=EXCLUDED.metadata,calculated_at=NOW() RETURNING object_key,epoch_jd,frame`,
    [row.objectKey,row.epochJulianDate,row.frame,row.x,row.y,row.z,row.vx,row.vy,row.vz,row.units,row.source,json(row.metadata)]);
    return result.rows[0];
  }

  async startSyncRun({ provider, dataset, metadata = {} } = {}) {
    const result = await this.pool.query(`INSERT INTO astronomy_sync_runs (provider,dataset,status,metadata) VALUES ($1,$2,'running',$3::jsonb) RETURNING id,started_at`, [provider,dataset,json(metadata)]);
    return result.rows[0];
  }

  async finishSyncRun(id, { status = 'succeeded', rowsReceived = 0, rowsInserted = 0, rowsUpdated = 0, errorMessage = null, metadata = {} } = {}) {
    if (!['succeeded','partial','failed'].includes(status)) throw new TypeError('Statut final de synchronisation invalide.');
    const result = await this.pool.query(`UPDATE astronomy_sync_runs SET status=$2,finished_at=NOW(),rows_received=$3,rows_inserted=$4,rows_updated=$5,error_message=$6,metadata=metadata || $7::jsonb WHERE id=$1 RETURNING id,status,finished_at`, [id,status,rowsReceived,rowsInserted,rowsUpdated,errorMessage,json(metadata)]);
    if (!result.rowCount) throw new Error(`Synchronisation ${id} introuvable.`);
    return result.rows[0];
  }
}

export function createPostgresAstronomicalRepository(options) { return new PostgresAstronomicalRepository(options); }
