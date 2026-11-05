import { useSolarData } from '@/hooks/useSolarData';
import { ResponsiveStyles } from '@/styles/responsiveStyles';
import { SolarScene } from './SolarScene';

export function SolarSystem() {
  const { status, data, error, retry } = useSolarData();

  if (status === 'ready') return <SolarScene data={data} />;

  return (
    <div className="loading">
      <ResponsiveStyles />
      {status === 'loading' ? (
        'Connexion à l’API…'
      ) : (
        <div className="fail">
          <p>Impossible de joindre l’API : {error}.</p>
          <p className="hint">Lancez le backend (<code>npm run dev:api</code>, port 3001), puis réessayez.</p>
          <button type="button" onClick={retry}>Réessayer</button>
        </div>
      )}
    </div>
  );
}

export default SolarSystem;
