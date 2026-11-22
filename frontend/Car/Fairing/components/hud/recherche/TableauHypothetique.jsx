// « Tableau hypothétique » de l'onglet « Théorie quantique » : les systèmes stellaires et substellaires à moins de
// 16,3 années-lumière, dessinés comme un tableau périodique (une case par système, rang 0 = le Système solaire /
// Solarium, rang 1 = Alpha Centauri qui contient Proxima Centauri / le Proximium), avec en dessous la liste complète
// des composantes individuelles (type spectral, distance, masse).
// Composants du kit d'interface.
// Importe les conversions des valeurs de style calculées au rendu.
import { tok } from '@/Fairing/kit/sx';
// Briques de style communes de la fenêtre Node.
import { Carte, Chiffre, Fiche, GrilleChiffres, SousTitre } from '../node/nodeUi.jsx';
// Données : les systèmes, leurs composantes et les compteurs simple/multiple.
import { SYSTEMES, ALPHA_CENTAURI, countMonoEtoiles, countMultiples } from './tableauHypothetique.js';

// Grille du dessin : 7 colonnes, taille d'une case, écart, pas et marge (unités du viewBox).
const COLS = 7, CASE_L = 88, CASE_H = 52, ECART = 4, PAS_X = CASE_L + ECART, PAS_Y = CASE_H + ECART, MARGE = 8;
// Nombre de lignes de la grille.
const LIGNES = Math.ceil(SYSTEMES.length / COLS);
// Largeur et hauteur du dessin.
const LARG = MARGE * 2 + COLS * PAS_X - ECART;
const HAUT = MARGE * 2 + LIGNES * PAS_Y - ECART;

/** Le tableau hypothétique en SVG : une case par système, rang en haut à gauche, code au centre, masse en bas. */
// GrilleSystemes : dessine les cases des systèmes.
function GrilleSystemes() {
  // Début du rendu.
  return (
    // Le dessin (début de la balise).
    <svg viewBox={`0 0 ${LARG} ${HAUT}`} role="img"
      // Description pour les lecteurs d'écran : le nombre de systèmes et les deux cases remarquables.
      aria-label={`Tableau hypothétique : ${SYSTEMES.length} systèmes à moins de 16,3 années-lumière, du Système solaire (rang 0, Solarium) à 40 Eridani (rang 48) ; Alpha Centauri (rang 1) contient Proxima Centauri, le Proximium`}
      // Toute la largeur, hauteur proportionnelle, couleur secondaire pour les textes.
      className="block w-full h-auto text-soft mt-2"
    // Fin de la balise ouvrante.
    >
      {/* Une case par système (début). */}
      {SYSTEMES.map((s, i) => {
        // La position de la case dans la grille.
        const x = MARGE + (i % COLS) * PAS_X, y = MARGE + Math.floor(i / COLS) * PAS_Y;
        // La case est-elle remarquable : rang 0 (Système solaire / Solarium) ou rang 1 (Alpha Centauri / Proximium).
        const solarium = s.rang === 0, proximium = s === ALPHA_CENTAURI;
        // Le fond et le texte de la case : surbrillance primaire pour le Solarium, secondaire pour le Proximium.
        const fond = solarium ? 'primary.main' : proximium ? 'secondary.main' : 'action.hover';
        const bord = solarium ? 'primary.light' : proximium ? 'secondary.main' : 'divider';
        const texte = solarium ? 'primary.contrastText' : proximium ? 'secondary.contrastText' : 'currentColor';
        // Le rendu de la case.
        return (
          // Le groupe de la case.
          <g key={s.rang}>
            {/* Le rectangle de la case. */}
            <rect x={x} y={y} width={CASE_L} height={CASE_H} rx={5} className={`${solarium || proximium ? '[stroke-width:1.5]' : '[stroke-width:1]'}`} style={{ fill: tok(fond), stroke: tok(bord) }} />
            {/* Le rang, en haut à gauche, en petits caractères. */}
            <text x={x + 5} y={y + 11} fontSize="8" style={{ fill: tok(texte) }}>{s.rang}</text>
            {/* Le code du système, centré, en gras. */}
            <text x={x + CASE_L / 2} y={y + 27} fontSize="12.5" fontWeight="700" textAnchor="middle" style={{ fill: tok(texte) }}>{s.code}</text>
            {/* La masse de la composante principale, en bas de case. */}
            <text x={x + CASE_L / 2} y={y + CASE_H - 8} fontSize="7.5" textAnchor="middle" style={{ fill: tok(texte) }}>{s.composantes[0].masse}</text>
            {/* Infobulle : le nom complet, la distance et les composantes. */}
            <title>{`${s.rang} · ${s.nom} — ${s.composantes[0].distance} a.l. — ${s.composantes.map((c) => c.nom).join(', ')}`}</title>
          {/* Fin du groupe. */}
          </g>
        );
      // Fin des cases.
      })}
    {/* Fin du dessin. */}
    </svg>
  // Fin du rendu.
  );
// Fin de GrilleSystemes.
}

/** Section complète : chiffres clés, la grille des systèmes, puis toutes les composantes en tableau. */
// Déclare et exporte TableauHypothetique.
export function TableauHypothetique() {
  // Nombre total de composantes (étoiles et naines brunes), tous systèmes confondus.
  const composantes = SYSTEMES.reduce((n, s) => n + s.composantes.length, 0);
  // Les lignes du tableau : le rang et le nom du système ne sont écrits que sur sa première composante.
  const lignes = SYSTEMES.flatMap((s) => s.composantes.map((c, i) => [i === 0 ? s.rang : '', i === 0 ? s.nom : '', c.nom, c.type, c.distance, c.masse]));
  // Début du rendu.
  return (
    <div>
      {/* Chiffres clés du voisinage. */}
      <GrilleChiffres>
        <Chiffre libelle="Systèmes, Système solaire compris" valeur={SYSTEMES.length} detail={`${composantes} étoiles et naines brunes`} />
        <Chiffre libelle="Systèmes à une seule étoile" valeur={countMonoEtoiles()} detail="aucun problème à trois corps" />
        <Chiffre libelle="Systèmes multiples" valeur={countMultiples()} detail="2 ou 3 composantes : problème à N corps" />
      </GrilleChiffres>
      {/* La grille des systèmes. */}
      <Carte className="mt-3 bg-transparent p-1 min-[600px]:p-2"><GrilleSystemes /></Carte>
      {/* Toutes les composantes. */}
      <SousTitre>Toutes les composantes</SousTitre>
      <Fiche
        label="Composantes des systèmes à moins de 16,3 années-lumière : type spectral, distance et masse"
        colonnes={[{ titre: 'Rang', cache: true }, { titre: 'Système' }, { titre: 'Composante' }, { titre: 'Type spectral', cache: true }, { titre: 'Distance (a.l.)', align: 'right' }, { titre: 'Masse', align: 'right' }]}
        lignes={lignes}
      />
    </div>
  );
// Fin de TableauHypothetique.
}
