import { fmtLat, fmtLon } from '@/lib/format';

/** Une zone ShadowCam : un clic place la caméra au-dessus de la zone. */
export function ShadowCamTile({ site, onGoMoon }) {
  return (
    <li>
      <button
        type="button"
        className="ac-btn ac-tile"
        onClick={() => onGoMoon?.({ lon: site.lon, lat: site.lat }, 30)}
        title={`${fmtLat(site.lat)} ${fmtLon(site.lon)}${site.season ? ` · éclairage indirect en ${site.season}` : ''}`}
      >
        <span className="ac-tile-name">{site.name}</span>
        <small>{site.error ? 'indisponible' : site.loading ? 'chargement…' : site.res ? `${site.res} m/px` : fmtLat(site.lat)}</small>
      </button>
    </li>
  );
}
