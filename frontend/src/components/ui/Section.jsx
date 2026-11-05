export function Section({ title, children }) {
  return (
    <section className="ac-section">
      {title && <h3 className="ac-title">{title}</h3>}
      {children}
    </section>
  );
}
