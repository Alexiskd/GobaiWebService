// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';
// Importe la barre du petit écran.
import { CompactToolbar } from './CompactToolbar.jsx';
// Importe la barre de l'ordinateur.
import { DesktopToolbar } from './DesktopToolbar.jsx';
// Importe toolbarActions, qui construit la liste des actions.
import { toolbarActions } from './toolbarActions.jsx';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/Engine/AstreSolideEngine/hudStore';
// Importe la session de l'assistant : le bouton porte le logo du fournisseur connecté.
import { useAssistantSession } from '@/Fairing/hooks/useAssistantSession';

// Actions de l'interface : barre d’outils du bas sur grand écran, navigation en quatre espaces sur petit écran.
// « Ma position » est passée sous la navball et le bouton Informations dans le panneau des caractéristiques : la barre
// ne porte plus ni l'un ni l'autre.
// Déclare et exporte le composant Toolbar (début de la liste des propriétés).
export function Toolbar({
  // Le HUD et les états rotation et vue 3/4.
  hud, auto, tilt,
  // Les rappels de recherche, d'assistant, d'ombre, de rotation, de vue 3/4 et de verrouillage, avec leurs états.
  onSearch, onAssistant, assistantOpen, night, onToggleDayNight, onToggleAuto, onToggleTilt, onToggleLock,
  // Affichage Schwarzschild : son état et son rappel (à côté du bouton Ombre).
  schwarzschild, onToggleSchwarzschild,
  // Les sources, la galerie et les paramètres.
  onSources, onGallery, onSettings, onContribute,
  // Fenêtre Trajet : son rappel et son état.
  onTrip, tripOpen,
  // Informations de l'astre focus : rappel et état.
  onInfos, infosOpen,
  // L'arborescence des astres (rappel et état).
  onNavigator, navigatorOpen,
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
  // Fournisseur de l'assistant connecté (claude, mistral), null si personne n'est connecté.
  const assistantProvider = useAssistantSession()?.provider ?? null;
  // Construit la liste des actions (début de l'appel).
  const actions = toolbarActions({
    // Le verrouillage et son rappel.
    lock, onToggleLock,
    // Les états affichés par les boutons.
    auto, tilt,
    // Tous les autres rappels et libellés.
    // Le don est aussi dans la feuille « Menu » du téléphone (en plus du cœur de la zone du titre). Le plateau
    // tournant et le moniteur de performance ne sont plus dans la barre : le premier vit dans le panneau
    // d'informations, le second a été retiré.
    onSearch, onAssistant, assistantOpen, assistantProvider, night, onToggleDayNight, onToggleAuto, onToggleTilt, onSources, onGallery, onSettings, onContribute, onTrip, tripOpen, onInfos, infosOpen,
    // Affichage Schwarzschild : l'état et le rappel passés à la liste.
    schwarzschild, onToggleSchwarzschild,
    // L'arborescence des astres, et le moniteur de performance hors téléphone.
    onNavigator, navigatorOpen,
  // Fin de l'appel.
  });
  // Petit écran : la barre compacte ; sinon : la barre de l'ordinateur.
  return compact ? <CompactToolbar actions={actions} /> : <DesktopToolbar hud={hud} actions={actions} />;
// Fin de Toolbar.
}
