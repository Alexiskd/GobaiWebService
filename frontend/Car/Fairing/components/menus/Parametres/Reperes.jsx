// Importe Group, le groupe de réglages.
import { Group } from '../../ui/Group.jsx';
// Importe Switch, l'interrupteur.
import { Switch } from '../../ui/Switch.jsx';

/**
 * Repères du modèle global : décochés, il ne reste que les astres, sans aucun élément d'indication. L'atmosphère des
 * planètes solides a rejoint la catégorie « Atmosphère » (Atmosphere.jsx).
 */
// Déclare et exporte le composant Reperes : l'état et le rappel de chaque repère.
export function Reperes({ orbits, onOrbits, markers, onMarkers, satellites, onSatellites, sky, onSky }) {
  // Début du rendu.
  return (
    // Fragment : regroupe les deux groupes.
    <>
      {/* Groupe « Repères ». */}
      <Group title="Repères">
        {/* Interrupteur des lignes d'orbite. */}
        <Switch checked={orbits} onChange={onOrbits} label="Lignes d’orbite" hint="Planètes, Lune et satellites naturels" />
        {/* Interrupteur des repères des planètes. */}
        <Switch checked={markers} onChange={onMarkers} label="Points et noms des planètes" />
        {/* Interrupteur des repères des satellites. */}
        <Switch checked={satellites} onChange={onSatellites} label="Points et noms des satellites naturels" />
      {/* Fin du groupe. */}
      </Group>
      {/* Groupe « Univers ». */}
      <Group title="Univers">
        {/* Interrupteur des étoiles et de la Voie lactée. */}
        <Switch checked={sky} onChange={onSky} label="Étoiles et Voie lactée" hint="Décoché : fond noir" />
      {/* Fin du groupe. */}
      </Group>
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de Reperes.
}
