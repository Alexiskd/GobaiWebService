import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCurrentWeather, weatherCodeInfo, weatherKey, weatherView, windDescription,
} from './cityWeatherMath.js';
import { weatherIconSvg } from './cityWeatherIcons.js';

test('météo : codes WMO traduits en libellés et pictogrammes français', () => {
  assert.deepEqual(weatherCodeInfo(0, true), { icon: 'clear', label: 'Ensoleillé' });
  assert.deepEqual(weatherCodeInfo(0, false), { icon: 'moon', label: 'Ciel étoilé' });
  assert.deepEqual(weatherCodeInfo(2), { icon: 'partly', label: 'Partiellement nuageux' });
  assert.equal(weatherCodeInfo(3).label, 'Couvert');
  assert.equal(weatherCodeInfo(45).icon, 'fog');
  assert.equal(weatherCodeInfo(53).icon, 'drizzle');
  assert.equal(weatherCodeInfo(65).icon, 'rain');
  assert.equal(weatherCodeInfo(75).icon, 'snow');
  assert.equal(weatherCodeInfo(96).icon, 'storm');
  assert.deepEqual(weatherCodeInfo(123), { icon: 'cloudy', label: 'Temps variable' });
});

test('météo : direction du vent en huit secteurs, sans discontinuité', () => {
  assert.equal(windDescription(0).short, 'N');
  assert.equal(windDescription(44).short, 'NE');
  assert.equal(windDescription(90).short, 'E');
  assert.equal(windDescription(135).short, 'SE');
  assert.equal(windDescription(193).short, 'S');
  assert.equal(windDescription(225).short, 'SO');
  assert.equal(windDescription(270).short, 'O');
  assert.equal(windDescription(315).short, 'NO');
  assert.equal(windDescription(348).short, 'N');
  assert.equal(windDescription(193).from, 'sud');
  assert.equal(windDescription(null), null);
});

test('météo : réponse Open-Meteo normalisée pour la fiche', () => {
  const view = weatherView(normalizeCurrentWeather({
    current: {
      time: '2026-10-26T18:00',
      temperature_2m: 13.2,
      relative_humidity_2m: 87,
      apparent_temperature: 11.9,
      is_day: 0,
      precipitation: 0.4,
      weather_code: 3,
      cloud_cover: 100,
      wind_speed_10m: 11.4,
      wind_direction_10m: 193,
    },
  }));
  assert.equal(view.tempC, 13);
  assert.equal(view.feelsC, 12);
  assert.equal(view.humidity, 87);
  assert.equal(view.windKmh, 11);
  assert.deepEqual(view.wind, { short: 'S', from: 'sud' });
  assert.equal(view.precipMm, 0.4);
  assert.equal(view.code, 3);
  assert.equal(view.isDay, false);
  assert.equal(view.icon, 'cloudy');
  assert.equal(view.label, 'Couvert');
});

test('météo : réponse incomplète ignorée, clé de cache arrondie au kilomètre', () => {
  assert.equal(normalizeCurrentWeather(null), null);
  assert.equal(normalizeCurrentWeather({ current: {} }), null);
  assert.equal(normalizeCurrentWeather({ current: { temperature_2m: null } }), null);
  assert.equal(weatherView(null), null);
  assert.equal(weatherKey(48.8566, 2.3522), '48.86,2.35');
  assert.equal(weatherKey(Number.NaN, 2), null);
});

test('météo : pictogrammes jour et nuit cohérents', () => {
  assert.match(weatherIconSvg('rain'), /cc-w-svg[\s\S]*w-rain/);
  assert.match(weatherIconSvg('partly', true), /w-sun/);
  assert.match(weatherIconSvg('partly', false), /w-moon/);
  assert.match(weatherIconSvg('inconnu'), /w-cloud/);
});
