// Importe les crochets de React.
import { useEffect, useRef, useState } from 'react';
// Importe de MUI la boîte et le bouton.
import { Box, Button } from '@mui/material';
// Importe la lecture de la configuration du globe Google.
import { fetchGoogleEarthConfig } from '@/moteur/api';

/** Position de départ sans Terre visible : la France, vue de 8 000 km. */
// Position par défaut.
const DEFAULT_VIEW = { lat: 46.6, lng: 2.4, range: 8_000_000 };
/** Distance caméra–centre du globe Google, en mètres : entre 300 m et 60 000 km (le globe va jusqu'à 63 170 km). */
// Bornes de la distance.
const RANGE_MIN = 300, RANGE_MAX = 60_000_000;

/**
 * Fenêtre du globe Google : remplace le globe Terre de l'app par le globe 3D photoréaliste de Google, dans un iframe.
 * Google refuse d'être affiché dans l'iframe d'un autre site (en-tête X-Frame-Options), le site Google Earth compris :
 * l'iframe affiche donc /google-earth.html, une page de l'app qui charge le globe officiel (3D Maps de l'API Maps
 * JavaScript). À l'ouverture, le globe part de la vue en cours ; à la fermeture, l'app reprend là où était la caméra
 * du globe Google.
 *
 * @param {{ open: boolean, engine: object, onClose: () => void }} props
 */
// Déclare et exporte le composant GoogleEarthWindow (début).
export function GoogleEarthWindow({ open, engine, onClose }) {
  // Iframe du globe.
  const frame = useRef(null);
  // Configuration reçue du serveur (clé), ou null.
  const config = useRef(null);
  // Position de départ, prise à l'ouverture.
  const start = useRef(DEFAULT_VIEW);
  // Dernière position de la caméra du globe Google, ou null.
  const camera = useRef(null);
  // Page de l'iframe prête à recevoir la clé ?
  const ready = useRef(false);
  // Erreur à afficher, ou vide.
  const [error, setError] = useState('');

  // À l'ouverture : position de départ et configuration (début).
  useEffect(() => {
    // Fermée : rien.
    if (!open) return undefined;
    // Vue en cours sur la Terre, si elle est connue.
    const geo = engine?.earthCameraGeo?.();
    // Position de départ : la vue en cours, sinon la France vue de loin.
    start.current = geo ? { lat: geo.lat, lng: geo.lon, range: Math.min(RANGE_MAX, Math.max(RANGE_MIN, geo.altitudeM)) } : DEFAULT_VIEW;
    // Rien de reçu encore.
    camera.current = null; ready.current = false; config.current = null; setError('');
    // Annulation à la fermeture.
    const ctrl = new AbortController();
    // Lit la configuration ; une fois là, l'envoie si la page est déjà prête.
    fetchGoogleEarthConfig(ctrl.signal).then((c) => { config.current = c; send(); }).catch((e) => { if (e.name !== 'AbortError') setError('Configuration du globe Google indisponible (serveur injoignable).'); });
    // À la fermeture : annule la lecture.
    return () => ctrl.abort();
  // Fin de l'effet ; il dépend de l'ouverture et du moteur.
  }, [open, engine]);

  // send : envoie la clé et la position de départ à la page de l'iframe, quand les deux sont prêtes (début).
  const send = () => {
    // Page pas prête ou configuration pas reçue : plus tard.
    if (!ready.current || !config.current || !frame.current?.contentWindow) return;
    // Envoie la clé et la position, à la page de même origine seulement.
    frame.current.contentWindow.postMessage({ type: 'gobai:google-earth:init', key: config.current.key, ...start.current }, location.origin);
  // Fin de send.
  };

  // Messages de la page de l'iframe : prête, ou position de la caméra (début).
  useEffect(() => {
    // Fermée : rien.
    if (!open) return undefined;
    // onMessage : un message reçu (début).
    const onMessage = (e) => {
      // Autre origine ou autre fenêtre : ignoré.
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      // Page prête : note-le et envoie la clé.
      if (e.data?.type === 'gobai:google-earth:ready') { ready.current = true; send(); }
      // Position de la caméra : gardée pour la fermeture.
      else if (e.data?.type === 'gobai:google-earth:camera' && Number.isFinite(e.data.lat) && Number.isFinite(e.data.lng)) camera.current = e.data;
    // Fin de onMessage.
    };
    // Écoute les messages.
    window.addEventListener('message', onMessage);
    // À la fermeture : n'écoute plus.
    return () => window.removeEventListener('message', onMessage);
  // Fin de l'effet ; il dépend de l'ouverture.
  }, [open]);

  // close : reprend la vue du globe Google dans l'app, puis ferme (début).
  const close = () => {
    // Dernière position de la caméra Google.
    const c = camera.current;
    // Si elle est connue : l'app va au même endroit, à la même hauteur.
    if (c && engine?.goTo) engine.goTo({ name: 'Vue Google', lon: c.lng, lat: c.lat, altitudeM: Number.isFinite(c.range) ? c.range : undefined });
    // Ferme la fenêtre.
    onClose();
  // Fin de close.
  };

  // Fermée : rien à afficher.
  if (!open) return null;
  // Rend la fenêtre (début).
  return (
    // Toute la fenêtre, par-dessus le globe de l'app.
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1250, bgcolor: '#05070c' }} role="dialog" aria-label="Globe Google">
      {/* L'iframe du globe Google (page de l'app, voir public/google-earth.html). */}
      <Box component="iframe" ref={frame} src="/google-earth.html" title="Globe Google" allow="fullscreen" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
      {/* Erreur éventuelle, centrée. */}
      {error && <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#dce6f5', p: 3, textAlign: 'center' }}>{error}</Box>}
      {/* Bouton de retour au globe de l'app, en haut à droite. */}
      <Button variant="contained" size="small" onClick={close} sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>Revenir au globe de l’app</Button>
    </Box>
  // Fin du rendu.
  );
// Fin de GoogleEarthWindow.
}
