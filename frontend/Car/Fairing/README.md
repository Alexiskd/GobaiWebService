# Fairing — Interface

Couche interface Gobai Space : composants React, HUD, menus, scène, barres d’outils, thème, hooks et diagnostics visuels. Fairing pilote l’affichage et délègue le chargement/rendu aux moteurs de `Engine`.

## Pile de l'interface

- **Tailwind CSS v4** (`theme/app.css`) : jetons du thème en variables CSS, classes utilitaires compilées au build. Aucun style n'est calculé pendant le rendu.
- **Kit** (`kit/`) : les composants de l'interface. Éléments HTML natifs habillés par les classes `g-…` ; **Base UI** (`@base-ui/react`) pour les fenêtres, infobulles, onglets et curseur.
- **Icônes** : jeu Lucide (`kit/icons.jsx`, via `react-icons`).
- **Thème** : nuit par défaut, jour sous `<html data-theme="day">` ; seules les variables CSS changent.
- **Scène** : `theme/scene.css` habille les éléments que le moteur 3D pose dans la page.

Règles : valeurs fixes en classes Tailwind ; valeurs connues au rendu en `style={{…}}` (aides dans `kit/sx.js`). Pas de flou d'arrière-plan (`backdrop-filter`) au-dessus du canvas 3D : il coûte un recalcul par image.
