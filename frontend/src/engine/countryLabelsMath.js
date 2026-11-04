// Fenêtre d'affichage des noms de pays selon l'altitude de la caméra (en rayons terrestres).
// Séparé du rendu pour rester testable sans DOM (voir countryLabelsMath.test.mjs).
export const COUNTRY_SHOW_ABOVE = 6;   // altitude sous laquelle les noms commencent à apparaître
export const COUNTRY_FADE_IN = 1.25;
export const COUNTRY_HIDE_BELOW = 1.65; // les noms de villes prennent le relais en dessous
export const COUNTRY_FADE_OUT = 0.75;

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Opacité du calque des pays : fondu à l'apparition, puis effacement quand les villes arrivent. */
export function countryLabelOpacity(altitude) {
  if (!(altitude > 0)) return 0;
  return Math.min(
    clamp((COUNTRY_SHOW_ABOVE - altitude) / COUNTRY_FADE_IN, 0, 1),
    clamp((altitude - COUNTRY_HIDE_BELOW) / COUNTRY_FADE_OUT, 0, 1),
  );
}
