// Importe Hint, la note d'aide.
import { Hint } from '../../ui/Hint';
// Importe le menu de la Lune.
import { Lune } from './Lune';
// Importe le menu de Mars.
import { Mars } from './Mars';
// Importe le menu de Mercure.
import { Mercure } from './Mercure';
// Importe le menu de la Terre.
import { Terre } from './Terre';
// Importe le menu des satellites et des géantes.
import { TrekBodyLayers } from './TrekBodyLayers';
// Importe la table des astres tuilés par identifiant.
import { TILED_BODY_BY_ID } from '@/moteur/engine/tiledBodies';

// Astres qui ont leur propre menu de cartes.
const MAPPED_BODIES = ['earth', 'moon', 'mars', 'mercury'];

/**
 * Composante adaptative : contenu du panneau « Informations » propre à l’astre visualisé.
 * Ordre fixe pour tous les astres : fond de carte → calques → affichage → état du chargement.
 */
// Déclare et exporte le composant BodyLayersMenu (début de la liste des propriétés).
export function BodyLayersMenu({
  // HUD, astre visé, calques de la Terre, états de la Lune et de la liste.
  hud, bodyId: currentId = null, bodyName = null, layers = [], moonRealAvailable, moonColorOk, listStatus, listError,
  // Fond de la Terre, ombrage et leurs rappels.
  baseId, onBase, shade, onShade,
  // Calques, fond et rappel de la Lune.
  moonLayers = [], moonBaseId = null, onMoonBase,
  // Calques, fond et rappel de Mars.
  marsLayers = [], marsBaseId = null, onMarsBase,
  // Calques, fond et rappel de Mercure.
  mercuryLayers = [], mercuryBaseId = null, onMercuryBase,
  // Fonds de tous les astres et rappel générique.
  bodyBases = {}, onBodyBase,
// Fin de la liste des propriétés.
}) {
  // La configuration de l'astre visé, s'il est tuilé.
  const trekBody = TILED_BODY_BY_ID[currentId];
  // Vrai si c'est un satellite ou une géante gazeuse.
  const isTrekBody = Boolean(trekBody && (trekBody.satellite || trekBody.gas));
  // Vrai si l'astre a un menu de cartes.
  const mapped = MAPPED_BODIES.includes(currentId) || isTrekBody;

  // Début du rendu.
  return (
    // Fragment : regroupe les cas.
    <>
      {/* Pour la Terre (début). */}
      {currentId === 'earth' && (
        // Son menu (début de la balise).
        <Terre
          // Le HUD.
          hud={hud}
          // Ses calques.
          layers={layers}
          // Son fond choisi.
          baseId={baseId}
          // Le rappel de choix.
          onBase={onBase}
          // Le statut de la liste.
          listStatus={listStatus}
          // L'erreur de la liste.
          listError={listError}
        // Fin du menu.
        />
      // Fin du cas.
      )}

      {/* Pour la Lune (début). */}
      {currentId === 'moon' && (
        // Son menu (début de la balise).
        <Lune
          // Le HUD.
          hud={hud}
          // Ses calques.
          moonLayers={moonLayers}
          // Son fond choisi.
          moonBaseId={moonBaseId}
          // Le rappel de choix.
          onMoonBase={onMoonBase}
          // La disponibilité de la Lune réelle.
          moonRealAvailable={moonRealAvailable}
          // L'état des couleurs.
          moonColorOk={moonColorOk}
          // Le statut de la liste.
          listStatus={listStatus}
          // L'ombrage.
          shade={shade}
          // Le rappel de l'ombrage.
          onShade={onShade}
        // Fin du menu.
        />
      // Fin du cas.
      )}

      {/* Pour Mars (début). */}
      {currentId === 'mars' && (
        // Son menu.
        <Mars hud={hud} layers={marsLayers} baseId={marsBaseId} onBase={onMarsBase} listStatus={listStatus} shade={shade} onShade={onShade} />
      // Fin du cas.
      )}
      {/* Pour Mercure (début). */}
      {currentId === 'mercury' && (
        // Son menu.
        <Mercure hud={hud} layers={mercuryLayers} baseId={mercuryBaseId} onBase={onMercuryBase} listStatus={listStatus} shade={shade} onShade={onShade} />
      // Fin du cas.
      )}

      {/* Pour un satellite ou une géante (début). */}
      {isTrekBody && (
        // Son menu (début de la balise).
        <TrekBodyLayers
          // Clé : le menu est recréé à chaque changement d'astre.
          key={currentId}
          // Le HUD.
          hud={hud}
          // L'identifiant de l'astre.
          bodyId={currentId}
          // Son nom, sinon le nom de sa carte sans le préfixe « Carte de ».
          label={bodyName || trekBody.mapLabel.replace(/^Carte de /, '')}
          // Son fond choisi, null s'il n'y en a pas.
          baseId={bodyBases[currentId] ?? null}
          // Le rappel de choix, complété par l'identifiant de l'astre.
          onBase={(layerId) => onBodyBase?.(currentId, layerId)}
          // L'ombrage.
          shade={shade}
          // Le rappel de l'ombrage.
          onShade={onShade}
        // Fin du menu.
        />
      // Fin du cas.
      )}

      {/* Sans astre visé (début). */}
      {currentId === null && (
        // Une note qui invite à cibler un astre.
        <Hint>Vue d’ensemble : ciblez la Terre, la Lune, Mars ou Mercure pour voir ses informations.</Hint>
      // Fin du cas.
      )}
      {/* Pour un astre sans menu de cartes (début). */}
      {currentId !== null && !mapped && (
        // Une note qui le dit.
        <Hint>Aucune information cartographique disponible pour {bodyName || 'cet astre'}.</Hint>
      // Fin du cas.
      )}
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de BodyLayersMenu.
}
