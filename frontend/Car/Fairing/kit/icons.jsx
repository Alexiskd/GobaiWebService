// Icônes de l'interface : le jeu Lucide (traits fins), servi par react-icons. Chaque icône est un simple <svg>
// de 1em de côté : elle prend la taille et la couleur du texte qui la porte, sans feuille de style calculée au rendu
// (les icônes MUI passaient par Emotion). Les noms d'export sont ceux qu'emploie le reste de l'interface.

// Importe cx, qui réunit les classes.
import { cx } from './cx.js';
// Importe les dessins Lucide utilisés.
import {
  LuArrowDownLeft, LuArrowDownRight, LuArrowLeft, LuArrowUp, LuArrowUpDown, LuArrowUpLeft, LuArrowUpRight, LuBrain,
  LuBuilding2, LuCheck, LuChevronDown, LuChevronUp, LuCircleAlert, LuCircleCheck, LuCompass, LuCopyright,
  LuDownload, LuEclipse, LuExternalLink, LuFileText, LuFlaskConical, LuGauge, LuGlobe, LuHeart, LuGripVertical,
  LuHouse, LuImages, LuInfo, LuKeyRound, LuLocateFixed, LuLock, LuLockOpen, LuLogOut,
  LuMapPin, LuMapPinPlus, LuMinus, LuNavigation, LuNetwork, LuPause, LuPlaneTakeoff, LuPlay,
  LuPlus, LuRefreshCw, LuRoute, LuSearch, LuSparkles, LuSquare, LuTriangleAlert, LuVideo,
  LuX,
} from 'react-icons/lu';

// Classe de taille de chaque valeur de `fontSize` (sans valeur : 1,5 rem, la taille d'une icône seule).
const SIZE = { small: 'g-icon-sm', large: 'g-icon-lg', inherit: 'g-icon-inherit' };
// Classe de couleur de chaque valeur de `color`.
const COLOR = { primary: 'text-primary', secondary: 'text-secondary', error: 'text-error', success: 'text-success', warning: 'text-warning', info: 'text-info', disabled: 'text-faint', action: 'text-soft' };

/**
 * Habille un dessin Lucide : classe `g-icon` (1em), taille (`fontSize`), couleur (`color`), classes et style reçus.
 * L'icône est décorative par défaut (aria-hidden) ; le bouton qui la porte donne son nom aux lecteurs d'écran.
 */
// Déclare icon : reçoit le dessin et renvoie le composant d'icône.
const icon = (Draw) => function Icon({ fontSize, color, className, ...rest }) {
  // Rend le dessin habillé.
  return <Draw aria-hidden="true" focusable="false" {...rest} className={cx('g-icon', SIZE[fontSize], COLOR[color], className)} />;
// Fin de icon.
};

// Recherche.
export const SearchIcon = icon(LuSearch);
// Ma position.
export const MyLocationIcon = icon(LuLocateFixed);
// Astre, vue d'ensemble.
export const PublicIcon = icon(LuGlobe);
// Explorer et navigation.
export const ExploreIcon = icon(LuCompass);
export const NavigationIcon = icon(LuNavigation);
// Ombre : face des astres opposée au Soleil.
export const ShadowIcon = icon(LuEclipse);
// Rotation automatique.
export const AutorenewIcon = icon(LuRefreshCw);
// Vue 3/4 : la caméra s'incline en approchant du sol.
export const CameraIcon = icon(LuVideo);
// Orientation verrouillée, et relâchée.
export const LockIcon = icon(LuLock);
export const LockOpenIcon = icon(LuLockOpen);
// Contribuer : poser un relevé LiDAR sur le globe.
export const AddLocationIcon = icon(LuMapPinPlus);
// Sources et mentions d'origine.
export const CopyrightIcon = icon(LuCopyright);
// Galerie d'images.
export const GalleryIcon = icon(LuImages);
// Moniteur de performance.
export const SpeedIcon = icon(LuGauge);
// Don : un cœur.
export const FavoriteIcon = icon(LuHeart);
// Arborescence des astres : un arbre.
export const AccountTreeIcon = icon(LuNetwork);
// Pilotage au téléphone : zoom seul, puis zoom et déplacement.
export const ArrowUpwardIcon = icon(LuArrowUp);
export const FlightTakeoffIcon = icon(LuPlaneTakeoff);
// Les quatre coins du cadre GPS.
export const NorthWestIcon = icon(LuArrowUpLeft);
export const NorthEastIcon = icon(LuArrowUpRight);
export const SouthWestIcon = icon(LuArrowDownLeft);
export const SouthEastIcon = icon(LuArrowDownRight);
// Assistant.
export const AutoAwesomeIcon = icon(LuSparkles);
// Validation et fermeture.
export const CheckIcon = icon(LuCheck);
export const CloseIcon = icon(LuX);
// Lecture, pause et arrêt.
export const PlayArrowIcon = icon(LuPlay);
export const PauseIcon = icon(LuPause);
export const StopIcon = icon(LuSquare);
// Téléchargement et lien externe.
export const DownloadIcon = icon(LuDownload);
export const OpenInNewIcon = icon(LuExternalLink);
// Déconnexion, clé d'API et retour.
export const LogoutIcon = icon(LuLogOut);
export const KeyIcon = icon(LuKeyRound);
export const ArrowBackIcon = icon(LuArrowLeft);
// Fenêtre Données : documents, flux cognitif, théorie quantique.
export const DescriptionIcon = icon(LuFileText);
export const PsychologyIcon = icon(LuBrain);
export const ScienceIcon = icon(LuFlaskConical);
// Résultats de recherche : ville, lieu, adresse.
export const LocationCityIcon = icon(LuBuilding2);
export const PlaceIcon = icon(LuMapPin);
export const HomeIcon = icon(LuHouse);
// Votes, plus et moins, dépli et repli.
export const VoteUpIcon = icon(LuChevronUp);
export const VoteDownIcon = icon(LuChevronDown);
export const AddIcon = icon(LuPlus);
export const RemoveIcon = icon(LuMinus);
export const ExpandLessIcon = icon(LuChevronUp);
export const ExpandMoreIcon = icon(LuChevronDown);
// Poignée de déplacement d'un panneau.
export const DragIndicatorIcon = icon(LuGripVertical);
// Envoi d'un message.
export const SendIcon = icon(LuArrowUp);
// Trajet, informations, inversion de deux points.
export const RouteIcon = icon(LuRoute);
export const InfoIcon = icon(LuInfo);
export const SwapVertIcon = icon(LuArrowUpDown);
// Avertissements du kit : information, réussite, attention, erreur.
export const AlertInfoIcon = icon(LuInfo);
export const AlertSuccessIcon = icon(LuCircleCheck);
export const AlertWarningIcon = icon(LuTriangleAlert);
export const AlertErrorIcon = icon(LuCircleAlert);
