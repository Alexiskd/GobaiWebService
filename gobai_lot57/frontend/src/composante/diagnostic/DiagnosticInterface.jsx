/**
 * Diagnostic de l'interface, à la demande : ouvrir l'application avec `?diagnostic=interface` dessine par-dessus
 * l'écran, à chaque seconde et demie, les commandes qui posent problème (voir layoutAudit) :
 *  - rouge : chevauchement ou commande recouverte ;
 *  - magenta : hors écran ;
 *  - orange : cible tactile de moins de 44 px ;
 * avec leur nombre dans un encart, et le détail dans la console. `window.gobaiDiagnostic()` renvoie le relevé. Rien
 * n'est monté sans le paramètre ; le calque laisse passer tous les gestes et n'est pas lu par les lecteurs d'écran.
 */
// Hooks de React.
import { useEffect, useState } from 'react';
// Analyse de la mise en page.
import { auditDocument, summarize } from './layoutAudit';

/** Vrai si l'adresse demande le diagnostic de l'interface. */
// Déclare et exporte wantsDiagnostic : la chaîne de recherche de l'adresse.
export const wantsDiagnostic = (search = typeof window === 'undefined' ? '' : window.location.search) => new URLSearchParams(search).get('diagnostic') === 'interface';

// Couleur de chaque catégorie.
const COLORS = { overlap: '#ff3b3b', occluded: '#ff3b3b', offscreen: '#ff2bd6', small: '#ffa31a' };

/** Le calque du diagnostic. */
// Déclare et exporte DiagnosticInterface.
export function DiagnosticInterface() {
  // Dernier relevé.
  const [res, setRes] = useState(null);
  // Mesure périodique (début).
  useEffect(() => {
    // Relevé exposé à la console.
    window.gobaiDiagnostic = () => summarize(auditDocument());
    // Une mesure : relevé, dessin, console.
    const run = () => { const r = auditDocument(); setRes(r); console.info('[diagnostic interface]', summarize(r)); };
    // Toutes les 1,5 s.
    const id = setInterval(run, 1500);
    // Première mesure après la mise en page.
    const t = setTimeout(run, 300);
    // Nettoyage.
    return () => { clearInterval(id); clearTimeout(t); delete window.gobaiDiagnostic; };
  // Fin de la mesure.
  }, []);
  // Rien encore : rien.
  if (!res) return null;
  // Rectangles à dessiner : catégorie et élément.
  const boxes = [
    // Chevauchements : les deux éléments.
    ...res.overlaps.flatMap(({ a, b }) => [['overlap', a], ['overlap', b]]),
    // Recouverts, hors écran, petits.
    ...res.occluded.map((it) => ['occluded', it]), ...res.offscreen.map((it) => ['offscreen', it]), ...res.small.map((it) => ['small', it]),
  // Fin de la liste.
  ];
  // Rendu (début).
  return (
    // Calque : toute la fenêtre, au-dessus de tout, sans capter les gestes, caché aux lecteurs d'écran.
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 2147483000, pointerEvents: 'none' }}>
      {/* Un cadre par élément signalé. */}
      {boxes.map(([kind, it], i) => <div key={i} style={{ position: 'absolute', left: it.rect.x, top: it.rect.y, width: it.rect.w, height: it.rect.h, outline: `2px solid ${COLORS[kind]}`, outlineOffset: -1 }} />)}
      {/* L'encart des nombres, en bas à gauche. */}
      <div style={{ position: 'absolute', left: 8, bottom: 8, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,.75)', color: '#fff', font: '11px ui-monospace, monospace' }}>
        {/* Nombre de commandes et de problèmes par catégorie. */}
        {res.count} commandes · chevauchements {res.overlaps.length} · recouvertes {res.occluded.length} · hors écran {res.offscreen.length} · petites {res.small.length}
      {/* Fin de l'encart. */}
      </div>
    {/* Fin de la couche de diagnostic. */}
    </div>
  // Fin du rendu.
  );
// Fin de DiagnosticInterface.
}
