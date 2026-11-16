// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Importe de MUI Box, les éléments de tableau et Typography.
import { Box, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
// Importe plusieurs éléments du module fluxCognitif (début de la liste).
import {
  // Le nombre de pensées par jour, l'année décimale, le flux en direct, la courbe du flux et la croissance de la population par seconde.
  PENSEES_PAR_JOUR, decimalYear, fluxCognitifEnDirect, fluxCurve, populationGrowthPerSecond,
// Fin de la liste ; module d'origine.
} from '@/moteur/lib/fluxCognitif';
// Importe scientific, qui écrit un nombre en notation scientifique.
import { scientific } from '@/moteur/engine/planetData';

// Onglet « Flux cognitif » de la fenêtre Node : la relation F(t) = P(t) × p (moteur/lib/fluxCognitif.ts), calculée
// avec le compteur de population mondiale en direct, et sa courbe de 2024 à 2046.

// entier : arrondit un nombre et l'écrit au format français.
const entier = (n) => Math.round(n).toLocaleString('fr-FR');

// Courbe : dimensions du dessin (unités du viewBox) et marges pour les graduations.
// Dimensions du dessin et marges gauche, droite, haute et basse.
const W = 560, H = 250, LEFT = 46, RIGHT = 14, TOP = 16, BOTTOM = 30;
// Unité de l'axe vertical : 10 puissance 13.
const UNIT = 1e13; // axe vertical en dizaines de billions de pensées par jour

// Déclare le composant Courbe : reçoit l'année décimale courante et la valeur courante du flux.
function Courbe({ now, nowValue }) {
  // Points de la courbe : chaque année décalée d'une demi-année, valeur ramenée à l'unité de l'axe.
  const points = fluxCurve().map(([year, perDay]) => [year + 0.5, perDay / UNIT]); // valeurs ONU au 1er juillet
  // Bornes horizontales : première et dernière année.
  const x0 = points[0][0], x1 = points[points.length - 1][0];
  // Bornes verticales : première et dernière valeur, arrondies au dixième et élargies de 0,1.
  const y0 = Math.floor(points[0][1] * 10) / 10 - 0.1, y1 = Math.ceil(points[points.length - 1][1] * 10) / 10 + 0.1;
  // px : convertit une année en abscisse du dessin.
  const px = (x) => LEFT + ((x - x0) / (x1 - x0)) * (W - LEFT - RIGHT);
  // py : convertit une valeur en ordonnée du dessin (l'axe monte vers le haut).
  const py = (y) => H - BOTTOM - ((y - y0) / (y1 - y0)) * (H - TOP - BOTTOM);
  // Tracé SVG : un déplacement vers le premier point, puis une ligne vers chaque point suivant.
  const path = points.map(([x, y], i) => `${i ? 'L' : 'M'}${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(' ');
  // Cinq graduations verticales, régulièrement réparties.
  const yTicks = [0, 1, 2, 3, 4].map((i) => y0 + ((y1 - y0) * i) / 4);
  // Cinq graduations horizontales : une tous les cinq ans.
  const xTicks = [2025, 2030, 2035, 2040, 2045];
  // Position de « maintenant » : l'année bornée à la courbe, et la valeur courante dans l'unité de l'axe.
  const nx = Math.min(Math.max(now, x0), x1), ny = nowValue / UNIT;
  // Début du rendu.
  return (
    // Le dessin (début de la balise).
    <Box
      // Rendu en balise svg, avec son repère de coordonnées et le rôle d'image.
      component="svg" viewBox={`0 0 ${W} ${H}`} role="img"
      // Description pour les lecteurs d'écran, avec les valeurs de départ et d'arrivée.
      aria-label={`Courbe du flux cognitif mondial de 2024 à 2046, en pensées par jour : de ${points[0][1].toFixed(2).replace('.', ',')} à ${points[points.length - 1][1].toFixed(2).replace('.', ',')} × 10¹³`}
      // Toute la largeur, hauteur proportionnelle, couleur secondaire.
      sx={{ display: 'block', width: '100%', height: 'auto', color: 'text.secondary', mt: 1 }}
    // Fin de la balise ouvrante.
    >
      {/* Une graduation verticale par valeur (début). */}
      {yTicks.map((y) => (
        // Groupe de la graduation.
        <g key={y}>
          {/* Trait horizontal léger sur toute la largeur du graphique. */}
          <line x1={LEFT} x2={W - RIGHT} y1={py(y)} y2={py(y)} stroke="currentColor" strokeOpacity="0.18" />
          {/* Valeur de la graduation, à gauche, avec une virgule décimale. */}
          <text x={LEFT - 6} y={py(y) + 4} textAnchor="end" fontSize="11" fill="currentColor">{y.toFixed(2).replace('.', ',')}</text>
        {/* Fin du groupe. */}
        </g>
      // Fin des graduations verticales.
      ))}
      {/* Une graduation horizontale par année (début). */}
      {xTicks.map((x) => (
        // L'année, centrée sous l'axe.
        <text key={x} x={px(x)} y={H - 10} textAnchor="middle" fontSize="11" fill="currentColor">{x}</text>
      // Fin des graduations horizontales.
      ))}
      {/* La courbe, en couleur primaire, sans remplissage. */}
      <Box component="path" d={path} fill="none" strokeWidth="2.5" strokeLinejoin="round" sx={{ stroke: (t) => t.palette.primary.main }} />
      {/* Maintenant : repère vertical et point sur la courbe. */}
      {/* Trait vertical en pointillés à l'instant présent. */}
      <line x1={px(nx)} x2={px(nx)} y1={TOP} y2={H - BOTTOM} stroke="currentColor" strokeOpacity="0.45" strokeDasharray="3 4" />
      {/* Point sur la courbe à l'instant présent, cerclé de la couleur du fond. */}
      <Box component="circle" cx={px(nx)} cy={py(ny)} r="5" sx={{ fill: (t) => t.palette.primary.main, stroke: (t) => t.palette.background.paper }} strokeWidth="2" />
      {/* Le mot « maintenant », à côté du point. */}
      <text x={px(nx) + 9} y={py(ny) + 16} fontSize="11" fill="currentColor">maintenant</text>
    {/* Fin du dessin. */}
    </Box>
  // Fin du rendu.
  );
// Fin de Courbe.
}

// Déclare et exporte le composant FluxCognitif.
export function FluxCognitif() {
  // Une lecture par seconde tant que l'onglet est affiché.
  // État : l'instant présent, en millisecondes.
  const [ms, setMs] = useState(() => Date.now());
  // Effet exécuté une seule fois : l'horloge.
  useEffect(() => {
    // Met l'instant à jour toutes les secondes.
    const timer = setInterval(() => setMs(Date.now()), 1000);
    // Nettoyage : arrête l'horloge.
    return () => clearInterval(timer);
  // Fin de l'effet ; aucune dépendance.
  }, []);
  // Calcule le flux cognitif à cet instant.
  const flux = fluxCognitifEnDirect(ms);
  // Calcule la croissance de la population par seconde.
  const growth = populationGrowthPerSecond(ms);
  // Lignes du tableau (début).
  const rows = [
    // Flux par seconde.
    ['Par seconde', flux.parSeconde],
    // Flux par jour.
    ['Par jour', flux.parJour],
    // Flux par an.
    ['Par an', flux.parAn],
  // Fin des lignes.
  ];
  // Début du rendu.
  return (
    // Conteneur de l'onglet.
    <Box>
      {/* Premier titre, au style overline. */}
      <Typography variant="overline" color="text.secondary" component="h3" sx={{ display: 'block', lineHeight: 2, mt: 1 }}>
        {/* Son texte. */}
        Population mondiale en direct
      {/* Fin du premier titre. */}
      </Typography>
      {/* Le compteur de population, en grand, non annoncé à chaque seconde. */}
      <Typography component="p" aria-live="off" sx={{ fontSize: { xs: 28, sm: 34 }, fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
        {/* La population, en nombre entier. */}
        {entier(flux.population)}
      {/* Fin du compteur. */}
      </Typography>
      {/* Paragraphe d'explication. */}
      <Typography variant="body2" color="text.secondary">
        {/* La croissance par seconde (au pluriel à partir de 2) et la source des projections (texte sur deux lignes). */}
        Estimation : + {growth.toFixed(1).replace('.', ',')} personne{growth >= 2 ? 's' : ''} par seconde, par interpolation des
        projections des Nations unies (World Population Prospects 2024). Personne ne compte les habitants en temps réel.
      {/* Fin du paragraphe. */}
      </Typography>

      {/* Deuxième titre. */}
      <Typography variant="overline" color="text.secondary" component="h3" sx={{ display: 'block', lineHeight: 2, mt: 2.5 }}>
        {/* Son texte. */}
        Relation
      {/* Fin du deuxième titre. */}
      </Typography>
      {/* La formule, en police à chasse fixe. */}
      <Typography component="p" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 17 }}>
        {/* Son texte. */}
        F(t) = P(t) × p
      {/* Fin de la formule. */}
      </Typography>
      {/* Paragraphe de légende. */}
      <Typography variant="body2" color="text.secondary">
        {/* Le sens de F, de P(t) et de p, avec la valeur de p et sa source (texte sur deux lignes). */}
        F : pensées humaines produites dans le monde · P(t) : population mondiale à l’instant t · p = {entier(PENSEES_PAR_JOUR)} pensées
        par jour et par personne (Tseng et Poppenk, Université Queen’s, 2020).
      {/* Fin du paragraphe. */}
      </Typography>
      {/* Le tableau des valeurs, en chiffres de largeur fixe. */}
      <Table size="small" sx={{ mt: 1, '& td': { fontVariantNumeric: 'tabular-nums' } }}>
        {/* Corps du tableau. */}
        <TableBody>
          {/* Une ligne par période (début). */}
          {rows.map(([label, value]) => (
            // La ligne.
            <TableRow key={label}>
              {/* Le libellé, en en-tête de ligne. */}
              <TableCell component="th" scope="row" sx={{ color: 'text.secondary', pl: 0 }}>{label}</TableCell>
              {/* La valeur en notation scientifique, à trois chiffres. */}
              <TableCell align="right">{scientific(value, 3)}</TableCell>
              {/* La valeur entière, masquée sur les très petits écrans. */}
              <TableCell align="right" sx={{ pr: 0, display: { xs: 'none', sm: 'table-cell' } }}>{entier(value)}</TableCell>
            {/* Fin de la ligne. */}
            </TableRow>
          // Fin des lignes.
          ))}
        {/* Fin du corps du tableau. */}
        </TableBody>
      {/* Fin du tableau. */}
      </Table>

      {/* Troisième titre. */}
      <Typography variant="overline" color="text.secondary" component="h3" sx={{ display: 'block', lineHeight: 2, mt: 2.5 }}>
        {/* Son texte. */}
        Courbe de F(t) · pensées par jour, × 10¹³
      {/* Fin du troisième titre. */}
      </Typography>
      {/* La courbe, avec l'année et la valeur du moment. */}
      <Courbe now={decimalYear(ms)} nowValue={flux.parJour} />
      {/* Paragraphe de mise en garde. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* La limite de l'estimation (texte sur deux lignes). */}
        Ordre de grandeur : la mesure de 6 200 transitions de pensée par jour porte sur des adultes éveillés et elle est appliquée
        ici à toute la population.
      {/* Fin du paragraphe. */}
      </Typography>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de FluxCognitif.
}
