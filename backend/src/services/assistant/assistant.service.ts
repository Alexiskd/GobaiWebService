// Outils NestJS : erreur HTTP générique et erreur 400.
import { BadRequestException, HttpException } from '@nestjs/common';
// readFileSync : lit un fichier au démarrage ; join : assemble un chemin.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Liste des outils de l'assistant et fonction de vérification d'un appel d'outil.
import { ASSISTANT_TOOLS, toAction } from './assistant-tools';
// Type (effacé à la compilation) d'une action.
import type { AssistantAction } from './assistant-tools';
// Interface commune des fournisseurs, et ses deux adaptateurs.
import { AssistantProvider, PROVIDER_IDS, ProviderError, ProviderId } from './providers/assistant-provider';
import { ClaudeProvider } from './providers/claude.provider';
import { MistralProvider } from './providers/mistral.provider';

/** Rôle fixé par le serveur : le visiteur ne peut pas le remplacer. */
/**
 * Fichier de la consigne système : backend/data/assistant/consigne.md, modifiable sans toucher au code. Le service
 * tourne compilé depuis dist/services/assistant : trois niveaux au-dessus se trouve la racine du backend.
 */
// Chemin du fichier de consigne.
const PROMPT_FILE = join(__dirname, '..', '..', '..', 'data', 'assistant', 'consigne.md');

// Consigne de secours, écrite phrase par phrase dans un tableau ; elle sert si le fichier md manque ou est illisible :
const FALLBACK_PROMPT = [
  // qui il est ;
  'Tu es l’assistant de Gobai Space, une application web qui affiche le système solaire en 3D et en direct.',
  // de quoi il parle ;
  'Tu réponds aux questions sur le système solaire, l’astronomie, l’exploration spatiale et l’utilisation de l’application.',
  // langue, longueur et forme des réponses ;
  'Réponds dans la langue de la question, en 120 mots au plus, en texte simple sans mise en forme Markdown.',
  // prudence sur les chiffres, et refus des sujets hors astronomie ;
  'Si tu n’es pas sûr d’un chiffre, dis-le. Pour toute demande hors de ces sujets, dis en une phrase que tu ne traites que l’astronomie et l’application.',
  // comment il agit sur l'interface : uniquement par les outils ;
  'Tu peux agir sur l’interface uniquement avec les outils fournis, et rien d’autre : aller sur un astre, ouvrir une fenêtre pour le visiteur, actionner n’importe quel interrupteur de la fenêtre Paramètres (repères, caméra, cartographie de la Terre, relief, LiDAR HD, réglages de l’appareil), afficher ou enlever des astres ou des familles entières, choisir le modèle LiDAR HD, aller au-dessus d’une ville de France, survoler un lieu nommé de la Terre ou de la Lune, régler la vitesse de rotation et zoomer.',
  // la règle sur les lieux : jamais de coordonnées inventées ;
  'Pour un lieu de la Terre ou de la Lune, donne seulement son nom : l’application possède ses coordonnées. N’invente jamais un nom de lieu ni une latitude ou une longitude ; un nom inconnu est simplement ignoré.',
  // la consigne d'agir plutôt que d'expliquer ;
  'Quand le visiteur demande une de ces actions, utilise l’outil au lieu d’expliquer comment faire, et dis en une courte phrase ce que tu fais. Tu tiens la place de la navigation : c’est à toi qu’on demande d’aller sur un astre.',
  // ce qu'il ne peut pas modifier.
  'Tu ne peux rien modifier d’autre : ni le contenu, ni le code, ni les données de l’application. Tu n’agis que sur l’interface, par ces outils.',
// Assemble les phrases en un seul texte, séparées par une espace.
].join(' ');

/**
 * Consigne système : le fichier md s'il est lisible, la consigne de secours sinon. Lue une seule fois, au démarrage :
 * un redéploiement suffit à reprendre en compte une modification du fichier.
 */
// Déclare et exporte loadSystemPrompt : lit la consigne, avec le chemin du fichier en paramètre pour les tests.
export function loadSystemPrompt(file: string = PROMPT_FILE): string {
  // Essai :
  try {
    // lit le fichier en UTF-8, sans ses espaces de début et de fin ;
    const text = readFileSync(file, 'utf8').trim();
    // s'il n'est pas vide, c'est la consigne ; sinon on prend le secours.
    return text || FALLBACK_PROMPT;
  // En cas d'échec (fichier absent, droits refusés) :
  } catch {
    // la consigne de secours.
    return FALLBACK_PROMPT;
  // Fin de l'essai.
  }
// Fin de loadSystemPrompt.
}

// La consigne retenue au démarrage.
const SYSTEM_PROMPT = loadSystemPrompt();

/** Forme d'un élément actionnable relevé par le navigateur : c'est ainsi que le modèle voit l'écran. */
// Forme d'un élément de l'inventaire.
export interface AssistantElement {
  // id : son identifiant dans ce relevé.
  id: string;
  // label : son libellé.
  label: string;
  // role : son rôle.
  role: string;
  // state : son état, s'il en a un.
  state?: string;
// Fin de AssistantElement.
}

/**
 * Met l'inventaire en texte, une ligne par élément, pour l'ajouter à la consigne. Le modèle y lit ce qui est à
 * l'écran et désigne ensuite un élément par son identifiant. Un inventaire vide n'ajoute rien à la consigne.
 */
// Déclare et exporte renderInventory : reçoit la liste des éléments.
export function renderInventory(elements: AssistantElement[] = []): string {
  // Liste vide : rien à ajouter.
  if (!elements.length) return '';
  // Une ligne par élément : son identifiant, son rôle, son libellé, et son état s'il en a un.
  const lines = elements.map((e) => `- ${e.id} · ${e.role} · ${e.label}${e.state ? ` · ${e.state}` : ''}`);
  // Le titre du bloc, précédé d'une ligne vide.
  const titre = '\n\n## Inventaire des éléments actionnables à l’écran\n\n';
  // Sa règle d'usage.
  const regle = 'Désigne un élément par son identifiant à l’outil « agir_sur_un_element ». Ce relevé ne vaut '
    + 'que pour ce message : un élément absent n’est pas à l’écran.\n\n';
  // Le bloc complet : le titre, la règle, puis les lignes.
  return `${titre}${regle}${lines.join('\n')}\n`;
// Fin de renderInventory.
}

// Forme d'un message de la conversation.
export interface AssistantMessage {
  // role : le visiteur ou l'assistant.
  role: 'user' | 'assistant';
  // content : le texte du message.
  content: string;
// Fin de AssistantMessage.
}

/** Longueur maximale d'une réponse : une aide à l'exploration, pas un rédacteur (la consigne demande 120 mots). */
const MAX_OUTPUT_TOKENS = 1024;
/** Forme d'une clé acceptée : un seul mot, sans espace, d'une longueur plausible. La clé n'est jamais renvoyée. */
const KEY_PATTERN = /^[\x21-\x7e]{16,300}$/;

/** Un fournisseur tel que le frontend l'affiche : nom, modèle, pages de clé et de paiement. */
export interface ProviderSummary { id: ProviderId; label: string; model: string; billingUrl: string; keysUrl: string }

/**
 * Assistant : chaque requête part chez le fournisseur choisi par l'utilisateur (Claude ou Mistral), avec SA clé,
 * reçue dans l'en-tête de la requête, jamais une clé du serveur. La clé n'est ni gardée, ni journalisée, ni
 * renvoyée. Les deux fournisseurs passent par la même interface (providers/assistant-provider.ts) : même consigne,
 * même inventaire de l'écran, mêmes outils, mêmes actions — l'assistant se comporte pareil avec l'un et l'autre.
 *
 * Les refus du fournisseur sont traduits en erreurs que le navigateur sait traiter :
 *  - 401 `invalid_key` : clé fausse ou révoquée → retour à l'écran de connexion ;
 *  - 402 `billing` + `billingUrl` : pas de moyen de paiement ou plus de crédit → page de paiement du fournisseur ;
 *  - 429 `rate_limited` : réessayer dans un instant ;
 *  - 502 `model_unavailable` / `unavailable` : modèle non ouvert au compte, panne du fournisseur.
 */
export class AssistantService {
  private readonly providers: Record<ProviderId, AssistantProvider>;

  constructor(config: AppConfig['assistant'], fetchFn: typeof fetch = (...a) => fetch(...a)) {
    this.providers = {
      claude: new ClaudeProvider(config.claudeModels, fetchFn),
      mistral: new MistralProvider(config.mistralModels, fetchFn),
    };
  }

  /** Les fournisseurs proposés, avec leur modèle principal (le plus performant) et leurs pages. */
  catalog(): { providers: ProviderSummary[] } {
    return {
      providers: PROVIDER_IDS.map((id) => {
        const { label, models, billingUrl, keysUrl } = this.providers[id].info;
        return { id, label, model: models[0], billingUrl, keysUrl };
      }),
    };
  }

  /** Appel de test : la clé est-elle valide, et le compte peut-il payer ? */
  async verify(providerId: string, key: string): Promise<{ provider: ProviderId; label: string; model: string }> {
    const provider = this.providerOf(providerId);
    const clean = this.keyOf(key);
    try {
      const { model } = await provider.verify(clean);
      return { provider: provider.info.id, label: provider.info.label, model };
    } catch (e) {
      throw this.toHttp(e, provider);
    }
  }

  /** Une réponse de l'assistant : texte et actions sur l'interface. */
  async reply(providerId: string, key: string, messages: AssistantMessage[], elements: AssistantElement[] = []):
    Promise<{ reply: string; actions: AssistantAction[]; provider: ProviderId; model: string }> {
    const provider = this.providerOf(providerId);
    const clean = this.keyOf(key);
    let result;
    try {
      result = await provider.chat(clean, {
        system: SYSTEM_PROMPT + renderInventory(elements),
        messages,
        tools: ASSISTANT_TOOLS,
        maxTokens: MAX_OUTPUT_TOKENS,
      });
    } catch (e) {
      throw this.toHttp(e, provider);
    }
    // Actions : outils connus seulement, valeurs simples, six au plus par réponse.
    const actions = result.toolCalls
      .map((c) => toAction(c.name, c.input))
      .filter((a): a is AssistantAction => a !== null)
      .slice(0, 6);
    if (!result.text && !actions.length) {
      throw new HttpException({ statusCode: 502, error: 'Bad Gateway', code: 'unavailable', provider: provider.info.id, message: 'L’assistant a renvoyé une réponse vide.' }, 502);
    }
    return { reply: result.text, actions, provider: provider.info.id, model: result.model };
  }

  private providerOf(id: string): AssistantProvider {
    if (!(PROVIDER_IDS as readonly string[]).includes(id)) throw new BadRequestException('Fournisseur inconnu : « claude » ou « mistral » attendu.');
    return this.providers[id as ProviderId];
  }

  /** Clé reçue, nettoyée ; une clé mal formée est refusée sans jamais être recopiée dans le message. */
  private keyOf(key: string): string {
    const clean = String(key ?? '').trim();
    if (!KEY_PATTERN.test(clean)) {
      throw new HttpException({ statusCode: 401, error: 'Unauthorized', code: 'invalid_key', message: 'Clé d’API absente ou mal formée : collez la clé complète, sans espace.' }, 401);
    }
    return clean;
  }

  /** Refus du fournisseur → erreur HTTP que le navigateur sait traiter. */
  private toHttp(e: unknown, provider: AssistantProvider): HttpException {
    const { id, label, models, billingUrl } = provider.info;
    if (!(e instanceof ProviderError)) {
      return new HttpException({ statusCode: 502, error: 'Bad Gateway', code: 'unavailable', provider: id, message: `${label} n’a pas pu répondre.` }, 502);
    }
    switch (e.kind) {
      case 'invalid_key':
        return new HttpException({ statusCode: 401, error: 'Unauthorized', code: 'invalid_key', provider: id,
          message: `Clé ${label} refusée : elle est invalide, révoquée ou expirée. Connectez-vous avec une clé valide.` }, 401);
      case 'billing':
        return new HttpException({ statusCode: 402, error: 'Payment Required', code: 'billing', provider: id, billingUrl,
          message: `Votre compte ${label} n’a pas de moyen de paiement ou n’a plus de crédit. Ajoutez un moyen de paiement chez ${label} pour utiliser l’assistant.` }, 402);
      case 'rate_limited':
        return new HttpException({ statusCode: 429, error: 'Too Many Requests', code: 'rate_limited', provider: id,
          message: `${label} reçoit trop de demandes pour votre compte : réessayez dans un instant.` }, 429);
      case 'model_unavailable':
        return new HttpException({ statusCode: 502, error: 'Bad Gateway', code: 'model_unavailable', provider: id,
          message: `Votre compte ${label} n’a accès à aucun des modèles de l’assistant (${models.join(', ')}).` }, 502);
      default:
        return new HttpException({ statusCode: 502, error: 'Bad Gateway', code: 'unavailable', provider: id,
          message: `${label} n’a pas pu répondre${e.status ? ` (erreur ${e.status})` : ''}. Réessayez dans un instant.` }, 502);
    }
  }
}
