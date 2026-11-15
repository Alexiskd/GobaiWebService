// Importe de MUI Box, Checkbox (case à cocher), FormControlLabel, Link, Slider (réglette), ToggleButton, ToggleButtonGroup et Typography.
import { Box, Checkbox, FormControlLabel, Link, Slider, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group';
// Importe Switch, l'interrupteur.
import { Switch } from '../../ui/Switch';
// Importe les fenêtres de temps proposées pour les incendies.
import { FIRE_WINDOWS_H } from '@/moteur/engine/atmosphere/fireMath';
// Importe la liste des calques à venir.
import { ATMOSPHERE_UPCOMING } from '@/composante/components/scene/atmosphereSettings';
// Importe les échelles de couleurs du radar et la légende de la pluie.
import { SNOW_SCALE, radarLegend } from '@/moteur/engine/atmosphere/radarMath';
// Importe les produits d'aérosols, leurs libellés et leurs légendes.
import { AEROSOL_LABELS, AEROSOL_PRODUCTS, aerosolLegend } from '@/moteur/engine/atmosphere/aerosolMath';
// Importe l'adresse de la légende de la prévision CAMS.
import { aerosolLegendUrl } from '@/moteur/api/scene';
// Importe les niveaux des vents, leurs libellés et l'échelle des vitesses.
import { FLOW_LEVEL_IDS, FLOW_LEVEL_LABELS, SPEED_SCALE } from '@/moteur/engine/atmosphere/flowMath';

/** Une réglette compacte, avec son libellé et sa valeur en pourcentage. */
// Déclare Reglette : libellé, valeur, bornes, pas et rappel.
function Reglette({ label, value, min, max, step, onChange }) {
  // Début du rendu.
  return (
    // Ligne : libellé à gauche, réglette à droite.
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 3, pr: 1.5, py: 0.25 }}>
      {/* Le libellé, à largeur fixe. */}
      <Typography variant="caption" color="text.secondary" sx={{ width: 64, flexShrink: 0 }}>{label}</Typography>
      {/* La réglette (début de la balise). */}
      <Slider
        // Petite taille.
        size="small"
        // Valeur, bornes et pas.
        value={value} min={min} max={max} step={step}
        // Au changement : transmet la valeur.
        onChange={(e, v) => onChange(Array.isArray(v) ? v[0] : v)}
        // Nom pour les lecteurs d'écran.
        aria-label={label}
        // Valeur lue en pourcentage.
        valueLabelDisplay="auto" valueLabelFormat={(v) => `${Math.round(v * 100)} %`}
        // Style : occupe le reste de la ligne.
        sx={{ flex: 1 }}
      // Fin de la réglette.
      />
    {/* Fin de la ligne. */}
    </Box>
  // Fin du rendu.
  );
// Fin de Reglette.
}

/** Réglages communs d'un calque allumé : opacité et intensité visuelle. */
// Déclare Reglages : les réglages du calque et le rappel de modification.
function Reglages({ value, onChange }) {
  // Début du rendu.
  return (
    // Fragment : deux réglettes.
    <>
      {/* Opacité, de 10 à 100 %. */}
      <Reglette label="Opacité" value={value.opacity} min={0.1} max={1} step={0.05} onChange={(v) => onChange({ opacity: v })} />
      {/* Intensité visuelle, de 50 à 200 %. */}
      <Reglette label="Intensité" value={value.intensity} min={0.5} max={2} step={0.05} onChange={(v) => onChange({ intensity: v })} />
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de Reglages.
}

/** Une option secondaire d'un calque : case à cocher compacte, en retrait. */
// Déclare Option : libellé, état et rappel.
function Option({ label, checked, onChange }) {
  // Début du rendu.
  return (
    // Ligne cliquable (début de la balise).
    <FormControlLabel
      // Case à cocher compacte.
      control={<Checkbox size="small" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} sx={{ py: 0.25 }} />}
      // Libellé en petit.
      label={<Typography variant="caption" color="text.secondary">{label}</Typography>}
      // En retrait, sans marge.
      sx={{ m: 0, pl: 2.5, pr: 1.5, width: '100%' }}
    // Fin de la balise.
    />
  // Fin du rendu.
  );
// Fin de Option.
}

/** Légende du radar : échelle de la pluie (dBZ et intensité estimée), échelle de la neige, mention de la source. */
// Déclare LegendeRadar.
function LegendeRadar() {
  // Paliers de la pluie.
  const rain = radarLegend();
  // Dégradé CSS d'une échelle.
  const gradient = (stops) => `linear-gradient(90deg, ${stops.map((c, i) => `${c} ${Math.round((i / (stops.length - 1)) * 100)}%`).join(', ')})`;
  // Début du rendu.
  return (
    // Bloc en retrait.
    <Box sx={{ pl: 3, pr: 1.5, pb: 0.75 }}>
      {/* Barre de la pluie. */}
      <Box aria-hidden sx={{ height: 8, borderRadius: 1, background: gradient(rain.map((r) => r.color)) }} />
      {/* Bornes de la pluie : faible et forte, avec leur intensité estimée. */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        {/* Borne basse. */}
        <Typography variant="caption" color="text.secondary">{`Pluie : ${rain[0].label}`}</Typography>
        {/* Borne haute. */}
        <Typography variant="caption" color="text.secondary">{rain[rain.length - 1].label}</Typography>
      {/* Fin des bornes. */}
      </Box>
      {/* Barre de la neige. */}
      <Box aria-hidden sx={{ height: 6, mt: 0.5, borderRadius: 1, background: gradient(SNOW_SCALE.map(([, c]) => c)) }} />
      {/* Libellé de la neige. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Neige : faible à forte</Typography>
      {/* Explication et source (mention obligatoire, avec lien). */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {/* Texte. */}
        {'Réflectivité mesurée par les radars au sol ; intensité estimée (Marshall-Palmer). Animation : images passées, pas une prévision. Ligne grise : limite de portée des radars. Données radar : '}
        {/* Lien vers la source. */}
        <Link href="https://www.rainviewer.com" target="_blank" rel="noopener noreferrer">Rain Viewer</Link>
        {/* Point final. */}
        {'.'}
      {/* Fin de l'explication. */}
      </Typography>
    {/* Fin du bloc. */}
    </Box>
  // Fin du rendu.
  );
// Fin de LegendeRadar.
}

/** Légende des aérosols : échelle du produit observé, ou légende publiée de la prévision CAMS ; mentions des sources. */
// Déclare LegendeAerosols : le produit.
function LegendeAerosols({ product }) {
  // Prévision des poussières (début).
  if (product === 'dust') {
    // Début du rendu.
    return (
      // Bloc en retrait.
      <Box sx={{ pl: 3, pr: 1.5, pb: 0.75 }}>
        {/* Légende publiée par l'ECMWF (image relayée par le serveur). */}
        <Box component="img" src={aerosolLegendUrl()} alt="Légende de la prévision des poussières (CAMS)" sx={{ display: 'block', maxWidth: '100%', borderRadius: 1, bgcolor: 'common.white' }} />
        {/* Explication et mention demandée par Copernicus. */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Épaisseur optique des poussières prévue par le modèle CAMS, toutes les 6 heures sur 48 heures : une prévision, pas une mesure. Contains modified Copernicus Atmosphere Monitoring Service information.</Typography>
      {/* Fin du bloc. */}
      </Box>
    // Fin du rendu.
    );
  // Fin de la prévision.
  }
  // Paliers du produit observé.
  const stops = aerosolLegend(product);
  // Dégradé CSS.
  const gradient = `linear-gradient(90deg, ${stops.map((p, i) => `${p.color} ${Math.round((i / (stops.length - 1)) * 100)}%`).join(', ')})`;
  // Début du rendu.
  return (
    // Bloc en retrait.
    <Box sx={{ pl: 3, pr: 1.5, pb: 0.75 }}>
      {/* Barre de l'échelle. */}
      <Box aria-hidden sx={{ height: 8, borderRadius: 1, background: gradient }} />
      {/* Bornes de l'échelle. */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        {/* Borne basse. */}
        <Typography variant="caption" color="text.secondary">{product === 'ai' ? `Indice ${stops[0].label}` : `AOD ${stops[0].label}`}</Typography>
        {/* Borne haute. */}
        <Typography variant="caption" color="text.secondary">{`${stops[stops.length - 1].label} et plus`}</Typography>
      {/* Fin des bornes. */}
      </Box>
      {/* Explication du produit. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{product === 'ai' ? 'Indice d’aérosols absorbants mesuré par OMPS : les poussières et les fumées ressortent, même au-dessus des nuages. Couleurs pâlies : mesure de la veille.' : 'Épaisseur optique des aérosols à 550 nm mesurée par VIIRS : l’air pur reste transparent ; sans couleur, aucune mesure (nuages, nuit, neige). Couleurs pâlies : mesure de la veille.'}</Typography>
    {/* Fin du bloc. */}
    </Box>
  // Fin du rendu.
  );
// Fin de LegendeAerosols.
}

/** Légende des vents : échelle des vitesses (km/h), explication et source. */
// Déclare LegendeVents.
function LegendeVents() {
  // Dégradé CSS de l'échelle.
  const gradient = `linear-gradient(90deg, ${SPEED_SCALE.map(([, c], i) => `${c} ${Math.round((i / (SPEED_SCALE.length - 1)) * 100)}%`).join(', ')})`;
  // Début du rendu.
  return (
    // Bloc en retrait.
    <Box sx={{ pl: 3, pr: 1.5, pb: 0.75 }}>
      {/* Barre des vitesses. */}
      <Box aria-hidden sx={{ height: 8, borderRadius: 1, background: gradient }} />
      {/* Bornes : calme et 216 km/h (60 m/s). */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        {/* Borne basse. */}
        <Typography variant="caption" color="text.secondary">Calme</Typography>
        {/* Borne haute. */}
        <Typography variant="caption" color="text.secondary">216 km/h et plus</Typography>
      {/* Fin des bornes. */}
      </Box>
      {/* Explication et source. */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>Vent des modèles météo au moment présent, sur une grille de 12° × 10° : les particules suivent ce vent, accéléré de 900 à 13 500 fois selon l’altitude de la vue, à une altitude exagérée ; ce ne sont pas des trajectoires mesurées. Flèches : axes estimés des courants-jets (250 hPa, 108 km/h et plus). Données : Open-Meteo (CC BY 4.0).</Typography>
    {/* Fin du bloc. */}
    </Box>
  // Fin du rendu.
  );
// Fin de LegendeVents.
}

/**
 * Catégorie « Atmosphère » : les nuages et l'atmosphère de la Terre (calque séparé de sa couche unique, désactivé par
 * défaut), l'atmosphère de Vénus et de Mars, puis les phénomènes en direct de la Terre, chacun allumé indépendamment avec son opacité et son intensité ; les incendies ont aussi leur fenêtre de
 * temps, le radar son animation et sa limite de portée, les aérosols leur produit (observé ou prévu), les vents leur
 * altitude. Les calques encore à venir sont annoncés comme tels :
 * aucun phénomène n'est représenté sans source.
 */
// Déclare et exporte le composant Atmosphere (début de la liste des propriétés).
export function Atmosphere({
  // Les nuages et l'atmosphère de la Terre, leur rappel et leur texte d'aide.
  earthAtmosphere = false, onEarthAtmosphere, earthAtmosphereHint,
  // L'atmosphère de Vénus et de Mars, son rappel et son texte d'aide.
  atmospheres, onAtmospheres, atmospheresHint,
  // Les réglages des calques, leur modification et les textes d'aide.
  settings, onUpdate, fireHint, cycloneHint, lightningHint, precipitationHint, stormHint, aerosolHint, windHint,
// Fin de la liste des propriétés.
}) {
  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Atmosphère">
      {/* Si le réglage de la Terre est fourni : interrupteur de ses nuages et de son atmosphère. */}
      {onEarthAtmosphere && <Switch checked={earthAtmosphere} onChange={onEarthAtmosphere} label="Nuages et atmosphère de la Terre" hint={earthAtmosphereHint || 'Nuages réels et halo bleu ; décoché : globe nu'} />}
      {/* Interrupteur de l'atmosphère de Vénus et de Mars. */}
      <Switch checked={atmospheres} onChange={onAtmospheres} label="Atmosphère de Vénus et de Mars" hint={atmospheresHint || 'Décoché : globes nus'} />
      {/* Si les réglages des calques sont fournis (début). */}
      {settings && onUpdate && (
        // Fragment : les calques en direct.
        <>
          {/* Interrupteur des incendies. */}
          <Switch checked={settings.fires.on} onChange={(on) => onUpdate('fires', { on })} label="Incendies" hint={fireHint} />
          {/* Si les incendies sont allumés (début). */}
          {settings.fires.on && (
            // Fragment : réglages des incendies.
            <>
              {/* Opacité et intensité. */}
              <Reglages value={settings.fires} onChange={(patch) => onUpdate('fires', patch)} />
              {/* Ligne de la fenêtre de temps. */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 3, pr: 1.5, py: 0.5 }}>
                {/* Le libellé. */}
                <Typography variant="caption" color="text.secondary" sx={{ width: 64, flexShrink: 0 }}>Période</Typography>
                {/* Boutons des fenêtres (début de la balise). */}
                <ToggleButtonGroup
                  // Un seul choix, petite taille.
                  exclusive size="small"
                  // Fenêtre choisie.
                  value={settings.fires.windowHours}
                  // Au choix (jamais vide) : transmet la fenêtre.
                  onChange={(e, v) => { if (v) onUpdate('fires', { windowHours: v }); }}
                  // Nom pour les lecteurs d'écran.
                  aria-label="Période des détections"
                // Fin de la balise ouvrante.
                >
                  {/* Un bouton par fenêtre. */}
                  {FIRE_WINDOWS_H.map((h) => <ToggleButton key={h} value={h} sx={{ px: 1.25, py: 0.25 }}>{`${h} h`}</ToggleButton>)}
                {/* Fin des boutons. */}
                </ToggleButtonGroup>
              {/* Fin de la ligne. */}
              </Box>
            {/* Fin des réglages des incendies. */}
            </>
          // Fin du cas.
          )}
          {/* Interrupteur des cyclones. */}
          <Switch checked={settings.cyclones.on} onChange={(on) => onUpdate('cyclones', { on })} label="Cyclones" hint={cycloneHint} />
          {/* Si les cyclones sont allumés : opacité et intensité. */}
          {settings.cyclones.on && <Reglages value={settings.cyclones} onChange={(patch) => onUpdate('cyclones', patch)} />}
          {/* Si les cyclones sont allumés : légende des tracés. */}
          {settings.cyclones.on && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 3, pr: 1.5, pb: 0.5 }}>Trajectoire observée en trait plein, prévue en pointillés ; vents de 34, 50 et 64 nœuds en jaune, orange et rouge.</Typography>}
          {/* Interrupteur de la foudre. */}
          <Switch checked={settings.lightning.on} onChange={(on) => onUpdate('lightning', { on })} label="Foudre" hint={lightningHint} />
          {/* Si la foudre est allumée : opacité et intensité. */}
          {settings.lightning.on && <Reglages value={settings.lightning} onChange={(patch) => onUpdate('lightning', patch)} />}
          {/* Si la foudre est allumée : légende, mesure et animation distinguées. */}
          {settings.lightning.on && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 3, pr: 1.5, pb: 0.5 }}>Points : impacts mesurés (jaune : nuage-sol, anneau violet : intra-nuage). Lueurs et éclairs : animation rejouée ×10 dans l’ordre réel, pas la forme réelle de l’éclair.</Typography>}
          {/* Interrupteur du radar des précipitations. */}
          <Switch checked={settings.precipitation.on} onChange={(on) => onUpdate('precipitation', { on })} label="Précipitations (radar)" hint={precipitationHint} />
          {/* Si le radar est allumé (début). */}
          {settings.precipitation.on && (
            // Fragment : réglages du radar.
            <>
              {/* Opacité et intensité. */}
              <Reglages value={settings.precipitation} onChange={(patch) => onUpdate('precipitation', patch)} />
              {/* Animation des dernières images. */}
              <Option label="Animation des 50 dernières minutes" checked={settings.precipitation.animate} onChange={(animate) => onUpdate('precipitation', { animate })} />
              {/* Limite de portée des radars. */}
              <Option label="Limite de portée des radars" checked={settings.precipitation.coverage} onChange={(coverage) => onUpdate('precipitation', { coverage })} />
              {/* Légende et source. */}
              <LegendeRadar />
            {/* Fin des réglages du radar. */}
            </>
          // Fin du cas.
          )}
          {/* Interrupteur des orages. */}
          <Switch checked={settings.storms.on} onChange={(on) => onUpdate('storms', { on })} label="Orages" hint={stormHint} />
          {/* Si les orages sont allumés : opacité et intensité. */}
          {settings.storms.on && <Reglages value={settings.storms} onChange={(patch) => onUpdate('storms', patch)} />}
          {/* Si les orages sont allumés : légende, estimation et avertissements officiels distingués. */}
          {settings.storms.on && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pl: 3, pr: 1.5, pb: 0.5 }}>Anneaux : cellules convectives estimées d’après le radar, non confirmées (orange : 45 dBZ et plus, rouge : 50, magenta : 55 ; en tirets : vue sur une seule image) ; flèche : déplacement estimé sur 30 minutes. Contours : avertissements officiels du NWS aux États-Unis (rouge : tornade, jaune : orage violent ; doublé : phénomène observé).</Typography>}
          {/* Interrupteur des aérosols. */}
          <Switch checked={settings.aerosols.on} onChange={(on) => onUpdate('aerosols', { on })} label="Aérosols" hint={aerosolHint} />
          {/* Si les aérosols sont allumés (début). */}
          {settings.aerosols.on && (
            // Fragment : réglages des aérosols.
            <>
              {/* Opacité et intensité. */}
              <Reglages value={settings.aerosols} onChange={(patch) => onUpdate('aerosols', patch)} />
              {/* Ligne du produit. */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 3, pr: 1.5, py: 0.5 }}>
                {/* Boutons des produits (début de la balise). */}
                <ToggleButtonGroup
                  // Un seul choix, petite taille, sur toute la largeur.
                  exclusive size="small" fullWidth
                  // Produit choisi.
                  value={settings.aerosols.product}
                  // Au choix (jamais vide) : transmet le produit.
                  onChange={(e, v) => { if (v) onUpdate('aerosols', { product: v }); }}
                  // Nom pour les lecteurs d'écran.
                  aria-label="Produit d'aérosols"
                // Fin de la balise ouvrante.
                >
                  {/* Un bouton par produit. */}
                  {AEROSOL_PRODUCTS.map((p) => <ToggleButton key={p} value={p} sx={{ px: 1, py: 0.25, fontSize: 12 }}>{AEROSOL_LABELS[p]}</ToggleButton>)}
                {/* Fin des boutons. */}
                </ToggleButtonGroup>
              {/* Fin de la ligne. */}
              </Box>
              {/* Prévision : animation des 48 heures. */}
              {settings.aerosols.product === 'dust' && <Option label="Animation des 48 prochaines heures" checked={settings.aerosols.animate} onChange={(animate) => onUpdate('aerosols', { animate })} />}
              {/* Légende et sources. */}
              <LegendeAerosols product={settings.aerosols.product} />
            {/* Fin des réglages des aérosols. */}
            </>
          // Fin du cas.
          )}
          {/* Interrupteur des vents. */}
          <Switch checked={settings.winds.on} onChange={(on) => onUpdate('winds', { on })} label="Vents et courants-jets" hint={windHint} />
          {/* Si les vents sont allumés (début). */}
          {settings.winds.on && (
            // Fragment : réglages des vents.
            <>
              {/* Opacité et intensité. */}
              <Reglages value={settings.winds} onChange={(patch) => onUpdate('winds', patch)} />
              {/* Ligne du niveau. */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 3, pr: 1.5, py: 0.5 }}>
                {/* Le libellé. */}
                <Typography variant="caption" color="text.secondary" sx={{ width: 64, flexShrink: 0 }}>Altitude</Typography>
                {/* Boutons des niveaux (début de la balise). */}
                <ToggleButtonGroup
                  // Un seul choix, petite taille.
                  exclusive size="small"
                  // Niveau choisi.
                  value={settings.winds.level}
                  // Au choix (jamais vide) : transmet le niveau.
                  onChange={(e, v) => { if (v) onUpdate('winds', { level: v }); }}
                  // Nom pour les lecteurs d'écran.
                  aria-label="Altitude des vents"
                // Fin de la balise ouvrante.
                >
                  {/* Un bouton par niveau. */}
                  {FLOW_LEVEL_IDS.map((l) => <ToggleButton key={l} value={l} sx={{ px: 1, py: 0.25, fontSize: 12 }}>{FLOW_LEVEL_LABELS[l]}</ToggleButton>)}
                {/* Fin des boutons. */}
                </ToggleButtonGroup>
              {/* Fin de la ligne. */}
              </Box>
              {/* Axes des courants-jets. */}
              <Option label="Axes des courants-jets (10 km)" checked={settings.winds.jets} onChange={(jets) => onUpdate('winds', { jets })} />
              {/* Légende et source. */}
              <LegendeVents />
            {/* Fin des réglages des vents. */}
            </>
          // Fin du cas.
          )}
          {/* Calques à venir, annoncés sans être représentés. */}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, py: 1 }}>{`À venir : ${ATMOSPHERE_UPCOMING.join(', ').toLowerCase()}.`}</Typography>
        {/* Fin des calques en direct. */}
        </>
      // Fin du cas.
      )}
    {/* Fin du groupe. */}
    </Group>
  // Fin du rendu.
  );
// Fin de Atmosphere.
}
