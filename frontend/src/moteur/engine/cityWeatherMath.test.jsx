// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis cityWeatherMath (début de la liste).
import {
  // Les cinq fonctions testées : normalisation, code météo, clé de cache, vue de la fiche et description du vent.
  normalizeCurrentWeather, weatherCodeInfo, weatherKey, weatherView, windDescription,
// Fin de la liste : le module cityWeatherMath.
} from './cityWeatherMath';
// Importe weatherIconSvg, le dessin d'un pictogramme, depuis cityWeatherIcons.
import { weatherIconSvg } from './cityWeatherIcons';

// Test : la traduction des codes météo WMO.
test('météo : codes WMO traduits en libellés et pictogrammes français', () => {
  // Code 0 de jour : pictogramme « clear », « Ensoleillé ».
  assert.deepEqual(weatherCodeInfo(0, true), { icon: 'clear', label: 'Ensoleillé' });
  // Code 0 de nuit : pictogramme « moon », « Ciel étoilé ».
  assert.deepEqual(weatherCodeInfo(0, false), { icon: 'moon', label: 'Ciel étoilé' });
  // Code 2 : pictogramme « partly », « Partiellement nuageux ».
  assert.deepEqual(weatherCodeInfo(2), { icon: 'partly', label: 'Partiellement nuageux' });
  // Code 3 : « Couvert ».
  assert.equal(weatherCodeInfo(3).label, 'Couvert');
  // Code 45 : pictogramme « fog ».
  assert.equal(weatherCodeInfo(45).icon, 'fog');
  // Code 53 : pictogramme « drizzle ».
  assert.equal(weatherCodeInfo(53).icon, 'drizzle');
  // Code 65 : pictogramme « rain ».
  assert.equal(weatherCodeInfo(65).icon, 'rain');
  // Code 75 : pictogramme « snow ».
  assert.equal(weatherCodeInfo(75).icon, 'snow');
  // Code 96 : pictogramme « storm ».
  assert.equal(weatherCodeInfo(96).icon, 'storm');
  // Code inconnu (123) : pictogramme « cloudy », « Temps variable ».
  assert.deepEqual(weatherCodeInfo(123), { icon: 'cloudy', label: 'Temps variable' });
// Fin du test.
});

// Test : la direction du vent.
test('météo : direction du vent en huit secteurs, sans discontinuité', () => {
  // 0° : N.
  assert.equal(windDescription(0).short, 'N');
  // 44° : NE.
  assert.equal(windDescription(44).short, 'NE');
  // 90° : E.
  assert.equal(windDescription(90).short, 'E');
  // 135° : SE.
  assert.equal(windDescription(135).short, 'SE');
  // 193° : S.
  assert.equal(windDescription(193).short, 'S');
  // 225° : SO.
  assert.equal(windDescription(225).short, 'SO');
  // 270° : O.
  assert.equal(windDescription(270).short, 'O');
  // 315° : NO.
  assert.equal(windDescription(315).short, 'NO');
  // 348° : N de nouveau.
  assert.equal(windDescription(348).short, 'N');
  // 193° : le vent vient du « sud ».
  assert.equal(windDescription(193).from, 'sud');
  // Direction absente : null.
  assert.equal(windDescription(null), null);
// Fin du test.
});

// Test : la normalisation d'une réponse d'Open-Meteo.
test('météo : réponse Open-Meteo normalisée pour la fiche', () => {
  // Vue de la fiche à partir d'une réponse d'essai normalisée (début).
  const view = weatherView(normalizeCurrentWeather({
    // Bloc des valeurs actuelles (début).
    current: {
      // Heure de la mesure.
      time: '2026-10-26T18:00',
      // Température à 2 m : 13,2 °C.
      temperature_2m: 13.2,
      // Humidité relative : 87 %.
      relative_humidity_2m: 87,
      // Température ressentie : 11,9 °C.
      apparent_temperature: 11.9,
      // Jour ou nuit : 0, la nuit.
      is_day: 0,
      // Précipitations : 0,4 mm.
      precipitation: 0.4,
      // Code météo : 3.
      weather_code: 3,
      // Couverture nuageuse : 100 %.
      cloud_cover: 100,
      // Vitesse du vent à 10 m : 11,4 km/h.
      wind_speed_10m: 11.4,
      // Direction du vent à 10 m : 193°.
      wind_direction_10m: 193,
    // Fin du bloc.
    },
  // Fin de la réponse d'essai.
  }));
  // Température arrondie : 13.
  assert.equal(view.tempC, 13);
  // Température ressentie arrondie : 12.
  assert.equal(view.feelsC, 12);
  // Humidité : 87.
  assert.equal(view.humidity, 87);
  // Vent arrondi : 11 km/h.
  assert.equal(view.windKmh, 11);
  // Direction du vent : S, « sud ».
  assert.deepEqual(view.wind, { short: 'S', from: 'sud' });
  // Précipitations : 0,4 mm.
  assert.equal(view.precipMm, 0.4);
  // Code : 3.
  assert.equal(view.code, 3);
  // Jour : faux.
  assert.equal(view.isDay, false);
  // Pictogramme : « cloudy ».
  assert.equal(view.icon, 'cloudy');
  // Libellé : « Couvert ».
  assert.equal(view.label, 'Couvert');
// Fin du test.
});

// Test : les réponses incomplètes et la clé de cache.
test('météo : réponse incomplète ignorée, clé de cache arrondie au kilomètre', () => {
  // Réponse absente : null.
  assert.equal(normalizeCurrentWeather(null), null);
  // Bloc actuel vide : null.
  assert.equal(normalizeCurrentWeather({ current: {} }), null);
  // Température nulle (null) : null.
  assert.equal(normalizeCurrentWeather({ current: { temperature_2m: null } }), null);
  // Vue d'une donnée absente : null.
  assert.equal(weatherView(null), null);
  // Clé de Paris : latitude et longitude arrondies à deux décimales.
  assert.equal(weatherKey(48.8566, 2.3522), '48.86,2.35');
  // Latitude non numérique : null.
  assert.equal(weatherKey(Number.NaN, 2), null);
// Fin du test.
});

// Test : les pictogrammes.
test('météo : pictogrammes jour et nuit cohérents', () => {
  // « rain » : un dessin de classe cc-w-svg qui contient w-rain.
  assert.match(weatherIconSvg('rain'), /cc-w-svg[\s\S]*w-rain/);
  // « partly » de jour : contient w-sun.
  assert.match(weatherIconSvg('partly', true), /w-sun/);
  // « partly » de nuit : contient w-moon.
  assert.match(weatherIconSvg('partly', false), /w-moon/);
  // Nom inconnu : contient w-cloud.
  assert.match(weatherIconSvg('inconnu'), /w-cloud/);
// Fin du test.
});
