import { validateAnchor } from '@/contributions/geodesy';

// Ancrage saisi sous forme de texte : on peut taper « - » ou « 48. » sans que le champ se vide.
export const EMPTY_ANCHOR_INPUT = { latitude: '0', longitude: '0', altitudeMeters: '0' };
export const ANCHOR_FIELDS = [
  ['latitude', 'Latitude'],
  ['longitude', 'Longitude'],
  ['altitudeMeters', 'Altitude (m)'],
];

export function anchorIsValid(anchor) {
  try {
    validateAnchor(anchor);
    return true;
  } catch {
    return false;
  }
}

export const toAnchor = (input) => ({
  latitude: Number(input.latitude),
  longitude: Number(input.longitude),
  altitudeMeters: Number(input.altitudeMeters),
});
export const toAnchorInput = (anchor) => ({
  latitude: String(anchor.latitude),
  longitude: String(anchor.longitude),
  altitudeMeters: String(anchor.altitudeMeters),
});
