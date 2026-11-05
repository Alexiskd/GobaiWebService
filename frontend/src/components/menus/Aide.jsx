import { useViewport } from '@/hooks/useViewport';

const KEYS = [
  ['Ctrl K  ou  /', 'Rechercher une ville ou un astre'],
  ['+  /  −', 'Zoomer, dézoomer'],
  ['← → ↑ ↓', 'Faire tourner la caméra autour de l’astre'],
  ['0 (pavé numérique)', 'Vue d’ensemble'],
  ['L', 'Ouvrir ou fermer les informations'],
  ['?', 'Afficher cette aide'],
  ['Échap', 'Fermer le panneau ouvert'],
];

const GESTURES = [
  ['Un doigt', 'Glisser pour tourner autour de l’astre'],
  ['Deux doigts', 'Pincer pour zoomer'],
  ['Toucher un astre', 'Le centrer'],
  ['Boutons + / −', 'Maintenir pour zoomer en continu'],
  ['Boussole', 'Recaler la caméra sur le nord'],
];

export function Aide({ open, onClose }) {
  const { coarse } = useViewport();
  if (!open) return null;
  const rows = coarse ? GESTURES : KEYS;
  return (
    <div className="overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel help" role="dialog" aria-modal="true" aria-label={coarse ? 'Gestes tactiles' : 'Raccourcis clavier'}>
        <header>
          <h2>{coarse ? 'Gestes tactiles' : 'Raccourcis clavier'}</h2>
          <button type="button" className="ghost" onClick={onClose} aria-label="Fermer">×</button>
        </header>
        <dl>
          {rows.map(([k, d]) => (
            <div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>
          ))}
        </dl>
        {!coarse && <p className="hint">Souris : glisser pour tourner, molette ou pincement pour zoomer, clic sur un astre pour le centrer.</p>}
      </div>
    </div>
  );
}
