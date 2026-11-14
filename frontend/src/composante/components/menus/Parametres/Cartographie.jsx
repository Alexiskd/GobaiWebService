// Importe de MUI Box, Button, ToggleButton et ToggleButtonGroup.
import { Box, Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group';
// Importe Switch, l'interrupteur.
import { Switch } from '../../ui/Switch';
// Importe MenuDeroulant, le menu déroulant générique.
import { MenuDeroulant } from '../../ui/MenuDeroulant';

// Libellés courts des trois modèles LiDAR HD (identifiants des calques de l'API, voir backend lidar-hd.ts).
// Libellé court de chaque modèle LiDAR HD : surface, sol nu, hauteurs.
const LIDAR_SHORT = { 'lidar-hd-mns': 'Surface', 'lidar-hd-mnt': 'Sol nu', 'lidar-hd-mnh': 'Hauteurs' };
/** Altitude d'arrivée au-dessus d'une dalle de points 3D (m) : la dalle de 1 km tient dans l'écran, en vue 3/4. */
// Altitude d'arrivée au-dessus d'une dalle de points : 900 m.
const POINTS_ALTITUDE_M = 900;
// millions : écrit un nombre de points en millions, avec une décimale au plus.
const millions = (n) => `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} millions de points`;

/**
 * Cartographie de la Terre, à plat : ce qui se lit sur la carte (noms des villes et des pays, frontières et
 * littoraux, rues et routes d'OpenStreetMap, volcans en éruption en direct). Le relief a son propre groupe, CartographieRelief ci-dessous.
 */
// Déclare et exporte le composant Cartographie (début de la liste des propriétés).
export function Cartographie({
  // Les noms des villes, les noms des pays et les contours, avec leurs rappels et leurs textes d'aide.
  cityNames, onCityNames, cityNamesHint, cityNamesDisabled, countryNames, onCountryNames, outlines, onOutlines, outlinesHint,
  // Les rues (éteintes par défaut) et leur rappel.
  streets = false, onStreets,
  // Les volcans en éruption, leur rappel et leur texte d'aide.
  volcanoes = false, onVolcanoes, volcanoesHint,
// Fin de la liste des propriétés.
}) {
  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Cartographie">
      {/* Interrupteur des noms des villes, désactivé s'ils sont déjà dans le fond. */}
      <Switch checked={cityNames} disabled={cityNamesDisabled} onChange={onCityNames} label="Noms des villes" hint={cityNamesHint} />
      {/* Interrupteur des noms des pays. */}
      <Switch checked={countryNames} onChange={onCountryNames} label="Noms des pays" hint="Dans leur alphabet local, en zoomant" />
      {/* Interrupteur des frontières et des littoraux. */}
      <Switch checked={outlines} onChange={onOutlines} label="Frontières et littoraux" hint={outlinesHint} />
      {/* Si le réglage des rues est fourni (début). */}
      {onStreets && (
        // Interrupteur des rues et des routes.
        <Switch checked={streets} onChange={onStreets} label="Rues et routes" hint="Grands axes de loin, rues et noms en zoomant" />
      // Fin du cas.
      )}
      {/* Si le réglage des volcans est fourni (début). */}
      {onVolcanoes && (
        // Interrupteur des volcans en éruption.
        <Switch checked={volcanoes} onChange={onVolcanoes} label="Volcans en éruption" hint={volcanoesHint} />
      // Fin du cas.
      )}
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de Cartographie.
}

/**
 * Cartographie en relief de la Terre : tout ce qui donne du volume à la carte. Relief 3D du globe (montagnes, fonds
 * marins), LiDAR HD de l'IGN sur la France (ombrage du modèle de surface, du sol nu ou des hauteurs), avec un menu
 * des villes où s'y rendre en direct, et dalles LiDAR en vrais points 3D, avec un bouton pour s'y rendre.
 */
// Déclare et exporte le composant CartographieRelief (début de la liste des propriétés).
export function CartographieRelief({
  // Le relief et son rappel.
  relief, onRelief,
  // Le calque LiDAR HD choisi, les calques proposés et le rappel de choix.
  lidarId = null, lidarLayers = [], onLidar,
  // Les villes de France du LiDAR HD et l'altitude d'arrivée au-dessus d'une ville.
  lidarCities = [], lidarCityAltitudeM = 2000,
  // Les points LiDAR, leurs lieux, leur couleur, leurs rappels, l'aller à un lieu et le rappel de fin.
  lidarPoints = false, lidarPlaces = [], onLidarPoints, lidarColor = 'photo', onLidarColor, onGoPlace, onDone,
// Fin de la liste des propriétés.
}) {
  // Vrai si un calque LiDAR HD est choisi.
  const lidarOn = Boolean(lidarId);
  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Cartographie en relief">
      {/* Interrupteur du relief 3D. */}
      <Switch checked={relief} onChange={onRelief} label="Relief 3D" hint="Montagnes et fonds marins en volume ; décoché : carte à plat, plus rapide" />
      {/* Si des calques LiDAR HD sont proposés (début). */}
      {lidarLayers.length > 0 && (
        // Fragment du bloc.
        <>
          {/* Interrupteur du LiDAR HD (début de la balise). */}
          <Switch
            // Coché si un calque est choisi.
            checked={lidarOn}
            // Activé : choisit le premier calque ; coupé : aucun.
            onChange={(on) => onLidar?.(on ? lidarLayers[0].id : null)}
            // Son libellé.
            label="LiDAR HD (France)"
            // Son texte d'aide.
            hint="Relief mesuré au laser par l’IGN, en zoomant sur la France"
          // Fin de l'interrupteur.
          />
          {/* S'il est actif et qu'il y a plusieurs modèles (début). */}
          {lidarOn && lidarLayers.length > 1 && (
            // Conteneur avec marges.
            <Box sx={{ px: 1.5, pb: 1 }}>
              {/* Le choix du modèle (début de la balise). */}
              <ToggleButtonGroup
                // Un seul choix à la fois.
                exclusive
                // Toute la largeur.
                fullWidth
                // Petite taille.
                size="small"
                // Le modèle choisi.
                value={lidarId}
                // Au changement : choisit le modèle, sauf si le choix est annulé.
                onChange={(_e, id) => { if (id) onLidar?.(id); }}
                // Nom pour les lecteurs d'écran.
                aria-label="Modèle LiDAR HD affiché"
              // Fin de la balise ouvrante.
              >
                {/* Un bouton par modèle (début). */}
                {lidarLayers.map((l) => (
                  // Le bouton, avec la description du modèle en infobulle.
                  <ToggleButton key={l.id} value={l.id} title={l.description} sx={{ textTransform: 'none', lineHeight: 1.2 }}>
                    {/* Son libellé court, le nom du calque à défaut. */}
                    {LIDAR_SHORT[l.id] || l.label}
                  {/* Fin du bouton. */}
                  </ToggleButton>
                // Fin des boutons.
                ))}
              {/* Fin du choix du modèle. */}
              </ToggleButtonGroup>
            {/* Fin du conteneur. */}
            </Box>
          // Fin du cas.
          )}
          {/* S'il y a des villes proposées (début). */}
          {lidarCities.length > 0 && (
            // Conteneur avec marges.
            <Box sx={{ px: 1.5, pb: 1 }}>
              {/* Le menu des villes (début de la balise). */}
              <MenuDeroulant
                // Son libellé.
                label="Aller au-dessus d’une ville"
                // Aucune ville choisie : le menu ne garde pas de choix, il sert à partir.
                value=""
                // Une entrée vide en tête, puis une entrée par ville : son nom et sa région.
                options={[{ value: '', label: `${lidarCities.length} villes de France` },
                  ...lidarCities.map((c) => ({ value: c.name, label: `${c.name} · ${c.region}` }))]}
                // Au choix d'une ville (début).
                onChange={(name) => {
                  // La ville choisie, parmi celles proposées.
                  const city = lidarCities.find((c) => c.name === name);
                  // Aucune (entrée vide) : rien à faire.
                  if (!city) return;
                  // Le calque n'est pas encore allumé : allume le premier modèle.
                  if (!lidarOn && lidarLayers[0]) onLidar?.(lidarLayers[0].id);
                  // Se rend au-dessus de la ville, à l'altitude où l'ombrage se lit, en vol.
                  onGoPlace?.({ name: city.name, lat: city.lat, lon: city.lon, altitudeM: lidarCityAltitudeM, fly: true });
                  // Signale la fin : la fenêtre des paramètres se referme.
                  onDone?.();
                // Fin du choix.
                }}
                // Toute la largeur du groupe.
                sx={{ width: '100%' }}
              // Fin du menu.
              />
            {/* Fin du conteneur. */}
            </Box>
          // Fin du cas.
          )}
        {/* Fin du fragment. */}
        </>
      // Fin du bloc LiDAR HD.
      )}
      {/* S'il y a des dalles de points (début). */}
      {lidarPlaces.length > 0 && (
        // Fragment du bloc.
        <>
          {/* Interrupteur des points LiDAR 3D (début de la balise). */}
          <Switch
            // Son état.
            checked={lidarPoints}
            // Son rappel.
            onChange={onLidarPoints}
            // Son libellé.
            label="Points LiDAR 3D"
            // Son texte d'aide.
            hint="Bâtiments, arbres et rues en vrais points 3D"
          // Fin de l'interrupteur.
          />
          {/* S'il est actif (début). */}
          {lidarPoints && (
            // Conteneur en colonne.
            <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {/* Le choix de la couleur (début de la balise). */}
              <ToggleButtonGroup
                // Un seul choix à la fois.
                exclusive
                // Toute la largeur.
                fullWidth
                // Petite taille.
                size="small"
                // Le mode de couleur choisi.
                value={lidarColor}
                // Au changement : choisit le mode, sauf si le choix est annulé.
                onChange={(_e, mode) => { if (mode) onLidarColor?.(mode); }}
                // Nom pour les lecteurs d'écran.
                aria-label="Couleur des points LiDAR"
              // Fin de la balise ouvrante.
              >
                {/* Bouton « Couleurs de la photo ». */}
                <ToggleButton value="photo" title="Chaque point prend la couleur de la photo aérienne de l’IGN à sa verticale" sx={{ textTransform: 'none', lineHeight: 1.2 }}>Couleurs de la photo</ToggleButton>
                {/* Bouton « Types de points ». */}
                <ToggleButton value="classes" title="Couleur selon le type de point : sol, toit, façade, végétation" sx={{ textTransform: 'none', lineHeight: 1.2 }}>Types de points</ToggleButton>
              {/* Fin du choix de la couleur. */}
              </ToggleButtonGroup>
              {/* Un bouton par dalle (début). */}
              {lidarPlaces.map((place) => (
                // Le bouton (début de la balise).
                <Button
                  // Clé unique : l'identifiant de la dalle.
                  key={place.id}
                  // Petite taille.
                  size="small"
                  // À contour.
                  variant="outlined"
                  // Infobulle : le nombre de points.
                  title={millions(place.points)}
                  // Au clic (début).
                  onClick={() => {
                    // Va à la dalle, à l'altitude d'arrivée, en vol.
                    onGoPlace?.({ name: place.name, lat: place.lat, lon: place.lon, altitudeM: POINTS_ALTITUDE_M, fly: true });
                    // Signale la fin.
                    onDone?.();
                  // Fin du clic.
                  }}
                  // Nom et invitation aux deux extrémités, casse d'origine.
                  sx={{ textTransform: 'none', justifyContent: 'space-between', lineHeight: 1.25, textAlign: 'left' }}
                // Fin de la balise ouvrante.
                >
                  {/* Le nom de la dalle. */}
                  <span>{place.name}</span>
                  {/* L'invitation « Y aller », décorative. */}
                  <span aria-hidden="true">Y aller →</span>
                {/* Fin du bouton. */}
                </Button>
              // Fin des boutons.
              ))}
            {/* Fin du conteneur. */}
            </Box>
          // Fin du cas.
          )}
        {/* Fin du fragment. */}
        </>
      // Fin du bloc des points.
      )}
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de CartographieRelief.
}
