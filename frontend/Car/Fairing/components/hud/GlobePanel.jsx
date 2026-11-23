// Importe de React les crochets useCallback, useEffect et useState.
import { useCallback, useEffect, useState } from 'react';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/Engine/AstreSolideEngine/hudStore';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';
// Importe la marge des bords de l'écran.
import { edge } from '@/Fairing/theme/layout';
// Importe les favoris de vues (stockés dans le navigateur).
import { addFavorite, readFavorites, removeFavorite, writeFavorites } from '@/engines/astre-solide/astre-solide.favorites.js';
// Importe le curseur du kit.
import { Slider } from '@/Fairing/kit';
// Importe les bornes et le texte du curseur du temps.
import { TIME_OFFSET_MAX_H, TIME_OFFSET_STEP_H, formatOffset } from '@/engines/astre-solide/astre-solide.time.js';
// Importe la lecture d'une ancre de vue.
import { parseViewHash } from '@/engines/astre-solide/astre-solide.view-link.js';

/**
 * Panneau du globe de près (affiché seulement quand le globe CesiumJS a la main) : vol entre deux villes (« Paris →
 * Tokyo », la route et la distance parcourue s'affichent dessous), curseur du temps (±12 h, on voit
 * la nuit avancer) et favoris de vues. Une étoile
 * enregistre la vue actuelle (son lien), la liste y revole en un clic ; la croix retire un favori.
 */
// Déclare et exporte le composant GlobePanel : le magasin du HUD et le moteur.
export function GlobePanel({ hud, engine }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Globe de près ?
  const near = useHud(hud, (s) => s.globeNear);
  // Lien de la vue (vide tant que la vue n'est pas posée).
  const viewLink = useHud(hud, (s) => s.viewLink);
  // Texte du zoom (astre, distance, lieu) : nom du favori.
  const zoomText = useHud(hud, (s) => s.zoomText);
  // Favoris, lus une fois dans le navigateur.
  const [favorites, setFavorites] = useState(() => readFavorites());
  // Liste ouverte ou non.
  const [open, setOpen] = useState(false);
  // Décalage de l'heure (heures), repris du moteur.
  const [offset, setOffset] = useState(() => (engine?.timeOffsetMs ?? 0) / 3600000);
  // changeOffset : nouveau décalage, appliqué au moteur (début).
  const changeOffset = (h) => setOffset(engine?.setTimeOffset(h) ?? h);
  // Route du vol en cours (texte du HUD) et texte saisi du trajet.
  const route = useHud(hud, (s) => s.route);
  // Texte du trajet saisi.
  const [trip, setTrip] = useState('');
  // Message d'erreur du trajet.
  const [tripError, setTripError] = useState('');
  // fly : lance le vol entre les deux lieux saisis (début).
  const fly = (e) => {
    // Pas de rechargement de la page.
    e.preventDefault();
    // Vol demandé au moteur.
    const r = engine?.flyRoute(trip);
    // Erreur affichée, ou effacée.
    setTripError(r?.error ?? '');
  // Fin de fly.
  };
  // En entrant ou en sortant du globe de près : décalage relu (il revient à 0 en sortant).
  useEffect(() => { setOffset((engine?.timeOffsetMs ?? 0) / 3600000); }, [engine, near]);
  // save : remplace la liste et l'écrit (début).
  const save = useCallback((list) => { setFavorites(list); writeFavorites(undefined, list); }, []);
  // Globe de loin : rien.
  if (!near) return null;
  // addCurrent : enregistre la vue actuelle (début).
  const addCurrent = () => {
    // Adresse de la vue.
    let url = null;
    // Lien illisible : rien.
    try { url = new URL(viewLink); } catch { return; }
    // Parties du texte du zoom : astre, distance, puis le lieu (ville, région, pays) s'il est connu.
    const parts = String(zoomText || '').split(' · ');
    // Nom : le lieu puis la distance (« Paris · Île-de-France · France · 2,5 km »), sinon l'astre et la distance.
    const name = (parts.length > 2 ? [...parts.slice(2), parts[1]] : parts).join(' · ') || 'Vue';
    // Ajouté en tête et gardé.
    save(addFavorite(favorites, { name, path: url.pathname, hash: url.hash }));
    // Liste ouverte pour voir l'ajout.
    setOpen(true);
  // Fin de addCurrent.
  };
  // Début du rendu.
  return (
    // Carte du panneau, en bas à gauche.
    <div data-hud="globe-panel" className="g-paper g-elev fixed z-[30] flex flex-col gap-1 p-1.5 rounded-[12px] max-w-[min(320px,calc(100vw_-_24px))]" style={{ left: edge('left', compact ? 8 : 14), bottom: edge('bottom', compact ? 150 : 72) }}>
      {/* Ligne des boutons. */}
      <div className="flex flex-row items-center gap-1">
        {/* Étoile : enregistre la vue (inactive tant que le lien n'est pas prêt). */}
        <button type="button" onClick={addCurrent} disabled={!viewLink} title="Ajouter cette vue aux favoris" className="t-caption px-2 py-1 rounded-[8px] hover:underline disabled:opacity-40">☆ Favori</button>
        {/* Ouvre ou ferme la liste. */}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="t-caption text-soft px-2 py-1 rounded-[8px] hover:underline">Mes vues ({favorites.length})</button>
      {/* Fin de la ligne. */}
      </div>
      {/* Vol entre deux lieux : « Paris → Tokyo ». */}
      <form onSubmit={fly} className="flex flex-row items-center gap-1 px-1">
        <input value={trip} onChange={(e) => setTrip(e.target.value)} placeholder="Paris → Tokyo" aria-label="Vol entre deux villes" className="t-caption flex-1 min-w-0 px-2 py-1 rounded-[8px] bg-transparent border border-current/20" />
        <button type="submit" disabled={!trip.trim()} className="t-caption px-2 py-1 rounded-[8px] hover:underline disabled:opacity-40">Voler</button>
      </form>
      {/* Route en cours ou erreur. */}
      {(route || tripError) && <span className="t-caption text-soft px-2 tabular-nums" role="status">{route || tripError}</span>}
      {/* Curseur du temps : −12 h à +12 h ; « maintenant » revient à l'heure réelle. */}
      <div className="flex flex-row items-center gap-2 px-2">
        <span className="t-caption text-soft flex-none">Heure</span>
        <Slider value={offset} onChange={(_, v) => changeOffset(Array.isArray(v) ? v[0] : v)} min={-TIME_OFFSET_MAX_H} max={TIME_OFFSET_MAX_H} step={TIME_OFFSET_STEP_H} aria-label="Décalage de l'heure" className="flex-1 min-w-[120px]" />
        <button type="button" onClick={() => changeOffset(0)} disabled={!offset} title="Revenir à l'heure réelle" className="t-caption tabular-nums flex-none w-[64px] text-right disabled:opacity-60">{formatOffset(offset)}</button>
      </div>
      {/* Liste des favoris (début). */}
      {open && (
        <ul className="flex flex-col max-h-[40vh] overflow-y-auto">
          {/* Aucun favori : une phrase. */}
          {!favorites.length && <li className="t-caption text-soft px-2 py-1">Aucune vue enregistrée.</li>}
          {/* Un favori par ligne : son nom (clic : vol) et une croix. */}
          {favorites.map((f, i) => (
            <li key={`${f.path}${f.hash}`} className="flex flex-row items-center gap-1">
              <button type="button" onClick={() => engine?.goToView(f.path, parseViewHash(f.hash))} title={`${f.path}${f.hash}`} className="t-caption text-left flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1 hover:underline">{f.name}</button>
              <button type="button" onClick={() => save(removeFavorite(favorites, i))} aria-label={`Retirer ${f.name}`} className="t-caption text-soft px-2 py-1">×</button>
            </li>
          ))}
        </ul>
      )}
    {/* Fin de la carte. */}
    </div>
  // Fin du rendu.
  );
// Fin de GlobePanel.
}
