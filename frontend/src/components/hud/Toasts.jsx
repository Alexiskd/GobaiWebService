export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span>{t.text}</span>
          <button type="button" className="ghost" onClick={() => onDismiss(t.id)} aria-label="Fermer le message">×</button>
        </div>
      ))}
    </div>
  );
}
