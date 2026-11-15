// Importe de MUI Box, Slider (réglette), ToggleButton, ToggleButtonGroup et Typography.
import { Box, Slider, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group';
// Importe Switch, l'interrupteur.
import { Switch } from '../../ui/Switch';
// Importe les fenêtres de temps proposées pour les incendies.
import { FIRE_WINDOWS_H } from '@/moteur/engine/atmosphere/fireMath';
// Importe la liste des calques à venir.
import { ATMOSPHERE_UPCOMING } from '@/composante/components/scene/atmosphereSettings';

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

/**
 * Catégorie « Atmosphère » : l'atmosphère et les nuages des planètes solides, puis les phénomènes en direct de la
 * Terre, chacun allumé indépendamment avec son opacité et son intensité ; les incendies ont aussi leur fenêtre de
 * temps. Les calques des lots suivants sont annoncés « à venir » : aucun phénomène n'est représenté sans source.
 */
// Déclare et exporte le composant Atmosphere (début de la liste des propriétés).
export function Atmosphere({
  // L'atmosphère et les nuages des planètes solides, leur rappel et leur texte d'aide.
  atmospheres, onAtmospheres, atmospheresHint,
  // Les réglages des calques, leur modification et les textes d'aide.
  settings, onUpdate, fireHint, cycloneHint, lightningHint,
// Fin de la liste des propriétés.
}) {
  // Début du rendu.
  return (
    // Groupe titré.
    <Group title="Atmosphère">
      {/* Interrupteur de l'atmosphère et des nuages des planètes solides. */}
      <Switch checked={atmospheres} onChange={onAtmospheres} label="Nuages et atmosphère des planètes solides" hint={atmospheresHint || 'Vénus, Terre et Mars ; décoché : globes nus'} />
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
