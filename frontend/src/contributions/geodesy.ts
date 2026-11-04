import type { GeodeticAnchor } from './types';

const EARTH_RADIUS_METERS = 6_371_000;
const WGS84_SEMI_MAJOR_METERS = 6_378_137;
const WGS84_ECCENTRICITY_SQUARED = 6.69437999014e-3;
const DEG_TO_RAD = Math.PI / 180;

export interface EnuVector {
  east: number;
  north: number;
  up: number;
}

export interface SceneVector {
  x: number;
  y: number;
  z: number;
}

export function validateAnchor(anchor: GeodeticAnchor): void {
  if (!Number.isFinite(anchor.latitude) || anchor.latitude < -90 || anchor.latitude > 90) {
    throw new RangeError('La latitude doit être comprise entre -90 et 90 degrés.');
  }
  if (!Number.isFinite(anchor.longitude) || anchor.longitude < -180 || anchor.longitude > 180) {
    throw new RangeError('La longitude doit être comprise entre -180 et 180 degrés.');
  }
  if (!Number.isFinite(anchor.altitudeMeters) || anchor.altitudeMeters < -12_000 || anchor.altitudeMeters > 100_000) {
    throw new RangeError('L’altitude doit être comprise entre -12 000 et 100 000 mètres.');
  }
}

export function geodeticToEcef(anchor: GeodeticAnchor): [number, number, number] {
  validateAnchor(anchor);
  const latitude = anchor.latitude * DEG_TO_RAD;
  const longitude = anchor.longitude * DEG_TO_RAD;
  const sinLatitude = Math.sin(latitude);
  const primeVerticalRadius = WGS84_SEMI_MAJOR_METERS
    / Math.sqrt(1 - WGS84_ECCENTRICITY_SQUARED * sinLatitude * sinLatitude);
  return [
    (primeVerticalRadius + anchor.altitudeMeters) * Math.cos(latitude) * Math.cos(longitude),
    (primeVerticalRadius + anchor.altitudeMeters) * Math.cos(latitude) * Math.sin(longitude),
    (primeVerticalRadius * (1 - WGS84_ECCENTRICITY_SQUARED) + anchor.altitudeMeters) * sinLatitude,
  ];
}

export function ecefToEnu(
  ecef: readonly [number, number, number],
  origin: GeodeticAnchor,
): EnuVector {
  const [originX, originY, originZ] = geodeticToEcef(origin);
  const latitude = origin.latitude * DEG_TO_RAD;
  const longitude = origin.longitude * DEG_TO_RAD;
  const dx = ecef[0] - originX;
  const dy = ecef[1] - originY;
  const dz = ecef[2] - originZ;
  return {
    east: -Math.sin(longitude) * dx + Math.cos(longitude) * dy,
    north: -Math.sin(latitude) * Math.cos(longitude) * dx
      - Math.sin(latitude) * Math.sin(longitude) * dy
      + Math.cos(latitude) * dz,
    up: Math.cos(latitude) * Math.cos(longitude) * dx
      + Math.cos(latitude) * Math.sin(longitude) * dy
      + Math.sin(latitude) * dz,
  };
}

/** Place a point expressed in local ENU meters on the unit-Earth scene used by the Three.js engine. */
export function enuToScene(enu: EnuVector, anchor: GeodeticAnchor): SceneVector {
  validateAnchor(anchor);
  const latitude = anchor.latitude * DEG_TO_RAD;
  const longitude = anchor.longitude * DEG_TO_RAD;
  const cosLatitude = Math.cos(latitude);
  const east = { x: -Math.sin(longitude), y: 0, z: -Math.cos(longitude) };
  const north = {
    x: -Math.sin(latitude) * Math.cos(longitude),
    y: cosLatitude,
    z: Math.sin(latitude) * Math.sin(longitude),
  };
  const up = { x: cosLatitude * Math.cos(longitude), y: Math.sin(latitude), z: -cosLatitude * Math.sin(longitude) };
  const anchorRadius = 1 + anchor.altitudeMeters / EARTH_RADIUS_METERS;
  const anchorPosition = { x: up.x * anchorRadius, y: up.y * anchorRadius, z: up.z * anchorRadius };
  const scale = 1 / EARTH_RADIUS_METERS;
  return {
    x: anchorPosition.x + (east.x * enu.east + north.x * enu.north + up.x * enu.up) * scale,
    y: anchorPosition.y + (east.y * enu.east + north.y * enu.north + up.y * enu.up) * scale,
    z: anchorPosition.z + (east.z * enu.east + north.z * enu.north + up.z * enu.up) * scale,
  };
}

export function dimensionsMeters(bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }): [number, number, number] {
  return [bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ];
}
