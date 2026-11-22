// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { CircularProgress } from '@/Fairing/kit';
// Importe buildGlobeCanvas, qui assemble la carte du globe.
import { buildGlobeCanvas } from '@/Engine/TextureEngine/globeTexture';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';
// Importe le plateau noir qui tourne et son globe.
import { PlateauTournant } from './PlateauTournant.jsx';

/**
 * Plateau tournant en ligne, sans fenêtre : le globe de l'astre visé (la Terre à défaut), habillé du même fond de
 * carte que celui actif sur l'astre dans la scène, posé dans le panneau d'informations, au-dessus de la galerie
 * de photos. Se met à jour quand on change d'astre ou de fond.
 *  engine     moteur 3D (ou null tant qu'il n'existe pas)
 *  bodyId     astre ciblé (id des tuiles : 'earth', 'mars', 'moon'…) ou null
 *  baseKey    id du fond actif de cet astre (change → nouvelle carte), ou null s'il n'y en a pas
 */
// Déclare et exporte le composant PlateauInline : le moteur, l'astre et le fond actif.
export function PlateauInline({ engine, bodyId, baseKey }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // L'astre affiché : celui qui est visé, la Terre à défaut.
  const id = bodyId || 'earth';
  // État : la carte du globe, null tant qu'elle n'est pas prête.
  const [globe, setGlobe] = useState(null);
  // État du chargement.
  const [state, setState] = useState('idle'); // 'loading' | 'ready' | 'none'

  // Effet qui construit la carte (déjà monté dans le DOM, pas besoin d'être ouvert).
  useEffect(() => {
    // Sans moteur : rien à faire.
    if (!engine) return undefined;
    // Demande au moteur la source du fond de l'astre.
    const source = engine.bodyBaseSource(id);
    // Sans source : pas de carte, état « none ».
    if (!source) { setGlobe(null); setState('none'); return undefined; }
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Passe à l'état « chargement ».
    setState('loading');
    // Assemble la carte, au niveau de zoom 2 en mode compact, 3 sinon.
    buildGlobeCanvas(source, { zoom: compact ? 2 : 3, signal: ctrl.signal })
      // Réussite : garde la carte, état « prêt ».
      .then((canvas) => { setGlobe(canvas); setState('ready'); })
      // Échec, sauf annulation volontaire : pas de carte, état « none ».
      .catch((e) => { if (e.name !== 'AbortError') { setGlobe(null); setState('none'); } });
    // Nettoyage : annule la construction en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendances : le moteur, l'astre, le fond et le mode compact.
  }, [engine, id, baseKey, compact]);

  // Astre sans fond de carte (pas de tuiles, comme Jupiter) : la composante ne s'affiche pas du tout.
  if (state === 'none') return null;

  // Début du rendu.
  return (
    // Section du panneau : hauteur contenue, le plateau s'adapte à son conteneur.
    <div className={`relative ${compact ? 'h-55' : 'h-70'} mt-3 overflow-hidden`}>
      {/* Le globe tournant, monté dès que le composant l'est. */}
      <PlateauTournant globe={globe} />
      {/* Tant que la carte n'est pas prête (début). */}
      {state !== 'ready' && (
        // Bloc de message, centré en haut, sans capter les clics.
        <div className="flex flex-col gap-2 items-center absolute top-4 left-0 right-0 pointer-events-none">
          {/* La roue de chargement, pendant le chargement. */}
          {state === 'loading' && <CircularProgress size={20} />}
          {/* Le message (début de la balise). */}
          <span className="t-caption text-soft">
            {/* « Chargement… » ou « Aucun fond de carte actif ». */}
            {state === 'loading' ? 'Chargement du fond de carte…' : 'Aucun fond de carte actif sur cet astre.'}
          {/* Fin du message. */}
          </span>
        {/* Fin du bloc. */}
        </div>
      // Fin du cas.
      )}
    {/* Fin de la section. */}
    </div>
  // Fin du rendu.
  );
// Fin de PlateauInline.
}
