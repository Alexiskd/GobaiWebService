export function Facts({ items }) {
  if (!items?.length) return null;
  return (
    <dl className="ac-card ac-facts">
      {items.map(({ term, value, note }) => (
        <div className="ac-fact" key={term}>
          <dt>{term}</dt>
          <dd>
            <span className="ac-value">{value}</span>
            {note && <small>{note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
