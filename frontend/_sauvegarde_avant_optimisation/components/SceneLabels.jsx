import { memo } from 'react';

// Étiquettes HTML superposées à la scène. Le moteur les positionne à chaque image
// (transform / display) via les éléments enregistrés dans `registry` ; React ne les
// re-rend jamais (composant mémoïsé, props stables).
function SceneLabels({ data, registry, onSelectBody }) {
  const { sun, planets } = data.bodies;
  return (
    <>
      <div className="l" ref={(el) => { registry.sun = el; }} style={{ '--c': sun.color }}>
        {sun.name}
      </div>

      {planets.map((p, i) => (
        <div
          key={p.name}
          className="l"
          ref={(el) => { registry.planets[i] = el; }}
          style={{ '--c': p.color }}
          title={`Cliquer pour centrer ${p.name}`}
          onClick={(e) => { e.stopPropagation(); onSelectBody(i + 1); }}
        >
          {p.name}
        </div>
      ))}

      {data.cities.map((c, i) => (
        <div
          key={`${c.name}-${i}`}
          className="l"
          ref={(el) => { registry.cities[i] = el; }}
          style={{ '--c': '#fff', fontSize: 11, display: 'none' }}
        >
          {c.name}
        </div>
      ))}

    </>
  );
}

export default memo(SceneLabels);
