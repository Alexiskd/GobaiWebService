-- Gobai Space / Lot 37 — PostgreSQL astronomical persistence
-- Apply with psql or the migration runner of the backend. PostgreSQL 14+.
BEGIN;

CREATE TABLE IF NOT EXISTS astronomy_sync_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('gaia', 'simbad', 'nasa-exoplanet-archive', 'gobai')),
  dataset TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  rows_received INTEGER NOT NULL DEFAULT 0 CHECK (rows_received >= 0),
  rows_inserted INTEGER NOT NULL DEFAULT 0 CHECK (rows_inserted >= 0),
  rows_updated INTEGER NOT NULL DEFAULT 0 CHECK (rows_updated >= 0),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK ((status = 'running' AND finished_at IS NULL) OR status <> 'running')
);
CREATE INDEX IF NOT EXISTS astronomy_sync_runs_provider_started_idx
  ON astronomy_sync_runs (provider, started_at DESC);

CREATE TABLE IF NOT EXISTS astronomical_stars (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  gaia_dr3_source_id NUMERIC(20,0) UNIQUE,
  primary_name TEXT,
  ra_deg DOUBLE PRECISION CHECK (ra_deg IS NULL OR (ra_deg >= 0 AND ra_deg < 360)),
  dec_deg DOUBLE PRECISION CHECK (dec_deg IS NULL OR (dec_deg >= -90 AND dec_deg <= 90)),
  parallax_mas DOUBLE PRECISION,
  proper_motion_ra_mas_yr DOUBLE PRECISION,
  proper_motion_dec_mas_yr DOUBLE PRECISION,
  radial_velocity_km_s DOUBLE PRECISION,
  reference_epoch_jyear DOUBLE PRECISION,
  astrometry JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_retrieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS astronomical_stars_name_idx ON astronomical_stars (lower(primary_name));
CREATE INDEX IF NOT EXISTS astronomical_stars_coordinates_idx ON astronomical_stars (ra_deg, dec_deg);

CREATE TABLE IF NOT EXISTS exoplanets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canonical_key TEXT NOT NULL UNIQUE,
  nasa_pl_name TEXT UNIQUE,
  host_name TEXT,
  host_gaia_dr3_source_id NUMERIC(20,0),
  host_star_id BIGINT REFERENCES astronomical_stars(id) ON DELETE SET NULL,
  host_link_status TEXT NOT NULL DEFAULT 'unresolved' CHECK (host_link_status IN ('verified-gaia-id', 'candidate', 'unresolved')),
  orbital_period_days DOUBLE PRECISION CHECK (orbital_period_days IS NULL OR orbital_period_days > 0),
  semi_major_axis_au DOUBLE PRECISION CHECK (semi_major_axis_au IS NULL OR semi_major_axis_au > 0),
  eccentricity DOUBLE PRECISION CHECK (eccentricity IS NULL OR (eccentricity >= 0 AND eccentricity < 1)),
  inclination_deg DOUBLE PRECISION,
  argument_periastron_deg DOUBLE PRECISION,
  periastron_epoch_jd DOUBLE PRECISION,
  radius_earth DOUBLE PRECISION,
  mass_earth DOUBLE PRECISION,
  physical JSONB NOT NULL DEFAULT '{}'::jsonb,
  orbit JSONB NOT NULL DEFAULT '{}'::jsonb,
  discovery JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_retrieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS exoplanets_host_star_idx ON exoplanets (host_star_id);
CREATE INDEX IF NOT EXISTS exoplanets_host_gaia_idx ON exoplanets (host_gaia_dr3_source_id);
CREATE INDEX IF NOT EXISTS exoplanets_name_idx ON exoplanets (lower(nasa_pl_name));

CREATE TABLE IF NOT EXISTS astronomical_source_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('gaia', 'simbad', 'nasa-exoplanet-archive')),
  external_id TEXT NOT NULL,
  object_kind TEXT NOT NULL CHECK (object_kind IN ('star', 'exoplanet', 'identifier')),
  payload JSONB NOT NULL,
  retrieved_at TIMESTAMPTZ,
  sync_run_id BIGINT REFERENCES astronomy_sync_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, external_id, object_kind)
);
CREATE INDEX IF NOT EXISTS astronomical_source_records_run_idx ON astronomical_source_records (sync_run_id);

CREATE TABLE IF NOT EXISTS astronomical_position_samples (
  object_key TEXT NOT NULL,
  epoch_jd DOUBLE PRECISION NOT NULL,
  frame TEXT NOT NULL CHECK (frame IN ('ICRS', 'ORBITAL-REFERENCE', 'GOBAI-SCENE')),
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  z DOUBLE PRECISION NOT NULL,
  vx DOUBLE PRECISION,
  vy DOUBLE PRECISION,
  vz DOUBLE PRECISION,
  units TEXT NOT NULL,
  source TEXT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (object_key, epoch_jd, frame, source)
);
CREATE INDEX IF NOT EXISTS astronomical_position_samples_epoch_idx
  ON astronomical_position_samples (epoch_jd DESC, frame);

COMMIT;
