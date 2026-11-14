/**
 * Magasin PostgreSQL des secrets du serveur : une table minuscule, lue au démarrage.
 *
 * Elle ne contient pas de données d'utilisateur, seulement les secrets que le serveur se donne à lui-même
 * quand personne ne les lui fournit. La base est déjà l'endroit où vivent les empreintes des mots de passe :
 * un secret de signature n'y est pas plus exposé.
 *
 * `claim` n'écrase jamais un secret existant (`ON CONFLICT DO NOTHING`, puis relecture) : deux instances qui
 * démarrent en même temps repartent donc avec le même secret, et les sessions déjà ouvertes tiennent.
 */
import { Pool } from 'pg';
import type { SecretStore } from './session-secret';

/** Schéma de la table des secrets. */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS app_secrets (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

/**
 * Le magasin de secrets de ce serveur, ou null quand aucune base n'est configurée.
 * Le groupe de connexions est minuscule et refermé par `close` : il ne sert qu'au démarrage.
 */
export function postgresSecretStore(env: NodeJS.ProcessEnv = process.env): (SecretStore & { close(): Promise<void> }) | null {
  // Adresse de la base, si elle est configurée.
  const url = env.DATABASE_URL?.trim();
  // Pas de base : pas de magasin.
  if (!url) return null;
  // Un groupe d'une seule connexion, le temps du démarrage.
  const pool = new Pool({ connectionString: url, max: 1, ssl: url.includes('render.com') ? { rejectUnauthorized: false } : undefined });
  // Une panne de connexion est signalée par la promesse de la requête, pas par un événement qui tuerait le processus.
  pool.on('error', () => undefined);
  // Le schéma, créé une seule fois.
  let ready: Promise<void> | null = null;
  // db : attend la création du schéma, puis rend le groupe.
  const db = async (): Promise<Pool> => {
    // Première requête : lance la création.
    if (!ready) ready = pool.query(SCHEMA).then(() => undefined);
    // Attend la création.
    await ready;
    // Le groupe.
    return pool;
  // Fin de db.
  };
  // Le magasin.
  return {
    // read : le secret rangé sous ce nom, ou null.
    async read(name) {
      // La requête.
      const { rows } = await (await db()).query<{ value: string }>('SELECT value FROM app_secrets WHERE name = $1', [name]);
      // La valeur, ou null.
      return rows[0]?.value ?? null;
    // Fin de read.
    },
    // claim : range ce secret s'il n'y en a pas, et rend celui qui vaut.
    async claim(name, candidate) {
      // Le groupe.
      const p = await db();
      // L'insertion, qui ne fait rien si un secret est déjà là.
      await p.query('INSERT INTO app_secrets (name, value) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING', [name, candidate]);
      // Relecture : celui qui vaut désormais, le nôtre ou celui d'une autre instance.
      const { rows } = await p.query<{ value: string }>('SELECT value FROM app_secrets WHERE name = $1', [name]);
      // La valeur retenue ; à défaut, la nôtre.
      return rows[0]?.value ?? candidate;
    // Fin de claim.
    },
    // close : referme le groupe, le démarrage étant fini.
    async close() { await pool.end(); },
  // Fin du magasin.
  };
// Fin de postgresSecretStore.
}
