// Actions de la barre d’outils. Sur petit écran, elles sont toutes dans le menu du bouton ⋯ (« Plus »), en haut à
// droite, séparées par bloc ; `primary` repère les actions principales.
// `group` = bloc de la barre ordinateur, séparés par un trait vertical.
/** Boutons masqués de la barre : voir hiddenActions. Les anciennes composantes masquées (Tuile 3D, Modéliser, Lunes) ont été supprimées. */
/**
 * Icônes : des composants Material de MUI, nommés dans ui/icons. Elles héritent de la couleur et de la taille du
 * bouton, donc un bouton enfoncé, coupé ou survolé se dessine tout seul — ce que les emoji ne faisaient pas.
 * Icône du bouton « Mistral » : le composant Material AutoAwesomeIcon. Une icône peut donc être un
 * composant, un objet { img } ou un caractère ; les boutons la dessinent avec `iconNode`.
 */
// Importe l'ensemble des boutons masqués, gardé dans son propre module (sans import, pour la fenêtre « Node »).
import { HIDDEN } from './hiddenActions.js';
// Importe les icônes employées par la barre.
import {
  // Recherche, vue d'ensemble, ombre, rotation, vue 3/4 et verrouillage.
  SearchIcon, PublicIcon, ShadowIcon, AutorenewIcon, CameraIcon, LockIcon, LockOpenIcon,
  // Son, langue, contribution, sources, aide, partage, galerie, performances, don et paramètres.
  VolumeUpIcon, VolumeOffIcon, TranslateIcon, AddLocationIcon, CopyrightIcon, HelpIcon, ShareIcon,
  GalleryIcon, SpeedIcon, StoreIcon, FavoriteIcon, SettingsIcon,
  // Arborescence des astres, plateau tournant et icône de l'assistant.
  AccountTreeIcon, ThreeSixtyIcon, AutoAwesomeIcon,
// Fin de la liste ; module des icônes.
} from '../ui/icons.jsx';
// Importe EmcIcon, la formule « E = mc² » composée pour le bouton de l'affichage relativiste.
import { EmcIcon } from './EmcIcon.jsx';
// Icône du bouton « Mistral » : le composant Material de l'assistant.
const MISTRAL_ICON = AutoAwesomeIcon;

// Déclare et exporte toolbarActions (début de la liste des paramètres).
export function toolbarActions({
  // Le verrouillage et son rappel.
  lock, onToggleLock,
  // Les états affichés par les boutons.
  auto, tilt, sound,
  // Tous les autres rappels et libellés.
  onSearch, onAssistant, assistantOpen, night, onToggleDayNight, onReset, onToggleAuto, onToggleTilt, onToggleSound, onLanguage, languageLabel, onSources, onDonate, onHelp, onStore, onGallery, onSettings, onPlateau, onShare, onTogglePerformanceMonitor, performanceMonitorVisible, onContribute,
  // Affichage Schwarzschild : son état et son rappel (bouton posé à côté d'Ombre).
  schwarzschild, onToggleSchwarzschild,
  // L'arborescence des astres : son rappel et son état.
  onNavigator, navigatorOpen,
// Fin de la liste des paramètres.
}) {
  // Renvoie la liste des actions (début du tableau).
  return [
    // Rechercher : action principale du groupe « explore », avec son raccourci Ctrl K.
    { id: 'search', group: 'explore', icon: SearchIcon, label: 'Rechercher', primary: true, onClick: onSearch, title: 'Rechercher une ville ou un astre (Ctrl K)', kbd: 'Ctrl K' },
    // « Ma position » n'est plus ici : elle est posée sous la navball, en icône (hud/NavballPilote).
    // Assistant : petit menu déroulant qui s'ouvre au-dessus du bouton (l'événement du clic donne son point d'ancrage).
    // Mistral : l'assistant, enfoncé quand son menu est ouvert.
    { id: 'assistant', group: 'explore', icon: MISTRAL_ICON, label: 'Claude', primary: true, pressed: assistantOpen, onClick: onAssistant, title: 'Claude : poser une question sur le système solaire' },
    // Le bouton Informations n'existe plus : le menu des cartes est rendu dans le panneau des caractéristiques,
    // qui s'ouvre d'un appui sur son en-tête (et par la touche L).
    // Vue globale : retour à la vue d'ensemble.
    { id: 'reset', group: 'explore', icon: PublicIcon, label: 'Vue globale', short: 'Global', primary: true, onClick: onReset, title: 'Retour à la vue d’ensemble (0 du pavé numérique)' },
    // Astres : ouvre ou ferme l'arborescence des astres (bande du dock sur téléphone, rail sur ordinateur), qui
    // n'avait de bouton que dans le panneau de l'assistant sur ordinateur, et aucun sur téléphone.
    onNavigator && { id: 'navigator', group: 'explore', icon: AccountTreeIcon, label: 'Astres', iconOnly: true, pressed: navigatorOpen, onClick: onNavigator, title: 'Arborescence des astres : planètes et satellites' },
    // Plateau tournant : n'était ouvert que par la touche T, sans bouton (inaccessible sur téléphone).
    onPlateau && { id: 'plateau', group: 'explore', icon: ThreeSixtyIcon, label: 'Plateau tournant', short: 'Plateau', iconOnly: true, onClick: onPlateau, title: 'Plateau tournant : l’astre visé en tournant (T)' },
    // Ombre : bouton à bascule comme « Vue 3/4 ». Enfoncé = face des astres opposée au Soleil dans l'ombre et interface
    // bleu nuit ; relâché = astres entièrement éclairés et interface gris doux.
    // Ombre (si le rappel existe) : bascule du groupe « camera », infobulle selon l'état.
    onToggleDayNight && { id: 'daynight', group: 'camera', icon: ShadowIcon, label: 'Ombre', iconOnly: true, pressed: night, onClick: onToggleDayNight, title: night ? 'Ombre activée : face des astres opposée au Soleil dans l’ombre' : 'Ombre désactivée : astres entièrement éclairés' },
    // E = mc² : bascule du groupe « camera », juste après Ombre. Affiche les orbites selon la métrique de
    // Schwarzschild (rosette précessée et grille filaire de courbure), fondu lent depuis les orbites de Kepler.
    // L'icône est le composant EmcIcon (formule composée) ; `wide` : sur ordinateur, une pastille assez large pour la
    // formule entière, au lieu du carré de 32 px où elle débordait sur les boutons voisins.
    onToggleSchwarzschild && { id: 'schwarzschild', group: 'camera', icon: EmcIcon, label: 'E = mc²', short: 'E = mc²', iconOnly: true, wide: true, pressed: Boolean(schwarzschild), onClick: onToggleSchwarzschild, title: schwarzschild ? 'E = mc² activé : orbites de Schwarzschild (rosette), grille de courbure et périvolumes des astres et des systèmes' : 'E = mc² : orbites de Schwarzschild, grille de courbure et périvolumes (fondu depuis Kepler)' },
    // Rotation automatique : bascule.
    { id: 'auto', group: 'camera', icon: AutorenewIcon, label: 'Rotation', iconOnly: true, pressed: auto, onClick: onToggleAuto, title: 'Rotation automatique' },
    // Vue 3/4 automatique : bascule.
    { id: 'tilt', group: 'camera', icon: CameraIcon, label: 'Vue 3/4', iconOnly: true, pressed: tilt, onClick: onToggleTilt, title: 'Vue 3/4 automatique en approchant du sol' },
    // Verrouillage : la vue se tourne vers l'astre le plus proche de l'astre focus (nommé sur le bouton) ; le zoom
    // avance toujours vers l'astre focus. Relâché : la caméra retrouve sa position d'origine. Toujours cliquable,
    // que cet astre soit ou non dans le champ de la caméra.
    // Verrouillage, seulement s'il y a un astre à verrouiller (début de l'objet).
    lock && {
      // Cadenas fermé ou ouvert selon l'état. Icône seule sur ordinateur : le cadenas dit tout, et le nom de
      // l'astre reste dans l'infobulle et dans le nom lu par les lecteurs d'écran, qui tiennent le libellé.
      // Sur la feuille du téléphone, la tuile garde le nom de l'astre (`short`) : les tuiles ont toutes un texte.
      id: 'lock', group: 'camera', icon: lock.on ? LockIcon : LockOpenIcon, label: `Verrouillage ${lock.name}`, short: lock.name, iconOnly: true,
      // Enfoncé si verrouillé ; le clic demande l'état inverse.
      pressed: lock.on, onClick: () => onToggleLock(!lock.on),
      // Infobulle selon l'état (début).
      title: lock.on
        // Verrouillé : rappelle l'astre visé, l'astre focus et le moyen de revenir.
        ? `Vue verrouillée sur ${lock.name} ; le zoom avance toujours vers ${lock.focusName} (astre focus). Cliquer pour revenir à la position d’origine.`
        // Déverrouillé : propose de verrouiller la vue sur l'astre.
        : `Verrouiller la vue sur ${lock.name}, l’astre le plus proche de ${lock.focusName} (astre focus)`,
    // Fin de l'objet.
    },
    // Son (si le rappel existe) : icône seule du groupe « help », enfoncée si le son est actif, sans son de clic.
    onToggleSound && { id: 'sound', group: 'help', icon: sound ? VolumeUpIcon : VolumeOffIcon, label: sound ? 'Son activé' : 'Son coupé', short: 'Son', iconOnly: true, pressed: sound, noSound: true, onClick: onToggleSound, title: sound ? 'Couper le son des clics' : 'Activer le son des clics' },
    // Langue (si le rappel existe) : icône seule, libellé avec la langue en cours si elle est connue.
    onLanguage && { id: 'lang', group: 'help', icon: TranslateIcon, label: languageLabel ? `Langue : ${languageLabel}` : 'Langue', short: 'Langue', iconOnly: true, onClick: onLanguage, title: 'Langue de l’interface' },
    // Contribuer : placer une dalle LiDAR sur le globe et voter sur le placement des autres.
    onContribute && { id: 'contribute', group: 'data', icon: AddLocationIcon, label: 'Contribuer', onClick: onContribute, title: 'Contribuer : placer un relevé LiDAR sur le globe et voter sur les placements' },
    // Aide (si le rappel existe) : icône seule, raccourcis clavier.
    onHelp && { id: 'help', group: 'help', icon: HelpIcon, label: 'Aide', iconOnly: true, onClick: onHelp, title: 'Raccourcis clavier (?)' },
    // Partager : feuille de partage du téléphone, ou copie du lien de la vue sur ordinateur.
    // Partager (si le rappel existe) : icône seule.
    onShare && { id: 'share', group: 'help', icon: ShareIcon, label: 'Partager', iconOnly: true, onClick: onShare, title: 'Partager cette vue (lien de l’astre affiché)' },
    // Boutique des exports : modèle 3D d'un astre, ses tuiles, son orbite (paiement Stripe côté serveur).
    onStore && { id: 'store', group: 'data', icon: StoreIcon, label: 'Exports', onClick: onStore, title: 'Boutique : exporter le modèle 3D d’un astre, ses tuiles ou son orbite' },
    // Données (si le rappel existe) : icône seule.
    onGallery && { id: 'gallery', group: 'help', icon: GalleryIcon, label: 'Données', iconOnly: true, onClick: onGallery, title: 'Données : documentation (PDF) et galerie d\'images (P)' },
    // Moniteur de performance : activation/désactivation depuis la barre sur ordinateur.
    onTogglePerformanceMonitor && { id: 'performance', group: 'help', icon: SpeedIcon, label: 'Performances', short: 'Perf', iconOnly: true, pressed: performanceMonitorVisible, onClick: onTogglePerformanceMonitor, title: performanceMonitorVisible ? 'Masquer le moniteur de performance' : 'Afficher le moniteur de performance' },
    // Faire un don : accessible directement depuis la barre d'outils sur ordinateur.
    onDonate && { id: 'donate', group: 'help', icon: FavoriteIcon, label: 'Faire un don', onClick: onDonate, title: 'Soutenir Gobai Space' },
    // Anthropic Node Open Source (si le rappel existe) : icône seule, posée juste avant Paramètres — les deux
    // fenêtres vont ensemble (ce dont le site est fait, et comment on le règle).
    onSources && { id: 'sources', group: 'help', icon: CopyrightIcon, label: 'Anthropic Node Open Source', short: 'Node', iconOnly: true, onClick: onSources, title: 'Anthropic Node Open Source (S)' },
    // Paramètres (si le rappel existe) : icône seule.
    onSettings && { id: 'settings', group: 'help', icon: SettingsIcon, label: 'Paramètres', iconOnly: true, onClick: onSettings, title: 'Paramètres : repères du système solaire, étoiles, aller à un astre' },
  // Fin du tableau : retire les entrées absentes et les boutons masqués.
  ].filter((a) => a && !HIDDEN.has(a.id));
// Fin de toolbarActions.
}
