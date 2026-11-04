import { loadWorldCityStats } from './worldCityStats';
import { loadCityWeather } from './cityWeather';
import { translateCity } from './cityTranslate';
import { weatherIconSvg } from './cityWeatherIcons';

const fmtInt = new Intl.NumberFormat('fr-FR');
const precipFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const timeFormats = new Map();

const node = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

const statusTags = (c, pop) => {
  const tags = [];
  if (c.capital) tags.push('Capitale');
  if (pop >= 8e6) tags.push('Mégapole');
  else if (pop >= 2e6) tags.push('Grande ville');
  return tags;
};

/**
 * Fiche ville affichée au survol d'une étiquette : panneau monochrome, ancre au-dessus ou sous le nom,
 * contenu limité aux données réellement disponibles (Natural Earth + heure et soleil de la simulation).
 */
export class CityCard {
  constructor({ parent, getSimMs, sunAltitude = null }) {
    this.parent = parent;
    this.getSimMs = getSimMs;
    this.sunAltitude = sunAltitude;
    this.el = node('div', 'city-card');
    this.el.setAttribute('role', 'tooltip');
    this.el.style.display = 'none';
    parent.appendChild(this.el);
    this.anchor = null;
    this.city = null;
    this.world = null;
    this.weather = null;
    this.translation = null;
    this.open = false;
    this.showTimer = null;
    this.closeTimer = null;
  }

  show(city, anchor) {
    if (!city || !anchor) return;
    clearTimeout(this.showTimer);
    this.city = city;
    this.anchor = anchor;
    if (this.world?.city !== city) this.world = null;
    if (this.weather?.city !== city) this.weather = null;
    if (this.translation?.city !== city) this.translation = null;
    void this.loadWorld(city);
    void this.loadWeather(city);
    void this.loadTranslation(city);
    this.showTimer = setTimeout(() => {
      if (this.city !== city) return;
      const a = this.anchor;
      if (!a || !a.isConnected || a.style.display === 'none' || a.city !== city) return;
      this.render(city);
      this.el.style.display = 'block';
      this.place();
      void this.el.offsetWidth;
      this.el.classList.add('is-open');
      this.open = true;
    }, 120);
  }

  /** Complète la fiche avec Worldometer dès que le cache local répond, si elle est déjà ouverte. */
  async loadWorld(city) {
    const stats = await loadWorldCityStats(city);
    if (!stats || this.city !== city) return;
    this.world = { city, ...stats };
    if (this.open) {
      this.render(city);
      this.place();
    }
  }

  /** Complète la fiche avec la météo actuelle dès que la réponse arrive, si elle est déjà ouverte. */
  async loadWeather(city) {
    const weather = await loadCityWeather(city);
    if (!weather || this.city !== city) return;
    this.weather = { city, ...weather };
    if (this.open) {
      this.render(city);
      this.place();
    }
  }

  /** Complète la fiche avec la traduction française du nom local et de la région, si elle est ouverte. */
  async loadTranslation(city) {
    const translation = await translateCity(city);
    if (!translation || this.city !== city) return;
    this.translation = { city, ...translation };
    if (this.open) {
      this.render(city);
      this.place();
    }
  }

  hide() {
    clearTimeout(this.showTimer);
    this.showTimer = null;
    this.city = null;
    this.anchor = null;
    if (!this.open) {
      this.el.style.display = 'none';
      this.el.classList.remove('is-open');
      return;
    }
    this.open = false;
    this.el.classList.remove('is-open');
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      if (!this.open) this.el.style.display = 'none';
    }, 150);
  }

  /** Suit l'étiquette pendant la rotation ou le zoom ; la masque si elle disparaît. */
  sync() {
    if (!this.open || !this.anchor) return;
    if (!this.anchor.isConnected || this.anchor.style.display === 'none' || this.anchor.city !== this.city) {
      this.hide();
      return;
    }
    this.place();
  }

  place() {
    const r = this.anchor.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const gap = 12;
    const margin = 8;
    const vw = innerWidth;
    const vh = innerHeight;
    const cw = this.el.offsetWidth;
    const ch = this.el.offsetHeight;
    let left = r.left + r.width / 2 - cw / 2;
    left = Math.max(margin, Math.min(vw - cw - margin, left));
    let top = r.bottom + gap;
    let placement = 'below';
    if (top + ch > vh - margin) {
      const above = r.top - gap - ch;
      if (above >= margin) {
        top = above;
        placement = 'above';
      } else {
        top = Math.max(margin, Math.min(vh - ch - margin, top));
      }
    }
    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
    this.el.dataset.placement = placement;
    this.el.style.setProperty('--arrow-x', `${Math.max(16, Math.min(cw - 16, r.left + r.width / 2 - left))}px`);
  }

  render(c) {
    const frag = document.createDocumentFragment();
    const world = this.world?.city === c ? this.world : null;
    const weather = this.weather?.city === c ? this.weather : null;
    const translation = this.translation?.city === c ? this.translation : null;
    const pop = world?.pop ?? c.pop;
    const area = world?.areaKm2 ?? c.areaKm2;
    const density = world?.density ?? (pop > 0 && area > 0 ? Math.round(pop / area) : 0);
    const title = c.nameFr || c.name;
    const head = node('div', 'cc-head');
    head.appendChild(node('h2', null, title));
    const sub = [];
    if (c.label && c.label !== title) sub.push(c.label);
    const country = c.countryFr || c.country;
    if (country) sub.push(country);
    if (sub.length) head.appendChild(node('p', 'cc-sub', sub.join(' · ')));
    if (translation?.name) {
      const alt = node('p', 'cc-alt');
      alt.title = 'Traduction automatique du nom local (MyMemory)';
      alt.appendChild(node('span', null, 'Traduction'));
      alt.appendChild(node('strong', null, translation.name));
      head.appendChild(alt);
    }
    frag.appendChild(head);

    const tags = statusTags(c, pop);
    if (tags.length) {
      const row = node('div', 'cc-badges');
      for (const tag of tags) row.appendChild(node('span', 'cc-badge', tag));
      frag.appendChild(row);
    }

    if (weather) frag.appendChild(this.weatherBlock(weather));

    if (pop > 0) {
      const line = node('div', 'cc-pop');
      line.appendChild(node('strong', null, fmtInt.format(pop)));
      line.appendChild(node('span', null, 'habitants · agglomération'));
      frag.appendChild(line);
      if (world) {
        frag.appendChild(node('p', 'cc-src',
          world.year ? `Source : worldometers.info · estimation ${world.year}` : 'Source : worldometers.info'));
      }
    }

    if (area > 0 || density > 0) {
      const grid = node('dl', 'cc-grid');
      if (area > 0) grid.appendChild(this.cell('Aire urbaine', `${fmtInt.format(area)} km²`));
      if (density > 0) grid.appendChild(this.cell('Densité', `${fmtInt.format(density)} hab/km²`));
      frag.appendChild(grid);
    }

    const rows = node('dl', 'cc-rows');
    const region = translation?.region || c.region;
    if (region) rows.appendChild(this.row('Région', region, translation?.region ? c.region : null));
    const lat = `${Math.abs(c.lat).toFixed(2)}°${c.lat >= 0 ? ' N' : ' S'}`;
    const lon = `${Math.abs(c.lon).toFixed(2)}°${c.lon >= 0 ? ' E' : ' O'}`;
    rows.appendChild(this.row('Coordonnées', `${lat} · ${lon}`));
    const time = this.localTime(c.timezone);
    if (time) rows.appendChild(this.row('Heure locale', time));
    const sun = this.sunInfo(c);
    if (sun) rows.appendChild(this.row('Soleil', sun.text));
    frag.appendChild(rows);

    if (sun) {
      const energy = node('div', 'cc-energy');
      const label = node('div', 'cc-energy-head');
      label.appendChild(node('span', null, 'Ensoleillement'));
      label.appendChild(node('strong', null, `${sun.power} %`));
      const meter = node('div', 'cc-meter');
      const fill = node('i');
      fill.style.width = `${sun.power}%`;
      meter.appendChild(fill);
      energy.appendChild(label);
      energy.appendChild(meter);
      energy.appendChild(node('small', 'cc-energy-note', 'Calculé d’après la position du Soleil, en direct.'));
      frag.appendChild(energy);
    }

    const foot = node('div', 'cc-foot');
    const sources = ['Natural Earth'];
    if (world) sources.push('Worldometer');
    if (weather) sources.push('Open-Meteo');
    if (translation) sources.push('MyMemory');
    const src = node('span', null, sources.join(' · '));
    const credits = [];
    if (weather) credits.push('Météo actuelle : Open-Meteo (CC BY 4.0)');
    if (translation) credits.push('Traduction automatique : MyMemory (translated.net)');
    if (credits.length) src.title = credits.join(' · ');
    foot.appendChild(src);
    foot.appendChild(node('span', null, 'Cliquer pour y aller →'));
    frag.appendChild(foot);
    this.el.replaceChildren(frag);
  }

  /** Bandeau météo : pictogramme, température, condition puis ressenti, vent et humidité. */
  weatherBlock(w) {
    const box = node('div', 'cc-weather');
    box.setAttribute('aria-label', `Météo actuelle : ${w.label}, ${w.tempC} degrés`);
    const icon = node('div', 'cc-w-icon');
    icon.innerHTML = weatherIconSvg(w.icon, w.isDay);
    box.appendChild(icon);

    const body = node('div', 'cc-w-body');
    const head = node('div', 'cc-w-head');
    head.appendChild(node('strong', 'cc-w-temp', `${w.tempC}°`));
    head.appendChild(node('span', 'cc-w-cond', w.label));
    body.appendChild(head);

    const metrics = node('div', 'cc-w-metrics');
    if (w.feelsC !== null) metrics.appendChild(this.weatherMetric('Ressenti', `${w.feelsC}°`));
    if (w.windKmh !== null) {
      const value = w.wind ? `${w.windKmh} km/h ${w.wind.short}` : `${w.windKmh} km/h`;
      const metric = this.weatherMetric('Vent', value);
      if (w.wind) metric.title = `Vent venant du ${w.wind.from}`;
      metrics.appendChild(metric);
    }
    if (w.humidity !== null) metrics.appendChild(this.weatherMetric('Humidité', `${w.humidity} %`));
    if (w.precipMm > 0) metrics.appendChild(this.weatherMetric('Précip.', `${precipFormat.format(w.precipMm)} mm`));
    body.appendChild(metrics);

    box.appendChild(body);
    return box;
  }

  weatherMetric(label, value) {
    const el = node('span', 'cc-w-metric');
    el.appendChild(node('em', null, label));
    el.appendChild(document.createTextNode(value));
    return el;
  }

  cell(label, value) {
    const cell = document.createElement('div');
    cell.appendChild(node('dt', null, label));
    cell.appendChild(node('dd', null, value));
    return cell;
  }

  row(label, value, hint = null) {
    const row = document.createElement('div');
    row.className = 'cc-row';
    row.appendChild(node('dt', null, label));
    const dd = node('dd', null, value);
    if (hint) dd.title = `Original : ${hint}`;
    row.appendChild(dd);
    return row;
  }

  localTime(timezone) {
    if (!timezone) return '';
    let format = timeFormats.get(timezone);
    if (!format) {
      try {
        format = new Intl.DateTimeFormat('fr-FR', {
          hour: '2-digit', minute: '2-digit', timeZone: timezone, timeZoneName: 'short',
        });
        timeFormats.set(timezone, format);
      } catch {
        timeFormats.set(timezone, null);
        return '';
      }
    }
    if (!format) return '';
    return format.format(new Date(this.getSimMs()));
  }

  sunInfo(c) {
    if (!this.sunAltitude) return null;
    const elevation = this.sunAltitude(c.lon, c.lat);
    if (!Number.isFinite(elevation)) return null;
    const phase = elevation >= 0 ? 'Jour' : elevation >= -6 ? 'Crépuscule' : 'Nuit';
    const power = Math.round(Math.max(0, Math.sin((elevation * Math.PI) / 180)) * 100);
    return { text: `${phase} · ${Math.round(elevation)}°`, power };
  }

  dispose() {
    clearTimeout(this.showTimer);
    clearTimeout(this.closeTimer);
    this.el.remove();
  }
}
