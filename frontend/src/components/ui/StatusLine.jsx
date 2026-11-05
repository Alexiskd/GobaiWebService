export function StatusLine({ text, tone, title }) {
  return (
    <p className={`ac-status is-${tone}`} title={title} role="status">
      <span className="ac-status-dot" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
