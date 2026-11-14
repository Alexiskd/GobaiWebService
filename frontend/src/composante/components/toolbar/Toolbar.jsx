// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe la barre du petit écran.
import { CompactToolbar } from './CompactToolbar';
// Importe la barre de l'ordinateur.
import { DesktopToolbar } from './DesktopToolbar';
// Importe toolbarActions, qui construit la liste des actions.
import { toolbarActions } from './toolbarActions';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';

// Actions de l'interface : barre d’outils du bas sur grand écran, navigation en quatre espaces sur petit écran.
// « Ma position » est passée sous la navball et le bouton Informations dans le panneau des caractéristiques : la barre
// ne porte plus ni l'un ni l'autre.
// Déclare et exporte le composant Toolbar (début de la liste des propriétés).
export function Toolbar({
  // Le HUD et les états rotation et vue 3/4.
  hud, auto, tilt,
  // Les rappels de recherche, d'assistant, d'ombre, de rotation, de vue 3/4, de verrouillage, de vue globale et d'aide, avec leurs états.
  onSearch, onAssistant, assistantOpen, night, onToggleDayNight, onToggleAuto, onToggleTilt, onToggleLock, onReset, onHelp,
  // Le son (actif par défaut), la langue, les sources, la galerie, les paramètres, le plateau et le partage.
  sound = true, onToggleSound, onLanguage, languageLabel, onSources, onDonate, onGallery, onSettings, onPlateau, onShare, onContribute, onStore,
// Fin de la liste des propriétés.
}) {
  // Lit le mode compact de l'écran.
  const { compact } = useViewport();
  // Verrouillage de la vue : astre le plus proche de l'astre focus (publié par le moteur).
  // Nom de l'astre proposé au verrouillage, null s'il n'y en a pas.
  const lockName = useHud(hud, (s) => s.viewLock?.name ?? null);
  // Nom de l'astre focus, null s'il n'y en a pas.
  const lockFocus = useHud(hud, (s) => s.viewLock?.focusName ?? null);
  // Verrouillage actif ou non.
  const lockOn = useHud(hud, (s) => Boolean(s.viewLock?.on));
  // Objet du verrouillage, seulement s'il y a un astre à verrouiller et un rappel pour le faire.
  const lock = lockName && onToggleLock ? { name: lockName, focusName: lockFocus, on: lockOn } : null;
  // Construit la liste des actions (début de l'appel).
  const actions = toolbarActions({
    // Le verrouillage et son rappel.
    lock, onToggleLock,
    // Les états affichés par les boutons.
    auto, tilt, sound,
    // Tous les autres rappels et libellés.
    onSearch, onAssistant, assistantOpen, night, onToggleDayNight, onReset, onToggleAuto, onToggleTilt, onToggleSound, onLanguage, languageLabel, onSources, onDonate: compact ? null : onDonate, onHelp, onGallery, onSettings, onPlateau, onShare, onContribute, onStore,
  // Fin de l'appel.
  });
  // Petit écran : la barre compacte ; sinon : la barre de l'ordinateur.
  return compact ? <CompactToolbar hud={hud} actions={actions} /> : <DesktopToolbar hud={hud} actions={actions} />;
// Fin de Toolbar.
}
