// Kit d'interface — composants à comportement, portés par Base UI (@base-ui/react) : fenêtres, feuille du bas,
// infobulles, onglets et curseur. Base UI fournit le comportement accessible (focus gardé dans la fenêtre,
// Échap, placement, clavier) sans aucun style : l'habillage est dans theme/app.css (classes `g-…`).

// Importe les parties Base UI utilisées, chacune depuis son propre module.
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { Slider as BaseSlider } from '@base-ui/react/slider';
// Importe cx, qui réunit les classes.
import { cx } from './cx.js';

// flag : attribut `data-…` présent (chaîne vide) quand la condition est vraie, absent sinon.
const flag = (on) => (on ? '' : undefined);

// ── Fenêtres ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Fenêtre modale centrée, ou plein écran (`fullScreen`). Fermée, rien n'est monté dans la page.
 * `maxWidth` : xs, sm (défaut), md, lg, xl ; `fullWidth` l'étire jusqu'à cette largeur.
 * `paperClassName` et `paperStyle` habillent la fenêtre elle-même ; `onClose(événement, raison)` à la fermeture.
 */
// Déclare et exporte Dialog.
export function Dialog({ open, onClose, fullScreen, maxWidth = 'sm', fullWidth, paperClassName, paperStyle, className, children, ...rest }) {
  // Rend la fenêtre dans un portail : voile, puis fenêtre.
  return (
    <BaseDialog.Root open={Boolean(open)} onOpenChange={(next, details) => { if (!next) onClose?.(details?.event, details?.reason); }}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={cx('g-backdrop', className)} />
        <BaseDialog.Popup {...rest} className={cx('g-dialog', paperClassName)} style={paperStyle} data-maxw={maxWidth} data-fullwidth={flag(fullWidth)} data-fullscreen={flag(fullScreen)}>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
// Fin de Dialog.
}

/** Corps défilant d'une fenêtre. */
// Déclare et exporte DialogContent.
export const DialogContent = ({ className, children, ...rest }) => <div {...rest} className={cx('g-dialog-content', className)}>{children}</div>;

/** Feuille modale qui monte du bas de l'écran (téléphone). Son contenu est libre : la feuille n'a ni fond ni bord. */
// Déclare et exporte Drawer.
export function Drawer({ open, onClose, className, children, ...rest }) {
  // Rend la feuille dans un portail : voile, puis feuille collée en bas.
  return (
    <BaseDialog.Root open={Boolean(open)} onOpenChange={(next, details) => { if (!next) onClose?.(details?.event, details?.reason); }}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="g-backdrop" />
        <BaseDialog.Popup {...rest} className={cx('g-sheet', className)}>{children}</BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
// Fin de Drawer.
}

// ── Infobulles ──────────────────────────────────────────────────────────────────────────────────────────

/** À poser une fois autour de l'application : délai commun d'apparition des infobulles. */
// Déclare et exporte TooltipProvider.
export const TooltipProvider = ({ children }) => <BaseTooltip.Provider delay={350}>{children}</BaseTooltip.Provider>;

/**
 * Infobulle d'un élément : `title` est son texte, l'enfant unique son déclencheur. Sans texte, l'enfant est rendu seul.
 * `placement` : bottom (défaut), top, left, right, avec « -start » ou « -end » pour l'alignement.
 */
// Déclare et exporte Tooltip.
export function Tooltip({ title, placement = 'bottom', disableHoverListener, children }) {
  // Sans texte : l'enfant seul.
  if (!title) return children;
  // Côté et alignement.
  const [side, align = 'center'] = placement.split('-');
  // Rend le déclencheur (l'enfant lui-même) et la bulle dans un portail.
  return (
    <BaseTooltip.Root disabled={Boolean(disableHoverListener)}>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} align={align} sideOffset={6} className="g-tooltip-pos">
          <BaseTooltip.Popup className="g-tooltip">{title}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
// Fin de Tooltip.
}

// ── Onglets ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Barre d'onglets : `value` est l'onglet actif, `onChange(événement, valeur)` le changement. Les panneaux sont
 * rendus par l'appelant. `orientation` : horizontal (défaut) ou vertical.
 */
// Déclare et exporte Tabs.
export function Tabs({ value, onChange, orientation = 'horizontal', className, children, variant, scrollButtons, ...rest }) {
  // Rend la racine (sans boîte : `display: contents`), la liste, ses onglets et le trait de l'onglet actif.
  return (
    <BaseTabs.Root value={value} onValueChange={(next) => onChange?.(null, next)} orientation={orientation} className="contents">
      <BaseTabs.List {...rest} className={cx('g-tabs', className)}>
        {children}
        <BaseTabs.Indicator className="g-tabs-indicator" />
      </BaseTabs.List>
    </BaseTabs.Root>
  );
// Fin de Tabs.
}

/** Onglet : `value` l'identifie, `label` est son contenu. */
// Déclare et exporte Tab.
export const Tab = ({ value, label, className, ...rest }) => <BaseTabs.Tab value={value} {...rest} className={cx('g-tab', className)}>{label}</BaseTabs.Tab>;

// ── Curseur ─────────────────────────────────────────────────────────────────────────────────────────────

/** Curseur à une poignée : `onChange(événement, valeur)` ; `orientation` horizontal (défaut) ou vertical. */
// Déclare et exporte Slider.
export function Slider({ value, onChange, min = 0, max = 100, step = 1, orientation = 'horizontal', size, className, style, thumbClassName, 'aria-label': label, ...rest }) {
  // Rend la racine, la zone de saisie, la piste, sa partie remplie et la poignée.
  return (
    <BaseSlider.Root {...rest} value={value} onValueChange={(next) => onChange?.(null, next)} min={min} max={max} step={step} orientation={orientation} className={className} style={style}>
      <BaseSlider.Control className="g-slider-control">
        <BaseSlider.Track className="g-slider-track">
          <BaseSlider.Indicator className="g-slider-indicator" />
          <BaseSlider.Thumb aria-label={label} className={cx('g-slider-thumb', thumbClassName)} />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
// Fin de Slider.
}
