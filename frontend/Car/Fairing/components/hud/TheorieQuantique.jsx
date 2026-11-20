// Onglet « Théorie quantique » de la fenêtre Node : la théorie Gobai Space, selon laquelle la matière se répète
// d'échelle en échelle (la particule serait un astre, l'atome un système solaire, la molécule une constellation).
// L'onglet déroule : l'échelle complète des neuf niveaux, l'analogie atome ↔ système solaire mise en nombres, la loi
// en n² des couches confrontée aux orbites réelles, le tableau périodique avec le « Solarium » (119), l'assemblage
// « SoaCen », le tableau hypothétique des systèmes proches, la charge du Soleil et les caractéristiques d'un élément.
// Composants MUI.
import { Box, Typography } from '@mui/material';
// Données et calculs de la théorie.
import {
  ELEMENTS, SOLARIUM, MOLECULE, COUCHES, ORBITES, MASSE_SOLEIL_KG, AUTEUR, DISTANCE_PROXIMA_AL, EXCEPTIONS_COUCHES,
  comparaisonAtomeSysteme, ecartMoyenOrbites, energieNiveau, rapportForces, rayonBohr, rayonBohrGravitationnel,
} from './theorieQuantique.js';
// La section de l'échelle complète de la matière.
import { EchelleMatiere } from './EchelleMatiere.jsx';
// Le tableau hypothétique des systèmes stellaires proches.
import { TableauHypothetique } from './TableauHypothetique.jsx';
// La section « charge électrique du Soleil selon T ».
import { ChargeSoleil } from './ChargeSoleil.jsx';
// La section « caractéristiques d'un élément du tableau périodique ».
import { CaracteristiquesElement } from './CaracteristiquesElement.jsx';
// Briques de style communes de la fenêtre Node.
import { Alerte, Carte, Chiffre, Fiche, Formule, GrilleChiffres, Note, Section, SousTitre } from './nodeUi.jsx';
// Importe scientific, qui écrit un nombre en notation scientifique française.
import { scientific } from '@/Engine/AstreSolideEngine/planetData';

// virgule : écrit un nombre avec une virgule décimale et d chiffres après elle.
const virgule = (n, d = 2) => n.toFixed(d).replace('.', ',');
// pourcent : écrit une fraction en pourcentage, avec d décimales.
const pourcent = (f, d = 2) => `${virgule(f * 100, d)} %`;
// signe : écrit un écart avec son signe (« +21 % », « −53 % »).
const signe = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(0)} %`;

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
      <Box component="rect" x={x} y={y} width={CASE_L} height={CASE_H} rx={4} sx={fond ? { fill: fond, stroke: texte, strokeWidth: 1.5 } : { fill: (t) => t.palette.action.hover, stroke: (t) => t.palette.divider, strokeWidth: 1 }} />
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
      <Box component="circle" cx={mx} cy={my - 7} r="4" sx={{ fill: (t) => t.palette.primary.main }} />
      <Box component="circle" cx={mx} cy={my + 7} r="4" sx={{ fill: (t) => t.palette.primary.main }} />
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
          <Box component="circle" cx={x} cy={y} r="26" sx={{ fill: (t) => (i === 0 ? t.palette.primary.main : t.palette.secondary.main) }} />
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
            <Box component="circle" cx={CX + r * Math.cos(a)} cy={CY + r * Math.sin(a)} r="4.5" sx={{ fill: (t) => t.palette.primary.main }} />
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
        <Box component="circle" cx={CX} cy={CY} r="20" sx={{ fill: (t) => t.palette.primary.main }} />
        {/* Le nom du Soleil, au centre du noyau. */}
        <Box component="text" x={CX} y={CY + 3.5} fontSize="9.5" fontWeight="700" textAnchor="middle" sx={{ fill: (t) => t.palette.primary.contrastText }}>Soleil</Box>
      {/* Fin du noyau. */}
      </g>
    {/* Fin du dessin. */}
    </Box>
  // Fin du rendu.
  );
// Fin de AtomeSolaire.
}

/** Valeur d'une ligne de la comparaison atome / système solaire, écrite selon sa nature (part, rapport ou longueur). */
// ecrit : choisit l'écriture de la valeur.
const ecrit = (id, v) => (id === 'masse' ? pourcent(v, 3) : id === 'voisin' && v < 100 ? virgule(v) : scientific(v, 2));

/** Section « L'atome et le système solaire en nombres » : les grandeurs de Bohr, puis la comparaison chiffrée. */
// Déclare AnalogieChiffree.
function AnalogieChiffree() {
  // Les lignes de la comparaison.
  const lignes = comparaisonAtomeSysteme();
  // Début du rendu.
  return (
    <Box>
      {/* Chiffres clés de l'atome d'hydrogène. */}
      <GrilleChiffres>
        <Chiffre libelle="Rayon de Bohr a₀" valeur={`${scientific(rayonBohr(), 3)} m`} detail="a₀ = 4π ε₀ ħ² / (m_e e²)" />
        <Chiffre libelle="Niveau fondamental E₁" valeur={`${virgule(energieNiveau(1))} eV`} detail="E_n = −m_e e⁴ / (8 ε₀² h² n²)" />
        <Chiffre libelle="Force électrique / gravité" valeur={scientific(rapportForces(), 2)} detail="e² / (4π ε₀ G m_p m_e), entre proton et électron" />
        <Chiffre libelle="Masse du Soleil" valeur={`${scientific(MASSE_SOLEIL_KG, 3)} kg`} detail={`${pourcent(lignes[1].systeme)} de la masse du système`} />
      </GrilleChiffres>
      <Formule sx={{ mt: 1.5 }}>{'r_n = n² · a₀        E_n = −13,6 eV / n²        L = n · ħ'}</Formule>
      <Note>
        Le modèle de Bohr (1913) donne à l’électron des orbites de rayon n² a₀ et d’énergie −13,6 eV / n² : c’est lui qui
        fonde l’image « atome = système solaire ». Il est tenu par la force électrique, {scientific(rapportForces(), 1)} fois
        plus intense que la gravité entre un proton et un électron — le système solaire, lui, n’est tenu que par la gravité.
      </Note>

      {/* La comparaison, grandeur par grandeur. */}
      <SousTitre>Atome d’hydrogène et système solaire, côte à côte</SousTitre>
      <Fiche
        label="Comparaison chiffrée de l’atome d’hydrogène et du système solaire"
        colonnes={[{ titre: 'Grandeur' }, { titre: 'Atome', align: 'right' }, { titre: 'Système solaire', align: 'right' }, { titre: 'Rapport', align: 'right', cache: true }]}
        lignes={lignes.map((l) => [l.libelle, ecrit(l.id, l.atome), ecrit(l.id, l.systeme), `× ${l.rapport < 100 ? virgule(l.rapport, l.rapport < 2 ? 4 : 1) : scientific(l.rapport, 1)}`])}
      />
      <Note>
        Deux ressemblances réelles : les deux sont presque vides (le centre occupe moins d’un millième du rayon) et presque
        toute la masse est au centre ({pourcent(lignes[1].atome, 3)} dans le proton, {pourcent(lignes[1].systeme, 3)} dans le
        Soleil). Deux différences : le système solaire est {virgule(lignes[0].rapport, 1)} fois plus « rempli » par son
        centre, et son voisin le plus proche (Proxima, à {virgule(DISTANCE_PROXIMA_AL)} années-lumière) est{' '}
        {Math.round(lignes[3].rapport).toLocaleString('fr-FR')} fois plus éloigné, à l’échelle, que deux atomes liés.
      </Note>
    </Box>
  );
// Fin de AnalogieChiffree.
}

/** Section « Couches et orbites » : le dessin, puis la loi en n² confrontée aux demi-grands axes réels. */
// Déclare CouchesEtOrbites.
function CouchesEtOrbites() {
  // La Terre, pour les exemples chiffrés.
  const terre = ORBITES[2];
  // Début du rendu.
  return (
    <Box>
      {/* Le dessin de l'analogie. */}
      <Carte sx={{ bgcolor: 'transparent' }}><AtomeSolaire /></Carte>
      {/* La loi en n² face aux orbites réelles. */}
      <SousTitre>La loi en n² de Bohr face aux orbites réelles</SousTitre>
      <Fiche
        label="Couches atomiques, orbites prédites en n² et orbites réelles des planètes"
        colonnes={[
          { titre: 'Couche' }, { titre: 'Planète' }, { titre: 'a (UA)', align: 'right', cache: true }, { titre: 'Prédit n²', align: 'right' },
          { titre: 'Réel', align: 'right' }, { titre: 'Écart', align: 'right' }, { titre: '2n²', align: 'right', cache: true },
        ]}
        lignes={ORBITES.map((o) => [`${o.couche} (n = ${o.n})`, o.planete, virgule(o.ua, 3), o.predit, virgule(o.reel), o.n === 1 ? 'référence' : signe(o.ecart), o.capacite])}
      />
      <Note>
        « Prédit » et « réel » sont en multiples de l’orbite de Mercure (couche K). Si les planètes suivaient la loi de
        Bohr, elles seraient à 1, 4, 9, 16… fois cette distance. L’écart moyen est de {ecartMoyenOrbites().toFixed(0)} % :
        seul Uranus tombe juste ({signe(ORBITES[6].ecart)}), par coïncidence. La colonne 2n² est le nombre maximal
        d’électrons d’une couche ; au-delà de n = 4, c’est une valeur théorique.
      </Note>

      {/* Les grandeurs quantiques des planètes. */}
      <SousTitre>Une planète est-elle quantique ?</SousTitre>
      <Fiche
        label="Vitesse orbitale, longueur d’onde de De Broglie et nombre quantique orbital de chaque planète"
        colonnes={[{ titre: 'Planète' }, { titre: 'Vitesse (km/s)', align: 'right', cache: true }, { titre: 'λ = h / mv (m)', align: 'right' }, { titre: 'n = L / ħ', align: 'right' }]}
        lignes={ORBITES.map((o) => [o.planete, virgule(o.vitesse / 1000, 1), scientific(o.lambda, 1), scientific(o.nQuantique, 1)])}
      />
      <Formule sx={{ mt: 1.5 }}>{'v = √(G M☉ / a)     λ = h / (m v)     n = m √(G M☉ a) / ħ     a_g = ħ² / (G M☉ m²)'}</Formule>
      <Note>
        En appliquant la règle de Bohr L = n ħ à la Terre, on trouve n ≈ {scientific(terre.nQuantique, 1)} : les niveaux
        voisins sont si serrés que l’orbite paraît parfaitement continue (principe de correspondance). Sa longueur d’onde
        de De Broglie vaut {scientific(terre.lambda, 1)} m, et son orbite fondamentale « gravitationnelle » aurait un rayon
        a_g ≈ {scientific(rayonBohrGravitationnel(terre.masse), 1)} m — bien plus petit que tout ce qui est mesurable.
        Une planète est donc un objet classique : c’est la limite quantitative de l’analogie.
      </Note>
    </Box>
  );
// Fin de CouchesEtOrbites.
}

/** Onglet complet : introduction, puis huit sections numérotées et la signature. */
// Déclare et exporte le composant TheorieQuantique.
export function TheorieQuantique() {
  // Nombre d'éléments dont la répartition par couches s'écarte de la règle de Klechkowski.
  const exceptions = Object.keys(EXCEPTIONS_COUCHES).length;
  // Début du rendu.
  return (
    <Box>
      {/* Introduction : l'idée de la théorie, et sa mise en garde. */}
      <Typography component="h2" variant="h4" sx={{ mt: 0.5 }}>La matière, d’échelle en échelle</Typography>
      <Typography variant="body1" sx={{ mt: 1, maxWidth: '78ch', lineHeight: 1.65 }}>
        Selon la théorie Gobai Space, la matière se répète de l’infiniment petit à l’infiniment grand : les particules
        seraient des astres, l’atome un système solaire — le Soleil pour noyau, les planètes pour électrons — et la
        molécule une constellation. Cette page pose l’échelle complète, puis met chaque étage de l’analogie en nombres.
      </Typography>
      <Alerte titre="Analogie spéculative">
        Ce n’est pas un modèle scientifique établi. Tous les calculs ci-dessous sont exacts et vérifiables ; ils servent
        justement à mesurer où l’analogie tient et où elle casse. Les planètes ne sont pas des électrons.
      </Alerte>

      <Section numero={1} titre="L’échelle complète, de l’infiniment petit à l’infiniment grand" sousTitre="Neuf niveaux en trois groupes : atomique, matière inerte et vivante, cosmique.">
        <EchelleMatiere />
      </Section>

      <Section numero={2} titre="L’atome et le système solaire en nombres" sousTitre="Niveau 2 de l’échelle : le noyau comme un soleil, les électrons comme des planètes.">
        <AnalogieChiffree />
      </Section>

      <Section numero={3} titre="Couches atomiques et orbites des planètes" sousTitre="K à R pour Mercure à Neptune : la correspondance, puis sa vérification.">
        <CouchesEtOrbites />
      </Section>

      <Section numero={4} titre="Tableau périodique théorique et Solarium" sousTitre="Les 118 éléments, leurs électrons par couche, et l’élément 119 de la théorie.">
        <Carte sx={{ bgcolor: 'transparent', p: { xs: 0.5, sm: 1 } }}><TableauPeriodique /></Carte>
        <Note>
          Les deux lignes du bas sont le bloc f (lanthanides et actinides). En bas de chaque case : les électrons par
          couche (K, L, M…), par exemple le fer (26) : 2, 8, 14, 2. Les {exceptions} éléments qui dérogent à la règle de
          Klechkowski (chrome, cuivre, or, uranium…) portent leur répartition mesurée. La case en surbrillance est ajoutée
          par la théorie : le <strong>Solarium</strong> — n° {SOLARIUM.z}, symbole <strong>So</strong>, masse{' '}
          {SOLARIUM.masse} ({SOLARIUM.masseDetail}), période 8, groupe 1 — dont le Soleil serait le noyau. Dans la réalité,
          le plus lourd élément connu est l’oganesson (118) ; le 119 n’a pas encore été synthétisé. Le{' '}
          <strong>Proximium</strong> (Pr, Proxima Centauri) figure dans le tableau hypothétique de la section 6.
        </Note>
      </Section>

      <Section numero={5} titre={`L’assemblage ${MOLECULE.nom} (${MOLECULE.formule})`} sousTitre="Niveau 3 de l’échelle : des atomes-systèmes reliés, comme les étoiles d’une constellation.">
        <Carte sx={{ bgcolor: 'transparent' }}><MoleculeSoaCen /></Carte>
        <Note>
          <strong>{MOLECULE.nom}</strong> réunit le <strong>Solarium</strong> (So, 119 — le Soleil) et <strong>aCen</strong>{' '}
          (Alpha Centauri, qui contient Proxima Centauri), reliés par une liaison simple. Dans l’analogie, la « liaison »
          est la gravitation entre les deux systèmes les plus proches l’un de l’autre ({virgule(DISTANCE_PROXIMA_AL)} années-lumière).
        </Note>
        <Note>
          <strong>Quark et interaction forte :</strong> dans un hadron, les quarks sont liés par l’interaction forte et ne
          peuvent pas être isolés (confinement). Sur la même optique, aCen serait le « quark » voisin du Soleil-atome.
          Aucune mesure ne montre de confinement gravitationnel entre étoiles : le Soleil et Alpha Centauri ne sont pas liés.
        </Note>
        <Note>
          <strong>Le problème à trois corps :</strong> Alpha Centauri est un système triple (A, B et Proxima). Il n’existe
          pas de solution analytique générale pour trois corps en interaction gravitationnelle (Poincaré) : leurs orbites
          se calculent par intégration numérique. L’« assemblage » est donc en réalité un problème à quatre corps au moins.
        </Note>
      </Section>

      <Section numero={6} titre="Tableau hypothétique : les systèmes à moins de 16,3 années-lumière" sousTitre="Le voisinage du Soleil, rangé comme un tableau périodique.">
        <TableauHypothetique />
        <Note>
          Le rang 0 est le Système solaire (le <strong>Solarium</strong>) et le rang 1, Alpha Centauri, contient{' '}
          <strong>Proxima Centauri</strong> — le <strong>Proximium</strong> de la théorie. Les masses sont en masses solaires
          (1 M☉ ≈ 1,989 × 10³⁰ kg) pour les étoiles, en masses joviennes (1 M_J ≈ 1,898 × 10²⁷ kg) pour les naines brunes les
          plus légères. La limite de fusion de l’hydrogène, ≈ 0,075 M☉ (~80 M_J), sépare naine rouge et naine brune.
        </Note>
      </Section>

      <Section numero={7} titre="Charge électrique du Soleil selon sa température" sousTitre="Le « noyau » de la théorie est-il chargé, comme un noyau d’atome ?">
        <ChargeSoleil />
      </Section>

      <Section numero={8} titre="Caractéristiques d’un élément" sousTitre="Numéro atomique Z, masse atomique A_r et défaut de masse.">
        <CaracteristiquesElement />
      </Section>

      {/* Signature de la théorie. */}
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 4, textAlign: 'right' }}>
        Théorie quantique Gobai Space — signée {AUTEUR}
      </Typography>
    </Box>
  );
// Fin de TheorieQuantique.
}
