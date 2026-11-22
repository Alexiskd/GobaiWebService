// Thème de l'interface : les couleurs, les polices et l'habillage des composants sont dans la feuille de style
// `app.css` (Tailwind CSS v4), en variables CSS. Le thème nuit est celui par défaut ; le thème jour s'applique
// quand la balise <html> porte `data-theme="day"` (voir App.jsx). Aucun objet de thème n'est fabriqué au rendu :
// changer de thème ne fait que changer un attribut, et le navigateur recolore la page.

// Couleur de fond pleine de chaque thème : celle de la barre d'état du téléphone (balise meta theme-color).
const SOLID = { night: '#05070D', day: '#E9EFF8' };

/** Nom du thème posé sur <html> : « day » pour le jour, « night » sinon. */
// Déclare et exporte themeName : reçoit le mode jour/nuit de l'application.
export const themeName = (dayNight = 'night') => (dayNight === 'day' ? 'day' : 'night');

/** Couleur de la barre d'état du téléphone pour ce thème. */
// Déclare et exporte statusBarColor : reçoit le mode jour/nuit.
export const statusBarColor = (dayNight = 'night') => SOLID[themeName(dayNight)];
