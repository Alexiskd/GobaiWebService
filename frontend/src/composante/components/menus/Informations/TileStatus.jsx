// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe la ligne d'état.
import { StatusLine } from '../../ui/StatusLine';
// Importe les noms des fournisseurs.
import { PROVIDER_LABEL } from './providerLabels';

// percent : pourcentage entier de ce qui est fait, 0 si le total est nul.
const percent = (done, total) => (total > 0 ? Math.floor((100 * done) / total) : 0);

// cachesTitle : infobulle des caches, s'ils sont connus (début)…
const cachesTitle = (c) => (c
  // … nombre de tuiles dans le GPU, en mémoire, lues sur le disque du navigateur et téléchargées…
  ? `Caches — GPU : ${c.gpu} tuiles · RAM : ${c.ram} · disque du navigateur : ${c.disk} lues, ${c.net} téléchargées`
  // … sinon aucune infobulle.
  : undefined);

/** État des tuiles de la Lune, de Mars, de Mercure ou de Vénus. */
// Déclare et exporte le composant TileStatus : HUD, clé de l'état des tuiles, nom de l'astre et indicateur de mise en cache.
export function TileStatus({ hud, source, label, warmup = false }) {
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
  // Si la mise en cache du niveau suivant est en cours, le préchargement étant fini.
  else if (warmup && p?.warmTotal && p.warmDone < p.warmTotal && p.done >= p.total) {
    // Texte : l'astre est prêt, avec le pourcentage de mise en cache.
    text = `${label} prête · mise en cache du niveau suivant ${percent(p.warmDone, p.warmTotal)} %`;
  // Fin du cas.
  }
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
  return <StatusLine text={text} tone={tone} title={cachesTitle(t.caches)} />;
// Fin de TileStatus.
}
