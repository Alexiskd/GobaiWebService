// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les constantes et les fonctions testées.
import {
  ACTIVE_LATITUDE_DEG, ERUPTION_BURST_S, ERUPTION_GRAVITY, ERUPTION_V_MAX, ERUPTION_V_MIN, MAX_SITES,
  SYNODIC_DEG_PER_DAY, apexHeight, buildEruptionAttributes, driftStonyhurst, eruptionSites, flareStrength,
  flightTime, localFrame, particleAge, particleState, regionStrength, seededRandom, sitesFromRegions, wrapDeg,
} from './sunSurfaceMath';

// near : deux nombres égaux à une tolérance près.
const near = (a, b, eps = 1e-5) => Math.abs(a - b) <= eps;
// dot : produit scalaire de deux vecteurs de trois nombres.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Test : le générateur pseudo-aléatoire.
test('éruptions du Soleil : la même graine donne la même suite, entre 0 et 1', () => {
  // Deux générateurs de même graine.
  const a = seededRandom(42), b = seededRandom(42);
  // Cent tirages (début).
  for (let i = 0; i < 100; i++) {
    // Un tirage.
    const v = a();
    // Identique pour l'autre générateur.
    assert.equal(v, b());
    // Entre 0 inclus et 1 exclu.
    assert.ok(v >= 0 && v < 1);
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : la trajectoire balistique.
test('éruptions du Soleil : un grain monte, atteint son sommet à mi-vol et retombe à la surface', () => {
  // Vitesse verticale de l'essai.
  const v = 0.08;
  // Durée du vol.
  const T = flightTime(v);
  // Durée attendue : 2·v/g.
  assert.ok(near(T, (2 * v) / ERUPTION_GRAVITY));
  // Au départ : à la surface.
  assert.equal(particleState(0, v, 0.02).height, 0);
  // À mi-vol : au sommet.
  assert.ok(near(particleState(T / 2, v, 0.02).height, apexHeight(v)));
  // À la fin du vol : de nouveau à la surface.
  assert.ok(near(particleState(T, v, 0.02).height, 0));
  // Après le vol : éteint.
  assert.equal(particleState(T + 0.01, v, 0.02).alive, false);
  // Distance parcourue le long de la surface : vitesse × temps.
  assert.ok(near(particleState(2, v, 0.02).arc, 0.04));
// Fin du test.
});

// Test : les hauteurs restent celles d'une protubérance.
test('éruptions du Soleil : la matière monte entre 0,04 et 0,43 rayon solaire', () => {
  // Hauteur du grain le plus lent : 0,04 rayon.
  assert.ok(near(apexHeight(ERUPTION_V_MIN), 0.04));
  // Hauteur du grain le plus rapide : sous 0,43 rayon.
  assert.ok(apexHeight(ERUPTION_V_MAX) < 0.43);
// Fin du test.
});

// Test : l'âge d'un grain.
test('éruptions du Soleil : l’âge d’un grain reste dans la période, même avant le premier départ', () => {
  // Plusieurs instants, dont des négatifs (début).
  for (const time of [-50, -1, 0, 3, 17.5, 1000]) {
    // Âge du grain.
    const age = particleAge(time, 20, 4, 2);
    // Entre 0 inclus et la période exclue.
    assert.ok(age >= 0 && age < 20);
  // Fin de la boucle.
  }
  // Six secondes après le début de la gerbe, avec deux secondes de retard : le grain a 4 secondes.
  assert.ok(near(particleAge(10, 20, 4, 2), 4));
// Fin du test.
});

// Test : les régions actives.
test('éruptions du Soleil : les régions actives sont sur la sphère, près de l’équateur, avec une arche tangente', () => {
  // Les régions.
  const sites = eruptionSites(MAX_SITES);
  // Leur nombre.
  assert.equal(sites.length, MAX_SITES);
  // Pour chaque région (début).
  for (const s of sites) {
    // Direction unitaire.
    assert.ok(near(Math.hypot(...s.dir), 1));
    // Arche unitaire.
    assert.ok(near(Math.hypot(...s.tangent), 1));
    // Arche tangente à la surface.
    assert.ok(near(dot(s.dir, s.tangent), 0));
    // Latitude dans la bande active.
    assert.ok(Math.abs(Math.asin(s.dir[1])) <= (ACTIVE_LATITUDE_DEG * Math.PI) / 180 + 1e-9);
    // Période plus longue que la gerbe et que le plus long vol : une éruption est finie avant la suivante.
    assert.ok(s.period >= ERUPTION_BURST_S + flightTime(ERUPTION_V_MAX));
    // Décalage dans la période.
    assert.ok(s.offset >= 0 && s.offset < s.period);
  // Fin de la boucle.
  }
  // Jamais plus que le maximum prévu par le shader.
  assert.equal(eruptionSites(50).length, MAX_SITES);
// Fin du test.
});

// Test : les tableaux des particules.
test('éruptions du Soleil : chaque grain part de la surface, dans une direction tangente, avec des vitesses bornées', () => {
  // Les régions.
  const sites = eruptionSites(5);
  // Le rayon de l'essai.
  const R = 696;
  // Les tableaux.
  const a = buildEruptionAttributes(sites, 40, R);
  // Nombre de grains.
  assert.equal(a.count, 200);
  // Tailles des tableaux.
  assert.deepEqual([a.position.length, a.tangent.length, a.launch.length, a.cycle.length], [600, 600, 800, 400]);
  // Pour chaque grain (début).
  for (let i = 0; i < a.count; i++) {
    // Son point de départ.
    const p = [a.position[i * 3], a.position[i * 3 + 1], a.position[i * 3 + 2]];
    // Sa direction de départ.
    const t = [a.tangent[i * 3], a.tangent[i * 3 + 1], a.tangent[i * 3 + 2]];
    // Départ sur la sphère.
    assert.ok(near(Math.hypot(...p) / R, 1, 1e-4));
    // Direction unitaire.
    assert.ok(near(Math.hypot(...t), 1, 1e-4));
    // Direction presque tangente à la surface (le pied est à 0,04 rayon au plus de la région).
    assert.ok(Math.abs(dot(p, t)) / R < 0.05);
    // Vitesse verticale bornée.
    assert.ok(a.launch[i * 4] >= ERUPTION_V_MIN - 1e-6 && a.launch[i * 4] <= ERUPTION_V_MAX + 1e-6);
    // Vitesse le long de la surface plus faible que la vitesse verticale.
    assert.ok(a.launch[i * 4 + 1] < a.launch[i * 4]);
    // Retard dans la gerbe.
    assert.ok(a.launch[i * 4 + 2] >= 0 && a.launch[i * 4 + 2] <= ERUPTION_BURST_S);
    // Période de sa région.
    assert.ok(near(a.cycle[i * 2], sites[Math.floor(i / 40)].period, 1e-4));
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : la remise d'un angle dans ]-180, 180].
test('régions réelles : les longitudes sont ramenées dans ]-180, 180]', () => {
  // Les valeurs déjà dans l'intervalle ne changent pas.
  assert.equal(wrapDeg(0), 0);
  // Une longitude juste au-dessus de 180 repasse du côté négatif.
  assert.equal(wrapDeg(190), -170);
  // Un tour complet ramène à la même valeur.
  assert.equal(wrapDeg(360 + 45), 45);
  // Une valeur très négative revient aussi dans l'intervalle.
  assert.equal(wrapDeg(-540), 180);
});

// Test : la dérive d'une région avec la rotation du Soleil.
test('régions réelles : une région dérive vers l’ouest à la vitesse synodique', () => {
  // Un instant de référence.
  const t0 = Date.UTC(2026, 10, 9, 0, 0);
  // Sans temps écoulé, la longitude ne change pas.
  assert.ok(near(driftStonyhurst(-30, t0, t0), -30));
  // Un jour plus tard, elle a avancé vers l'ouest de la rotation synodique.
  assert.ok(near(driftStonyhurst(-30, t0, t0 + 86400000), -30 + SYNODIC_DEG_PER_DAY, 1e-9));
  // Une région au centre du disque atteint le limbe ouest en un quart de rotation.
  assert.ok(near(driftStonyhurst(0, t0, t0 + 86400000 * (90 / SYNODIC_DEG_PER_DAY)), 90, 1e-9));
  // Une rotation complète la ramène au même endroit.
  assert.ok(near(driftStonyhurst(10, t0, t0 + 86400000 * 27.2753), 10, 1e-9));
});

// Test : le repère local d'un point de la surface.
test('régions réelles : le repère local est orthonormé et orienté', () => {
  // Un point à 20 degrés de latitude nord et 50 de longitude.
  const { dir, east, north } = localFrame((20 * Math.PI) / 180, (50 * Math.PI) / 180);
  // Les trois axes sont unitaires.
  for (const v of [dir, east, north]) assert.ok(near(Math.hypot(...v), 1));
  // Ils sont perpendiculaires deux à deux.
  assert.ok(near(dot(dir, east), 0));
  assert.ok(near(dot(dir, north), 0));
  assert.ok(near(dot(east, north), 0));
  // L'est local est horizontal : il ne monte ni ne descend.
  assert.ok(near(east[1], 0));
  // Le nord local monte vers le pôle nord.
  assert.ok(north[1] > 0);
});

// Test : la force d'une éruption d'après sa classe GOES.
test('régions réelles : la force d’une éruption croît avec sa classe', () => {
  // Les classes rangées du plus faible au plus fort.
  const classes = ['B1.0', 'C1.0', 'C9.9', 'M1.0', 'M5.0', 'X1.0', 'X9.0'];
  // Les forces correspondantes.
  const forces = classes.map(flareStrength);
  // Chaque classe est au moins aussi forte que la précédente.
  for (let i = 1; i < forces.length; i++) assert.ok(forces[i] >= forces[i - 1], `${classes[i]} >= ${classes[i - 1]}`);
  // Toutes restent entre 0 et 1.
  for (const f of forces) assert.ok(f >= 0 && f <= 1);
  // Une classe illisible ne donne aucune force.
  for (const bad of ['', 'Z1.0', null, undefined, 3]) assert.equal(flareStrength(bad), 0);
});

// Test : la force d'une région active.
test('régions réelles : la force d’une région suit ses probabilités d’éruption et sa surface', () => {
  // Une région calme et minuscule garde le plancher.
  assert.ok(near(regionStrength({ area: 0, probability: { c: 0, m: 0, x: 0 } }), 0.18));
  // Une région très probable en classe X est au maximum.
  assert.ok(regionStrength({ area: 50, probability: { c: 80, m: 40, x: 25 } }) >= 0.99);
  // À probabilités égales, la plus grande région est la plus forte.
  const petite = regionStrength({ area: 60, probability: {} });
  const grande = regionStrength({ area: 500, probability: {} });
  assert.ok(grande > petite);
  // La force reste toujours entre 0 et 1.
  for (const area of [0, 100, 600, 5000]) {
    const f = regionStrength({ area, probability: { c: 10 } });
    assert.ok(f >= 0 && f <= 1);
  }
});

// Test : le placement d'une région réelle dans le repère du Soleil.
test('régions réelles : une région au centre du disque est placée face à la Terre', () => {
  // L'instant du test, qui est aussi la fin du jour d'observation.
  const now = Date.UTC(2026, 10, 10, 0, 0);
  // La longitude, dans le repère du Soleil, du méridien qui fait face à la Terre.
  const earthLongitude = 0.7;
  // Une seule région, au centre du disque et sur l'équateur.
  const sites = sitesFromRegions(
    { regions: [{ number: 4571, lat: 0, lon: 0, observedAt: '2026-11-09', area: 100, probability: { m: 10 } }], flares: [] },
    { nowMs: now, earthLongitude },
  );
  // Une région est rendue.
  assert.equal(sites.length, 1);
  // Elle est placée à la longitude qui fait face à la Terre.
  assert.ok(near(Math.atan2(sites[0].dir[2], sites[0].dir[0]), earthLongitude));
  // Sa direction est unitaire et sur l'équateur.
  assert.ok(near(Math.hypot(...sites[0].dir), 1));
  assert.ok(near(sites[0].dir[1], 0));
  // Son étiquette porte le numéro NOAA de la région.
  assert.equal(sites[0].label, 'AR 4571');
});

// Test : le sens des longitudes, ouest et est.
test('régions réelles : l’ouest et l’est se placent de part et d’autre du méridien central', () => {
  // L'instant du test, qui est aussi la fin du jour d'observation.
  const now = Date.UTC(2026, 10, 10, 0, 0);
  // Deux régions, l'une à 90 degrés à l'ouest, l'autre à 90 degrés à l'est.
  const sites = sitesFromRegions(
    {
      regions: [
        { number: 1, lat: 0, lon: 90, observedAt: '2026-11-09', area: 200 },
        { number: 2, lat: 0, lon: -90, observedAt: '2026-11-09', area: 100 },
      ],
      flares: [],
    },
    { nowMs: now, earthLongitude: 0 },
  );
  // Les deux régions sont rendues, la plus grande d'abord.
  assert.equal(sites.length, 2);
  assert.equal(sites[0].lon, 90);
  // La région à l'ouest est à -90 degrés dans le repère du Soleil.
  assert.ok(near(Math.atan2(sites[0].dir[2], sites[0].dir[0]), -Math.PI / 2));
  // Celle à l'est est à +90 degrés : les deux sont bien opposées.
  assert.ok(near(Math.atan2(sites[1].dir[2], sites[1].dir[0]), Math.PI / 2));
});

// Test : une éruption récente remonte la force de sa région.
test('régions réelles : une éruption récente passe devant une grande région calme', () => {
  // L'instant du test.
  const now = Date.UTC(2026, 10, 10, 12, 0);
  // Une grande région calme, et une petite région qui vient d'éclater en classe X.
  const sites = sitesFromRegions(
    {
      regions: [
        { number: 10, lat: 5, lon: 10, observedAt: '2026-11-09', area: 600, probability: {} },
        { number: 20, lat: -8, lon: -20, observedAt: '2026-11-09', area: 20, probability: {} },
      ],
      flares: [{ cls: 'X2.0', peak: new Date(now - 3600000).toISOString(), lat: -8, lon: -20, region: 20 }],
    },
    { nowMs: now, earthLongitude: 0 },
  );
  // La région qui a éclaté passe en tête.
  assert.equal(sites[0].label, 'AR 20');
  // Sa classe d'éruption est notée.
  assert.equal(sites[0].flare, 'X2.0');
  // Sa période entre deux gerbes est plus courte que celle de la région calme.
  assert.ok(sites[0].period < sites[1].period);
});

// Test : une éruption sans région connue devient une région à elle seule, et les vieilles sont écartées.
test('régions réelles : une éruption isolée devient une région, une éruption ancienne est ignorée', () => {
  // L'instant du test.
  const now = Date.UTC(2026, 10, 10, 12, 0);
  // Deux éruptions : une récente hors de toute région connue, une vieille de deux jours.
  const sites = sitesFromRegions(
    {
      regions: [],
      flares: [
        { cls: 'M1.5', peak: new Date(now - 7200000).toISOString(), lat: 12, lon: 30, region: null },
        { cls: 'X5.0', peak: new Date(now - 2 * 86400000).toISOString(), lat: -12, lon: -30, region: null },
      ],
    },
    { nowMs: now, earthLongitude: 0 },
  );
  // Seule l'éruption récente est retenue.
  assert.equal(sites.length, 1);
  // Elle porte sa classe dans son étiquette.
  assert.equal(sites[0].label, 'Éruption M1.5');
});

// Test : une réponse vide ou illisible ne donne aucune région.
test('régions réelles : une réponse vide ne donne aucune région', () => {
  // Pour chacune de ces réponses,
  for (const bad of [null, undefined, {}, { regions: [], flares: [] }, { regions: 'non' }]) {
    // aucune région n'est rendue : l'appelant garde ses régions simulées.
    assert.deepEqual(sitesFromRegions(bad, { nowMs: Date.now() }), []);
  }
  // Une région sans position est écartée elle aussi.
  assert.deepEqual(sitesFromRegions({ regions: [{ number: 1, observedAt: '2026-11-09' }] }, { nowMs: Date.now() }), []);
});

// Test : le nombre de régions rendues est borné.
test('régions réelles : le nombre de régions rendues ne dépasse pas la demande', () => {
  // Douze régions, plus que le maximum du shader.
  const regions = Array.from({ length: 12 }, (_, i) => ({ number: 100 + i, lat: i - 6, lon: i * 10 - 60, observedAt: '2026-11-09', area: 500 - i * 20 }));
  // Sans demande particulière, le maximum du shader s'applique.
  assert.equal(sitesFromRegions({ regions }, { nowMs: Date.UTC(2026, 10, 10) }).length, MAX_SITES);
  // Avec une demande plus petite, c'est elle qui s'applique.
  assert.equal(sitesFromRegions({ regions }, { nowMs: Date.UTC(2026, 10, 10), max: 5 }).length, 5);
});

// Test : la force d'une région règle la hauteur de ses gerbes.
test('régions réelles : une région forte envoie sa matière plus haut qu’une région faible', () => {
  // Le repère local d'une région sur l'équateur.
  const frame = localFrame(0, 0);
  // Une région faible et une région forte, au même endroit.
  const faible = { dir: frame.dir, tangent: frame.east, period: 30, offset: 0, strength: 0.05 };
  const forte = { dir: frame.dir, tangent: frame.east, period: 30, offset: 0, strength: 1 };
  // Les vitesses verticales moyennes des deux régions, sur cinquante grains chacune.
  const moyenne = (site) => {
    // Les tableaux des grains de cette région.
    const { launch } = buildEruptionAttributes([site], 50, 1);
    // La moyenne des vitesses verticales.
    let total = 0;
    for (let i = 0; i < 50; i++) total += launch[i * 4];
    return total / 50;
  };
  // La région forte envoie sa matière plus vite, donc plus haut.
  assert.ok(moyenne(forte) > moyenne(faible));
  // Les deux restent dans les bornes du modèle.
  for (const site of [faible, forte]) {
    const { launch } = buildEruptionAttributes([site], 50, 1);
    for (let i = 0; i < 50; i++) assert.ok(launch[i * 4] >= ERUPTION_V_MIN && launch[i * 4] <= ERUPTION_V_MAX);
  }
});

// Test : un instantané périmé des régions est ignoré.
test('régions réelles : un instantané trop vieux est ignoré', () => {
  // L'instant du test.
  const now = Date.UTC(2026, 10, 14, 12, 0);
  // Une région observée la veille, et une observée dix jours plus tôt.
  const data = {
    regions: [
      { number: 1, lat: 10, lon: 0, observedAt: '2026-11-13', area: 100 },
      { number: 2, lat: -10, lon: 0, observedAt: '2026-11-04', area: 900 },
    ],
    flares: [],
  };
  // Les régions retenues.
  const sites = sitesFromRegions(data, { nowMs: now, earthLongitude: 0 });
  // Seule la région récente est retenue, même si l'autre est bien plus grande.
  assert.equal(sites.length, 1);
  assert.equal(sites[0].label, 'AR 1');
  // Avec un âge maximal plus large, les deux reviennent.
  assert.equal(sitesFromRegions(data, { nowMs: now, maxAge: 30 * 86400000 }).length, 2);
});
