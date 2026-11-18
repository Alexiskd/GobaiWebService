// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/Car/AstreSolideEngine/hudStore';
// Importe la ligne d'état.
import { StatusLine } from '../../ui/StatusLine.jsx';
// Importe les noms des fournisseurs.
import { PROVIDER_LABEL } from './providerLabels.jsx';

// percent : pourcentage entier de ce qui est fait, 0 si le total est nul.
const percent = (done, total) => (total > 0 ? Math.floor((100 * done) / total) : 0);

// cachesTitle : infobulle des caches, s'ils sont connus (début)…
const cachesTitle = (c) => (c
  // … nombre de tuiles dans le GPU, en mémoire et téléchargées (rien n'est gardé sur le disque du navigateur)…
  ? `Caches — GPU : ${c.gpu} tuiles · RAM : ${c.ram} · ${c.net} téléchargées`
  // … sinon aucune infobulle.
  : undefined);

// perfTitle : compteurs de performance des tuiles, s'ils sont connus (début)…
const perfTitle = (p) => (p
  // … première tuile, débit, envoi au GPU, réseau de la session (Mo, annulés, délais dépassés, pannes)…
  ? `Performance — première tuile : ${p.firstTileMs ?? '…'} ms · ${p.tilesPerSec} tuiles/s · envoi GPU : ${p.uploadMs} ms/image · réseau : ${(p.net.bytes / 1e6).toFixed(1)} Mo, ${p.net.done}/${p.net.requests} reçues, ${p.net.aborted} annulées, ${p.net.timeouts} délais dépassés, ${p.net.errors} pannes`
  // … sinon rien.
  : '');

/** État des tuiles de la Lune, de Mars, de Mercure ou de Vénus. */
// Déclare et exporte le composant TileStatus : HUD, clé de l'état des tuiles, nom de l'astre et indicateur de mise en cache.
export function TileStatus({ hud, source, label }) {
  // Lit l'état des tuiles de l'astre.
  const t = useHud(hud, (s) => s[source]);
  // Sans couche affichée et sans erreur, rien n'est affiché.
  if (!t?.layerId && t?.status !== 'error') return null;
  // Texte de départ : le nom du fournisseur, son identifiant, ou « Carte de » suivi de l'astre.
  let text = PROVIDER_LABEL[t.provider] || t.provider || `Carte de ${label}`;
  // Le ton, « ok » par défaut.
  let tone = 'ok';
  // L'état du préchargement.
  const p = t.preload;
  // En erreur : le message (ou un message par défaut), ton d'erreur.
  if (t.status === 'error') { text = t.error || `La carte de ${label} ne répond pas`; tone = 'bad'; }
  // Si le préchargement est en cours.
  else if (p?.total && p.done < p.total) {
    // Texte : le pourcentage et le décompte du préchargement.
    text = `Préchargement de ${label} · ${percent(p.done, p.total)} % (${p.done}/${p.total})`;
    // Ton « en cours ».
    tone = 'busy';
  // Fin du cas.
  }
  // Pendant un chargement : ajoute le nombre d'images en cours, ton « en cours ».
  else if (t.status === 'loading') { text += ` · ${t.loading} images`; tone = 'busy'; }
  // Sinon, si le niveau de zoom est connu : l'ajoute au texte.
  else if (t.zoom) text += ` · niveau ${t.zoom}`;
  // Rend la ligne d'état, avec l'infobulle des caches.
  return <StatusLine text={text} tone={tone} title={[cachesTitle(t.caches), perfTitle(t.perf)].filter(Boolean).join('\n') || undefined} />;
// Fin de TileStatus.
}
