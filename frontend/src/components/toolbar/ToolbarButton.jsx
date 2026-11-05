// Bouton de la barre d’outils : icône + libellé (court ou complet selon l’écran).
export function ToolbarButton({ action, compact, inMenu = false, onPick }) {
  return (
    <button
      type="button"
      className={[
        'tool-btn',
        inMenu && 'tool-menu-item',
        !compact && action.iconOnly && 'tool-btn-icon',
      ].filter(Boolean).join(' ')}
      aria-pressed={action.pressed === undefined ? undefined : Boolean(action.pressed)}
      data-no-sound={action.noSound ? '' : undefined}
      disabled={action.disabled}
      title={action.title}
      aria-label={action.label}
      onClick={() => { action.onClick?.(); if (inMenu) onPick?.(); }}
    >
      <span className="tool-icon" aria-hidden="true">{action.icon}</span>
      {!(action.iconOnly && !compact) && (
        <span className="tool-label">
          {/* Ordinateur : libellé complet ; laptop étroit : libellé court (via CSS) ; mobile : libellé court. */}
          {compact && !inMenu ? (action.short || action.label) : (
            <>
              <span className={action.short ? 'tool-label-full has-short' : 'tool-label-full'}>{action.label}</span>
              {action.short && <span className="tool-label-short" aria-hidden="true">{action.short}</span>}
            </>
          )}
        </span>
      )}
    </button>
  );
}
