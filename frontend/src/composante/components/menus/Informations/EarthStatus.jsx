// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe la ligne d'état.
import { StatusLine } from '../../ui/StatusLine';
// Importe les noms des fournisseurs.
import { PROVIDER_LABEL } from './providerLabels';

// Déclare et exporte le composant EarthStatus : HUD, statut et erreur de la liste des couches.
export function EarthStatus({ hud, listStatus, listError }) {
  // Lit l'état des tuiles de la Terre.
  const tiles = useHud(hud, (s) => s.tiles);
  // Le texte à afficher.
  let text;
  // Le ton, « ok » par défaut.
  let tone = 'ok';
  // Liste des couches en erreur : message avec l'erreur, ton d'erreur.
  if (listStatus === 'error') { text = `API de tuiles indisponible (${listError})`; tone = 'bad'; }
  // Tuiles en erreur : leur message (ou un message par défaut), ton d'erreur.
  else if (tiles?.status === 'error') { text = tiles.error || 'La carte ne répond pas'; tone = 'bad'; }
  // Si une couche est affichée.
  else if (tiles?.layerId) {
    // Nom du fournisseur (son identifiant à défaut), avec la mention « expérimental » s'il y a lieu.
    text = `${PROVIDER_LABEL[tiles.provider] || tiles.provider}${tiles.experimental ? ' · expérimental' : ''}`;
    // Pendant le chargement : ajoute le nombre d'images en cours, ton « en cours ».
    if (tiles.status === 'loading') { text += ` · ${tiles.loading} images`; tone = 'busy'; }
  // Sinon.
  } else {
    // « Chargement des fonds… » ou « Aucun fond chargé », selon le statut de la liste.
    text = listStatus === 'loading' ? 'Chargement des fonds…' : 'Aucun fond chargé';
    // Ton « en cours ».
    tone = 'busy';
  // Fin du choix.
  }
  // Rend la ligne d'état.
  return <StatusLine text={text} tone={tone} />;
// Fin de EarthStatus.
}
