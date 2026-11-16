/**
 * Mises en forme de la composante « Contribuer » : état d'un placement, nombres, tailles et dates.
 * Aucune dépendance : testable sans navigateur.
 */

/** Les trois états d'un placement, avec leur libellé, leur couleur MUI et la teinte du calque 3D. */
export const PLACEMENT_STATES = {
  // Placement approuvé par les votes.
  valide: { label: 'Placement validé', color: 'success', tint: 0x49df8a },
  // Placement refusé par les votes.
  conteste: { label: 'Placement contesté', color: 'error', tint: 0xff5b69 },
  // Pas encore assez de voix pour trancher.
  attente: { label: 'En attente de votes', color: 'warning', tint: 0xffc857 },
};

/** État d'un placement, l'attente servant de valeur par défaut pour un état inconnu. */
export const placementState = (status) => PLACEMENT_STATES[status] || PLACEMENT_STATES.attente;

/** Nombre entier avec les séparateurs de milliers français. */
export const formatCount = (value) => (Number.isFinite(value) ? Math.round(value).toLocaleString('fr-FR') : '—');

/** Longueur en mètres ou en kilomètres, selon sa taille. */
export function formatMeters(value) {
  // Valeur inutilisable.
  if (!Number.isFinite(value)) return '—';
  // Au-delà du kilomètre : en kilomètres, à une décimale.
  if (Math.abs(value) >= 1000) return `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
  // Sinon : en mètres entiers.
  return `${Math.round(value).toLocaleString('fr-FR')} m`;
// Fin de formatMeters.
}

/** Taille d'un fichier, en unités binaires. */
export function formatBytes(bytes) {
  // Valeur inutilisable.
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  // Unités.
  const units = ['o', 'Kio', 'Mio', 'Gio'];
  // Rang de l'unité.
  let rank = 0;
  // Valeur réduite.
  let value = bytes;
  // Divise tant que la valeur dépasse mille et qu'il reste une unité.
  while (value >= 1024 && rank < units.length - 1) { value /= 1024; rank += 1; }
  // La taille mise en forme.
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: rank ? 1 : 0 })} ${units[rank]}`;
// Fin de formatBytes.
}

/** Coordonnée en degrés, avec son hémisphère, à cinq décimales (environ un mètre). */
export function formatDegrees(value, axis) {
  // Valeur inutilisable.
  if (!Number.isFinite(value)) return '—';
  // Lettre de l'hémisphère.
  const letter = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'O');
  // La coordonnée.
  return `${Math.abs(value).toFixed(5)}° ${letter}`;
// Fin de formatDegrees.
}

/** Nom lisible d'une dalle IGN : « dalle 0652-6863 », ou null hors de France. */
export function formatTile(tile) {
  // Pas de dalle.
  if (typeof tile !== 'string') return null;
  // Les deux numéros de kilomètre du nom.
  const m = /^LHD_FXX_(\d{4})_(\d{4})$/.exec(tile);
  // Nom inattendu : rendu tel quel.
  return m ? `dalle ${m[1]}-${m[2]}` : tile;
// Fin de formatTile.
}

/** Âge d'une publication, en français et à la louche (« il y a 3 h »). */
export function formatAge(date, now = Date.now()) {
  // Instant de la publication.
  const at = new Date(date).getTime();
  // Date illisible.
  if (!Number.isFinite(at)) return '';
  // Secondes écoulées, jamais négatives.
  const s = Math.max(0, Math.round((now - at) / 1000));
  // Moins d'une minute.
  if (s < 60) return 'à l’instant';
  // Minutes.
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  // Heures.
  if (s < 86_400) return `il y a ${Math.floor(s / 3600)} h`;
  // Jours.
  if (s < 2_592_000) return `il y a ${Math.floor(s / 86_400)} j`;
  // Au-delà d'un mois : la date.
  return new Date(at).toLocaleDateString('fr-FR');
// Fin de formatAge.
}

/** Phrase qui résume d'où vient la position : du fichier, ou reconnue par le serveur. */
export const formatCrs = (crs, crsSource) => (crsSource === 'declare'
  // Le fichier déclarait son système de coordonnées.
  ? `${crs} déclaré par le fichier`
  // Le serveur l'a reconnu à l'emprise des coordonnées.
  : `${crs} reconnu à l’emprise`);
