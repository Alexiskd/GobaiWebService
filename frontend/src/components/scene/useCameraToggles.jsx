import { useEffect, useState } from 'react';

/** Rotation automatique et vue 3/4, envoyées au moteur. */
export function useCameraToggles(engine) {
  const [auto, setAuto] = useState(true);
  const [tilt, setTilt] = useState(true);

  useEffect(() => { engine?.setAutoRotate(auto); }, [engine, auto]);
  useEffect(() => { engine?.setTilt(tilt); }, [engine, tilt]);

  return { auto, setAuto, tilt, setTilt };
}
