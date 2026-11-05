import { useHud } from '@/engine/hudStore';
import { StatusLine } from '../../ui/StatusLine';
import { PROVIDER_LABEL } from './providerLabels';

export function EarthStatus({ hud, listStatus, listError }) {
  const tiles = useHud(hud, (s) => s.tiles);
  let text;
  let tone = 'ok';
  if (listStatus === 'error') { text = `API de tuiles indisponible (${listError})`; tone = 'bad'; }
  else if (tiles?.status === 'error') { text = tiles.error || 'La carte ne répond pas'; tone = 'bad'; }
  else if (tiles?.layerId) {
    text = `${PROVIDER_LABEL[tiles.provider] || tiles.provider}${tiles.experimental ? ' · expérimental' : ''}`;
    if (tiles.status === 'loading') { text += ` · ${tiles.loading} images`; tone = 'busy'; }
  } else {
    text = listStatus === 'loading' ? 'Chargement des fonds…' : 'Aucun fond chargé';
    tone = 'busy';
  }
  return <StatusLine text={text} tone={tone} />;
}
