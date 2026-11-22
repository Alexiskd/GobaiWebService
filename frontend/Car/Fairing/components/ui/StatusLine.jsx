// Ligne d'état : éléments HTML habillés par Tailwind CSS.
import { tok } from '@/Fairing/kit/sx';

// Table des couleurs de la pastille selon le ton : vert (ok), bleu (en cours), rouge (erreur).
const TONE_COLOR = { ok: 'success.main', busy: 'info.main', bad: 'error.main' };

/** Ligne d'état : pastille de couleur (ok, en cours, erreur) et texte. */
// Déclare et exporte le composant StatusLine : reçoit le texte, le ton et une infobulle.
export function StatusLine({ text, tone, title }) {
  // Début du rendu.
  return (
    // Ligne horizontale au rôle d'état, éléments centrés verticalement, avec infobulle et marges.
    <div role="status" title={title} className="flex flex-row gap-2 items-center px-1 py-2">
      {/* La pastille (début de la balise). */}
      <div
        // Cachée aux lecteurs d'écran : purement décorative.
        aria-hidden="true"
        // Début du style de la pastille.
        className={`w-2 h-2 rounded-full flex-none ${tone === 'busy' ? '[animation:status-pulse_1.2s_ease-in-out_infinite]' : '[animation:none]'} motion-reduce:[animation:none]`} style={{ backgroundColor: tok(TONE_COLOR[tone] || 'text.disabled') }}
      // Fin de la pastille.
      />
      {/* Le texte, en petit ; rouge en cas d'erreur, couleur secondaire sinon. */}
      <span className={`t-caption ${tone === 'bad' ? 'text-error' : 'text-soft'}`}>{text}</span>
    {/* Fin de la ligne. */}
    </div>
  // Fin du rendu.
  );
// Fin de StatusLine.
}
