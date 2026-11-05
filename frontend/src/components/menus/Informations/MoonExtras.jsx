import { MoonFaces } from './MoonFaces';
import { MoonOrbiters } from './MoonOrbiters';
import { MoonPhases } from './MoonPhases';
import { MoonShadowCam } from './MoonShadowCam';

/** Sections lunaires : phases, faces, sondes et ShadowCam. Les planètes n’en affichent aucune. */
export function MoonExtras({ moon, phases, handlers }) {
  const { onSide, onSelectOrbiter, onGoMoon } = handlers;

  return (
    <>
      <MoonFaces onSide={onSide} />
      <MoonPhases phases={phases} />
      {/* Sondes absentes tant que JPL Horizons n'a pas répondu. */}
      <MoonOrbiters orbiters={moon.orbiters || []} source={moon.orbitersSource} onSelect={onSelectOrbiter} />
      <MoonShadowCam items={moon.shadowcam || []} onGoMoon={onGoMoon} />
    </>
  );
}
