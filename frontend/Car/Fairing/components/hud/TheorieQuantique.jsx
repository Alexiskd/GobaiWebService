// Onglet « Théorie quantique » de la fenêtre Node : la théorie Gobai Space (le système solaire serait un atome d'une
// masse très grande), la correspondance couches atomiques / orbites des planètes, et le tableau périodique dessiné
// avec l'élément hypothétique « Solarium » (119) ajouté.
// Composants MUI.
import { Box, Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
// Données de l'onglet : éléments, Solarium, couches et masse du Soleil.
import { ELEMENTS, SOLARIUM, COUCHES, MASSE_SOLEIL_KG } from './theorieQuantique.js';
// Importe scientific, qui écrit un nombre en notation scientifique française.
import { scientific } from '@/Engine/AstreSolideEngine/planetData';

// Titre de section, au même style que les autres onglets de Node.
const SectionTitle = ({ children }) => (
  // Titre de niveau 3, style overline, couleur secondaire.
  <Typography component="h3" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 2.5, mb: 0.5 }}>
    {children}
  </Typography>
);

// Tableau périodique : taille d'une case, écart, pas et marge du dessin (unités du viewBox).
const CASE = 34, ECART = 3, PAS = CASE + ECART, MARGE = 8;
// Largeur du dessin : marge, 18 groupes, moins le dernier écart, marge.
const LARG_TABLE = MARGE * 2 + 18 * PAS - ECART;
// Hauteur du dessin : marge, 10 lignes (7 périodes + Solarium + 2 lignes du bloc f), moins le dernier écart, marge.
const HAUT_TABLE = MARGE * 2 + 10 * PAS - ECART;

/** Abscisse et ordonnée d'une case du tableau, selon le groupe/période ou la colonne du bloc f. */
// caseXY : position de la case d'un élément du dessin.
const caseXY = (e) => (e.blocF
  // Bloc f : colonne affichée à partir du groupe 3.
  ? { x: MARGE + (e.colonneF + 2) * PAS, y: MARGE + (e.blocF - 1) * PAS }
  // Bloc principal : groupe et période.
  : { x: MARGE + (e.groupe - 1) * PAS, y: MARGE + (e.periode - 1) * PAS });

/** Le tableau périodique en SVG : les 118 cases, plus le Solarium en période 8, groupe 1, en surbrillance. */
// TableauPeriodique : dessine le tableau périodique des éléments.
function TableauPeriodique() {
  // La case du Solarium : période 8, groupe 1.
  const so = { x: MARGE, y: MARGE + (SOLARIUM.periode - 1) * PAS };
  // Début du rendu.
  return (
    // Le dessin (début de la balise).
    <Box
      // Rendu en balise svg, avec son repère de coordonnées et le rôle d'image.
      component="svg" viewBox={`0 0 ${LARG_TABLE} ${HAUT_TABLE}`} role="img"
      // Description pour les lecteurs d'écran : le nombre d'éléments et la place du Solarium.
      aria-label={`Tableau périodique des 118 éléments connus, plus le Solarium, élément hypothétique numéro 119, en période 8, groupe 1`}
      // Toute la largeur, hauteur proportionnelle, couleur secondaire pour les textes.
      sx={{ display: 'block', width: '100%', height: 'auto', color: 'text.secondary', mt: 1 }}
    // Fin de la balise ouvrante.
    >
      {/* Une case par élément connu (début). */}
      {ELEMENTS.map((e) => {
        // La position de la case.
        const { x, y } = caseXY(e);
        // Le rendu de la case.
        return (
          // Le groupe de la case : rectangle, numéro atomique et symbole.
          <g key={e.z}>
            {/* Le rectangle de la case. */}
            <Box component="rect" x={x} y={y} width={CASE} height={CASE} rx={4} sx={{ fill: 'action.hover', stroke: 'divider', strokeWidth: 1 }} />
            {/* Le numéro atomique, en haut à gauche, en petits caractères. */}
            <text x={x + 4} y={y + 10} fontSize="7.5" fill="currentColor">{e.z}</text>
            {/* Le symbole, centré, en gras. */}
            <text x={x + CASE / 2} y={y + 23} fontSize="11" fontWeight="700" textAnchor="middle" fill="currentColor">{e.symbole}</text>
          {/* Fin du groupe. */}
          </g>
        );
      // Fin des cases.
      })}
      {/* La case du Solarium, en surbrillance (début). */}
      <g>
        {/* Le rectangle, rempli de la couleur primaire. */}
        <Box component="rect" x={so.x} y={so.y} width={CASE} height={CASE} rx={4} sx={{ fill: (t) => t.palette.primary.main, stroke: (t) => t.palette.primary.light, strokeWidth: 1.5 }} />
        {/* Le numéro 119, en haut à gauche, en petits caractères clairs. */}
        <text x={so.x + 4} y={so.y + 10} fontSize="7.5" fill={(t) => t.palette.primary.contrastText}>{SOLARIUM.z}</text>
        {/* Le symbole « So », centré, en gras. */}
        <text x={so.x + CASE / 2} y={so.y + 23} fontSize="11" fontWeight="700" textAnchor="middle" fill={(t) => t.palette.primary.contrastText}>{SOLARIUM.symbole}</text>
      {/* Fin de la case du Solarium. */}
      </g>
    {/* Fin du dessin. */}
    </Box>
  // Fin du rendu.
  );
// Fin de TableauPeriodique.
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
      <SectionTitle>Tableau périodique, avec le Solarium</SectionTitle>
      {/* Le tableau périodique dessiné. */}
      <TableauPeriodique />
      {/* La légende du dessin. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte : les 118 éléments connus, le bloc f en bas, et le Solarium ajouté. */}
        Les 118 éléments connus (numéros 1 à 118) ; les deux lignes du bas sont le bloc f (lanthanides et actinides).
        La case en surbrillance est le <strong>Solarium</strong> (So, n° {SOLARIUM.z}), élément hypothétique ajouté par la
        théorie en période 8, groupe 1 : dans cette analogie, le Soleil en serait le noyau. Dans la réalité, le plus
        lourd élément connu est l’oganesson (118) ; le 119 n’existe pas encore.
      {/* Fin de la légende. */}
      </Typography>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de TheorieQuantique.
}
