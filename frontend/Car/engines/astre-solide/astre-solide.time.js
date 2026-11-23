/**
 * Curseur du temps du globe de près : décalage de l'heure de l'app par rapport à l'heure réelle, de −12 h à +12 h, par
 * pas de 15 minutes. On voit la nuit avancer et les lumières des villes s'allumer. Fonctions pures.
 */

// Déclare et exporte le décalage maximal (heures).
export const TIME_OFFSET_MAX_H = 12;
// Déclare et exporte le pas du curseur (heures).
export const TIME_OFFSET_STEP_H = 0.25;

/** Décalage (heures) borné à ±12 h et arrondi au pas de 15 min ; 0 s'il est illisible. */
// Déclare et exporte clampOffsetHours : le décalage en heures (début).
export function clampOffsetHours(h) {
  // Illisible : 0.
  if (!Number.isFinite(h)) return 0;
  // Borné.
  const b = Math.max(-TIME_OFFSET_MAX_H, Math.min(TIME_OFFSET_MAX_H, h));
  // Arrondi au pas (et −0 évité).
  return Math.round(b / TIME_OFFSET_STEP_H) * TIME_OFFSET_STEP_H || 0;
// Fin de clampOffsetHours.
}

/** Texte du décalage : « maintenant », « +3 h », « −1 h 45 », « +15 min ». */
// Déclare et exporte formatOffset : le décalage en heures (début).
export function formatOffset(h) {
  // Décalage borné, en minutes.
  const min = Math.round(clampOffsetHours(h) * 60);
  // Nul : maintenant.
  if (!min) return 'maintenant';
  // Signe, heures et minutes.
  const sign = min > 0 ? '+' : '−', a = Math.abs(min), hh = Math.floor(a / 60), mm = a % 60;
  // Texte.
  return hh ? `${sign}${hh} h${mm ? ` ${String(mm).padStart(2, '0')}` : ''}` : `${sign}${mm} min`;
// Fin de formatOffset.
}
