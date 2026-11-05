import { memo } from 'react';

export const SceneLabels = memo(function SceneLabels({ data, registry, onSelectBody }) {
  const { sun, planets } = data.bodies;
  return (
    <>
      <div className="l" ref={(el) => { registry.sun = el; }} style={{ '--c': sun.color }}>
        {sun.name}
      </div>

      {planets.map((p, i) => (
        <div
          key={p.name}
          className="l l-planet"
          ref={(el) => { registry.planets[i] = el; }}
          style={{ '--c': p.color }}
          title={`Toucher pour centrer ${p.name}`}
          role="button"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onSelectBody(i + 1); }}
        >
          {p.name}
        </div>
      ))}

      {data.cities.map((c, i) => (
        <div
          key={`${c.name}-${i}`}
          className="l l-city"
          ref={(el) => { registry.cities[i] = el; }}
          style={{ '--c': '#fff', display: 'none' }}
        >
          {c.name}
        </div>
      ))}
    </>
  );
});
