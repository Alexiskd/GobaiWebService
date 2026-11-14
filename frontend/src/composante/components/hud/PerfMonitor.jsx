// Importe de MUI Box et Paper.
import { Box, Paper } from '@mui/material';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe safe, qui donne une marge de sécurité de l'écran.
import { safe } from '@/composante/theme/mediaQueries';

/** Couleur d'une charge : vert sous 60 % de l'intervalle entre deux images, orange sous 85 %, rouge au-delà. */
// loadColor : vert sous 60 %, orange sous 85 %, rouge au-delà.
export const loadColor = (pct) => (pct < 60 ? 'success.main' : pct < 85 ? 'warning.main' : 'error.main');
/** 1 234 567 → « 1,2 M », 54 321 → « 54 k ». */
// shortCount : en millions avec une décimale à partir d'un million…
export const shortCount = (n) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
  // … en milliers à partir de dix mille, tel quel sinon (format français).
  : n >= 1e4 ? `${Math.round(n / 1e3)} k` : n.toLocaleString('fr-FR'));
// ms : nombre au format français, avec une décimale.
const ms = (v) => v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Ligne « CPU 4,2 ms 25 % » avec sa barre de charge. */
// Déclare le composant Load : libellé, durée en millisecondes et pourcentage.
function Load({ label, valueMs, pct }) {
  // Début du rendu.
  return (
    // Grille de trois colonnes : libellé, barre, valeurs.
    <Box sx={{ display: 'grid', gridTemplateColumns: '3.2ch 1fr auto', alignItems: 'center', columnGap: '6px' }}>
      {/* Le libellé. */}
      <b>{label}</b>
      {/* Le rail de la barre. */}
      <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
        {/* Le remplissage : largeur selon le pourcentage, couleur selon la charge, avec transition. */}
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: loadColor(pct), transition: 'width 400ms linear' }} />
      {/* Fin du rail. */}
      </Box>
      {/* La durée et le pourcentage. */}
      <span>{ms(valueMs)} ms · {pct} %</span>
    {/* Fin de la grille. */}
    </Box>
  // Fin du rendu.
  );
// Fin de Load.
}

/**
 * Moniteur CPU / GPU, sous le compteur de FPS (voir perfProbe.jsx pour ce qui est mesuré) :
 *  - CPU : temps de calcul du moteur par image (fil principal) et sa part de l'intervalle entre deux images ;
 *  - GPU : temps de dessin par image et sa part, quand le navigateur donne le chronomètre du GPU (Chrome et Edge sur
 *    ordinateur) ; sinon la ligne le dit, sans chiffre inventé ;
 *  - travail demandé au GPU (appels de dessin, triangles), textures et maillages en mémoire, mémoire JavaScript
 *    (Chrome), nom de la carte graphique.
 * Ce n'est pas la charge du processeur ni de la carte graphique de l'appareil, que le navigateur ne donne pas.
 */
// Déclare et exporte le composant PerfMonitor : reçoit le magasin du HUD.
export function PerfMonitor({ hud }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit les mesures de performance, null s'il n'y en a pas.
  const perf = useHud(hud, (s) => s.perf ?? null);
  // Sans mesure, rien n'est affiché.
  if (compact || !perf) return null;
  // Début du rendu.
  return (
    // Carte du moniteur (début de la balise).
    <Paper
      // Ombre légère.
      elevation={2}
      // Rôle d'état.
      role="status"
      // Nom pour les lecteurs d'écran.
      aria-label="Moniteur CPU et GPU"
      // Jamais traduit.
      translate="no"
      // Début du style.
      sx={{
        // Fixée, sans capter les clics, lignes empilées.
        position: 'fixed', zIndex: 26, pointerEvents: 'none', display: 'grid', rowGap: '3px',
        // Sous le compteur d'images par seconde, à 5 px du bord gauche.
        top: `calc(var(--gps-top, 0px) + ${safe('top')} + ${compact ? 72 : 60}px)`, left: `calc(${safe('left')} + 5px)`,
        // Largeur selon l'écran, petites marges, une seule ligne par entrée, chiffres de largeur fixe.
        width: compact ? 178 : 214, px: 0.75, py: 0.5, borderRadius: 1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
        // Police à chasse fixe, taille selon l'écran.
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace', fontSize: compact ? 10.5 : 11.5, lineHeight: 1.35,
        // Libellés en gras, couleur primaire.
        '& b': { fontWeight: 700, color: 'primary.main' },
        // Lignes atténuées : couleur secondaire, coupées par des points de suspension.
        '& .muted': { color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis' },
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* La ligne du CPU. */}
      <Load label="CPU" valueMs={perf.cpuMs} pct={perf.cpuPct} />
      {/* Si le temps du GPU est mesurable… */}
      {perf.gpuMs !== null
        // … la ligne du GPU…
        ? <Load label="GPU" valueMs={perf.gpuMs} pct={perf.gpuPct} />
        // … sinon une ligne qui le dit, sans chiffre.
        : <Box sx={{ display: 'flex', gap: '6px' }}><b>GPU</b><span className="muted">temps non mesurable ici</span></Box>}
      {/* Nombre d'appels de dessin et de triangles. */}
      <span className="muted">{shortCount(perf.calls)} dessins · {shortCount(perf.triangles)} triangles</span>
      {/* Ligne de la mémoire (début de la balise). */}
      <span className="muted">
        {/* Nombre de textures et de maillages, puis la mémoire JavaScript si elle est connue. */}
        {shortCount(perf.textures)} textures · {shortCount(perf.geometries)} maillages{perf.heapMb !== null ? ` · ${perf.heapMb} Mo` : ''}
      {/* Fin de la ligne de la mémoire. */}
      </span>
      {/* Le nom de la carte graphique, s'il est connu. */}
      {perf.gpuName && <span className="muted">{perf.gpuName}</span>}
    {/* Fin de la carte. */}
    </Paper>
  // Fin du rendu.
  );
// Fin de PerfMonitor.
}
