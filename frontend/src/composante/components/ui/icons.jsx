/**
 * Icônes de l'interface : toutes celles qu'affiche Gobai Space, nommées en un seul endroit.
 *
 * Ce sont les icônes Material de MUI (https://mui.com/material-ui/material-icons/), prises dans
 * `@mui/icons-material`. Chaque icône est importée par son propre chemin, ce qui évite de charger les deux
 * mille autres : Vite ne met dans le paquet final que celles qui servent.
 *
 * Pourquoi ce fichier plutôt que des imports éparpillés : l'interface employait des emoji et des caractères
 * géométriques (🔒, ⌖, ◐, ♥…), dont le dessin change d'un système à l'autre et qui ne suivent ni la couleur ni
 * la taille du thème. Les icônes MUI sont des vecteurs : elles héritent de `color` et de `fontSize`, donc un
 * bouton enfoncé, un bouton coupé et un bouton survolé se dessinent tout seuls. Passer par ce fichier donne un
 * nom français stable à chaque usage et permet de changer une icône partout d'une seule ligne.
 */
// Recherche d'une ville ou d'un astre.
export { default as SearchIcon } from '@mui/icons-material/Search';
// Ma position, suivie en direct.
export { default as MyLocationIcon } from '@mui/icons-material/MyLocation';
// Vue d'ensemble du système solaire.
export { default as PublicIcon } from '@mui/icons-material/Public';
// Explorer : l'espace « Explorer » de la navigation du téléphone.
export { default as ExploreIcon } from '@mui/icons-material/Explore';
// Pilotage orbital : l'espace « Orbite ».
export { default as NavigationIcon } from '@mui/icons-material/Navigation';
// Ombre : moitié de disque éclairée, comme un astre à moitié dans la nuit.
export { default as ShadowIcon } from '@mui/icons-material/Brightness4';
// Rotation automatique de la caméra.
export { default as AutorenewIcon } from '@mui/icons-material/Autorenew';
// Vue 3/4 : la caméra s'incline en approchant du sol.
export { default as CameraIcon } from '@mui/icons-material/Videocam';
// Orientation verrouillée, et relâchée.
export { default as LockIcon } from '@mui/icons-material/Lock';
export { default as LockOpenIcon } from '@mui/icons-material/LockOpen';
// Son des clics, activé et coupé.
export { default as VolumeUpIcon } from '@mui/icons-material/VolumeUp';
export { default as VolumeOffIcon } from '@mui/icons-material/VolumeOff';
// Langue de l'interface.
export { default as TranslateIcon } from '@mui/icons-material/Translate';
// Contribuer : poser un relevé LiDAR sur le globe.
export { default as AddLocationIcon } from '@mui/icons-material/AddLocation';
// Boutique des exports.
export { default as StoreIcon } from '@mui/icons-material/ShoppingCart';
// Sources et mentions d'origine.
export { default as CopyrightIcon } from '@mui/icons-material/Copyright';
// Aide et raccourcis clavier.
export { default as HelpIcon } from '@mui/icons-material/Help';
// Partager la vue.
export { default as ShareIcon } from '@mui/icons-material/Share';
// Galerie d'images.
export { default as GalleryIcon } from '@mui/icons-material/Collections';
// Moniteur de performance.
export { default as SpeedIcon } from '@mui/icons-material/Speed';
// Faire un don.
export { default as FavoriteIcon } from '@mui/icons-material/Favorite';
// Paramètres.
export { default as SettingsIcon } from '@mui/icons-material/Settings';
// Données et sources : l'espace « Données ».
export { default as StorageIcon } from '@mui/icons-material/Storage';
// Menu : l'espace « Menu » de la navigation du téléphone.
export { default as MenuIcon } from '@mui/icons-material/Menu';
// Pilotage au téléphone : zoom seul, puis zoom et déplacement.
export { default as ArrowUpwardIcon } from '@mui/icons-material/ArrowUpward';
export { default as FlightTakeoffIcon } from '@mui/icons-material/FlightTakeoff';
// Les quatre coins du cadre GPS.
export { default as NorthWestIcon } from '@mui/icons-material/NorthWest';
export { default as NorthEastIcon } from '@mui/icons-material/NorthEast';
export { default as SouthWestIcon } from '@mui/icons-material/SouthWest';
export { default as SouthEastIcon } from '@mui/icons-material/SouthEast';
// Étape franchie, et fermeture.
export { default as CheckIcon } from '@mui/icons-material/Check';
export { default as CloseIcon } from '@mui/icons-material/Close';
// Lecture d'une vidéo de la galerie, et arrêt d'un téléchargement.
export { default as PlayArrowIcon } from '@mui/icons-material/PlayArrow';
export { default as StopIcon } from '@mui/icons-material/Stop';
// Téléchargement, et ouverture dans un nouvel onglet.
export { default as DownloadIcon } from '@mui/icons-material/Download';
export { default as OpenInNewIcon } from '@mui/icons-material/OpenInNew';
// Ville d'un résultat de recherche.
export { default as LocationCityIcon } from '@mui/icons-material/LocationCity';
// Lieu enregistré, et accueil.
export { default as PlaceIcon } from '@mui/icons-material/Place';
export { default as HomeIcon } from '@mui/icons-material/Home';
// Votes d'un placement : juste, et faux.
export { default as VoteUpIcon } from '@mui/icons-material/ArrowDropUp';
export { default as VoteDownIcon } from '@mui/icons-material/ArrowDropDown';
// Plus et moins du pavé de zoom.
export { default as AddIcon } from '@mui/icons-material/Add';
export { default as RemoveIcon } from '@mui/icons-material/Remove';
// Replier et déplier un panneau.
export { default as ExpandLessIcon } from '@mui/icons-material/ExpandLess';
export { default as ExpandMoreIcon } from '@mui/icons-material/ExpandMore';
// Poignée de déplacement d'un panneau (en-tête des fenêtres déplaçables).
export { default as DragIndicatorIcon } from '@mui/icons-material/DragIndicator';
// Envoi d'une question à l'assistant.
export { default as SendIcon } from '@mui/icons-material/ArrowUpward';
