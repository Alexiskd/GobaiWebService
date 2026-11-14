// Importe loadWorldCityStats, les statistiques mondiales d'une ville.
import { loadWorldCityStats } from './worldCityStats';
// Importe loadCityWeather, la météo actuelle d'une ville.
import { loadCityWeather } from './cityWeather';
// Importe translateCity, la traduction du nom local et de la région.
import { translateCity } from './cityTranslate';
// Importe weatherIconSvg, le dessin d'un pictogramme météo.
import { weatherIconSvg } from './cityWeatherIcons';

// Format des nombres entiers, en français.
const fmtInt = new Intl.NumberFormat('fr-FR');
// Format des précipitations : une décimale au plus.
const precipFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
// Formats d'heure déjà créés, par fuseau horaire.
const timeFormats = new Map();

// node : crée un élément HTML avec une classe et un texte facultatifs (début).
const node = (tag, className, text) => {
  // Crée l'élément.
  const el = document.createElement(tag);
  // Sa classe, si elle est donnée.
  if (className) el.className = className;
  // Son texte, s'il est donné.
  if (text !== undefined) el.textContent = text;
  // Le renvoie.
  return el;
// Fin de node.
};

// statusTags : les étiquettes de statut d'une ville (début).
const statusTags = (c, pop) => {
  // Liste des étiquettes.
  const tags = [];
  // Capitale.
  if (c.capital) tags.push('Capitale');
  // Mégapole, à partir de 8 millions d'habitants.
  if (pop >= 8e6) tags.push('Mégapole');
  // Grande ville, à partir de 2 millions.
  else if (pop >= 2e6) tags.push('Grande ville');
  // Classement mondial : dans les 1000 premières, ou dans les 5000.
  if (c.rank) tags.push(c.rank <= 1000 ? 'Top 1000 mondial' : 'Top 5000 mondial');
  // Renvoie la liste.
  return tags;
// Fin de statusTags.
};

/**
 * Fiche ville affichée au survol d'une étiquette : panneau monochrome, ancre au-dessus ou sous le nom,
 * contenu limité aux données réellement disponibles (Natural Earth + heure et soleil de la simulation).
 */
// Déclare et exporte la classe CityCard (début).
export class CityCard {
  // Constructeur : l'élément parent, l'instant simulé et la hauteur du Soleil (début).
  constructor({ parent, getSimMs, sunAltitude = null }) {
    // Garde l'élément parent.
    this.parent = parent;
    // Garde la fonction de l'instant simulé.
    this.getSimMs = getSimMs;
    // Garde la fonction de la hauteur du Soleil.
    this.sunAltitude = sunAltitude;
    // Élément de la fiche.
    this.el = node('div', 'city-card');
    // Son rôle : infobulle.
    this.el.setAttribute('role', 'tooltip');
    // Cachée au départ.
    this.el.style.display = 'none';
    // L'ajoute au parent.
    parent.appendChild(this.el);
    // Étiquette d'accroche : aucune.
    this.anchor = null;
    // Ville affichée : aucune.
    this.city = null;
    // Statistiques mondiales : aucune.
    this.world = null;
    // Météo : aucune.
    this.weather = null;
    // Traduction : aucune.
    this.translation = null;
    // Fiche fermée.
    this.open = false;
    // Minuterie d'ouverture.
    this.showTimer = null;
    // Minuterie de fermeture.
    this.closeTimer = null;
  // Fin du constructeur.
  }

  // show : ouvre la fiche d'une ville sur une étiquette (début).
  show(city, anchor) {
    // Sans ville ou sans étiquette : rien à faire.
    if (!city || !anchor) return;
    // Annule l'ouverture en attente.
    clearTimeout(this.showTimer);
    // Garde la ville.
    this.city = city;
    // Garde l'étiquette.
    this.anchor = anchor;
    // Oublie les statistiques d'une autre ville.
    if (this.world?.city !== city) this.world = null;
    // Oublie la météo d'une autre ville.
    if (this.weather?.city !== city) this.weather = null;
    // Oublie la traduction d'une autre ville.
    if (this.translation?.city !== city) this.translation = null;
    // Lance le chargement des statistiques, sans l'attendre.
    void this.loadWorld(city);
    // Lance le chargement de la météo.
    void this.loadWeather(city);
    // Lance le chargement de la traduction.
    void this.loadTranslation(city);
    // Programme l'ouverture (début).
    this.showTimer = setTimeout(() => {
      // La ville a changé entre-temps : abandon.
      if (this.city !== city) return;
      // L'étiquette d'accroche.
      const a = this.anchor;
      // Étiquette retirée, cachée ou réutilisée pour une autre ville : abandon.
      if (!a || !a.isConnected || a.style.display === 'none' || a.city !== city) return;
      // Construit le contenu.
      this.render(city);
      // Affiche la fiche.
      this.el.style.display = 'block';
      // La place.
      this.place();
      // Force le navigateur à calculer la mise en page.
      void this.el.offsetWidth;
      // Ajoute la classe qui lance l'animation d'ouverture.
      this.el.classList.add('is-open');
      // Fiche ouverte.
      this.open = true;
    // Fin : après 120 ms.
    }, 120);
  // Fin de show.
  }

  /** Complète la fiche avec Worldometer dès que le cache local répond, si elle est déjà ouverte. */
  // loadWorld, asynchrone : charge les statistiques mondiales (début).
  async loadWorld(city) {
    // Attend les statistiques.
    const stats = await loadWorldCityStats(city);
    // Aucune, ou ville changée : abandon.
    if (!stats || this.city !== city) return;
    // Les garde, avec leur ville.
    this.world = { city, ...stats };
    // Si la fiche est ouverte (début).
    if (this.open) {
      // Reconstruit le contenu.
      this.render(city);
      // La replace.
      this.place();
    // Fin de ce cas.
    }
  // Fin de loadWorld.
  }

  /** Complète la fiche avec la météo actuelle dès que la réponse arrive, si elle est déjà ouverte. */
  // loadWeather, asynchrone : charge la météo (début).
  async loadWeather(city) {
    // Attend la météo.
    const weather = await loadCityWeather(city);
    // Aucune, ou ville changée : abandon.
    if (!weather || this.city !== city) return;
    // La garde, avec sa ville.
    this.weather = { city, ...weather };
    // Si la fiche est ouverte (début).
    if (this.open) {
      // Reconstruit le contenu.
      this.render(city);
      // La replace.
      this.place();
    // Fin de ce cas.
    }
  // Fin de loadWeather.
  }

  /** Complète la fiche avec la traduction française du nom local et de la région, si elle est ouverte. */
  // loadTranslation, asynchrone : charge la traduction (début).
  async loadTranslation(city) {
    // Attend la traduction.
    const translation = await translateCity(city);
    // Aucune, ou ville changée : abandon.
    if (!translation || this.city !== city) return;
    // La garde, avec sa ville.
    this.translation = { city, ...translation };
    // Si la fiche est ouverte (début).
    if (this.open) {
      // Reconstruit le contenu.
      this.render(city);
      // La replace.
      this.place();
    // Fin de ce cas.
    }
  // Fin de loadTranslation.
  }

  // hide : ferme la fiche (début).
  hide() {
    // Annule l'ouverture en attente.
    clearTimeout(this.showTimer);
    // Plus de minuterie d'ouverture.
    this.showTimer = null;
    // Plus de ville.
    this.city = null;
    // Plus d'étiquette.
    this.anchor = null;
    // Si elle n'était pas ouverte (début).
    if (!this.open) {
      // La cache.
      this.el.style.display = 'none';
      // Retire la classe d'ouverture.
      this.el.classList.remove('is-open');
      // Terminé.
      return;
    // Fin de ce cas.
    }
    // Fiche fermée.
    this.open = false;
    // Retire la classe d'ouverture : l'animation de fermeture commence.
    this.el.classList.remove('is-open');
    // Annule la fermeture en attente.
    clearTimeout(this.closeTimer);
    // Programme le masquage (début).
    this.closeTimer = setTimeout(() => {
      // Si la fiche n'a pas été rouverte : la cache.
      if (!this.open) this.el.style.display = 'none';
    // Fin : après 150 ms.
    }, 150);
  // Fin de hide.
  }

  /** Suit l'étiquette pendant la rotation ou le zoom ; la masque si elle disparaît. */
  // sync : suit l'étiquette (début).
  sync() {
    // Fiche fermée ou sans étiquette : rien à faire.
    if (!this.open || !this.anchor) return;
    // Étiquette retirée, cachée ou passée à une autre ville (début).
    if (!this.anchor.isConnected || this.anchor.style.display === 'none' || this.anchor.city !== this.city) {
      // Ferme la fiche.
      this.hide();
      // Terminé.
      return;
    // Fin de ce cas.
    }
    // Replace la fiche.
    this.place();
  // Fin de sync.
  }

  // place : positionne la fiche par rapport à l'étiquette (début).
  place() {
    // Rectangle de l'étiquette à l'écran.
    const r = this.anchor.getBoundingClientRect();
    // Rectangle vide : rien à faire.
    if (!r.width && !r.height) return;
    // Écart entre l'étiquette et la fiche : 12 pixels.
    const gap = 12;
    // Marge par rapport aux bords de la fenêtre : 8 pixels.
    const margin = 8;
    // Largeur de la fenêtre.
    const vw = innerWidth;
    // Hauteur de la fenêtre.
    const vh = innerHeight;
    // Largeur de la fiche.
    const cw = this.el.offsetWidth;
    // Hauteur de la fiche.
    const ch = this.el.offsetHeight;
    // Position horizontale : centrée sur l'étiquette.
    let left = r.left + r.width / 2 - cw / 2;
    // Gardée dans la fenêtre.
    left = Math.max(margin, Math.min(vw - cw - margin, left));
    // Position verticale : sous l'étiquette.
    let top = r.bottom + gap;
    // Placement : dessous.
    let placement = 'below';
    // Si elle dépasse en bas (début).
    if (top + ch > vh - margin) {
      // Position au-dessus de l'étiquette.
      const above = r.top - gap - ch;
      // Si elle tient au-dessus (début).
      if (above >= margin) {
        // Elle passe au-dessus.
        top = above;
        // Placement : dessus.
        placement = 'above';
      // Sinon (début).
      } else {
        // Elle reste dessous, ramenée dans la fenêtre.
        top = Math.max(margin, Math.min(vh - ch - margin, top));
      // Fin du choix.
      }
    // Fin de ce cas.
    }
    // Écrit la position horizontale.
    this.el.style.left = `${Math.round(left)}px`;
    // Écrit la position verticale.
    this.el.style.top = `${Math.round(top)}px`;
    // Note le placement, pour le style.
    this.el.dataset.placement = placement;
    // Position de la flèche : sous le centre de l'étiquette, à 16 pixels au moins des bords de la fiche.
    this.el.style.setProperty('--arrow-x', `${Math.max(16, Math.min(cw - 16, r.left + r.width / 2 - left))}px`);
  // Fin de place.
  }

  // render : construit le contenu de la fiche (début).
  render(c) {
    // Fragment où le contenu est assemblé.
    const frag = document.createDocumentFragment();
    // Statistiques mondiales, si elles sont celles de cette ville.
    const world = this.world?.city === c ? this.world : null;
    // Météo, si elle est celle de cette ville.
    const weather = this.weather?.city === c ? this.weather : null;
    // Traduction, si elle est celle de cette ville.
    const translation = this.translation?.city === c ? this.translation : null;
    // Population : celle des statistiques, sinon celle de la ville.
    const pop = world?.pop ?? c.pop;
    // Superficie : de la même façon.
    const area = world?.areaKm2 ?? c.areaKm2;
    // Densité : celle des statistiques, sinon population divisée par superficie, sinon 0.
    const density = world?.density ?? (pop > 0 && area > 0 ? Math.round(pop / area) : 0);
    // Titre : le nom français, sinon le nom.
    const title = c.nameFr || c.name;
    // En-tête.
    const head = node('div', 'cc-head');
    // Son titre.
    head.appendChild(node('h2', null, title));
    // Sous-titre, en morceaux.
    const sub = [];
    // Le libellé local, s'il diffère du titre.
    if (c.label && c.label !== title) sub.push(c.label);
    // Le pays, en français si possible.
    const country = c.countryFr || c.country;
    // L'ajoute au sous-titre.
    if (country) sub.push(country);
    // Sous-titre, les morceaux séparés par un point médian.
    if (sub.length) head.appendChild(node('p', 'cc-sub', sub.join(' · ')));
    // Avec un nom traduit (début).
    if (translation?.name) {
      // Ligne de traduction.
      const alt = node('p', 'cc-alt');
      // Son infobulle.
      alt.title = 'Traduction automatique du nom local (MyMemory)';
      // Le mot « Traduction ».
      alt.appendChild(node('span', null, 'Traduction'));
      // Le nom traduit.
      alt.appendChild(node('strong', null, translation.name));
      // L'ajoute à l'en-tête.
      head.appendChild(alt);
    // Fin de ce cas.
    }
    // Ajoute l'en-tête.
    frag.appendChild(head);

    // Étiquettes de statut.
    const tags = statusTags(c, pop);
    // S'il y en a (début).
    if (tags.length) {
      // Rangée des étiquettes.
      const row = node('div', 'cc-badges');
      // Une pastille par étiquette.
      for (const tag of tags) row.appendChild(node('span', 'cc-badge', tag));
      // Ajoute la rangée.
      frag.appendChild(row);
    // Fin de ce cas.
    }

    // Avec une météo : ajoute le bandeau météo.
    if (weather) frag.appendChild(this.weatherBlock(weather));

    // Avec une population (début).
    if (pop > 0) {
      // Ligne de la population.
      const line = node('div', 'cc-pop');
      // Le nombre.
      line.appendChild(node('strong', null, fmtInt.format(pop)));
      // Sa légende.
      line.appendChild(node('span', null, 'habitants · agglomération'));
      // Ajoute la ligne.
      frag.appendChild(line);
      // Avec des statistiques mondiales (début).
      if (world) {
        // Ajoute la source :
        frag.appendChild(node('p', 'cc-src',
          // avec l'année de l'estimation si elle est connue.
          world.year ? `Source : worldometers.info · estimation ${world.year}` : 'Source : worldometers.info'));
      // Fin de ce cas.
      }
    // Fin du cas de la population.
    }

    // Avec une superficie, une densité ou un rang (début).
    if (area > 0 || density > 0 || c.rank) {
      // Grille de chiffres.
      const grid = node('dl', 'cc-grid');
      // Le rang mondial.
      if (c.rank) grid.appendChild(this.cell('Rang mondial', `n° ${fmtInt.format(c.rank)} / 5 000`));
      // L'aire urbaine.
      if (area > 0) grid.appendChild(this.cell('Aire urbaine', `${fmtInt.format(area)} km²`));
      // La densité.
      if (density > 0) grid.appendChild(this.cell('Densité', `${fmtInt.format(density)} hab/km²`));
      // Ajoute la grille.
      frag.appendChild(grid);
    // Fin de ce cas.
    }

    // Liste des lignes d'information.
    const rows = node('dl', 'cc-rows');
    // Région : la traduction, sinon l'original.
    const region = translation?.region || c.region;
    // Ligne « Région », avec l'original en infobulle quand elle est traduite.
    if (region) rows.appendChild(this.row('Région', region, translation?.region ? c.region : null));
    // Latitude, à deux décimales, avec N ou S.
    const lat = `${Math.abs(c.lat).toFixed(2)}°${c.lat >= 0 ? ' N' : ' S'}`;
    // Longitude, à deux décimales, avec E ou O.
    const lon = `${Math.abs(c.lon).toFixed(2)}°${c.lon >= 0 ? ' E' : ' O'}`;
    // Ligne « Coordonnées ».
    rows.appendChild(this.row('Coordonnées', `${lat} · ${lon}`));
    // Heure locale.
    const time = this.localTime(c.timezone);
    // Ligne « Heure locale », si elle est connue.
    if (time) rows.appendChild(this.row('Heure locale', time));
    // Informations sur le Soleil.
    const sun = this.sunInfo(c);
    // Ligne « Soleil », si elles sont connues.
    if (sun) rows.appendChild(this.row('Soleil', sun.text));
    // Ajoute la liste.
    frag.appendChild(rows);

    // Avec les informations sur le Soleil (début).
    if (sun) {
      // Bloc de l'ensoleillement.
      const energy = node('div', 'cc-energy');
      // Son en-tête.
      const label = node('div', 'cc-energy-head');
      // Le mot « Ensoleillement ».
      label.appendChild(node('span', null, 'Ensoleillement'));
      // Le pourcentage.
      label.appendChild(node('strong', null, `${sun.power} %`));
      // Jauge.
      const meter = node('div', 'cc-meter');
      // Son remplissage.
      const fill = node('i');
      // Largeur du remplissage : le pourcentage.
      fill.style.width = `${sun.power}%`;
      // L'ajoute à la jauge.
      meter.appendChild(fill);
      // Ajoute l'en-tête au bloc.
      energy.appendChild(label);
      // Ajoute la jauge au bloc.
      energy.appendChild(meter);
      // Ajoute la note d'explication.
      energy.appendChild(node('small', 'cc-energy-note', 'Calculé d’après la position du Soleil, en direct.'));
      // Ajoute le bloc.
      frag.appendChild(energy);
    // Fin de ce cas.
    }

    // Pied de la fiche.
    const foot = node('div', 'cc-foot');
    // Sources : Natural Earth d'abord.
    const sources = ['Natural Earth'];
    // Worldometer, avec des statistiques.
    if (world) sources.push('Worldometer');
    // Open-Meteo, avec une météo.
    if (weather) sources.push('Open-Meteo');
    // MyMemory, avec une traduction.
    if (translation) sources.push('MyMemory');
    // Texte des sources.
    const src = node('span', null, sources.join(' · '));
    // Mentions de crédit.
    const credits = [];
    // Celle de la météo.
    if (weather) credits.push('Météo actuelle : Open-Meteo (CC BY 4.0)');
    // Celle de la traduction.
    if (translation) credits.push('Traduction automatique : MyMemory (translated.net)');
    // En infobulle sur les sources.
    if (credits.length) src.title = credits.join(' · ');
    // Ajoute les sources au pied.
    foot.appendChild(src);
    // Ajoute l'invitation à cliquer.
    foot.appendChild(node('span', null, 'Cliquer pour y aller →'));
    // Ajoute le pied.
    frag.appendChild(foot);
    // Remplace le contenu de la fiche par le fragment.
    this.el.replaceChildren(frag);
  // Fin de render.
  }

  /** Bandeau météo : pictogramme, température, condition puis ressenti, vent et humidité. */
  // weatherBlock : construit le bandeau météo (début).
  weatherBlock(w) {
    // Le bandeau.
    const box = node('div', 'cc-weather');
    // Son libellé pour les lecteurs d'écran.
    box.setAttribute('aria-label', `Météo actuelle : ${w.label}, ${w.tempC} degrés`);
    // Zone du pictogramme.
    const icon = node('div', 'cc-w-icon');
    // Le pictogramme, de jour ou de nuit.
    icon.innerHTML = weatherIconSvg(w.icon, w.isDay);
    // L'ajoute au bandeau.
    box.appendChild(icon);

    // Corps du bandeau.
    const body = node('div', 'cc-w-body');
    // Sa première ligne.
    const head = node('div', 'cc-w-head');
    // La température.
    head.appendChild(node('strong', 'cc-w-temp', `${w.tempC}°`));
    // La condition.
    head.appendChild(node('span', 'cc-w-cond', w.label));
    // Ajoute la ligne au corps.
    body.appendChild(head);

    // Ligne des mesures.
    const metrics = node('div', 'cc-w-metrics');
    // Le ressenti, s'il est connu.
    if (w.feelsC !== null) metrics.appendChild(this.weatherMetric('Ressenti', `${w.feelsC}°`));
    // Avec une vitesse de vent (début).
    if (w.windKmh !== null) {
      // Valeur : la vitesse, suivie de la direction si elle est connue.
      const value = w.wind ? `${w.windKmh} km/h ${w.wind.short}` : `${w.windKmh} km/h`;
      // La mesure « Vent ».
      const metric = this.weatherMetric('Vent', value);
      // Son infobulle : la provenance du vent.
      if (w.wind) metric.title = `Vent venant du ${w.wind.from}`;
      // L'ajoute.
      metrics.appendChild(metric);
    // Fin de ce cas.
    }
    // L'humidité, si elle est connue.
    if (w.humidity !== null) metrics.appendChild(this.weatherMetric('Humidité', `${w.humidity} %`));
    // Les précipitations, s'il y en a.
    if (w.precipMm > 0) metrics.appendChild(this.weatherMetric('Précip.', `${precipFormat.format(w.precipMm)} mm`));
    // Ajoute les mesures au corps.
    body.appendChild(metrics);

    // Ajoute le corps au bandeau.
    box.appendChild(body);
    // Renvoie le bandeau.
    return box;
  // Fin de weatherBlock.
  }

  // weatherMetric : une mesure, avec son libellé (début).
  weatherMetric(label, value) {
    // L'élément.
    const el = node('span', 'cc-w-metric');
    // Le libellé.
    el.appendChild(node('em', null, label));
    // La valeur.
    el.appendChild(document.createTextNode(value));
    // Le renvoie.
    return el;
  // Fin de weatherMetric.
  }

  // cell : une case de la grille de chiffres (début).
  cell(label, value) {
    // L'élément.
    const cell = document.createElement('div');
    // Le libellé.
    cell.appendChild(node('dt', null, label));
    // La valeur.
    cell.appendChild(node('dd', null, value));
    // Le renvoie.
    return cell;
  // Fin de cell.
  }

  // row : une ligne d'information, avec une infobulle facultative (début).
  row(label, value, hint = null) {
    // L'élément.
    const row = document.createElement('div');
    // Sa classe.
    row.className = 'cc-row';
    // Le libellé.
    row.appendChild(node('dt', null, label));
    // La valeur.
    const dd = node('dd', null, value);
    // Avec une infobulle : l'original.
    if (hint) dd.title = `Original : ${hint}`;
    // Ajoute la valeur.
    row.appendChild(dd);
    // Renvoie la ligne.
    return row;
  // Fin de row.
  }

  // localTime : l'heure locale d'un fuseau, à l'instant simulé (début).
  localTime(timezone) {
    // Sans fuseau : vide.
    if (!timezone) return '';
    // Format déjà créé pour ce fuseau.
    let format = timeFormats.get(timezone);
    // Sinon (début).
    if (!format) {
      // Essai (début).
      try {
        // Crée le format (début) :
        format = new Intl.DateTimeFormat('fr-FR', {
          // heures et minutes sur deux chiffres, dans ce fuseau, avec son nom court.
          hour: '2-digit', minute: '2-digit', timeZone: timezone, timeZoneName: 'short',
        // Fin du format.
        });
        // Le garde.
        timeFormats.set(timezone, format);
      // Fuseau refusé (début).
      } catch {
        // Garde null pour ce fuseau.
        timeFormats.set(timezone, null);
        // Vide.
        return '';
      // Fin de l'essai.
      }
    // Fin de ce cas.
    }
    // Format nul : vide.
    if (!format) return '';
    // Renvoie l'heure à l'instant simulé.
    return format.format(new Date(this.getSimMs()));
  // Fin de localTime.
  }

  // sunInfo : la position du Soleil vue de la ville (début).
  sunInfo(c) {
    // Sans fonction de hauteur du Soleil : null.
    if (!this.sunAltitude) return null;
    // Hauteur du Soleil, en degrés.
    const elevation = this.sunAltitude(c.lon, c.lat);
    // Valeur invalide : null.
    if (!Number.isFinite(elevation)) return null;
    // Phase : jour au-dessus de l'horizon, crépuscule jusqu'à −6°, nuit en dessous.
    const phase = elevation >= 0 ? 'Jour' : elevation >= -6 ? 'Crépuscule' : 'Nuit';
    // Ensoleillement : le sinus de la hauteur, en pourcentage, jamais négatif.
    const power = Math.round(Math.max(0, Math.sin((elevation * Math.PI) / 180)) * 100);
    // Renvoie le texte et l'ensoleillement.
    return { text: `${phase} · ${Math.round(elevation)}°`, power };
  // Fin de sunInfo.
  }

  // dispose : libère la fiche (début).
  dispose() {
    // Annule l'ouverture en attente.
    clearTimeout(this.showTimer);
    // Annule la fermeture en attente.
    clearTimeout(this.closeTimer);
    // Retire l'élément de la page.
    this.el.remove();
  // Fin de dispose.
  }
// Fin de la classe CityCard.
}
