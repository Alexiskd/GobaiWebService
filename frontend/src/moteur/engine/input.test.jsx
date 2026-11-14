// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe bindInput, le branchement des gestes sur le moteur, depuis input.
import { bindInput } from './input';

/** Scène simulée : canevas, fenêtre et document réduits aux écouteurs ; le moteur note ce qu'on lui demande. */
// setup : construit une scène simulée (début).
function setup() {
  // target : fabrique une cible d'événements avec un objet style vide (début).
  const target = () => {
    // La cible d'événements.
    const t = new EventTarget();
    // Son objet style.
    t.style = {};
    // La renvoie.
    return t;
  // Fin de target.
  };
  // Faux canevas.
  const canvas = target();
  // Sa capture de pointeur : ne fait rien.
  canvas.setPointerCapture = () => {};
  // Fausse fenêtre, posée dans l'environnement global.
  globalThis.window = target();
  // Faux document visible, posé dans l'environnement global.
  globalThis.document = Object.assign(target(), { visibilityState: 'visible' });
  // Journal des appels reçus par le moteur.
  const calls = [];
  // Faux moteur (début).
  const engine = {
    // Le canevas, l'état du glisser et l'état des touches de rotation.
    canvas, drag: false, keyRotate: {},
    // markActive : ne fait rien.
    markActive() {},
    // zoom : note le facteur.
    zoom: (f) => calls.push(['zoom', f]),
    // dragBy : note le déplacement.
    dragBy: (dx, dy) => calls.push(['drag', dx, dy]),
    // releaseLocks : note l'appel.
    releaseLocks: () => calls.push(['release']),
    // selectAt : note la position.
    selectAt: (x, y) => calls.push(['select', x, y]),
    // resize et resetView : ne font rien.
    resize() {}, resetView() {},
  // Fin du faux moteur.
  };
  // Branche les gestes et garde la fonction de débranchement.
  const unbind = bindInput(engine);
  // send : envoie un événement de pointeur au canevas (début).
  const send = (type, pointerId, x, y, extra = {}) => {
    // Crée l'événement.
    const e = new Event(type);
    // Lui donne son identifiant, sa position, le type tactile et les champs supplémentaires.
    Object.assign(e, { pointerId, clientX: x, clientY: y, pointerType: 'touch', isPrimary: false, ...extra });
    // L'envoie au canevas.
    canvas.dispatchEvent(e);
  // Fin de send.
  };
  // Événement dont la cible est une étiquette de la scène, reçu au niveau du document.
  // Fausse étiquette : son closest la renvoie pour le sélecteur « .l ».
  const label = { closest: (selector) => (selector === '.l' ? label : null) };
  // sendLabel : envoie au document un événement dont la cible est l'étiquette (début).
  const sendLabel = (type, pointerId, x, y, extra = {}) => {
    // Crée l'événement, annulable.
    const e = new Event(type, { cancelable: true });
    // Lui donne son identifiant, sa position, le type tactile et les champs supplémentaires.
    Object.assign(e, { pointerId, clientX: x, clientY: y, pointerType: 'touch', isPrimary: false, ...extra });
    // Fixe sa cible : l'étiquette.
    Object.defineProperty(e, 'target', { value: label });
    // L'envoie au document.
    globalThis.document.dispatchEvent(e);
    // Renvoie l'événement.
    return e;
  // Fin de sendLabel.
  };
  // Renvoie la scène simulée ; only filtre le journal par nom d'appel.
  return { engine, calls, send, sendLabel, unbind, only: (name) => calls.filter((c) => c[0] === name) };
// Fin de setup.
}

// Test : les gestes à un doigt.
test('un doigt : le glisser suit le doigt, un appui sans mouvement sélectionne', () => {
  // Scène simulée.
  const s = setup();
  // Le doigt 1 se pose en (100, 100).
  s.send('pointerdown', 1, 100, 100, { isPrimary: true });
  // Le glisser est en cours.
  assert.equal(s.engine.drag, true);
  // Il bouge jusqu'à (130, 90).
  s.send('pointermove', 1, 130, 90);
  // Le moteur a reçu un déplacement de 30 et −10.
  assert.deepEqual(s.only('drag'), [['drag', 30, -10]]);
  // Il se lève.
  s.send('pointerup', 1, 130, 90);
  // Le glisser est terminé.
  assert.equal(s.engine.drag, false);
  // Aucune sélection.
  assert.equal(s.only('select').length, 0, 'un glisser ne sélectionne pas');
  // Le doigt 2 se pose en (50, 50).
  s.send('pointerdown', 2, 50, 50, { isPrimary: true });
  // Il se lève un pixel plus loin.
  s.send('pointerup', 2, 51, 50);
  // Le moteur a reçu une sélection en (51, 50).
  assert.deepEqual(s.only('select'), [['select', 51, 50]]);
  // Débranche les gestes.
  s.unbind();
// Fin du test.
});

// Test : les gestes à deux doigts.
test('deux doigts : l’écartement zoome, le milieu déplace, le doigt restant reprend sans saut', () => {
  // Scène simulée.
  const s = setup();
  // Le doigt 1 se pose en (100, 200).
  s.send('pointerdown', 1, 100, 200, { isPrimary: true });
  // Le doigt 2 se pose en (200, 200).
  s.send('pointerdown', 2, 200, 200);
  // Premier mouvement du doigt 2, sans déplacement.
  s.send('pointermove', 2, 200, 200);            // référence de l'écartement (100 px)
  // Le doigt 2 s'écarte de 10 pixels.
  s.send('pointermove', 2, 210, 200);            // 110 px : zoom avant, milieu décalé de 5 px
  // Le moteur a reçu un zoom de 100 / 110.
  assert.deepEqual(s.only('zoom'), [['zoom', 100 / 110]]);
  // Et un déplacement de 5 pixels.
  assert.deepEqual(s.only('drag'), [['drag', 5, 0]]);
  // Le doigt 2 se lève.
  s.send('pointerup', 2, 210, 200);
  // Le glisser continue.
  assert.equal(s.engine.drag, true, 'un doigt reste posé');
  // Le doigt 1 bouge de 4 pixels.
  s.send('pointermove', 1, 104, 200);
  // Le dernier déplacement reçu est de 4 pixels.
  assert.deepEqual(s.only('drag').at(-1), ['drag', 4, 0], 'repart de sa propre position');
  // Le doigt 1 se lève.
  s.send('pointerup', 1, 104, 200);
  // Aucune sélection.
  assert.equal(s.only('select').length, 0);
  // Le glisser est terminé.
  assert.equal(s.engine.drag, false);
  // Débranche les gestes.
  s.unbind();
// Fin du test.
});

// Test : un doigt dont le lever n'arrive jamais.
test('doigt fantôme : un « pointerup » perdu ne transforme pas le doigt suivant en pincement', () => {
  // Scène simulée.
  const s = setup();
  // Le doigt 1 se pose.
  s.send('pointerdown', 1, 100, 100, { isPrimary: true });
  // Le doigt 2 se pose.
  s.send('pointerdown', 2, 300, 100);
  // Le doigt 1 se lève.
  s.send('pointerup', 1, 100, 100);
  // Le « pointerup » du doigt 2 n'arrive jamais. Nouveau geste à un doigt :
  // Le doigt 3 se pose, en doigt principal.
  s.send('pointerdown', 3, 150, 150, { isPrimary: true });
  // Il bouge de 20 pixels.
  s.send('pointermove', 3, 170, 150);
  // Aucun zoom.
  assert.equal(s.only('zoom').length, 0, 'aucun zoom tout seul');
  // Le dernier déplacement reçu est de 20 pixels.
  assert.deepEqual(s.only('drag').at(-1), ['drag', 20, 0]);
  // Le doigt 3 se lève.
  s.send('pointerup', 3, 170, 150);
  // Le glisser est terminé.
  assert.equal(s.engine.drag, false);
  // Débranche les gestes.
  s.unbind();
// Fin du test.
});

// Test : la capture perdue et la perte du focus.
test('geste repris par le système ou page masquée : plus rien ne reste enfoncé', () => {
  // Scène simulée.
  const s = setup();
  // Le doigt 1 se pose.
  s.send('pointerdown', 1, 100, 100, { isPrimary: true });
  // Sa capture est perdue.
  s.send('lostpointercapture', 1, 100, 100);
  // Le glisser est terminé.
  assert.equal(s.engine.drag, false);
  // Aucune sélection.
  assert.equal(s.only('select').length, 0, 'une capture perdue n’est pas un appui');
  // Le doigt 2 se pose.
  s.send('pointerdown', 2, 100, 100, { isPrimary: true });
  // Le doigt 3 se pose.
  s.send('pointerdown', 3, 200, 100);
  // La fenêtre perd le focus.
  globalThis.window.dispatchEvent(new Event('blur'));
  // Le glisser est terminé.
  assert.equal(s.engine.drag, false);
  // Le doigt 2 bouge.
  s.send('pointermove', 2, 150, 100);
  // Aucun zoom.
  assert.equal(s.only('zoom').length, 0);
  // Débranche les gestes.
  s.unbind();
// Fin du test.
});

// Test : un doigt posé sur une étiquette.
test('doigt posé sur une étiquette : la vue se déplace et se pince quand même, le clic parasite est ignoré', () => {
  // Scène simulée.
  const s = setup();
  // Le doigt 1 se pose sur l'étiquette.
  s.sendLabel('pointerdown', 1, 100, 100, { isPrimary: true });
  // Le glisser est en cours.
  assert.equal(s.engine.drag, true);
  // Il bouge de 40 pixels.
  s.sendLabel('pointermove', 1, 140, 100);
  // Le moteur a reçu un déplacement de 40 pixels.
  assert.deepEqual(s.only('drag'), [['drag', 40, 0]]);
  // Second doigt sur le canevas : pincement à deux doigts, l'un sur l'étiquette.
  // Le doigt 2 se pose sur le canevas.
  s.send('pointerdown', 2, 240, 100);
  // Premier mouvement du doigt 2, sans déplacement.
  s.send('pointermove', 2, 240, 100);
  // Le doigt 2 s'écarte de 20 pixels.
  s.send('pointermove', 2, 260, 100);
  // Le moteur a reçu un zoom.
  assert.equal(s.only('zoom').length, 1);
  // Le doigt 2 se lève.
  s.send('pointerup', 2, 260, 100);
  // Le doigt 1 se lève de l'étiquette.
  s.sendLabel('pointerup', 1, 140, 100);
  // Le glisser est terminé.
  assert.equal(s.engine.drag, false);
  // Aucune sélection.
  assert.equal(s.only('select').length, 0);
  // Le clic qui suit est annulé.
  assert.equal(s.sendLabel('click', 1, 140, 100).defaultPrevented, true, 'clic après un glisser : ignoré');
  // Simple appui sur une étiquette : son clic passe, et la scène ne sélectionne rien à sa place.
  // Seconde scène simulée.
  const t = setup();
  // Un doigt se pose sur l'étiquette.
  t.sendLabel('pointerdown', 5, 10, 10, { isPrimary: true });
  // Il se lève sans avoir bougé.
  t.sendLabel('pointerup', 5, 10, 10);
  // Aucune sélection.
  assert.equal(t.only('select').length, 0);
  // Le clic n'est pas annulé.
  assert.equal(t.sendLabel('click', 5, 10, 10).defaultPrevented, false);
  // Débranche les gestes de la première scène.
  s.unbind();
  // Débranche ceux de la seconde.
  t.unbind();
// Fin du test.
});
