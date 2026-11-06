import { memo } from 'react';
import { Box } from '@mui/material';

// Étiquettes des astres et des villes : le moteur les positionne lui-même à chaque image ; leur apparence
// (classe `l`) est partagée avec les étiquettes créées par le moteur (theme/SceneStyles).

export const SceneLabels = memo(function SceneLabels({ data, registry, onSelectBody }) {
  const { sun, planets } = data.bodies;
  return (
    <>
      <Box className="l" ref={(el) => { registry.sun = el; }} style={{ '--c': sun.color }}>
        {sun.name}
      </Box>

      {planets.map((p, i) => (
        <Box
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
        </Box>
      ))}

      {data.cities.map((c, i) => (
        <Box
          key={`${c.name}-${i}`}
          className="l l-city"
          ref={(el) => { registry.cities[i] = el; }}
          style={{ '--c': '#fff', display: 'none' }}
        >
          {c.name}
        </Box>
      ))}
    </>
  );
});
