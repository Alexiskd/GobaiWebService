// Importe de React les crochets useEffect et useState.
import { useEffect, useState } from 'react';
// Briques de style communes de la fenêtre Node.
import { Carte, Chiffre, Formule, GrilleChiffres, Note, Section } from '../node/nodeUi.jsx';
// Importe plusieurs éléments du module fluxCognitif (début de la liste).
import {
  // Le nombre de pensées par jour, l'année décimale, le flux en direct, la courbe du flux et la croissance de la population par seconde.
  PENSEES_PAR_JOUR, decimalYear, fluxCognitifEnDirect, fluxCurve, populationGrowthPerSecond,
// Fin de la liste ; module d'origine.
} from '@/Engine/shared/lib/fluxCognitif';
// Importe scientific, qui écrit un nombre en notation scientifique.
import { scientific } from '@/Engine/AstreSolideEngine/BodyEngine/planetData';

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
    <svg viewBox={`0 0 ${W} ${H}`} role="img"
      // Description pour les lecteurs d'écran, avec les valeurs de départ et d'arrivée.
      aria-label={`Courbe du flux cognitif mondial de 2024 à 2046, en pensées par jour : de ${points[0][1].toFixed(2).replace('.', ',')} à ${points[points.length - 1][1].toFixed(2).replace('.', ',')} × 10¹³`}
      // Toute la largeur, hauteur proportionnelle, couleur secondaire.
      className="block w-full h-auto text-soft mt-2"
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
      <path d={path} fill="none" strokeWidth="2.5" strokeLinejoin="round" className="stroke-primary" />
      {/* Maintenant : repère vertical et point sur la courbe. */}
      {/* Trait vertical en pointillés à l'instant présent. */}
      <line x1={px(nx)} x2={px(nx)} y1={TOP} y2={H - BOTTOM} stroke="currentColor" strokeOpacity="0.45" strokeDasharray="3 4" />
      {/* Point sur la courbe à l'instant présent, cerclé de la couleur du fond. */}
      <circle cx={px(nx)} cy={py(ny)} r="5" className="fill-primary stroke-surface" strokeWidth="2" />
      {/* Le mot « maintenant », à côté du point. */}
      <text x={px(nx) + 9} y={py(ny) + 16} fontSize="11" fill="currentColor">maintenant</text>
    {/* Fin du dessin. */}
    </svg>
  // Fin du rendu.
  );
// Fin de Courbe.
}

/** Onglet « Flux cognitif » : la population en direct, la relation F(t) = P(t) × p, ses valeurs et sa courbe. */
// Déclare et exporte le composant FluxCognitif.
export function FluxCognitif() {
  // État : l'instant courant en millisecondes, relu chaque seconde.
  const [ms, setMs] = useState(() => Date.now());
  // Effet : met l'instant à jour toutes les secondes, et arrête le minuteur à la fermeture de l'onglet.
  useEffect(() => {
    const timer = setInterval(() => setMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Le flux cognitif et la population à cet instant.
  const flux = fluxCognitifEnDirect(ms);
  // La croissance de la population, en personnes par seconde.
  const growth = populationGrowthPerSecond(ms);
  // Début du rendu.
  return (
    <div>
      {/* Le compteur de population, en grand. */}
      <Carte accent="primary.main" className="mt-1">
        <h3 className="t-overline text-soft block leading-[1.6]">Population mondiale en direct</h3>
        <p aria-live="off" className="t-body1 text-[30px] min-[600px]:text-[40px] font-bold tabular-nums leading-[1.15] tracking-[-0.02em]">
          {entier(flux.population)}
        </p>
        <p className="t-body2 text-soft mt-1 max-w-[78ch]">
          Estimation : + {growth.toFixed(1).replace('.', ',')} personne{growth >= 2 ? 's' : ''} par seconde, par interpolation des
          projections des Nations unies (World Population Prospects 2024). Personne ne compte les habitants en temps réel.
        </p>
      </Carte>

      <Section numero={1} titre="La relation" sousTitre="Ce n’est pas une constante : le flux suit la population.">
        <Formule>{'F(t) = P(t) × p'}</Formule>
        <Note>
          F : pensées humaines produites dans le monde · P(t) : population mondiale à l’instant t · p = {entier(PENSEES_PAR_JOUR)} pensées
          par jour et par personne (Tseng et Poppenk, Université Queen’s, 2020).
        </Note>
        {/* Les trois valeurs du flux. */}
        <GrilleChiffres className="mt-3">
          <Chiffre libelle="Pensées par seconde" valeur={scientific(flux.parSeconde, 3)} detail={entier(flux.parSeconde)} />
          <Chiffre libelle="Pensées par jour" valeur={scientific(flux.parJour, 3)} detail={entier(flux.parJour)} />
          <Chiffre libelle="Pensées par an" valeur={scientific(flux.parAn, 3)} detail={entier(flux.parAn)} />
        </GrilleChiffres>
      </Section>

      <Section numero={2} titre="La courbe de F(t)" sousTitre="Pensées par jour, × 10¹³, de 2024 à 2046.">
        <Carte className="bg-transparent"><Courbe now={decimalYear(ms)} nowValue={flux.parJour} /></Carte>
        <Note>
          Ordre de grandeur : la mesure de 6 200 transitions de pensée par jour porte sur des adultes éveillés, et elle est
          appliquée ici à toute la population.
        </Note>
      </Section>
    </div>
  );
// Fin de FluxCognitif.
}
