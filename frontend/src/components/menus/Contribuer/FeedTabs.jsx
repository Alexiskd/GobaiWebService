// Choix du classement du flux : tendances (« hot ») ou recommandations pour l'utilisateur.
export function FeedTabs({ feedMode, compact, onChange }) {
  return (
    <div className="contribution-feed-tabs" role="group" aria-label="Mode de classement">
      <button type="button" aria-pressed={feedMode === 'hot'} onClick={() => onChange('hot')}>
        {compact ? 'Tendances' : 'Tendances · Hot'}
      </button>
      <button type="button" aria-pressed={feedMode === 'recommended'} onClick={() => onChange('recommended')}>
        {compact ? 'Pour vous' : 'Pour vous · voisins'}
      </button>
    </div>
  );
}
