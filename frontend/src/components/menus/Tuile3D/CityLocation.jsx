// Coordonnées de la ville, affichées seulement si elles sont valides.
export function CityLocation({ lat, lon }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return (
    <p className="city-pointcloud-location">
      {Math.abs(lat).toFixed(3)}° {lat >= 0 ? 'N' : 'S'} · {Math.abs(lon).toFixed(3)}° {lon >= 0 ? 'E' : 'O'}
    </p>
  );
}
