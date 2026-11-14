// Outils NestJS : erreur 502, erreur HTTP générique, Injectable (service injectable), Logger (journal), erreur 503.
import { BadGatewayException, HttpException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
// readFileSync : lit un fichier au démarrage ; join : assemble un chemin.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Liste des outils de l'assistant et fonction de vérification d'un appel d'outil.
import { ASSISTANT_TOOLS, toAction } from './assistant-tools';
// Type (effacé à la compilation) d'une action.
import type { AssistantAction } from './assistant-tools';

// Adresse de l'API Messages de Claude.
const API_URL = 'https://api.anthropic.com/v1/messages';
// Version de l'API, envoyée dans un en-tête.
const API_VERSION = '2023-06-01';
// Délai maximal d'un appel : 30 secondes.
const TIMEOUT_MS = 30_000;
/** Réponses courtes : la fenêtre est une aide à l'exploration, pas un rédacteur. */
// Longueur maximale d'une réponse : 500 tokens.
const MAX_OUTPUT_TOKENS = 500;
// Nombre de millisecondes dans un jour.
const DAY_MS = 86_400_000;

/** Refus lié au compte (crédit, facturation) : inutile de réessayer avec une requête plus simple. */
// Fonction isAccountProblem : le message d'erreur parle-t-il de crédit, de facturation ou de solde ?
const isAccountProblem = (message = ''): boolean => /credit|billing|balance/i.test(message);

/**
 * Erreur renvoyée au navigateur quand l'API Claude refuse : la cause est dite en clair (clé, crédit, modèle), pour
 * que le propriétaire du site sache quoi corriger dans Render ou dans la Claude Console. La clé n'y figure jamais.
 */
// Fonction apiFailure : traduit un refus de l'API en erreur lisible ; reçoit le code HTTP, le détail et le nom du modèle.
function apiFailure(status: number, detail: string, model: string): HttpException {
  // Code 401 ou 403 : clé refusée.
  if (status === 401 || status === 403) {
    // Erreur 502 qui dit de vérifier ANTHROPIC_API_KEY dans Render.
    return new BadGatewayException('Clé de l’API Claude refusée : vérifiez la variable ANTHROPIC_API_KEY dans Render (clé complète, sans espace ni guillemets).');
  // Fin du cas.
  }
  // Problème de compte :
  if (isAccountProblem(detail)) {
    // erreur 502 qui dit d'ajouter du crédit.
    return new BadGatewayException('Crédit de l’API Claude insuffisant : ajoutez du crédit dans la Claude Console (Billing).');
  // Fin du cas.
  }
  // Code 404 : modèle introuvable ; erreur 502 qui nomme le modèle et la variable ASSISTANT_MODEL.
  if (status === 404) return new BadGatewayException(`Modèle introuvable : « ${model} ». Vérifiez la variable ASSISTANT_MODEL.`);
  // Code 429 ou 529 : service surchargé ; erreur 503 qui invite à réessayer.
  if (status === 429 || status === 529) return new ServiceUnavailableException('L’assistant est très demandé : réessayez dans un instant.');
  // Détail ajouté au message s'il existe, coupé à 160 caractères.
  const reason = detail ? ` : ${detail.slice(0, 160)}` : '';
  // Tout autre cas : erreur 502 avec le code (ou « réseau ») et ce détail.
  return new BadGatewayException(`L’assistant n’a pas pu répondre (erreur ${status || 'réseau'}${reason}).`);
// Fin de apiFailure.
}

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

// Forme utile de la réponse de l'API.
interface AnthropicResponse {
  // content : les blocs de la réponse (texte, appel d'outil…), chacun avec son type et ses champs éventuels.
  content?: { type: string; text?: string; name?: unknown; input?: unknown }[];
  // error : le message d'erreur, en cas de refus.
  error?: { message?: string };
// Fin de AnthropicResponse.
}

/**
 * Assistant de la fenêtre « Claude » : relaie la conversation à l'API Claude (modèle Haiku, le plus petit) avec la clé
 * gardée sur le serveur (`ANTHROPIC_API_KEY`). Sans clé, l'assistant est fermé et la fenêtre reste en démonstration.
 * Garde-fous de coût : réponses plafonnées, réflexion coupée, et un nombre maximal de réponses par jour pour tout le
 * site (`ASSISTANT_DAILY_LIMIT`), en plus de la limite par visiteur posée sur la route.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de l'assistant.
export class AssistantService {
  // Journal préfixé par « Assistant ».
  private readonly log = new Logger('Assistant');
  // Début de la journée de comptage en cours : l'instant du démarrage.
  private dayStart = Date.now();
  // Nombre de réponses demandées depuis ce début.
  private dayCount = 0;

  // Constructeur ; ses paramètres :
  constructor(
    // la partie « assistant » de la configuration ;
    private readonly config: AppConfig['assistant'],
    // la fonction de téléchargement, par défaut le fetch de Node (remplaçable dans les tests).
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  // Corps du constructeur vide.
  ) {}

  // Méthode status : renvoie l'état de configuration.
  status(): { enabled: boolean; model: string } {
    // enabled : vrai si une clé est présente ; model : le nom du modèle.
    return { enabled: Boolean(this.config.anthropicApiKey), model: this.config.model };
  // Fin de status.
  }

  // Méthode reply, asynchrone : reçoit la conversation et l'inventaire de l'écran, renvoie le texte et les actions.
  async reply(messages: AssistantMessage[], elements: AssistantElement[] = []): Promise<{ reply: string; actions: AssistantAction[] }> {
    // Clé de l'API.
    const key = this.config.anthropicApiKey;
    // Sans clé : erreur 503, assistant non configuré.
    if (!key) throw new ServiceUnavailableException('L’assistant n’est pas configuré sur le serveur.');
    // Compte cette demande dans le plafond du jour (erreur 429 s'il est atteint).
    this.countRequest();

    // Du réglage le plus économe au plus simple : si l'API refuse la requête (400), on réessaie en retirant les réglages
    // facultatifs un par un, pour qu'un paramètre non accepté par le modèle ne ferme pas l'assistant.
    // Consigne envoyée : celle du fichier, suivie de l'inventaire de l'écran s'il y en a un.
    const system = SYSTEM_PROMPT + renderInventory(elements);
    // Requête de base : modèle, longueur maximale, consigne système, conversation.
    const base = { model: this.config.model, max_tokens: MAX_OUTPUT_TOKENS, system, messages };
    // Variantes de la requête, essayées dans l'ordre :
    const variants: Record<string, unknown>[] = [
      // Réponses directes : effort minimal et réflexion coupée (ses tokens sont facturés comme de la sortie).
      // `tools` = actions sur l'interface : le modèle les demande, le navigateur les exécute (voir assistant-tools.ts).
      // la plus économe : outils, effort minimal, réflexion coupée ;
      { ...base, tools: ASSISTANT_TOOLS, output_config: { effort: 'low' }, thinking: { type: 'disabled' } },
      // sans le réglage de réflexion ;
      { ...base, tools: ASSISTANT_TOOLS, output_config: { effort: 'low' } },
      // sans le réglage d'effort ;
      { ...base, tools: ASSISTANT_TOOLS },
      // la plus simple : la base seule, sans outils.
      base,
    // Fin des variantes.
    ];
    // Fonction call : envoie une requête à l'API, avec :
    const call = (body: Record<string, unknown>) => this.fetchFn(API_URL, {
      // la méthode POST ;
      method: 'POST',
      // un abandon au bout de 30 secondes ;
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // les en-têtes : JSON, clé, version de l'API ;
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': API_VERSION },
      // le corps, converti en texte JSON.
      body: JSON.stringify(body),
    // Fin de call.
    });

    // Dernière réponse HTTP reçue, null au départ.
    let res: Response | null = null;
    // Son contenu JSON, vide au départ.
    let json: AnthropicResponse = {};
    // Essaie :
    try {
      // pour chaque variante,
      for (let i = 0; i < variants.length; i++) {
        // d'envoyer la requête ;
        res = await call(variants[i]);
        // de lire le JSON de la réponse (objet vide s'il est illisible) ;
        json = await res.json().catch(() => ({})) as AnthropicResponse;
        // et d'arrêter là, sauf si l'API a répondu 400 sans que ce soit un problème de compte ;
        if (res.status !== 400 || isAccountProblem(json.error?.message)) break;
        // dans ce cas, note le refus dans le journal et passe à la variante suivante.
        this.log.warn(`API Claude : requête refusée (essai ${i + 1}/${variants.length}) : ${json.error?.message ?? 'sans message'}`);
      // Fin de la boucle.
      }
    // En cas d'échec réseau ou de délai dépassé :
    } catch (e) {
      // erreur 502, assistant injoignable.
      throw new BadGatewayException(`Assistant injoignable : ${(e as Error).message}`);
    // Fin du cas.
    }
    // Pas de réponse, ou réponse en erreur :
    if (!res || !res.ok) {
      // détail donné par l'API, s'il y en a un ;
      const detail = json.error?.message ?? '';
      // noté dans le journal ;
      this.log.warn(`API Claude : HTTP ${res?.status} ${detail}`);
      // et traduit en erreur lisible.
      throw apiFailure(res?.status ?? 0, detail, this.config.model);
    // Fin du cas.
    }
    // Le contenu peut commencer par d'autres blocs (réflexion) : on garde les blocs de texte, quel que soit leur rang.
    // Blocs de la réponse, liste vide s'il n'y en a pas.
    const blocks = json.content ?? [];
    // Texte : les blocs de type texte non vides, joints par un retour à la ligne, espaces retirés autour.
    const reply = blocks.filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n').trim();
    // Actions demandées (blocs « tool_use ») : six au plus par réponse, noms et valeurs filtrés.
    // Actions : parmi les blocs,
    const actions = blocks
      // ceux de type « tool_use »,
      .filter((b) => b.type === 'tool_use')
      // chacun vérifié et nettoyé,
      .map((b) => toAction(b.name, b.input))
      // les appels refusés (null) retirés,
      .filter((a): a is AssistantAction => a !== null)
      // six au plus.
      .slice(0, 6);
    // Ni texte ni action : erreur 502, réponse vide.
    if (!reply && !actions.length) throw new BadGatewayException('L’assistant a renvoyé une réponse vide.');
    // Renvoie le texte et les actions.
    return { reply, actions };
  // Fin de reply.
  }

  /** Plafond quotidien pour tout le site : au-delà, plus aucun appel payant jusqu'au lendemain. */
  // Méthode privée countRequest.
  private countRequest(): void {
    // Instant présent.
    const now = Date.now();
    // Si un jour entier s'est écoulé depuis le début du comptage : nouveau début, compteur à zéro.
    if (now - this.dayStart >= DAY_MS) { this.dayStart = now; this.dayCount = 0; }
    // Si le plafond du jour est atteint :
    if (this.dayCount >= this.config.dailyLimit) {
      // erreur 429.
      throw new HttpException('L’assistant a atteint sa limite de réponses pour aujourd’hui. Revenez demain.', 429);
    // Fin du cas.
    }
    // Compte cette demande.
    this.dayCount++;
  // Fin de countRequest.
  }
// Fin du service.
}
