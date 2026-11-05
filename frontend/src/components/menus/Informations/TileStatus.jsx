import { useHud } from '@/engine/hudStore';
import { StatusLine } from '../../ui/StatusLine';
import { PROVIDER_LABEL } from './providerLabels';

const percent = (done, total) => (total > 0 ? Math.floor((100 * done) / total) : 0);

const cachesTitle = (c) => (c
  ? `Caches — GPU : ${c.gpu} tuiles · RAM : ${c.ram} · disque du navigateur : ${c.disk} lues, ${c.net} téléchargées`
  : undefined);

/** État des tuiles de la Lune, de Mars, de Mercure ou de Vénus. */
export function TileStatus({ hud, source, label, warmup = false }) {
  const t = useHud(hud, (s) => s[source]);
  if (!t?.layerId && t?.status !== 'error') return null;
  let text = PROVIDER_LABEL[t.provider] || t.provider || `Carte de ${label}`;
  let tone = 'ok';
  const p = t.preload;
  if (t.status === 'error') { text = t.error || `La carte de ${label} ne répond pas`; tone = 'bad'; }
  else if (warmup && p?.warmTotal && p.warmDone < p.warmTotal && p.done >= p.total) {
    text = `${label} prête · mise en cache du niveau suivant ${percent(p.warmDone, p.warmTotal)} %`;
  }
  else if (p?.total && p.done < p.total) {
    text = `Préchargement de ${label} · ${percent(p.done, p.total)} % (${p.done}/${p.total})`;
    tone = 'busy';
  }
  else if (t.status === 'loading') { text += ` · ${t.loading} images`; tone = 'busy'; }
  else if (t.zoom) text += ` · niveau ${t.zoom}`;
  return <StatusLine text={text} tone={tone} title={cachesTitle(t.caches)} />;
}
