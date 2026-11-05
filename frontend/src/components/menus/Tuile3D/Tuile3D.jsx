import { useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import { cloudBaseUrl } from './format';
import { QUERIES } from './queries';
import { PointCloudStyles } from './PointCloudStyles';
import { usePointCloudCatalog } from './usePointCloudCatalog';
import { useLyonDataset } from './useLyonDataset';
import { usePanelLock } from './usePanelLock';
import { Tuile3DHeader } from './Tuile3DHeader';
import { CityLocation } from './CityLocation';
import { LyonLidar } from './LyonLidar';
import { CloudSelect } from './CloudSelect';
import { CloudMeta } from './CloudMeta';
import { PotreeViewer } from './PotreeViewer';

// Panneau « Tuile 3D » : nuage de points Potree d'une ville.
// Écran large : panneau flottant. Mobile / téléphone en paysage : plein écran.
// Tous les styles sont en MUI (`GlobalStyles` + `useMediaQuery`), aucun fichier .css.

export function Tuile3D({ city, open, onClose }) {
  const compact = useMediaQuery(QUERIES.compact, { noSsr: true });
  const coarse = useMediaQuery(QUERIES.coarse, { noSsr: true });
  const catalog = usePointCloudCatalog(open);
  const [selectedName, setSelectedName] = useState('');
  const cityKey = city ? `${city.name}|${city.lat}|${city.lon}` : '';
  const isLyon = /lyon/i.test(city?.name || '');
  const lyonDataset = useLyonDataset(open, isLyon);
  usePanelLock(open, onClose, compact);

  // `potreeUrl` ou `potreeBaseUrl` : le filtre et le viewer utilisent maintenant la même règle.
  const available = useMemo(() => catalog.items.filter((item) => cloudBaseUrl(item)), [catalog.items]);
  const selected = available.find((item) => item.name === selectedName) || available[0] || null;

  useEffect(() => {
    if (available.length && !available.some((item) => item.name === selectedName)) {
      setSelectedName(available[0].name);
    }
  }, [available, selectedName]);

  if (!open || !city) return null;

  return (
    <section
      className="city-pointcloud panel"
      role="dialog"
      aria-modal={compact ? 'true' : 'false'} // plein écran sur mobile : c'est alors une vraie modale
      aria-label={`Nuages 3D de ${city.name}`}
    >
      <PointCloudStyles />
      <Tuile3DHeader name={city.name} onClose={onClose} />
      <div className="city-pointcloud-body">
        <CityLocation lat={Number(city.lat)} lon={Number(city.lon)} />
        {isLyon && <LyonLidar dataset={lyonDataset} />}
        {catalog.status === 'loading' && <p className="city-pointcloud-message">Recherche des jeux de données…</p>}
        {catalog.status === 'error' && <p className="city-pointcloud-message is-error">Catalogue indisponible : {catalog.error}</p>}
        {catalog.status === 'ready' && !available.length && !isLyon && (
          <p className="city-pointcloud-message">
            Aucun jeu Potree converti n’est associé. Placez les données converties dans
            <code> POINTCLOUD_DIR/potree/&lt;nom-du-fichier&gt;/cloud.js</code>.
          </p>
        )}
        {selected && (
          <>
            {available.length > 1 && <CloudSelect items={available} value={selected.name} onChange={setSelectedName} />}
            <CloudMeta cloud={selected} />
            <PotreeViewer key={`${cityKey}|${selected.name}`} cloud={selected} coarse={coarse} />
          </>
        )}
      </div>
    </section>
  );
}
