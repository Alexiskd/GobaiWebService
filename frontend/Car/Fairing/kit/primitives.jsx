// Kit d'interface — composants sans dépendance : des éléments HTML habillés par les classes `g-…` de
// theme/app.css. Aucun style n'est calculé ici : chaque composant pose des classes fixes et des attributs
// `data-…` que la feuille de style lit. Un `className` reçu s'ajoute aux classes du kit, et l'emporte.

// Importe de React la création d'élément, le contexte et les crochets utilisés par les champs et les groupes.
import { createContext, createElement, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
// Importe cx, qui réunit les classes.
// Importe le portail, qui rend un panneau flottant à la racine de la page.
import { createPortal } from 'react-dom';
import { cx } from './cx.js';
// Importe les icônes des avertissements et de la fermeture.
import { AlertErrorIcon, AlertInfoIcon, AlertSuccessIcon, AlertWarningIcon, CloseIcon } from './icons.jsx';

// flag : attribut `data-…` présent (chaîne vide) quand la condition est vraie, absent sinon.
const flag = (on) => (on ? '' : undefined);

// ── Texte ───────────────────────────────────────────────────────────────────────────────────────────────

// Balise HTML de chaque variante de texte.
const TEXT_TAG = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', subtitle1: 'h6', subtitle2: 'h6', body1: 'p', body2: 'p', caption: 'span', overline: 'span', button: 'span' };
// Classe de couleur des couleurs nommées de l'interface.
const TEXT_COLOR = { primary: 'text-primary', secondary: 'text-secondary', error: 'text-error', 'text.primary': 'text-ink', 'text.secondary': 'text-soft', 'text.disabled': 'text-faint', success: 'text-success', warning: 'text-warning', info: 'text-info' };

/** Texte dont la variante n'est connue qu'au rendu ; ailleurs, la balise et sa classe `t-…` sont écrites en dur. */
// Déclare et exporte Typography : variante, balise, couleur, coupe sur une ligne, classes et le reste.
export function Typography({ variant = 'body1', component, color, noWrap, className, ...rest }) {
  // Rend la balise de la variante, avec sa classe, sa couleur et la coupe éventuelle.
  return createElement(component || TEXT_TAG[variant] || 'p', { ...rest, className: cx(`t-${variant}`, TEXT_COLOR[color], noWrap && 'truncate', className) });
// Fin de Typography.
}

// ── Boutons ─────────────────────────────────────────────────────────────────────────────────────────────

// Contexte du groupe de boutons : la variante imposée aux boutons du groupe.
const ButtonGroupContext = createContext(null);

/** Bouton à libellé : `variant` text (défaut), outlined ou contained ; un `href` en fait un lien. */
// Déclare et exporte Button.
export function Button({ variant, color = 'primary', size = 'medium', startIcon, endIcon, fullWidth, component, className, children, ...rest }) {
  // Variante du groupe, si le bouton est dans un groupe.
  const group = useContext(ButtonGroupContext);
  // Balise : celle demandée, un lien s'il y a une adresse, sinon un bouton.
  const tag = component || (rest.href ? 'a' : 'button');
  // Rend le bouton (type « button » par défaut : il ne soumet pas un formulaire par accident).
  return createElement(tag, {
    type: tag === 'button' ? 'button' : undefined,
    ...rest,
    className: cx('g-btn', className),
    'data-variant': variant || group?.variant || 'text', 'data-color': color, 'data-size': size, 'data-full': flag(fullWidth),
  },
  // L'icône de début, le libellé, l'icône de fin.
  startIcon && <span className="g-btn-icon" aria-hidden="true">{startIcon}</span>, children, endIcon && <span className="g-btn-icon" aria-hidden="true">{endIcon}</span>);
// Fin de Button.
}

/** Groupe de boutons accolés, qui partagent une variante. */
// Déclare et exporte ButtonGroup.
export function ButtonGroup({ variant = 'outlined', fullWidth, className, children, ...rest }) {
  // Rend le groupe et donne sa variante aux boutons.
  return (
    <div role="group" {...rest} className={cx('g-btngroup', className)} data-full={flag(fullWidth)}>
      <ButtonGroupContext.Provider value={{ variant }}>{children}</ButtonGroupContext.Provider>
    </div>
  );
// Fin de ButtonGroup.
}

/** Bouton icône : carré de 40 px (30 px en `size="small"`), 44 px au moins sur écran tactile. */
// Déclare et exporte IconButton.
export function IconButton({ size = 'medium', color, component, className, children, ...rest }) {
  // Balise : celle demandée, un lien s'il y a une adresse, sinon un bouton.
  const tag = component || (rest.href ? 'a' : 'button');
  // Rend le bouton.
  return createElement(tag, { type: tag === 'button' ? 'button' : undefined, ...rest, className: cx('g-iconbtn', className), 'data-size': size, 'data-color': color }, children);
// Fin de IconButton.
}

/** Pastille : étiquette, ou bouton quand elle est cliquable. */
// Déclare et exporte Chip.
export function Chip({ label, icon, size = 'medium', variant = 'filled', color = 'default', clickable, onClick, className, ...rest }) {
  // Cliquable si demandé ou si elle a un rappel de clic.
  const click = Boolean(clickable || onClick);
  // Rend un bouton quand elle est cliquable, un bloc sinon.
  return createElement(click ? 'button' : 'div', {
    type: click ? 'button' : undefined, onClick,
    ...rest,
    className: cx('g-chip', className), 'data-size': size, 'data-variant': variant, 'data-color': color, 'data-clickable': flag(click),
  },
  // L'icône éventuelle, puis le libellé.
  icon && <span className="g-chip-icon" aria-hidden="true">{icon}</span>, <span className="g-chip-label">{label}</span>);
// Fin de Chip.
}

/** Lien : `underline` always (défaut), hover ou none. */
// Déclare et exporte Link.
export function Link({ underline = 'always', className, children, ...rest }) {
  // Rend le lien.
  return <a {...rest} className={cx('g-link', className)} data-underline={underline}>{children}</a>;
// Fin de Link.
}

// ── Attente ─────────────────────────────────────────────────────────────────────────────────────────────

/** Rond de chargement : un arc qui tourne, animé par la feuille de style (aucun JavaScript). */
// Déclare et exporte CircularProgress.
export function CircularProgress({ size = 40, color = 'primary', className, style, ...rest }) {
  // Rend le dessin, à la taille demandée.
  return (
    <svg role="progressbar" viewBox="22 22 44 44" width={size} height={size} {...rest} className={cx('g-spin', className)} data-color={color} style={style}>
      <circle cx="44" cy="44" r="20.2" strokeWidth="3.6" />
    </svg>
  );
// Fin de CircularProgress.
}

/** Squelette : un bloc gris qui pulse à la place d'un contenu en cours de chargement. */
// Déclare et exporte Skeleton.
export function Skeleton({ variant = 'text', width, height, className, style, ...rest }) {
  // Rend le bloc, aux dimensions demandées.
  return <span aria-hidden="true" {...rest} className={cx('g-skel', className)} data-variant={variant} style={{ width, height, ...style }} />;
// Fin de Skeleton.
}

// ── Avertissement ───────────────────────────────────────────────────────────────────────────────────────

// Icône de chaque gravité.
const ALERT_ICON = { info: AlertInfoIcon, success: AlertSuccessIcon, warning: AlertWarningIcon, error: AlertErrorIcon };

/** Avertissement : `severity` info, success, warning ou error ; `variant` standard (défaut), outlined ou filled. */
// Déclare et exporte Alert.
export function Alert({ severity = 'info', variant = 'standard', action, onClose, closeText = 'Fermer', className, children, ...rest }) {
  // Icône de la gravité.
  const Icon = ALERT_ICON[severity] || AlertInfoIcon;
  // Rend l'avertissement : icône, message, action éventuelle, bouton de fermeture éventuel.
  return (
    <div role="alert" {...rest} className={cx('g-alert', className)} data-severity={severity} data-variant={variant}>
      <span className="g-alert-icon" aria-hidden="true"><Icon /></span>
      <div className="g-alert-message">{children}</div>
      {action && <div className="g-alert-action">{action}</div>}
      {!action && onClose && (
        <div className="g-alert-action">
          <IconButton size="small" color="inherit" aria-label={closeText} title={closeText} onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </div>
      )}
    </div>
  );
// Fin de Alert.
}

// ── Listes ──────────────────────────────────────────────────────────────────────────────────────────────

/** Liste : `dense` resserre les lignes, `disablePadding` retire la marge du haut et du bas. */
// Déclare et exporte List.
export function List({ dense, disablePadding, component = 'ul', className, children, ...rest }) {
  // Rend la liste.
  return createElement(component, { ...rest, className: cx('g-list', className), 'data-dense': flag(dense), 'data-nopad': flag(disablePadding) }, children);
// Fin de List.
}

/** Ligne de liste ; `secondaryAction` pose un élément à droite. */
// Déclare et exporte ListItem.
export function ListItem({ disableGutters, disablePadding, secondaryAction, className, children, ...rest }) {
  // Rend la ligne.
  return (
    <li {...rest} className={cx('g-li', className)} data-nogutters={flag(disableGutters)} data-nopad={flag(disablePadding)} data-action={flag(secondaryAction)}>
      {children}
      {secondaryAction && <div className="g-li-action">{secondaryAction}</div>}
    </li>
  );
// Fin de ListItem.
}

/** Ligne de liste cliquable : au clavier, Entrée et Espace valent un clic. */
// Déclare et exporte ListItemButton.
export function ListItemButton({ selected, dense, disabled, className, children, onClick, onKeyDown, role = 'button', ...rest }) {
  // Touche enfoncée : rappel reçu, puis Entrée ou Espace déclenchent le clic.
  const key = (e) => {
    onKeyDown?.(e);
    if (!e.defaultPrevented && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.currentTarget.click(); }
  };
  // Rend la ligne.
  return (
    <div role={role} tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined} {...rest} onClick={disabled ? undefined : onClick} onKeyDown={key}
      className={cx('g-libtn', className)} data-selected={flag(selected)} data-dense={flag(dense)}>
      {children}
    </div>
  );
// Fin de ListItemButton.
}

/** Texte d'une ligne : un titre et un sous-titre ; `slotProps.primary` et `.secondary` reçoivent des classes. */
// Déclare et exporte ListItemText.
export function ListItemText({ primary, secondary, slotProps, className, ...rest }) {
  // Rend le bloc de texte.
  return (
    <div {...rest} className={cx('g-litext', className)}>
      {primary != null && <span className={cx('g-litext-primary', slotProps?.primary?.className)}>{primary}</span>}
      {secondary != null && <span className={cx('g-litext-secondary', slotProps?.secondary?.className)}>{secondary}</span>}
    </div>
  );
// Fin de ListItemText.
}

/** Icône en tête de ligne. */
// Déclare et exporte ListItemIcon.
export const ListItemIcon = ({ className, children, ...rest }) => <div {...rest} className={cx('g-liicon', className)}>{children}</div>;

// ── Tableaux ────────────────────────────────────────────────────────────────────────────────────────────

// Contexte de l'en-tête : vrai dans un <thead>, où les cellules sont des <th>.
const TableHeadContext = createContext(false);

/** Tableau ; `size="small"` resserre les cellules. */
// Déclare et exporte Table.
export const Table = ({ size = 'medium', className, children, ...rest }) => <table {...rest} className={cx('g-table', className)} data-size={size}>{children}</table>;
/** En-tête du tableau. */
export const TableHead = ({ className, children, ...rest }) => <thead {...rest} className={cx('g-thead', className)}><TableHeadContext.Provider value>{children}</TableHeadContext.Provider></thead>;
/** Corps du tableau. */
export const TableBody = ({ children, ...rest }) => <tbody {...rest}>{children}</tbody>;
/** Ligne du tableau. */
export const TableRow = ({ children, ...rest }) => <tr {...rest}>{children}</tr>;
/** Cellule : un <th> dans l'en-tête, un <td> ailleurs ; `align` right ou center. */
// Déclare et exporte TableCell.
export function TableCell({ align, className, children, ...rest }) {
  // Dans l'en-tête ou non.
  const head = useContext(TableHeadContext);
  // Rend la cellule.
  return createElement(head ? 'th' : 'td', { scope: head ? 'col' : undefined, ...rest, className: cx('g-td', className), 'data-align': align }, children);
// Fin de TableCell.
}

// ── Champs ──────────────────────────────────────────────────────────────────────────────────────────────

/** Hauteur d'une zone de texte : elle suit son contenu, jusqu'à `maxRows` lignes. */
// Déclare useAutosize : la référence de la zone, sa valeur et le nombre maximal de lignes.
function useAutosize(ref, value, maxRows) {
  // Après chaque changement de valeur, avant l'affichage.
  useLayoutEffect(() => {
    // La zone de texte.
    const el = ref.current;
    // Pas de zone (champ sur une ligne) : rien à faire.
    if (!el || el.tagName !== 'TEXTAREA') return;
    // Remet la hauteur à zéro pour mesurer le contenu.
    el.style.height = 'auto';
    // Hauteur d'une ligne.
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
    // Hauteur maximale.
    const max = maxRows ? line * maxRows : Infinity;
    // Pose la hauteur du contenu, plafonnée ; au-delà, la zone défile.
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  // Fin de l'effet ; dépendances : la valeur et le plafond.
  }, [ref, value, maxRows]);
// Fin de useAutosize.
}

// setRefs : donne le même élément à plusieurs références (objet ou fonction).
const setRefs = (...refs) => (el) => { for (const r of refs) { if (typeof r === 'function') r(el); else if (r) r.current = el; } };

/** Champ nu : une enveloppe (qui reçoit les classes) et son <input> ou, en `multiline`, sa zone de texte. */
// Déclare et exporte InputBase.
export function InputBase({ multiline, maxRows, fullWidth, inputProps, slotProps, inputRef, className, style, ...field }) {
  // Référence interne de l'élément de saisie.
  const own = useRef(null);
  // Ajuste la hauteur de la zone de texte.
  useAutosize(own, field.value, multiline ? maxRows : 0);
  // Attributs de l'élément de saisie : ceux du champ, puis ceux passés à part.
  const props = { ...field, ...inputProps, ...slotProps?.input, ref: setRefs(own, inputRef) };
  // Rend l'enveloppe et l'élément de saisie.
  return (
    <div className={cx('g-inputbase', className)} style={style} data-full={flag(fullWidth)}>
      {multiline ? <textarea rows={1} {...props} /> : <input {...props} />}
    </div>
  );
// Fin de InputBase.
}

/** Champ encadré, avec libellé et texte d'aide ; `select` en fait une liste déroulante native (enfants : MenuItem). */
// Déclare et exporte TextField.
export function TextField({ label, helperText, size = 'medium', fullWidth = true, multiline, maxRows, select, inputProps, slotProps, inputRef, className, style, children, id, ...field }) {
  // Référence interne de l'élément de saisie.
  const own = useRef(null);
  // Ajuste la hauteur de la zone de texte.
  useAutosize(own, field.value, multiline ? maxRows : 0);
  // Attributs de l'élément de saisie.
  const props = { id, ...field, ...inputProps, ...slotProps?.htmlInput, ref: setRefs(own, inputRef) };
  // Rend le libellé, la boîte du champ et le texte d'aide.
  return (
    <div className={cx('g-field', className)} style={style} data-size={size} data-full={flag(fullWidth)}>
      {label && <label className="g-field-label" htmlFor={id}>{label}</label>}
      <div className="g-field-box">
        {select ? <select aria-label={typeof label === 'string' ? label : undefined} {...props}>{children}</select> : multiline ? <textarea rows={1} {...props} /> : <input {...props} />}
      </div>
      {helperText != null && <p className="g-field-help">{helperText}</p>}
    </div>
  );
// Fin de TextField.
}

/** Entrée d'une liste déroulante native. */
// Déclare et exporte MenuItem.
export const MenuItem = ({ value, children, ...rest }) => <option value={value} {...rest}>{children}</option>;

/** Interrupteur : une case à cocher native au rôle « switch », redessinée par la feuille de style. */
// Déclare et exporte Switch.
export const Switch = ({ size, slotProps, inputProps, className, ...rest }) => <input type="checkbox" role="switch" {...rest} {...inputProps} {...slotProps?.input} className={cx('g-switch', className)} />;
/** Case à cocher native, redessinée. */
// Déclare et exporte Checkbox.
export const Checkbox = ({ size, slotProps, inputProps, className, ...rest }) => <input type="checkbox" {...rest} {...inputProps} {...slotProps?.input} className={cx('g-check', className)} />;
/** Bouton radio natif, redessiné. */
// Déclare et exporte Radio.
export const Radio = ({ size, slotProps, inputProps, className, ...rest }) => <input type="radio" {...rest} {...inputProps} {...slotProps?.input} className={cx('g-radio', className)} />;

/** Libellé cliquable d'un champ : le champ (`control`) puis son libellé, ou l'inverse avec `labelPlacement="start"`. */
// Déclare et exporte FormControlLabel.
export function FormControlLabel({ control, label, labelPlacement, disabled, disableTypography, className, ...rest }) {
  // Rend le libellé ; l'ordre visuel est inversé par la feuille de style quand le libellé passe devant.
  return <label {...rest} className={cx('g-formlabel', className)} data-start={flag(labelPlacement === 'start')} data-disabled={flag(disabled)}>{control}{label}</label>;
// Fin de FormControlLabel.
}

// Contexte du groupe de bascules : la valeur choisie et le rappel de choix.
const ToggleContext = createContext(null);

/** Groupe de boutons à bascule, à choix unique (`exclusive`) : `onChange(événement, valeur)`. */
// Déclare et exporte ToggleButtonGroup.
export function ToggleButtonGroup({ value, onChange, exclusive, size, fullWidth, className, children, ...rest }) {
  // Rend le groupe et donne sa valeur aux boutons.
  return (
    <div role="group" {...rest} className={cx('g-togglegroup', className)} data-full={flag(fullWidth)}>
      <ToggleContext.Provider value={{ value, onChange }}>{children}</ToggleContext.Provider>
    </div>
  );
// Fin de ToggleButtonGroup.
}

/** Bouton à bascule : enfoncé quand sa valeur est celle du groupe (ou quand `selected` est vrai, hors groupe). */
// Déclare et exporte ToggleButton.
export function ToggleButton({ value, selected, onChange, className, children, ...rest }) {
  // Le groupe, s'il y en a un.
  const group = useContext(ToggleContext);
  // Enfoncé : valeur du groupe, sinon l'état reçu.
  const on = group ? group.value === value : Boolean(selected);
  // Au clic : le groupe reçoit la valeur (null si on relâche le bouton enfoncé) ; hors groupe, le rappel du bouton.
  const click = (e) => { if (group) group.onChange?.(e, on ? null : value); else onChange?.(e, value); };
  // Rend le bouton.
  return <button type="button" aria-pressed={on} {...rest} onClick={click} className={cx('g-toggle', className)}>{children}</button>;
// Fin de ToggleButton.
}

// ── Repli ───────────────────────────────────────────────────────────────────────────────────────────────

// Durée de l'animation du repli, en millisecondes (la même que dans .g-collapse).
const COLLAPSE_MS = 220;

/** Repli animé : `in` ouvre ; `unmountOnExit` retire le contenu du DOM une fois replié. */
// Déclare et exporte Collapse.
export function Collapse({ in: open, unmountOnExit, timeout, className, children, ...rest }) {
  // État : contenu monté ou non (toujours monté sans `unmountOnExit`).
  const [mounted, setMounted] = useState(Boolean(open) || !unmountOnExit);
  // État : ouvert à l'écran — décalé d'une image après le montage, pour que l'ouverture soit animée.
  const [shown, setShown] = useState(Boolean(open));
  // État : animation d'ouverture terminée (le contenu peut alors déborder : menus, focus).
  const [settled, setSettled] = useState(Boolean(open));
  // Quand `in` change.
  useEffect(() => {
    // Ouverture : monte le contenu, l'ouvre à l'image suivante, puis note la fin de l'animation.
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setShown(true));
      // Filet de sécurité : si le navigateur n'anime pas la grille, aucun « transitionend » n'arrive.
      const timer = setTimeout(() => setSettled(true), COLLAPSE_MS + 60);
      return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
    }
    // Fermeture : replie tout de suite, puis démonte le contenu une fois replié (si demandé).
    setShown(false); setSettled(false);
    const timer = unmountOnExit ? setTimeout(() => setMounted(false), COLLAPSE_MS + 60) : 0;
    return () => clearTimeout(timer);
  // Fin de l'effet ; dépendances : l'ouverture et le démontage demandé.
  }, [open, unmountOnExit]);
  // Fin de l'animation : note l'ouverture terminée, ou démonte le contenu replié.
  const end = (e) => {
    if (e.target !== e.currentTarget) return;
    if (shown) setSettled(true); else if (unmountOnExit && !open) setMounted(false);
  };
  // Rend l'enveloppe en grille (voir .g-collapse) et le contenu.
  return (
    <div {...rest} className={cx('g-collapse', className)} data-open={flag(shown)} data-settled={flag(settled)} onTransitionEnd={end}>
      <div className="g-collapse-in">{mounted ? children : null}</div>
    </div>
  );
// Fin de Collapse.
}

// ── Écran ───────────────────────────────────────────────────────────────────────────────────────────────

/** Vrai quand la requête média est satisfaite ; suit ses changements (sans rendu inutile entre deux). */
// Déclare et exporte useMediaQuery : reçoit la requête (« (max-width: 720px) », avec ou sans « @media »).
export function useMediaQuery(query) {
  // La requête sans son préfixe.
  const q = String(query).replace(/^@media\s*/, '');
  // Abonnement aux changements de la requête.
  const subscribe = (notify) => {
    const list = window.matchMedia?.(q);
    list?.addEventListener('change', notify);
    return () => list?.removeEventListener('change', notify);
  };
  // Valeur courante ; fausse hors navigateur.
  return useSyncExternalStore(subscribe, () => Boolean(window.matchMedia?.(q).matches), () => false);
// Fin de useMediaQuery.
}

// ── Panneau ancré ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Panneau flottant ancré à un élément : au-dessus à gauche (`top-start`) ou en dessous à droite (`bottom-end`),
 * décalé de `offset` px et gardé dans l'écran. Replacé quand la fenêtre ou le panneau changent de taille.
 */
// Déclare et exporte Popper.
export function Popper({ open, anchorEl, placement = 'bottom-start', offset = 10, padding = 8, className, children, ...rest }) {
  // Référence du panneau.
  const ref = useRef(null);
  // Place le panneau, avant l'affichage puis à chaque changement de taille.
  useLayoutEffect(() => {
    // Le panneau.
    const el = ref.current;
    // Fermé ou sans ancre : rien à placer.
    if (!open || !el || !anchorEl) return undefined;
    // place : calcule la position du panneau d'après l'ancre.
    const place = () => {
      // Rectangles de l'ancre et du panneau.
      const a = anchorEl.getBoundingClientRect(); const w = el.offsetWidth; const h = el.offsetHeight;
      // Côté (au-dessus ou en dessous) et alignement (début ou fin).
      const [side, align = 'start'] = placement.split('-');
      // Au-dessus si demandé et s'il y a la place, sinon en dessous (et l'inverse).
      let top = side === 'top' ? a.top - h - offset : a.bottom + offset;
      if (side === 'top' && top < padding) top = a.bottom + offset;
      if (side !== 'top' && top + h > window.innerHeight - padding) top = a.top - h - offset;
      // Aligné sur le bord gauche ou droit de l'ancre.
      let left = align === 'end' ? a.right - w : a.left;
      // Gardé dans l'écran.
      left = Math.max(padding, Math.min(left, window.innerWidth - w - padding));
      top = Math.max(padding, Math.min(top, window.innerHeight - h - padding));
      // Pose la position, par une transformation (sans relancer la mise en page).
      el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    // Fin de place.
    };
    // Première position.
    place();
    // Suit la taille de la fenêtre, du panneau et de l'ancre.
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    ro?.observe(el); ro?.observe(anchorEl);
    window.addEventListener('resize', place);
    // Nettoyage.
    return () => { ro?.disconnect(); window.removeEventListener('resize', place); };
  // Fin de l'effet ; dépendances : l'ouverture, l'ancre et le placement.
  }, [open, anchorEl, placement, offset, padding]);
  // Fermé : rien.
  if (!open) return null;
  // Rend le panneau à la racine de la page : aucun ancêtre ne peut décaler sa position fixe.
  return createPortal(<div ref={ref} {...rest} className={cx('g-popper', className)}>{children}</div>, document.body);
// Fin de Popper.
}
