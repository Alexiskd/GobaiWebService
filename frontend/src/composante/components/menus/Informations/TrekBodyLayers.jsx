// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe le chargement des couches d'un satellite.
import { fetchSatelliteLayers } from '@/moteur/api/scene';
// Importe la table des astres tuilés par identifiant.
import { TILED_BODY_BY_ID } from '@/moteur/engine/tiledBodies';
// Importe la liste des fonds de carte d'une planète.
import { PlanetBases } from './PlanetBases';
// Importe la ligne d'état des tuiles.
import { TileStatus } from './TileStatus';

/**
 * Menu des satellites et géantes gazeuses (systèmes de Jupiter, Saturne, Uranus, Neptune) : toutes les couches
 * NASA Solar System Treks de l'astre (mosaïques, relief, cartes géologiques…), USGS en dernier recours.
 * La liste est demandée à l'ouverture (GET /tiles/satellites/{astre}/layers) : le serveur la découvre au démarrage.
 */
// Déclare et exporte le composant TrekBodyLayers : HUD, identifiant et nom de l'astre, fond choisi, rappel de choix et ombrage.
export function TrekBodyLayers({ hud, bodyId, label, baseId, onBase, shade, onShade }) {
  // État : les couches de l'astre, vide au départ.
  const [layers, setLayers] = useState([]);
  // État : le statut du chargement.
  const [status, setStatus] = useState('loading');

  // Effet relancé quand l'astre change.
  useEffect(() => {
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Passe au statut « chargement ».
    setStatus('loading');
    // Demande les couches de l'astre.
    fetchSatelliteLayers(bodyId, ctrl.signal)
      // Réussite : garde la liste (vide si ce n'est pas un tableau) et passe à « prêt ».
      .then((list) => { setLayers(Array.isArray(list) ? list : []); setStatus('ready'); })
      // Échec, sauf annulation volontaire : liste vide et statut « prêt ».
      .catch((e) => { if (e?.name !== 'AbortError') { setLayers([]); setStatus('ready'); } });
    // Nettoyage : annule la requête en cours.
    return () => ctrl.abort();
  // Fin de l'effet ; dépendance : l'identifiant de l'astre.
  }, [bodyId]);

  // Clé de l'état des tuiles de cet astre dans le HUD, si elle existe.
  const source = TILED_BODY_BY_ID[bodyId]?.hudKey;
  // Début du rendu.
  return (
    // Fragment : regroupe les deux blocs.
    <>
      {/* Les fonds de carte de l'astre. */}
      <PlanetBases groupName={`${bodyId}-base`} label={label} layers={layers} baseId={baseId} onBase={onBase} listStatus={status} />
      {/* L'état de ses tuiles, si la clé existe. */}
      {source && <TileStatus hud={hud} source={source} label={label} />}
    {/* Fin du fragment. */}
    </>
  // Fin du rendu.
  );
// Fin de TrekBodyLayers.
}
