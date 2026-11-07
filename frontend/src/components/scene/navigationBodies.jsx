// Les indices correspondent à l'ordre des astres dans le moteur, pas à l'ordre affiché.
export function navigationBodies(bodies) {
  const planets = bodies.planets.map((planet, i) => ({
    index: i + 1,
    name: planet.name,
    color: planet.color || '#8b97b3',
    number: String(i + 2).padStart(2, '0'),
  }));
  const earthIndex = bodies.planets.findIndex((planet) => planet.earth || planet.name === 'Terre');
  const earth = planets[earthIndex];
  const moon = {
    index: planets.length + 1,
    name: bodies.moon.name,
    color: bodies.moon.color || '#d8d2c4',
    number: earth ? `${earth.number} bis` : String(planets.length + 2).padStart(2, '0'),
    ...(earth ? { parentIndex: earth.index } : {}),
  };
  const result = [
    { index: 0, name: bodies.sun.name, color: bodies.sun.color || '#ffb300', number: '01' },
    ...planets,
  ];
  result.splice(earth ? earthIndex + 2 : result.length, 0, moon);
  return result;
}
