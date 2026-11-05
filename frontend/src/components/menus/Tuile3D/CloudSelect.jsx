// Liste déroulante des jeux de données disponibles pour la ville.
export function CloudSelect({ items, value, onChange }) {
  return (
    <label className="city-pointcloud-select">
      Jeu de données
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {items.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
      </select>
    </label>
  );
}
