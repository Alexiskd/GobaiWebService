// Importe iconNode, le dessin d'une icône (composant, image ou caractère).
import { iconNode } from './iconNode.jsx';
// Importe l'infobulle et la réunion de classes du kit.
import { Tooltip, cx } from '@/Fairing/kit';

/**
 * Bouton d'une action de la barre d'outils (classes `tb-…` de theme/app.css) :
 *  - ordinateur, action `iconOnly` : pastille carrée de 34 px, l'icône seule, le nom dans l'infobulle ;
 *  - ordinateur, action à libellé  : l'icône puis le libellé ;
 *  - téléphone (`compact`)         : l'icône au-dessus du libellé court, sur toute la largeur.
 * Une action à bascule enfoncée (`pressed`) se remplit de la couleur principale : son état reste lisible sans libellé.
 * Aucun style n'est calculé ici : la barre reste à l'écran en permanence et se redessine avec le HUD.
 */
// Déclare et exporte ToolbarButton : reçoit l'action et le mode compact.
export function ToolbarButton({ action, compact }) {
  // État enfoncé : indéfini pour une action sans bascule, sinon un booléen.
  const pressed = action.pressed === undefined ? undefined : Boolean(action.pressed);
  // Icône seule : sur ordinateur, pour les actions qui le demandent.
  const iconOnly = !compact && action.iconOnly;
  // Le bouton.
  const button = (
    <button
      type="button"
      // Nom et état pour les lecteurs d'écran.
      aria-label={action.label}
      aria-pressed={pressed}
      // Marque les actions sans son de clic.
      data-no-sound={action.noSound ? '' : undefined}
      disabled={action.disabled}
      onClick={action.onClick}
      // Forme : pastille d'icône, bouton à libellé, ou tuile du téléphone.
      className={cx('tb-btn', iconOnly ? 'tb-btn-icon' : compact ? 'tb-btn-stack' : 'tb-btn-label')}
    >
      {/* L'icône, décorative. */}
      <span aria-hidden="true" className="tb-btn-glyph">{iconNode(action.icon, compact ? 17 : iconOnly ? 18 : 16)}</span>
      {/* Le libellé, hors des pastilles d'icône : court sur téléphone. */}
      {!iconOnly && <span className="tb-btn-text">{compact ? (action.short || action.label) : action.label}</span>}
    </button>
  );
  // Téléphone : pas d'infobulle (pas de survol). Ordinateur : l'infobulle décrit l'action.
  return compact ? button : <Tooltip title={action.title || (iconOnly ? action.label : '')} placement="top">{button}</Tooltip>;
// Fin de ToolbarButton.
}
