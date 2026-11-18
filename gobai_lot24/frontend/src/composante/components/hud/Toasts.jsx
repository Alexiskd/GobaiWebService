// Importe de MUI Alert (message d'alerte) et Stack (pile).
import { Alert, Stack } from '@mui/material';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';
// Importe la limite basse de la zone du titre du téléphone.
import { HUD_TOP } from '@/composante/theme/layout';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';

// Correspondance entre le ton d'un message et la gravité MUI.
const SEVERITY = { warn: 'warning', error: 'error', info: 'info', ok: 'success' };

/** Messages éphémères, empilés en haut au centre (au-dessus des panneaux et des dialogues). */
// Déclare et exporte le composant Toasts : reçoit les messages et le rappel de fermeture.
export function Toasts({ toasts, onDismiss }) {
  // Mode compact (téléphone).
  const { compact } = useViewport();
  // Début du rendu.
  return (
    // Pile des messages (début de la balise).
    <Stack
      // Espacement entre les messages.
      spacing={1}
      // Rôle d'état pour les lecteurs d'écran.
      role="status"
      // Changements annoncés sans interrompre la lecture en cours.
      aria-live="polite"
      // Début du style.
      sx={{
        // Fixée, au niveau des messages, centrée horizontalement.
        position: 'fixed', zIndex: (t) => t.zIndex.snackbar, left: '50%', transform: 'translateX(-50%)',
        // Position du haut : sur téléphone, 8 px sous la zone du titre (jamais sur le bandeau ni ses boutons) ; sur
        // ordinateur, sous le bandeau GPS et la marge de sécurité, plus 14 px.
        top: compact ? `calc(${HUD_TOP} + 8px)` : `calc(var(--gps-top, 0px) + ${safe('top')} + 14px)`,
        // Largeur bornée à l'écran (ces deux réglages étaient restés en commentaire à la fin de la ligne précédente :
        // la pile n'avait pas de largeur maximale et captait les gestes posés sur la scène).
        width: 'min(440px, calc(100vw - 28px))',
        // Les gestes passent à travers la pile (chaque message reste cliquable pour sa croix).
        pointerEvents: 'none', '& > *': { pointerEvents: 'auto' },
      // Fin du style.
      }}
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
          sx={{ pointerEvents: 'auto', overflowWrap: 'anywhere' }}
        // Fin de la balise ouvrante.
        >
          {/* Le texte du message. */}
          {t.text}
        {/* Fin du message. */}
        </Alert>
      // Fin des messages.
      ))}
    {/* Fin de la pile. */}
    </Stack>
  // Fin du rendu.
  );
// Fin de Toasts.
}
