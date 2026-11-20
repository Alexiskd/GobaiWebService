// Onglet « Théorie quantique » de la fenêtre Node : la théorie Gobai Space (le système solaire serait un atome d'une
// masse très grande), la correspondance couches atomiques / orbites des planètes, le tableau périodique dessiné
// avec la répartition des électrons par couche atomique (K, L, M…) et l'élément hypothétique « Solarium » (119),
// l'assemblage « SoaCen » (Solarium–Alpha Centauri), et le « tableau hypothétique » des systèmes stellaires proches.
// Composants MUI.
import { Box, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
// Données de l'onglet : éléments, Solarium, assemblage SoaCen, couches, masse du Soleil et auteur (signature).
import { ELEMENTS, SOLARIUM, MOLECULE, COUCHES, MASSE_SOLEIL_KG, AUTEUR } from './theorieQuantique.js';
// Le tableau hypothétique des systèmes stellaires proches.
import { TableauHypothetique } from './TableauHypothetique.jsx';
// La section « charge électrique du Soleil selon T » (description des calculs).
import { ChargeSoleil } from './ChargeSoleil.jsx';
// La section « caractéristiques d'un élément du tableau périodique ».
import { CaracteristiquesElement } from './CaracteristiquesElement.jsx';
// Importe scientific, qui écrit un nombre en notation scientifique française.
import { scientific } from '@/Engine/AstreSolideEngine/planetData';

// Titre de section, au même style que les autres onglets de Node.
const SectionTitle = ({ children }) => (
  // Titre de niveau 3, style overline, couleur secondaire.
  <Typography component="h3" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 2.5, mb: 0.5 }}>
    {children}
  </Typography>
);

// Tableau périodique : largeur et hauteur d'une case, écarts, pas et marge du dessin (unités du viewBox).
const CASE_L = 34, CASE_H = 56, ECART = 3, PAS_X = CASE_L + ECART, PAS_Y = CASE_H + ECART, MARGE = 8;
// Largeur du dessin : marge, 18 groupes, moins le dernier écart, marge.
const LARG_TABLE = MARGE * 2 + 18 * PAS_X - ECART;
// Hauteur du dessin : marge, 10 lignes (7 périodes + Solarium + 2 lignes du bloc f), moins le dernier écart, marge.
const HAUT_TABLE = MARGE * 2 + 10 * PAS_Y - ECART;

/** Abscisse et ordonnée d'une case du tableau, selon le groupe/période ou la colonne du bloc f. */
// caseXY : position de la case d'un élément du dessin.
const caseXY = (e) => (e.blocF
  // Bloc f : colonne affichée à partir du groupe 3.
  ? { x: MARGE + (e.colonneF + 2) * PAS_X, y: MARGE + (e.blocF - 1) * PAS_Y }
  // Bloc principal : groupe et période.
  : { x: MARGE + (e.groupe - 1) * PAS_X, y: MARGE + (e.periode - 1) * PAS_Y });

/** Les lignes de la répartition par couches, découpée par quatre nombres (deux lignes au plus). */
// lignesCouches : découpe la répartition [2, 8, 14, 2] en lignes de « 2, 8, 14, 2 ».
const lignesCouches = (couches) => {
  // Les lignes, par paquets de quatre nombres.
  const lignes = [];
  // Tant qu'il reste des nombres : un paquet de quatre.
  for (let i = 0; i < couches.length; i += 4) lignes.push(couches.slice(i, i + 4).join(', '));
  // Les lignes.
  return lignes;
// Fin de lignesCouches.
};

/**
 * Une case du tableau : rectangle, numéro atomique, symbole et répartition des électrons par couche (K, L, M…).
 * `fond` et `texte` colorent la case des éléments hypothétiques (surbrillance) ; sans elles, la case est neutre.
 */
// Case : dessine une case à la position x, y, pour l'élément e.
function Case({ e, x, y, fond, texte }) {
  // Les lignes de la répartition par couches.
  const lignes = lignesCouches(e.couches);
  // Couleur des textes : celle de la surbrillance, ou la couleur courante sinon.
  const couleurTexte = texte ? { fill: texte } : { fill: 'currentColor' };
  // Début du rendu.
  return (
    // Le groupe de la case.
    <g>
      {/* Le rectangle de la case. */}
      <Box component="rect" x={x} y={y} width={CASE_L} height={CASE_H} rx={4} sx={fond ? { fill: fond, stroke: texte, strokeWidth: 1.5 } : { fill: 'action.hover', stroke: 'divider', strokeWidth: 1 }} />
      {/* Le numéro atomique, en haut à gauche, en petits caractères. */}
      <Box component="text" x={x + 4} y={y + 10} fontSize="7.5" sx={couleurTexte}>{e.z}</Box>
      {/* Le symbole, centré, en gras (« So » pour le Solarium). */}
      <Box component="text" x={x + CASE_L / 2} y={y + 22} fontSize="11" fontWeight="700" textAnchor="middle" sx={couleurTexte}>{e.symbole}</Box>
      {/* Le nom de l'élément, quand il en a un (ex. « Solarium »), sous le symbole. */}
      {e.nom && <Box component="text" x={x + CASE_L / 2} y={y + 31} fontSize="6.5" textAnchor="middle" sx={couleurTexte}>{e.nom}</Box>}
      {/* La masse atomique, quand elle est définie (Solarium : 1,00 M☉), sous le nom. */}
      {e.masse && <Box component="text" x={x + CASE_L / 2} y={y + 40} fontSize="6.5" fontWeight="600" textAnchor="middle" sx={couleurTexte}>{e.masse}</Box>}
      {/* La répartition par couches, en bas de case, sur une ou deux lignes. */}
      {lignes.map((ligne, i) => (
        // Une ligne de la répartition.
        <Box key={i} component="text" x={x + CASE_L / 2} y={y + CASE_H - 9 + i * 8} fontSize="6" textAnchor="middle" sx={couleurTexte}>{ligne}</Box>
      // Fin des lignes.
      ))}
      {/* Infobulle : numéro, symbole, nom, masse et répartition complète, pour les lecteurs d'écran et le survol. */}
      <title>{`${e.z} ${e.symbole}${e.nom ? ` (${e.nom})` : ''}${e.masse ? `, masse ${e.masse}${e.masseDetail ? ` ${e.masseDetail}` : ''}` : ''} : couches K, L, M… = ${e.couches.join(', ')}`}</title>
    {/* Fin du groupe. */}
    </g>
  // Fin du rendu.
  );
// Fin de Case.
}

/**
 * Le tableau périodique (théorique) en SVG : les 118 cases avec leur répartition par couches atomiques, plus
 * l'élément hypothétique de la théorie en surbrillance : le Solarium (119) en période 8, groupe 1. Le Proximium
 * (Proxima Centauri) a été retiré de ce tableau : il figure dans le « tableau hypothétique » des systèmes proches.
 */
// TableauPeriodique : dessine le tableau périodique des éléments.
function TableauPeriodique() {
  // La position de la case du Solarium : période 8, groupe 1.
  const so = caseXY(SOLARIUM);
  // Début du rendu.
  return (
    // Le dessin (début de la balise).
    <Box
      // Rendu en balise svg, avec son repère de coordonnées et le rôle d'image.
      component="svg" viewBox={`0 0 ${LARG_TABLE} ${HAUT_TABLE}`} role="img"
      // Description pour les lecteurs d'écran : les 118 éléments, les couches par case, et le Solarium.
      aria-label={`Tableau périodique des 118 éléments connus, avec la répartition des électrons par couche atomique en bas de chaque case, plus le Solarium (119, période 8, groupe 1)`}
      // Toute la largeur, hauteur proportionnelle, couleur secondaire pour les textes.
      sx={{ display: 'block', width: '100%', height: 'auto', color: 'text.secondary', mt: 1 }}
    // Fin de la balise ouvrante.
    >
      {/* Une case par élément connu, avec ses couches atomiques (début). */}
      {ELEMENTS.map((e) => {
        // La position de la case.
        const { x, y } = caseXY(e);
        // La case.
        return <Case key={e.z} e={e} x={x} y={y} />;
      // Fin des cases.
      })}
      {/* La case du Solarium, en surbrillance primaire. */}
      <Case e={SOLARIUM} x={so.x} y={so.y} fond={(t) => t.palette.primary.main} texte={(t) => t.palette.primary.contrastText} />
    {/* Fin du dessin. */}
    </Box>
  // Fin du rendu.
  );
// Fin de TableauPeriodique.
}

/** L'assemblage SoaCen en SVG : les deux noyaux (Soleil = Solarium « So », Alpha Centauri « aCen ») reliés par une liaison. */
// MoleculeSoaCen : dessine l'assemblage diatomique So–aCen, avec la paire d'électrons partagée au milieu de la liaison.
function MoleculeSoaCen() {
  // Les deux atomes de l'assemblage, avec leur position dans le dessin.
  const atomes = [
    { e: MOLECULE.atomes[0], x: 150, y: 140, label: 'Soleil' },
    { e: MOLECULE.atomes[1], x: 410, y: 140, label: 'Alpha Centauri' },
  ];
  // Le milieu de la liaison.
  const mx = (atomes[0].x + atomes[1].x) / 2, my = atomes[0].y;
  // Début du rendu.
  return (
    // Le dessin (début de la balise).
    <Box
      // Rendu en balise svg, avec son repère de coordonnées et le rôle d'image.
      component="svg" viewBox="0 0 560 300" role="img"
      // Description pour les lecteurs d'écran : l'assemblage SoaCen et ses deux atomes.
      aria-label={`Assemblage SoaCen : Solarium (Soleil, So, 119) et aCen (Alpha Centauri / Proxima Centauri, 120) reliés par une liaison simple avec une paire d'électrons partagée`}
      // Toute la largeur, hauteur proportionnelle, couleur secondaire.
      sx={{ display: 'block', width: '100%', maxWidth: 520, height: 'auto', mx: 'auto', color: 'text.secondary', mt: 1 }}
    // Fin de la balise ouvrante.
    >
      {/* La liaison, avec la paire d'électrons partagée au milieu (début). */}
      <line x1={atomes[0].x + 26} y1={my} x2={atomes[1].x - 26} y2={my} stroke="currentColor" strokeWidth="2" />
      {/* Les deux électrons partagés, au milieu de la liaison. */}
      <circle cx={mx} cy={my - 7} r="4" sx={{ fill: (t) => t.palette.primary.main }} />
      <circle cx={mx} cy={my + 7} r="4" sx={{ fill: (t) => t.palette.primary.main }} />
      {/* La formule, au-dessus de la liaison. */}
      <text x={mx} y={my - 46} fontSize="15" fontWeight="700" textAnchor="middle" fill="currentColor">{MOLECULE.nom}</text>
      {/* Un atome par noyau (début). */}
      {atomes.map(({ e, x, y, label }, i) => (
        // Le groupe de l'atome.
        <g key={e.z}>
          {/* Deux couches autour du noyau. */}
          <circle cx={x} cy={y} r="38" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
          <circle cx={x} cy={y} r="52" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="3 4" />
          {/* Le noyau, en surbrillance : primaire pour le Solarium, secondaire pour le Proximium. */}
          <circle cx={x} cy={y} r="26" sx={{ fill: (t) => (i === 0 ? t.palette.primary.main : t.palette.secondary.main) }} />
          {/* Le symbole de l'atome (So, aCen), au centre du noyau. */}
          <Box component="text" x={x} y={y - 1} fontSize="12" fontWeight="700" textAnchor="middle" sx={{ fill: (t) => (i === 0 ? t.palette.primary.contrastText : t.palette.secondary.contrastText) }}>{MOLECULE.symboles[i]}</Box>
          {/* Le numéro atomique, sous le symbole. */}
          <Box component="text" x={x} y={y + 12} fontSize="8.5" textAnchor="middle" sx={{ fill: (t) => (i === 0 ? t.palette.primary.contrastText : t.palette.secondary.contrastText) }}>{e.z}</Box>
          {/* Le nom du noyau, sous l'atome. */}
          <text x={x} y={y + 72} fontSize="11" fontWeight="600" textAnchor="middle" fill="currentColor">{`${label} · ${e.nom}`}</text>
        {/* Fin du groupe. */}
        </g>
      // Fin des atomes.
      ))}
    {/* Fin du dessin. */}
    </Box>
  // Fin du rendu.
  );
// Fin de MoleculeSoaCen.
}

// Schéma de l'atome : centre du dessin, rayon de la première orbite et écart entre deux orbites (unités du viewBox).
const CX = 280, CY = 230, R0 = 36, DR = 26;

/** L'analogie en dessin : le Soleil au centre (noyau) et les huit planètes sur les couches K à R. */
// AtomeSolaire : dessine le noyau « Soleil » et les huit orbites étiquetées.
function AtomeSolaire() {
  // Début du rendu.
  return (
    // Le dessin (début de la balise).
    <Box
      // Rendu en balise svg, avec son repère de coordonnées et le rôle d'image.
      component="svg" viewBox="0 0 560 460" role="img"
      // Description pour les lecteurs d'écran : le Soleil au noyau et les planètes de Mercure à Neptune.
      aria-label="Schéma de l'analogie : le Soleil au centre du noyau, et Mercure, Vénus, Terre, Mars, Jupiter, Saturne, Uranus et Neptune sur les couches K à R"
      // Toute la largeur, hauteur proportionnelle, couleur secondaire.
      sx={{ display: 'block', width: '100%', maxWidth: 480, height: 'auto', mx: 'auto', color: 'text.secondary', mt: 1 }}
    // Fin de la balise ouvrante.
    >
      {/* Une orbite par couche, de K (la plus proche) à R (la plus lointaine) (début). */}
      {COUCHES.map((c, i) => {
        // Le rayon de l'orbite.
        const r = R0 + i * DR;
        // L'angle du point représentant la planète sur l'orbite, en radians.
        const a = ((-60 + i * 45) * Math.PI) / 180;
        // Le rendu de l'orbite.
        return (
          // Le groupe de l'orbite.
          <g key={c.couche}>
            {/* Le cercle de l'orbite, en trait fin. */}
            <circle cx={CX} cy={CY} r={r} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
            {/* La planète, un point sur l'orbite, en couleur primaire. */}
            <circle cx={CX + r * Math.cos(a)} cy={CY + r * Math.sin(a)} r="4.5" sx={{ fill: (t) => t.palette.primary.main }} />
            {/* L'étiquette de la couche et de la planète, en haut de l'orbite. */}
            <text x={CX} y={CY - r - 4} fontSize="11" fontWeight="600" textAnchor="middle" fill="currentColor">{`${c.couche} · ${c.planete}`}</text>
          {/* Fin du groupe. */}
          </g>
        );
      // Fin des orbites.
      })}
      {/* Le noyau : le Soleil (début). */}
      <g>
        {/* Le disque du noyau, en couleur primaire. */}
        <circle cx={CX} cy={CY} r="20" sx={{ fill: (t) => t.palette.primary.main }} />
        {/* Le nom du Soleil, au centre du noyau. */}
        <text x={CX} y={CY + 3.5} fontSize="9.5" fontWeight="700" textAnchor="middle" fill={(t) => t.palette.primary.contrastText}>Soleil</text>
      {/* Fin du noyau. */}
      </g>
    {/* Fin du dessin. */}
    </Box>
  // Fin du rendu.
  );
// Fin de AtomeSolaire.
}

// Déclare et exporte le composant TheorieQuantique, l'onglet « Théorie quantique » de la fenêtre Node.
export function TheorieQuantique() {
  // Début du rendu.
  return (
    // Le conteneur de l'onglet.
    <Box>
      {/* Premier titre. */}
      <SectionTitle>Le système solaire, un atome géant ?</SectionTitle>
      {/* Le texte de la théorie (début). */}
      <Typography variant="body1">
        {/* Son contenu : la théorie Gobai Space. */}
        Selon la théorie Gobai Space, le système solaire serait un atome d’une masse très grande : le Soleil jouerait le
        rôle du noyau — il concentre 99,86 % de la masse du système, soit {scientific(MASSE_SOLEIL_KG, 3)} kg — et les
        huit planètes celui des électrons, chacune tournant sur son orbite comme sur une couche atomique.
      {/* Fin du texte. */}
      </Typography>
      {/* La mise en garde, en petits caractères. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte : analogie spéculative, pas un modèle scientifique établi. */}
        Mise en garde : c’est une analogie spéculative, présentée pour le plaisir de la comparaison — ce n’est pas un
        modèle scientifique établi. Les planètes ne sont pas des électrons, et les échelles de masse et de distance ne
        se correspondent pas.
      {/* Fin de la mise en garde. */}
      </Typography>

      {/* Deuxième titre. */}
      <SectionTitle>Couches atomiques et orbites des planètes</SectionTitle>
      {/* Le schéma de l'atome. */}
      <AtomeSolaire />
      {/* Le tableau de la correspondance, en chiffres de largeur fixe. */}
      <Table size="small" sx={{ mt: 1, maxWidth: 520, '& td': { fontVariantNumeric: 'tabular-nums' } }}>
        {/* Corps du tableau. */}
        <TableBody>
          {/* Une ligne par couche, de K à R (début). */}
          {COUCHES.map((c) => (
            // La ligne.
            <TableRow key={c.couche}>
              {/* La lettre de la couche, en en-tête de ligne. */}
              <TableCell component="th" scope="row" sx={{ color: 'text.secondary', pl: 0 }}>Couche {c.couche} (n = {c.n})</TableCell>
              {/* La planète de l'orbite. */}
              <TableCell>{c.planete}</TableCell>
              {/* La capacité maximale de la couche : 2n². */}
              <TableCell align="right" sx={{ pr: 0 }}>2n² = {c.capacite}</TableCell>
            {/* Fin de la ligne. */}
            </TableRow>
          // Fin des lignes.
          ))}
        {/* Fin du corps. */}
        </TableBody>
      {/* Fin du tableau. */}
      </Table>
      {/* La note sur les capacités, en petits caractères. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte : au-delà de n = 4, 2n² est une valeur théorique. */}
        La capacité 2n² est le nombre maximal d’électrons d’une couche ; au-delà de n = 4, elle n’est qu’une valeur théorique.
      {/* Fin de la note. */}
      </Typography>

      {/* Troisième titre. */}
      <SectionTitle>Tableau périodique théorique, couches atomiques et Solarium</SectionTitle>
      {/* Le tableau périodique dessiné. */}
      <TableauPeriodique />
      {/* La légende du dessin. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte : les 118 éléments, les couches en bas de case, le bloc f, et les deux hypothétiques. */}
        Les 118 éléments connus (numéros 1 à 118) ; les deux lignes du bas sont le bloc f (lanthanides et actinides).
        En bas de chaque case, les chiffres sont la répartition des électrons par couche atomique (K, L, M…),
        par exemple le fer (26) : 2, 8, 14, 2. La case en surbrillance est ajoutée par la théorie : le{' '}
        <strong>Solarium</strong> — n° atomique {SOLARIUM.z}, symbole <strong>So</strong>, nom <strong>Solarium</strong>,
        masse atomique {SOLARIUM.masse} ({SOLARIUM.masseDetail}), période 8, groupe 1 — dont le Soleil serait le noyau.
        Dans la réalité, le plus lourd élément connu est l’oganesson (118) ; le 119 n’existe pas encore.
        Le <strong>Proximium</strong> (Pr, Proxima Centauri) a été retiré de ce tableau : il figure dans le tableau
        hypothétique ci-dessous.
      {/* Fin de la légende. */}
      </Typography>

      {/* Quatrième titre. */}
      <SectionTitle>L’assemblage {MOLECULE.nom} ({MOLECULE.formule})</SectionTitle>
      {/* Le schéma de l'assemblage. */}
      <MoleculeSoaCen />
      {/* La légende de l'assemblage. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte : l'assemblage SoaCen, deux noyaux liés. */}
        L’assemblage <strong>{MOLECULE.nom}</strong> ({MOLECULE.formule}) réunit les deux astres de la théorie :
        le <strong>Solarium</strong> (So, 119 — le Soleil) et <strong>aCen</strong> (Alpha Centauri, qui contient Proxima
        Centauri — le Proximium du tableau hypothétique), reliés par une liaison simple avec une paire d’électrons
        partagée. Dans l’analogie, cette « liaison » serait la gravitation entre les deux étoiles les plus proches l’une
        de l’autre (≈ 4,24 années-lumière) — toujours une analogie spéculative, pas un modèle scientifique établi.
      {/* Fin de la légende. */}
      </Typography>
      {/* Le paragraphe sur l'analogie quark / interaction forte. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte : aCen, un « quark » lié par l'interaction forte. */}
        <strong>Analogie avec le quark et l’interaction forte :</strong> dans un hadron, les quarks sont maintenus
        ensemble par l’interaction forte (les gluons) et ne peuvent pas être isolés — c’est le confinement. Sur la même
        optique, <strong>aCen</strong> (Alpha Centauri) serait le « quark » voisin du Soleil-atome : à l’échelle
        stellaire, la gravitation jouerait le rôle de l’interaction forte, liant les deux « atomes » en un assemblage
        plus grand. Encore une analogie spéculative : aucune mesure ne confirme un « confinement » gravitationnel entre
        étoiles.
      {/* Fin du paragraphe. */}
      </Typography>
      {/* Le paragraphe sur le problème à trois corps. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte : Alpha Centauri est un système triple, sans solution analytique générale. */}
        <strong>Le problème à trois corps :</strong> Alpha Centauri est un système triple (A, B et Proxima). Poincaré a
        montré qu’il n’existe pas de solution analytique générale pour trois corps en interaction gravitationnelle :
        leurs orbites ne sont pas des ellipses parfaites et deviennent chaotiques à long terme — on les calcule par
        intégration numérique. Dans l’analogie Gobai, l’« assemblage » Soleil–aCen est donc en réalité un problème à
        trois corps, ce qui illustre la limite de l’analogie.
      {/* Fin du paragraphe. */}
      </Typography>

      {/* Cinquième titre. */}
      <SectionTitle>Tableau hypothétique : les 48 systèmes à moins de 16,3 a.l.</SectionTitle>
      {/* Le tableau hypothétique dessiné. */}
      <TableauHypothetique />
      {/* La légende du tableau hypothétique. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte : les systèmes proches, avec Proxima Centauri (Proximium) dans Alpha Centauri. */}
        Chaque case est un système stellaire ou substellaire situé à moins de 16,3 années-lumière : le rang 0 est le
        Système solaire (le <strong>Solarium</strong>, en surbrillance primaire) et le rang 1, Alpha Centauri (en
        surbrillance secondaire), contient <strong>Proxima Centauri</strong> — le <strong>Proximium</strong> (Pr) de la
        théorie, retiré du tableau théorique ci-dessus. La masse de chaque composante est exprimée en masses solaires
        (M☉) pour les étoiles, en masses joviennes (M_J) pour les naines brunes les plus légères
        (1 M☉ ≈ 1,989 × 10³⁰ kg ≈ 333 000 masses terrestres ; 1 M_J ≈ 1,898 × 10²⁷ kg ≈ 318 masses terrestres).
        La plus lourde du voisinage est Sirius A (2,063 M☉) ; la limite de fusion de l’hydrogène est ≈ 0,075–0,080 M☉
        (~80 M_J), frontière entre naine rouge et naine brune.
      {/* Fin de la légende. */}
      </Typography>

      {/* Sixième titre. */}
      <SectionTitle>Charge électrique du Soleil selon T — description des calculs</SectionTitle>
      {/* La section des calculs. */}
      <ChargeSoleil />

      {/* Septième titre. */}
      <SectionTitle>Caractéristiques d’un élément du tableau périodique</SectionTitle>
      {/* La section Z et masse atomique. */}
      <CaracteristiquesElement />

      {/* La signature de la théorie. */}
      <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ mt: 3, textAlign: 'right' }}>
        {/* Son texte : la théorie Gobai Space signée par son auteur. */}
        Théorie quantique Gobai Space — signée {AUTEUR}
      {/* Fin de la signature. */}
      </Typography>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de TheorieQuantique.
}
