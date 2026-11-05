export function Group({ title, children }) {
  return (
    <div className="ac-group" role="group" aria-label={title}>
      <div className="ac-group-title">{title}</div>
      <div className="ac-group-body">{children}</div>
    </div>
  );
}
