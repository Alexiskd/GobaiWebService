// Hook de React pour les effets.
import { useEffect } from 'react';
// Composant MUI des styles globaux.
import { GlobalStyles } from '@mui/material';

// Styles globaux MUI (Emotion) des éléments que le moteur 3D crée lui-même dans le DOM, hors de React :
// étiquettes de la scène (astres, villes, pays, lieux lunaires, sondes) et fiche ville au survol.
// Ces éléments n'existent pas dans l'arbre React : ils ne peuvent être stylés que par leur classe.
// Le reste de l'interface est fait de composants MUI stylés par `sx`.

// Contour sombre des noms posés sur la scène : un liseré net d'un pixel dans les quatre directions, puis un halo.
// Le nom reste lisible sur un globe clair (calottes, nuages, face éclairée) comme sur le noir de l'espace.
// Contour sombre des noms : un liseré d'un pixel dans les quatre directions, puis un halo.
const LABEL_OUTLINE = '1px 0 0 rgba(0,0,0,.85), -1px 0 0 rgba(0,0,0,.85), 0 1px 0 rgba(0,0,0,.85), 0 -1px 0 rgba(0,0,0,.85), 0 0 5px #000';

// Fonction sceneStyles : les styles globaux, à partir du thème.
const sceneStyles = (theme) => ({
  // La page : toute la hauteur, sans défilement.
  'html, body, #root': { height: '100%', overflow: 'hidden', overscrollBehavior: 'none' },
  // Chiffres de largeur égale.
  body: { fontVariantNumeric: 'tabular-nums' },
  // Téléphone et tablette (écran tactile) : aucun élément n'est sélectionnable — ni texte surligné, ni menu
  // « Copier / Enregistrer l'image » à l'appui long, ni voile gris au toucher. Les champs de saisie restent éditables.
  // Sur écran tactile :
  '@media (pointer: coarse)': {
    // pour tous les éléments,
    '*, *::before, *::after': {
      // pas de sélection, pas de menu à l'appui long, pas de voile au toucher.
      WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent',
    // Fin de la règle.
    },
    // Images et liens : pas de glisser-déposer.
    'img, a': { WebkitUserDrag: 'none' },
    // Champs de saisie : la sélection reste possible.
    'input, textarea, [contenteditable="true"]': { WebkitUserSelect: 'text', userSelect: 'text' },
  // Fin du cas.
  },
  // Panneau en cours de déplacement (useDraggable) : au premier plan, curseur « main fermée ».
  // Panneau en cours de déplacement : au premier plan.
  '.is-dragging': { zIndex: '200 !important' },
  // Son contenu : curseur « main fermée ».
  '.is-dragging *': { cursor: 'grabbing !important' },

  // ---------------------------------------------------------------- Étiquettes de la scène
  // Étiquette de la scène.
  ".l": { position: "fixed", left: "0", top: "0", fontSize: "12px", color: "#fff", textShadow: LABEL_OUTLINE, pointerEvents: "none", whiteSpace: "nowrap", paddingLeft: "10px" },
  // Étiquette cliquable.
  ".l[title]": { pointerEvents: "auto", cursor: "pointer", borderRadius: "5px", padding: "3px 5px 3px 12px", margin: "-3px 0 0 -2px", background: "rgba(1, 2, 6, 0.18)" },
  // Étiquette cliquable, pendant l'appui.
  ".l[title]:active": { background: "rgba(240, 178, 74, 0.35)" },
  // Pastille de l'étiquette.
  ".l::before": { content: "\"\"", position: "absolute", left: "0", top: "50%", width: "8px", height: "8px", marginTop: "-4px", borderRadius: "50%", background: "var(--c, #ffd24a)", boxShadow: "0 0 6px var(--c, #ffd24a)" },
  // Nom de ville.
  ".l.map-label": { pointerEvents: "auto", cursor: "pointer", borderRadius: "0", background: "none", padding: "2px 6px 2px 12px", margin: "0", fontSize: "calc(var(--size, 11px) * var(--script-scale, 1))", fontWeight: "400", lineHeight: "1.2", letterSpacing: "var(--tracking, 0.01em)", color: "#fff", textShadow: "0 0 1px rgba(0, 0, 0, 0.95), 0 0 3px rgba(0, 0, 0, 0.85), 0 1px 4px rgba(0, 0, 0, 0.7)", transition: "color 0.12s ease" },
  // Pastille d'un nom de ville.
  ".l.map-label::before": { left: "0", width: "4px", height: "4px", margin: "-2px 0 0 -2px", boxShadow: "none", background: "var(--dot, #fff)", border: "1px solid rgba(0, 0, 0, 0.8)" },
  // Nom de ville de rang 0.
  ".l.map-label[data-tier=\"0\"]": { "--size": "13.5px", "--tracking": "0.015em", fontWeight: "600" },
  // Sa pastille.
  ".l.map-label[data-tier=\"0\"]::before": { width: "6px", height: "6px", margin: "-3px 0 0 -3px" },
  // Nom de ville de rang 1.
  ".l.map-label[data-tier=\"1\"]": { "--size": "12px", fontWeight: "500" },
  // Sa pastille.
  ".l.map-label[data-tier=\"1\"]::before": { width: "5px", height: "5px", margin: "-2.5px 0 0 -2.5px" },
  // Nom de ville de rang 2.
  ".l.map-label[data-tier=\"2\"]": { color: "#e8eef9" },
  // Nom de ville de rang 3.
  ".l.map-label[data-tier=\"3\"]": { "--size": "10.5px", color: "#c7d1e0" },
  // Sa pastille.
  ".l.map-label[data-tier=\"3\"]::before": { width: "3px", height: "3px", margin: "-1.5px 0 0 -1.5px", opacity: "0.9" },
  // Nom de ville survolé ou appuyé.
  ".l.map-label:hover, .l.map-label:active": { background: "none", color: `${theme.palette.primary.main}` },
  // Nom de ville en japonais.
  ".l.map-label[data-script=\"japanese\"]": { "--script-scale": "0.94", "--tracking": "0.02em", fontFamily: "\"Yu Gothic UI\", \"Hiragino Sans\", \"Noto Sans CJK JP\", sans-serif" },
  // Nom de ville en chinois.
  ".l.map-label[data-script=\"chinese\"]": { "--script-scale": "0.94", "--tracking": "0.02em", fontFamily: "\"Microsoft YaHei UI\", \"PingFang SC\", \"Noto Sans CJK SC\", sans-serif" },
  // Nom de ville en coréen.
  ".l.map-label[data-script=\"korean\"]": { "--script-scale": "0.94", "--tracking": "0.02em", fontFamily: "\"Malgun Gothic\", \"Apple SD Gothic Neo\", \"Noto Sans KR\", sans-serif" },
  // Nom de ville en arabe.
  ".l.map-label[data-script=\"arabic\"]": { "--script-scale": "1.08", "--tracking": "0", fontFamily: "\"Segoe UI\", \"Geeza Pro\", \"Noto Naskh Arabic\", \"Noto Sans Arabic\", Tahoma, sans-serif" },
  // Nom de ville en hébreu.
  ".l.map-label[data-script=\"hebrew\"]": { "--script-scale": "1.04", "--tracking": "0", fontFamily: "\"Segoe UI\", \"Arial Hebrew\", \"Noto Sans Hebrew\", sans-serif" },
  // Nom de ville en devanagari ou en bengali.
  ".l.map-label[data-script=\"devanagari\"], .l.map-label[data-script=\"bengali\"]": { "--script-scale": "1.06", "--tracking": "0", fontFamily: "\"Nirmala UI\", \"Kohinoor Devanagari\", \"Noto Sans Devanagari\", sans-serif" },
  // Nom de ville en cyrillique.
  ".l.map-label[data-script=\"cyrillic\"]": { "--script-scale": "1", "--tracking": "0.005em", fontFamily: "system-ui, \"Segoe UI\", \"PT Sans\", \"Noto Sans\", sans-serif" },
  // Nom d'un lieu lunaire.
  ".l.moon-label": { "--dot": "var(--c, #fff)" },
  // Repère d'un astre.
  ".l.body-marker": { marginLeft: "-4px" },
  // Nom de pays.
  ".l.country-label": { padding: "0", margin: "0", pointerEvents: "none", userSelect: "none", "--label-size": "11px", "--script-scale": "1", "--tracking": "0.1em", fontSize: "calc(var(--label-size) * var(--script-scale))", textTransform: "uppercase", letterSpacing: "var(--tracking)", color: "#fff", fontWeight: "600", lineHeight: "1", textShadow: "0 0 1px rgba(0, 0, 0, 0.95), 0 0 3px rgba(0, 0, 0, 0.8), 0 1px 4px rgba(0, 0, 0, 0.65)" },
  // Nom de pays : pas de pastille.
  ".l.country-label::before": { content: "none" },
  // Nom de pays de rang 2.
  ".l.country-label[data-rank=\"2\"]": { "--label-size": "13px" },
  // Nom de pays de rang 3.
  ".l.country-label[data-rank=\"3\"]": { "--label-size": "12px" },
  // Nom de pays de rang 4.
  ".l.country-label[data-rank=\"4\"]": { "--label-size": "11px", fontWeight: "500", "--tracking": "0.09em" },
  // Nom de pays de rang 5.
  ".l.country-label[data-rank=\"5\"]": { "--label-size": "10px", fontWeight: "500", "--tracking": "0.08em", color: "#edf1f9" },
  // Nom de pays dans une autre écriture : pas de majuscules forcées.
  ".l.country-label[data-script]": { textTransform: "none" },
  // Nom de pays en chinois ou en japonais.
  ".l.country-label[data-script=\"chinese\"], .l.country-label[data-script=\"japanese\"]": { "--tracking": "0.03em", fontFamily: "\"Microsoft YaHei UI\", \"PingFang SC\", \"Noto Sans CJK SC\", \"Yu Gothic UI\", \"Hiragino Sans\", sans-serif" },
  // Nom de pays en coréen.
  ".l.country-label[data-script=\"korean\"]": { "--tracking": "0.02em", fontFamily: "\"Malgun Gothic\", \"Apple SD Gothic Neo\", \"Noto Sans KR\", sans-serif" },
  // Nom de pays en arabe ou en hébreu.
  ".l.country-label[data-script=\"arabic\"], .l.country-label[data-script=\"hebrew\"]": { "--script-scale": "1.07", "--tracking": "0", fontFamily: "\"Segoe UI\", \"Geeza Pro\", \"Noto Naskh Arabic\", \"Noto Sans Arabic\", \"Arial Hebrew\", Tahoma, sans-serif" },
  // Nom de pays en devanagari ou en bengali.
  ".l.country-label[data-script=\"devanagari\"], .l.country-label[data-script=\"bengali\"]": { "--script-scale": "1.06", "--tracking": "0", fontFamily: "\"Nirmala UI\", \"Kohinoor Devanagari\", \"Noto Sans Devanagari\", sans-serif" },
  // Nom de pays en cingalais.
  ".l.country-label[data-script=\"sinhala\"]": { "--script-scale": "1.06", "--tracking": "0", fontFamily: "\"Iskoola Pota\", \"Nirmala UI\", \"Noto Sans Sinhala\", sans-serif" },
  // Nom de pays en thaï.
  ".l.country-label[data-script=\"thai\"]": { "--script-scale": "1.06", "--tracking": "0", fontFamily: "\"Leelawadee UI\", Tahoma, \"Noto Sans Thai\", sans-serif" },
  // Nom de pays en lao.
  ".l.country-label[data-script=\"lao\"]": { "--script-scale": "1.08", "--tracking": "0", fontFamily: "\"Leelawadee UI\", \"DokChampa\", \"Noto Sans Lao\", sans-serif" },
  // Nom de pays en khmer.
  ".l.country-label[data-script=\"khmer\"]": { "--script-scale": "1.08", "--tracking": "0", fontFamily: "\"Khmer UI\", \"Leelawadee UI\", \"Noto Sans Khmer\", sans-serif" },
  // Nom de pays en birman.
  ".l.country-label[data-script=\"myanmar\"]": { "--script-scale": "1.08", "--tracking": "0", fontFamily: "\"Myanmar Text\", \"Noto Sans Myanmar\", sans-serif" },
  // Nom de pays en éthiopien.
  ".l.country-label[data-script=\"ethiopic\"]": { "--script-scale": "1.08", "--tracking": "0", fontFamily: "\"Nyala\", \"Ebrima\", \"Noto Sans Ethiopic\", sans-serif" },
  // Nom de pays en géorgien.
  ".l.country-label[data-script=\"georgian\"]": { "--script-scale": "1.04", "--tracking": "0", fontFamily: "\"Sylfaen\", \"Segoe UI\", \"Noto Sans Georgian\", sans-serif" },
  // Nom de pays en thâna.
  ".l.country-label[data-script=\"thaana\"]": { "--script-scale": "1.14", "--tracking": "0", fontFamily: "\"MV Boli\", \"Noto Sans Thaana\", sans-serif" },
  // Nom de pays en tibétain.
  ".l.country-label[data-script=\"tibetan\"]": { "--script-scale": "1.16", "--tracking": "0", fontFamily: "\"Microsoft Himalaya\", \"Noto Serif Tibetan\", serif" },
  // Nom de pays en grec.
  ".l.country-label[data-script=\"greek\"]": { "--script-scale": "1.02", "--tracking": "0.01em", fontFamily: "\"Segoe UI\", \"Noto Sans\", \"Arial\", sans-serif" },
  // Nom de pays en cyrillique.
  ".l.country-label[data-script=\"cyrillic\"]": { "--tracking": "0.01em", fontFamily: "system-ui, \"Segoe UI\", \"PT Sans\", \"Noto Sans\", sans-serif" },
  // Nom de sonde.
  ".l.orbiter-label": { pointerEvents: "auto", cursor: "pointer", fontSize: "11px", fontWeight: "600", padding: "1px 5px 1px 11px", background: "rgba(1, 2, 6, 0.35)", borderRadius: "4px", color: "var(--c)" },
  // Nom de sonde sélectionnée.
  ".l.orbiter-label.selected": { outline: "1px solid var(--c)" },
  // Fiche ville.
  ".city-card": { position: "fixed", zIndex: "40", width: "292px", padding: "14px 16px 12px", pointerEvents: "none", color: "#f4f5f7", background: "linear-gradient(180deg, rgba(20, 21, 24, 0.97), rgba(6, 7, 9, 0.97))", border: "1px solid rgba(255, 255, 255, 0.34)", borderRadius: "13px", boxShadow: "0 22px 60px rgba(0, 0, 0, 0.72), 0 2px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)", backdropFilter: "blur(16px) saturate(0.35)", WebkitBackdropFilter: "blur(16px) saturate(0.35)", fontSize: "0.8rem", lineHeight: "1.35", opacity: "0", transform: "translateY(-5px) scale(0.985)", transformOrigin: "var(--arrow-x, 50%) 0", transition: "opacity 0.16s ease, transform 0.16s ease" },
  // Fiche ville placée au-dessus du point.
  ".city-card[data-placement=\"above\"]": { transformOrigin: "var(--arrow-x, 50%) 100%", transform: "translateY(5px) scale(0.985)" },
  // Fiche ville ouverte.
  ".city-card.is-open": { opacity: "1", transform: "none" },
  // Flèche de la fiche ville.
  ".city-card::before": { content: "\"\"", position: "absolute", left: "var(--arrow-x, 50%)", top: "-7px", width: "12px", height: "12px", transform: "translateX(-50%) rotate(45deg)", background: "#141519", borderLeft: "1px solid rgba(255, 255, 255, 0.34)", borderTop: "1px solid rgba(255, 255, 255, 0.34)" },
  // Flèche d'une fiche placée au-dessus.
  ".city-card[data-placement=\"above\"]::before": { top: "auto", bottom: "-7px", background: "#0c0d10", border: "0", borderRight: "1px solid rgba(255, 255, 255, 0.34)", borderBottom: "1px solid rgba(255, 255, 255, 0.34)" },
  // Fiche ville : le nom.
  ".cc-head h2": { margin: "0", fontSize: "1.04rem", fontWeight: "650", letterSpacing: "0.01em", color: "#fff" },
  // Le sous-titre.
  ".cc-sub": { margin: "3px 0 0", color: "#a3a7b0", fontSize: "0.76rem" },
  // Les autres noms.
  ".cc-alt": { display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "6px", margin: "5px 0 0", color: "#dfe2e8", fontSize: "0.74rem" },
  // Leur libellé.
  ".cc-alt span": { color: "#8b91a0", fontSize: "0.59rem", letterSpacing: "0.09em", textTransform: "uppercase" },
  // Leur valeur.
  ".cc-alt strong": { fontWeight: "600" },
  // Les badges.
  ".cc-badges": { display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" },
  // Un badge.
  ".cc-badge": { border: "1px solid rgba(255, 255, 255, 0.36)", borderRadius: "999px", padding: "1px 8px", fontSize: "0.61rem", fontWeight: "600", letterSpacing: "0.09em", textTransform: "uppercase", color: "#e9eaee" },
  // Le bloc météo.
  ".cc-weather": { display: "flex", alignItems: "center", gap: "11px", marginTop: "10px", padding: "8px 10px", border: "1px solid rgba(255, 255, 255, 0.14)", borderRadius: "10px", background: "linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.015))" },
  // L'icône météo.
  ".cc-w-icon": { flex: "none", width: "42px", height: "42px", display: "grid", placeItems: "center", borderRadius: "11px", background: "radial-gradient(circle at 30% 24%, rgba(240, 178, 74, 0.15), rgba(150, 175, 220, 0.07) 62%, transparent 78%)" },
  // Son dessin.
  ".cc-w-svg": { width: "34px", height: "34px", fill: "none", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round", overflow: "visible" },
  // Le soleil.
  ".cc-w-svg .w-sun": { stroke: "#f0b24a", fill: "rgba(240, 178, 74, 0.1)" },
  // La lune.
  ".cc-w-svg .w-moon": { stroke: "#e6ebf6", fill: "rgba(230, 235, 246, 0.08)" },
  // Le nuage.
  ".cc-w-svg .w-cloud": { stroke: "#d6dceb", fill: "rgba(214, 220, 235, 0.09)" },
  // Le brouillard.
  ".cc-w-svg .w-fog": { stroke: "#b7c0d2" },
  // La pluie.
  ".cc-w-svg .w-rain": { stroke: "#93c2ff" },
  // La neige.
  ".cc-w-svg .w-snow": { stroke: "#d7ecff" },
  // L'éclair.
  ".cc-w-svg .w-bolt": { stroke: "#f0b24a", fill: "rgba(240, 178, 74, 0.2)" },
  // Le texte de la météo.
  ".cc-w-body": { flex: "1", minWidth: "0" },
  // Sa première ligne.
  ".cc-w-head": { display: "flex", alignItems: "baseline", gap: "8px" },
  // La température.
  ".cc-w-temp": { color: "#fff", fontSize: "1.34rem", fontWeight: "650", letterSpacing: "-0.02em", lineHeight: "1", fontVariantNumeric: "tabular-nums" },
  // Le temps qu'il fait.
  ".cc-w-cond": { color: "#c5cad6", fontSize: "0.72rem", lineHeight: "1.2" },
  // Les mesures.
  ".cc-w-metrics": { display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: "4px", color: "#e8eaf0", fontSize: "0.64rem", fontVariantNumeric: "tabular-nums" },
  // Une mesure.
  ".cc-w-metric": { whiteSpace: "nowrap" },
  // Son libellé.
  ".cc-w-metric em": { marginRight: "4px", fontStyle: "normal", color: "#8b91a0", letterSpacing: "0.02em" },
  // La population.
  ".cc-pop": { display: "flex", alignItems: "baseline", gap: "7px", marginTop: "12px" },
  // Son nombre.
  ".cc-pop strong": { fontSize: "1.32rem", fontWeight: "650", letterSpacing: "-0.015em", color: "#fff", fontVariantNumeric: "tabular-nums" },
  // Son libellé.
  ".cc-pop span": { color: "#a3a7b0", fontSize: "0.7rem" },
  // La source.
  ".cc-src": { margin: "4px 0 0", color: "#7d818a", fontSize: "0.62rem", letterSpacing: "0.02em" },
  // La grille des chiffres.
  ".cc-grid": { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", margin: "11px 0 0" },
  // Une case.
  ".cc-grid > div": { border: "1px solid rgba(255, 255, 255, 0.14)", borderRadius: "9px", padding: "6px 9px", background: "rgba(255, 255, 255, 0.035)" },
  // Son libellé.
  ".cc-grid dt": { color: "#92969f", fontSize: "0.61rem", letterSpacing: "0.08em", textTransform: "uppercase" },
  // Sa valeur.
  ".cc-grid dd": { margin: "2px 0 0", fontSize: "0.82rem", fontVariantNumeric: "tabular-nums" },
  // Les lignes de détail.
  ".cc-rows": { display: "flex", flexDirection: "column", gap: "5px", margin: "11px 0 0", paddingTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.12)" },
  // Une ligne.
  ".cc-row": { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "14px" },
  // Son libellé.
  ".cc-row dt": { flex: "none", color: "#92969f", fontSize: "0.72rem" },
  // Sa valeur.
  ".cc-row dd": { margin: "0", overflow: "hidden", color: "#f0f1f4", fontSize: "0.74rem", textAlign: "right", textOverflow: "ellipsis", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  // Le bloc énergie.
  ".cc-energy": { marginTop: "12px" },
  // Son titre.
  ".cc-energy-head": { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", color: "#92969f", fontSize: "0.63rem", letterSpacing: "0.09em", textTransform: "uppercase" },
  // Sa valeur.
  ".cc-energy-head strong": { color: "#fff", fontSize: "0.8rem", letterSpacing: "0", fontVariantNumeric: "tabular-nums" },
  // La jauge.
  ".cc-meter": { marginTop: "6px", height: "4px", overflow: "hidden", borderRadius: "99px", background: "rgba(255, 255, 255, 0.14)" },
  // Son remplissage.
  ".cc-meter i": { display: "block", height: "100%", borderRadius: "inherit", background: "linear-gradient(90deg, #7e828b, #ffffff)", transition: "width 0.25s ease" },
  // La note.
  ".cc-energy-note": { display: "block", marginTop: "5px", color: "#7d818a", fontSize: "0.62rem", lineHeight: "1.3" },
  // Le pied de la fiche.
  ".cc-foot": { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "4px 10px", marginTop: "12px", paddingTop: "9px", borderTop: "1px solid rgba(255, 255, 255, 0.12)", color: "#7d818a", fontSize: "0.63rem", letterSpacing: "0.035em" },
  // Sur écran étroit :
  "@media (max-width: 720px)": {
    // la fiche ville ne dépasse pas l'écran.
    ".city-card": { width: "min(292px, calc(100vw - 20px))" },
  // Fin du cas.
  },
  // Nom de ville : 11 pixels.
  '.l-city': { fontSize: '11px' },
  // Nom de planète : cliquable.
  '.l-planet': { cursor: 'pointer' },
  // Repère d'apside d'une sonde.
  '.l.orbiter-apsis': { fontSize: '10px', fontWeight: 500, opacity: 0.9 },
  // Étiquettes cliquables : le doigt posé dessus déplace et zoome la scène (moteur : input.jsx), jamais la page.
  // Étiquettes cliquables : le doigt déplace la scène, jamais la page.
  '.l[title], .l.map-label, .l.orbiter-label': { touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' },

  // ---------------------------------------------------------------- Point bleu « Ma position »
  // Créé par le moteur (userMarker.jsx), déplacé par transformation seulement : halo de précision, cône
  // d'orientation, point, et une onde toutes les deux secondes quand la position est suivie en direct.
  // Point « Ma position ».
  '.user-marker': { position: 'fixed', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none', willChange: 'transform' },
  // Ses parties.
  '.user-marker i': { position: 'absolute', display: 'block' },
  // Son halo de précision.
  '.user-marker-halo': { left: 0, top: 0, transform: 'translate(-50%, -50%)', borderRadius: '50%', background: 'rgba(26, 115, 232, 0.16)', border: '1px solid rgba(26, 115, 232, 0.45)' },
  // Son cône d'orientation :
  '.user-marker-cone': {
    // sa taille et sa place ;
    left: '-34px', top: '-34px', width: '68px', height: '68px', borderRadius: '50%', transformOrigin: '50% 50%',
    // son dégradé en cône ;
    background: 'conic-gradient(from -32deg, rgba(26, 115, 232, 0.55) 0deg 64deg, transparent 64deg)',
    // son masque en dégradé.
    WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 70%)', maskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
  // Fin du cône.
  },
  // Le point :
  '.user-marker-dot': {
    // sa taille et sa place ;
    left: '-8px', top: '-8px', width: '16px', height: '16px', boxSizing: 'border-box', borderRadius: '50%',
    // son bleu, son liseré blanc et son ombre.
    background: '#1a73e8', border: '2.5px solid #fff', boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.25), 0 1px 4px rgba(0, 0, 0, 0.5)',
  // Fin du point.
  },
  // L'onde :
  '.user-marker-pulse': {
    // sa taille et sa place ;
    left: '-8px', top: '-8px', width: '16px', height: '16px', boxSizing: 'border-box', borderRadius: '50%',
    // son contour, invisible au repos.
    border: '2px solid rgba(26, 115, 232, 0.75)', opacity: 0,
  // Fin de l'onde.
  },
  // L'onde s'anime quand la position est suivie en direct.
  '.user-marker.is-live .user-marker-pulse': { animation: 'user-marker-pulse 2s ease-out infinite' },
  // Animation de l'onde : elle grandit et s'efface.
  '@keyframes user-marker-pulse': { from: { transform: 'scale(1)', opacity: 0.85 }, to: { transform: 'scale(3.6)', opacity: 0 } },
  // Pas d'onde si les animations sont réduites.
  '@media (prefers-reduced-motion: reduce)': { '.user-marker.is-live .user-marker-pulse': { animation: 'none' } },
// Fin de sceneStyles.
});

// Éléments où la saisie reste possible.
const EDITABLE = 'input, textarea, [contenteditable="true"]';

// Composant SceneStyles.
export function SceneStyles() {
  // Écran tactile : pas de sélection ni de menu contextuel à l'appui long (Android), sauf dans les champs de saisie.
  // Au premier affichage :
  useEffect(() => {
    // hors écran tactile : rien ;
    if (!window.matchMedia?.('(pointer: coarse)').matches) return undefined;
    // fonction block : annule l'action, sauf dans un champ de saisie ;
    const block = (e) => { if (!e.target?.closest?.(EDITABLE)) e.preventDefault(); };
    // bloque le début de sélection ;
    document.addEventListener('selectstart', block);
    // bloque le menu contextuel.
    document.addEventListener('contextmenu', block);
    // Au retrait du composant :
    return () => {
      // cesse de bloquer la sélection ;
      document.removeEventListener('selectstart', block);
      // cesse de bloquer le menu contextuel.
      document.removeEventListener('contextmenu', block);
    // Fin du retrait.
    };
  // Fin de l'effet.
  }, []);
  // Affiche les styles globaux.
  return <GlobalStyles styles={sceneStyles} />;
// Fin de SceneStyles.
}
