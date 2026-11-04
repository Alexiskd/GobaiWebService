import { useSolarData } from '@/hooks/useSolarData';
import SolarScene from './SolarScene';

// Point d'entrée : récupère les données auprès de l'API NestJS puis affiche la scène.
export default function SolarSystem() {
  const { status, data, error, retry } = useSolarData();

  if (status === 'ready') return <SolarScene data={data} />;

  return (
    <div className="loading">
      {status === 'loading' ? (
        'Connexion à l’API…'
      ) : (
        <div className="fail">
          <p>Impossible de joindre l’API : {error}.</p>
          <p className="hint">Lancez le backend (<code>npm run dev:api</code>, port 3001), puis réessayez.</p>
          <button onClick={retry}>Réessayer</button>
        </div>
      )}
    </div>
  );
}
