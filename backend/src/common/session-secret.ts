/**
 * Secret de signature des sessions et des clés d'API : résolu une fois au démarrage, jamais écrit dans le dépôt.
 *
 * Ce secret signe deux choses : les sessions des comptes, et les clés d'API vendues dans la boutique. Qui le
 * connaît peut donc fabriquer une clé valable sans payer — c'est pourquoi il n'a sa place ni dans le code, ni
 * dans un fichier versionné, ni dans cette conversation.
 *
 * Trois sources, dans cet ordre :
 *
 *   1. la variable d'environnement `SESSION_SECRET`, si elle est posée — elle gagne toujours, ce qui permet de
 *      la faire tourner depuis le tableau de bord sans toucher au code ;
 *   2. sinon, un secret gardé **dans la base de données** : au premier démarrage le serveur en tire un au
 *      hasard et l'y range ; aux démarrages suivants il le relit. Personne ne le manipule, il ne quitte jamais
 *      le serveur et sa base, et il survit aux redéploiements — ce qui est exactement ce qu'on attend de lui ;
 *   3. sinon, un secret tiré au hasard pour la durée du processus, comme avant : les sessions ne survivent alors
 *      pas au redémarrage, et le journal le dit.
 *
 * Le secret résolu est reposé dans `process.env.SESSION_SECRET`, pour que tous les lecteurs existants
 * (jwt.guard, contributions.service) le trouvent là où ils le cherchent déjà, sans rien changer chez eux.
 */
import { randomBytes } from 'node:crypto';

/** Nom du secret dans la table des secrets. */
export const SESSION_SECRET_NAME = 'session';

/** Longueur du secret tiré au hasard, en octets : 48 octets font 64 caractères en base64url. */
export const SECRET_BYTES = 48;

/** Un secret neuf, imprévisible. */
export const newSecret = (): string => randomBytes(SECRET_BYTES).toString('base64url');

/** D'où vient le secret retenu : utile au journal, et au diagnostic de la boutique. */
export type SecretSource = 'environnement' | 'base' | 'éphémère';

/** Le magasin durable des secrets : la base de données, ou une doublure dans les tests. */
export interface SecretStore {
  /** Le secret rangé sous ce nom, ou null s'il n'y en a pas encore. */
  read(name: string): Promise<string | null>;
  /**
   * Range ce secret sous ce nom **sans écraser** celui qui s'y trouverait déjà, et renvoie celui qui vaut
   * désormais. Deux instances qui démarrent en même temps obtiennent ainsi le même.
   */
  claim(name: string, candidate: string): Promise<string>;
}

/** Le secret retenu, et d'où il vient. */
export interface ResolvedSecret { secret: string; source: SecretSource }

/**
 * Résout le secret selon les trois sources ci-dessus.
 * `store` est null quand aucune base n'est configurée ; une panne de la base n'empêche pas le démarrage,
 * elle fait simplement retomber sur le secret éphémère.
 */
export async function resolveSessionSecret(
  env: NodeJS.ProcessEnv,
  store: SecretStore | null,
): Promise<ResolvedSecret> {
  // La variable d'environnement, espaces retirés.
  const configured = env.SESSION_SECRET?.trim();
  // Posée : elle gagne, sans toucher à la base.
  if (configured) return { secret: configured, source: 'environnement' };
  // Avec une base : on relit le secret rangé, ou on en range un neuf.
  if (store) {
    // Essaie la base.
    try {
      // Le secret déjà rangé.
      const stored = await store.read(SESSION_SECRET_NAME);
      // Trouvé : c'est lui.
      if (stored) return { secret: stored, source: 'base' };
      // Absent : on en propose un neuf, et c'est la base qui dit lequel vaut.
      return { secret: await store.claim(SESSION_SECRET_NAME, newSecret()), source: 'base' };
    // Base injoignable : on ne bloque pas le démarrage pour autant.
    } catch {
      // On retombe sur le secret éphémère ci-dessous.
    // Fin de l'essai.
    }
  // Fin du cas avec base.
  }
  // Sans base utilisable : un secret pour la durée du processus.
  return { secret: newSecret(), source: 'éphémère' };
// Fin de resolveSessionSecret.
}
