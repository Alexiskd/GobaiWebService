import { useHud } from '@/engine/hudStore';

// Boussole : aiguille 3D (pointe rouge au nord, pointe blanche au sud) qui tourne avec le cap ;
// un clic recale la caméra sur le nord géographique.
export default function Compass({ hud, onRecalibrate }) {
  const compass = useHud(hud, (s) => s.compass);
  if (!compass) return null;

  const deg = (compass.angle * 180) / Math.PI;
  const shown = Math.round(((deg % 360) + 540) % 360 - 180);
  const side = shown === 0 ? 'en haut' : shown === 180 || shown === -180 ? 'en bas' : `${Math.abs(shown)}° ${shown > 0 ? 'à droite' : 'à gauche'}`;
  const hint = `Nord ${side} · cliquer pour recaler la caméra sur le nord`;

  return (
    <div className="compass-pad">
      <button type="button" className="compass" title={hint} aria-label={`Boussole, ${hint}`} onClick={onRecalibrate}>
        <img
          className="compass-needle"
          src="/compass-needle.webp"
          alt=""
          draggable="false"
          style={{ transform: `rotate(${deg}deg)` }}
        />
        <span className="compass-mark" aria-hidden="true" />
      </button>
    </div>
  );
}
