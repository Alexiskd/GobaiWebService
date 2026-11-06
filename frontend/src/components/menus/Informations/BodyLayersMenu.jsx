import { Hint } from '../../ui/Hint';
import { AdaptiveStyles } from './AdaptiveStyles';
import { Lune } from './Lune';
import { Mars } from './Mars';
import { Mercure } from './Mercure';
import { Terre } from './Terre';
import { Venus } from './Vénus';

const MAPPED_BODIES = ['earth', 'moon', 'mars', 'mercury', 'venus'];

/**
 * Composante adaptative : contenu du panneau « Informations » propre à l’astre visualisé.
 * Ordre fixe pour tous les astres : fond de carte → calques → affichage → état du chargement.
 */
export function BodyLayersMenu({
  hud, bodyId: currentId = null, bodyName = null, layers = [], moonRealAvailable, moonColorOk, listStatus, listError,
  baseId, onBase, roads, onRoads, roadsHint, shade, onShade, borders, onBorders, bordersHint, coasts, onCoasts, countryNames, onCountryNames, cityNames, onCityNames, cityNamesHint, cityNamesDisabled, gps, onGps,
  moonFeatures, onMoonFeatures, moonOrbiters, onMoonOrbiters, moonModel, onMoonModel, moonModelHint, shadowcam, onShadowcam, shadowcamHint,
  moonLayers = [], moonBaseId = null, onMoonBase,
  marsLayers = [], marsBaseId = null, onMarsBase,
  mercuryLayers = [], mercuryBaseId = null, onMercuryBase,
  venusLayers = [], venusBaseId = null, onVenusBase,
}) {
  const mapped = MAPPED_BODIES.includes(currentId);

  return (
    <div className="ac">
      <AdaptiveStyles />

      {currentId === 'earth' && (
        <Terre
          hud={hud}
          layers={layers}
          baseId={baseId}
          onBase={onBase}
          listStatus={listStatus}
          listError={listError}
          roads={roads}
          onRoads={onRoads}
          roadsHint={roadsHint}
          shade={shade}
          onShade={onShade}
          borders={borders}
          onBorders={onBorders}
          bordersHint={bordersHint}
          coasts={coasts}
          onCoasts={onCoasts}
          countryNames={countryNames}
          onCountryNames={onCountryNames}
          cityNames={cityNames}
          onCityNames={onCityNames}
          cityNamesHint={cityNamesHint}
          cityNamesDisabled={cityNamesDisabled}
          gps={gps}
          onGps={onGps}
        />
      )}

      {currentId === 'moon' && (
        <Lune
          hud={hud}
          moonLayers={moonLayers}
          moonBaseId={moonBaseId}
          onMoonBase={onMoonBase}
          moonRealAvailable={moonRealAvailable}
          moonColorOk={moonColorOk}
          listStatus={listStatus}
          moonModel={moonModel}
          onMoonModel={onMoonModel}
          moonModelHint={moonModelHint}
          shadowcam={shadowcam}
          onShadowcam={onShadowcam}
          shadowcamHint={shadowcamHint}
          moonFeatures={moonFeatures}
          onMoonFeatures={onMoonFeatures}
          moonOrbiters={moonOrbiters}
          onMoonOrbiters={onMoonOrbiters}
          shade={shade}
          onShade={onShade}
        />
      )}

      {currentId === 'mars' && (
        <Mars hud={hud} layers={marsLayers} baseId={marsBaseId} onBase={onMarsBase} listStatus={listStatus} shade={shade} onShade={onShade} />
      )}
      {currentId === 'mercury' && (
        <Mercure hud={hud} layers={mercuryLayers} baseId={mercuryBaseId} onBase={onMercuryBase} listStatus={listStatus} shade={shade} onShade={onShade} />
      )}
      {currentId === 'venus' && (
        <Venus hud={hud} layers={venusLayers} baseId={venusBaseId} onBase={onVenusBase} listStatus={listStatus} shade={shade} onShade={onShade} />
      )}

      {currentId === null && (
        <Hint>Vue d’ensemble : ciblez la Terre, la Lune, Mars, Mercure ou Vénus pour voir ses informations.</Hint>
      )}
      {currentId !== null && !mapped && (
        <Hint>Aucune information cartographique disponible pour {bodyName || 'cet astre'}.</Hint>
      )}
    </div>
  );
}
