import { Cartographie } from '../../Parametres/Cartographie.jsx';
import { VitesseRotation } from '../../Parametres/VitesseRotation.jsx';
import { MoonCountries } from './MoonCountries.jsx';

/**
 * Réglages attachés à l'astre décrit dans le panneau Informations. Depuis la refonte (étape 2), tous les calques sont
 * actifs en permanence et s'affichent selon le zoom : il ne reste que la vitesse de rotation, la couche de la Terre
 * (avec son téléchargement) et, pour la Lune, la description de ses pays.
 */
export function PlanetSettings({ bodyId, bodyName, rotateSpeed, onRotateSpeed, rotating, earthLayers = {} }) {
  if (!bodyId) return null;

  return (
    <section aria-label={`Réglages de ${bodyName || 'l’astre'}`} className="mt-2 pt-2 border-t border-line">
      <h3 className="t-subtitle2 text-soft min-h-9 flex items-center">
        Réglages · {bodyName || 'Astre'}
      </h3>
      <VitesseRotation speed={rotateSpeed} onSpeed={onRotateSpeed} rotating={rotating} />
      {/* La couche unique de la Terre et son téléchargement. */}
      {bodyId === 'earth' && <Cartographie {...earthLayers} />}
      {/* Pays de la Lune : leur liste, avec la descendance sémantique de chaque nom. */}
      {bodyId === 'moon' && <MoonCountries />}
    </section>
  );
}
