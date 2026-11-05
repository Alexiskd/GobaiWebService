export function Tuile3DHeader({ name, onClose }) {
  return (
    <header>
      <div>
        <span className="city-pointcloud-kicker">Tuile urbaine · Potree</span>
        <h2>{name}</h2>
      </div>
      <button type="button" className="ghost" onClick={onClose} aria-label="Fermer le nuage 3D">×</button>
    </header>
  );
}
