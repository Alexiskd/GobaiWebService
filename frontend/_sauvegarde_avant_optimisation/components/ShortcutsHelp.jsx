const KEYS = [
  ['Ctrl K  ou  /', 'Rechercher une ville ou un astre'],
  ['+  /  −', 'Zoomer, dézoomer'],
  ['← → ↑ ↓', 'Faire tourner la caméra autour de l’astre'],
  ['0 (pavé numérique)', 'Vue d’ensemble'],
  ['L', 'Ouvrir ou fermer les couches'],
  ['P', 'Ouvrir ou fermer le panneau pair-à-pair'],
  ['?', 'Afficher cette aide'],
  ['Échap', 'Fermer le panneau ouvert'],
];

export default function ShortcutsHelp({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel help" role="dialog" aria-modal="true" aria-label="Raccourcis clavier">
        <header>
          <h2>Raccourcis clavier</h2>
          <button className="ghost" onClick={onClose} aria-label="Fermer">×</button>
        </header>
        <dl>
          {KEYS.map(([k, d]) => (
            <div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>
          ))}
        </dl>
        <p className="hint">Souris : glisser pour tourner, molette ou pincement pour zoomer, clic sur un astre pour le centrer.</p>
      </div>
    </div>
  );
}
