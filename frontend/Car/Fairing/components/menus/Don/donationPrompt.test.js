// Tests du rappel des dons : à l'ouverture, puis toutes les dix minutes, jamais par-dessus une autre fenêtre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DonationPromptClock, DONATION_PROMPT } from './donationPrompt.js';

const { FIRST_MS, EVERY_MS, RESUME_MS } = DONATION_PROMPT;

test('à l’ouverture : premier rappel peu après que la scène est prête', () => {
  const c = new DonationPromptClock(0);
  assert.equal(c.update(0), Math.max(FIRST_MS, RESUME_MS));
  assert.equal(c.due(1000), false);
  assert.equal(c.due(Math.max(FIRST_MS, RESUME_MS)), true);
});

test('ensuite toutes les dix minutes, comptées depuis la fermeture de la fenêtre des dons', () => {
  const c = new DonationPromptClock(0);
  c.update(0);
  c.update(5_000, { donateOpen: true });
  // La fenêtre reste ouverte une minute : ce temps ne compte pas.
  assert.equal(c.update(65_000, { donateOpen: true }), null);
  assert.equal(c.update(65_000), EVERY_MS);
  assert.equal(c.due(65_000 + EVERY_MS - 1), false);
  assert.equal(c.due(65_000 + EVERY_MS), true);
});

test('une autre fenêtre ouverte ou l’onglet caché mettent le compte à rebours en pause', () => {
  const c = new DonationPromptClock(0);
  c.update(0, { donateOpen: true });
  c.update(0);
  // Une minute plus tard, la recherche s'ouvre pour trente secondes.
  assert.equal(c.update(60_000, { paused: true }), null);
  assert.equal(c.due(200_000), false);
  // À la reprise, il reste une minute.
  assert.equal(c.update(90_000), EVERY_MS - 60_000);
  // Reprise juste avant l'échéance : au moins RESUME_MS de répit.
  c.update(90_000 + EVERY_MS - 60_000 - 100, { paused: true });
  assert.equal(c.update(500_000), RESUME_MS);
});
