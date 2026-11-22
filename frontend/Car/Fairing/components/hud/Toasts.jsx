// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Alert } from '@/Fairing/kit';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/Fairing/theme/mediaQueries';
// Importe la limite basse de la zone du titre du téléphone.
import { HUD_TOP } from '@/Fairing/theme/layout';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';

// Correspondance entre le ton d'un message et la gravité de l'avertissement.
const SEVERITY = { warn: 'warning', error: 'error', info: 'info', ok: 'success' };

/** Messages éphémères, empilés en haut au centre (au-dessus des panneaux et des dialogues). */
// Déclare et exporte le composant Toasts : reçoit les messages et le rappel de fermeture.
export function Toasts({ toasts, onDismiss }) {
  // Mode compact (téléphone).
  const { compact } = useViewport();
  // Début du rendu.
  return (
    // Pile des messages (début de la balise).
    <div
      // Rôle d'état pour les lecteurs d'écran.
      role="status"
      // Changements annoncés sans interrompre la lecture en cours.
      aria-live="polite"
      // Début du style.
      className="flex flex-col gap-2 fixed z-[1400] left-1/2 [transform:translateX(-50%)] w-[min(440px,calc(100vw_-_28px))] pointer-events-none *:pointer-events-auto" style={{ top: compact ? `calc(${HUD_TOP} + 8px)` : `calc(var(--gps-top, 0px) + ${safe('top')} + 14px)` }}
    // Fin de la balise ouvrante.
    >
      {/* Un message d'alerte par entrée (début). */}
      {toasts.map((t) => (
        // Le message (début de la balise).
        <Alert
          // Clé unique : son identifiant.
          key={t.id}
          // Gravité selon le ton, « info » par défaut.
          severity={SEVERITY[t.tone] || 'info'}
          // Style plein.
          variant="filled"
          // Bouton de fermeture : retire ce message.
          onClose={() => onDismiss(t.id)}
          // Texte du bouton de fermeture pour les lecteurs d'écran.
          closeText="Fermer le message"
          // Reçoit les clics et coupe les mots trop longs ; sans ombre, comme les autres panneaux.
          className="pointer-events-auto [overflow-wrap:anywhere]"
        // Fin de la balise ouvrante.
        >
          {/* Le texte du message. */}
          {t.text}
        {/* Fin du message. */}
        </Alert>
      // Fin des messages.
      ))}
    {/* Fin de la pile. */}
    </div>
  // Fin du rendu.
  );
// Fin de Toasts.
}
