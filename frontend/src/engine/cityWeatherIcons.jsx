/**
 * Pictogrammes météo de la fiche ville (SVG inline, 32×32, trait clair + accents soleil/pluie).
 * Les tracés sont statiques : aucun contenu externe n'est injecté.
 */

const SUN = '<g class="w-sun"><circle cx="16" cy="16" r="5.4"/>'
  + '<path d="M16 3.4v3.8M16 24.8v3.8M3.4 16h3.8M24.8 16h3.8M7.2 7.2l2.6 2.6M22.2 22.2l2.6 2.6M24.8 7.2l-2.6 2.6M9.8 22.2l-2.6 2.6"/></g>';

const MOON = '<g class="w-moon"><path d="M21.8 5.4a10.4 10.4 0 1 0 4.9 13.9A9 9 0 0 1 21.8 5.4Z"/></g>';

const CLOUD = '<g class="w-cloud"><path d="M9 24.4h13.1a4.9 4.9 0 0 0 .5-9.8A7.7 7.7 0 0 0 8.3 16.3 4.7 4.7 0 0 0 9 24.4Z"/></g>';

const CLOUD_SMALL = '<g class="w-cloud"><path d="M7.4 25.4h12.4a4.5 4.5 0 0 0 .4-9 6.9 6.9 0 0 0-13 1.6 4.3 4.3 0 0 0 .2 7.4Z"/></g>';

const PARTLY_DAY = '<g class="w-sun"><circle cx="21.4" cy="10.4" r="4"/>'
  + '<path d="M21.4 2.6v2.2M21.4 15.8v2.2M13.6 10.4h2.2M27 10.4h2.2M16 5l1.6 1.6M25.2 14.2l1.6 1.6M26.8 5l-1.6 1.6M17.6 14.2l-1.6 1.6"/></g>'
  + CLOUD_SMALL;

const PARTLY_NIGHT = `<g class="w-moon"><path transform="translate(9.4 1.2) scale(.62)" d="M21.8 5.4a10.4 10.4 0 1 0 4.9 13.9A9 9 0 0 1 21.8 5.4Z"/></g>`
  + CLOUD_SMALL;

const FOG = CLOUD + '<g class="w-fog"><path d="M7.2 27.4h15M10.4 30h14.4"/></g>';

const DRIZZLE = CLOUD + '<g class="w-rain"><path d="M12.3 27.2l-1 2.3M17 27.2l-1 2.3M21.7 27.2l-1 2.3"/></g>';

const RAIN = CLOUD + '<g class="w-rain"><path d="M12 27l-1.5 3.4M17 27l-1.5 3.4M22 27l-1.5 3.4"/></g>';

const SNOW = CLOUD + '<g class="w-snow"><path d="M12 27.2v2.5M10.8 28.4h2.4M17 27.2v2.5M15.8 28.4h2.4M22 27.2v2.5M20.8 28.4h2.4"/></g>';

const STORM = CLOUD + '<g class="w-bolt"><path d="M18.1 18.8l-4.8 7.1h3.3l-1.8 5 5.6-7.5h-3.3z"/></g>';

const ICONS = {
  clear: SUN,
  moon: MOON,
  partly: PARTLY_DAY,
  'partly-night': PARTLY_NIGHT,
  cloudy: CLOUD,
  fog: FOG,
  drizzle: DRIZZLE,
  rain: RAIN,
  snow: SNOW,
  storm: STORM,
};

/** SVG d'un pictogramme météo ; « partly » devient lune + nuage la nuit. */
export function weatherIconSvg(icon, isDay = true) {
  const key = icon === 'partly' && !isDay ? 'partly-night' : icon;
  const body = ICONS[key] || ICONS.cloudy;
  return `<svg class="cc-w-svg" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${body}</svg>`;
}
