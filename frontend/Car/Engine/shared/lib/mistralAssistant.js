/**
 * Client direct de l'API Mistral, appelé depuis le navigateur.
 *
 * Le composant Assistant relève l'inventaire des éléments actionnables de la page (domInventory) et l'envoie
 * au modèle avec la conversation : le modèle voit l'interface en direct et désigne les éléments par leur
 * identifiant de relevé. La clé d'API n'est jamais écrite dans le code ni dans le dépôt : le visiteur la
 * enregistre dans son navigateur (localStorage), et chaque appel la porte dans l'en-tête Authorization.
 *
 * Le modèle répond en JSON : { reply, actions }. Les actions sont revalidées par l'application contre sa
 * liste fermée ; une action inconnue est ignorée.
 */

/** Adresse de l'API de chat de Mistral. */
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

/** Modèle employé par défaut ; remplaçable par un autre via le réglage du navigateur. */
export const DEFAULT_MODEL = 'mistral-large-latest';

/** Clés d'enregistrement dans le localStorage du navigateur. */
const KEY_STORAGE = 'gobai.mistral.key';
const MODEL_STORAGE = 'gobai.mistral.model';

/** Température basse : les réponses d'action doivent rester déterministes. */
const TEMPERATURE = 0.2;
/** Longueur maximale d'une réponse, en jetons. */
const MAX_TOKENS = 1024;

/** Stockage local, ou null là où il est indisponible (test, navigation privée stricte). */
const STORAGE = globalThis.localStorage ?? null;

/** Lit une valeur du stockage, sans lever si le stockage est refusé. */
function readStorage(key) {
  try {
    return STORAGE?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Écrit une valeur dans le stockage, sans lever si le stockage est refusé. */
function writeStorage(key, value) {
  try {
    if (value) STORAGE?.setItem(key, value);
    else STORAGE?.removeItem(key);
  } catch {
    /* stockage refusé : le réglage ne dure pas, sans casser l'appel */
  }
}

/** Vrai si une clé d'API Mistral est enregistrée dans ce navigateur. */
export function isConnected() {
  return Boolean(readStorage(KEY_STORAGE));
}

/** La clé d'API enregistrée, ou null. */
export function getApiKey() {
  return readStorage(KEY_STORAGE);
}

/** Enregistre (ou retire, si vide) la clé d'API Mistral du visiteur. */
export function setApiKey(key) {
  writeStorage(KEY_STORAGE, key ? String(key).trim() : '');
}

/** Le modèle demandé, ou le modèle par défaut. */
export function getModel() {
  return readStorage(MODEL_STORAGE) || DEFAULT_MODEL;
}

/** Enregistre le modèle demandé (nom d'API Mistral, par exemple « mistral-large-latest »). */
export function setModel(model) {
  writeStorage(MODEL_STORAGE, model ? String(model).trim() : '');
}

/** Consigne système : rôle, format de réponse attendu, et usage de l'inventaire des éléments. */
const SYSTEM_PROMPT = [
  'Tu es l’assistant de Gobai Space, une simulation interactive du système solaire.',
  'Tu réponds toujours en français, de façon concise.',
  'Pour t’aider à agir sur l’interface, on te fournit la liste « elements » : les éléments actionnables',
  'actuellement à l’écran, chacun avec son identifiant (« id »), son libellé (« label »), son rôle et son état.',
  'Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :',
  '{"reply": "<ta réponse en français>", "actions": ["<actions demandées>"]}',
  'Pour cliquer un élément de l’interface, désigne-le par son identifiant de relevé :',
  '{"name": "agir_sur_un_element", "input": {"element": "<id de l’inventaire>"}}.',
  'Pour toute autre action (aller sur un astre, ouvrir une fenêtre, changer un réglage), nomme-la en français :',
  '{"name": "<verbe à l’infinitif>", "input": {"<paramètre>": "<valeur>"}} — l’application la valide contre sa',
  'liste fermée d’actions et ignore celles qu’elle ne connaît pas.',
  'Si tu n’as aucune action à faire, mets « actions » : [].',
].join('\n');

/**
 * Envoie la conversation et l'inventaire des éléments actionnables à l'API Mistral.
 *
 * `messages` : [{ role: 'user' | 'assistant', content }] — la conversation, sans la consigne système.
 * `elements` : [{ id, label, role, state? }] — le relevé de la page à l'instant de l'envoi.
 * Renvoie `{ reply, actions }`, ou lève une Error dont le message est affiché tel quel dans la conversation.
 */
export async function askMistral(messages, elements, signal) {
  // Sans clé enregistrée : rien n'est envoyé, la fenêtre reste en démonstration.
  const key = getApiKey();
  if (!key) throw new Error('Aucune clé d’API Mistral n’est enregistrée dans ce navigateur.');
  // L'appel : la consigne système porte l'inventaire, suivi de la conversation du visiteur.
  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: getModel(),
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\nInventaire des éléments actionnables : ${JSON.stringify(elements)}` },
        ...messages,
      ],
    }),
  });
  // Erreur HTTP : le détail renvoyé par l'API aide au diagnostic (clé refusée, modèle inconnu…).
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`L’API Mistral a répondu ${response.status}${detail ? ` : ${detail.slice(0, 200)}` : '.'}`);
  }
  // La réponse : le texte du premier choix, à interpréter comme du JSON d'actions.
  const data = await response.json();
  return parseReply(data?.choices?.[0]?.message?.content ?? '');
}

/** Extrait { reply, actions } de la réponse du modèle, en tolérant le texte autour du JSON. */
function parseReply(content) {
  // Le texte brut, sans espaces de bord.
  const text = String(content).trim();
  // Candidats JSON : un bloc ```json …```, sinon le premier objet { … } équilibré, sinon tout le texte.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [...(fenced ? [fenced[1]] : []), text];
  // Essaie chaque candidat : le premier objet valide gagne.
  for (const candidate of candidates) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) continue;
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1));
      if (parsed && typeof parsed === 'object') {
        return {
          reply: typeof parsed.reply === 'string' ? parsed.reply : '',
          actions: Array.isArray(parsed.actions) ? parsed.actions.filter((a) => a && typeof a === 'object') : [],
        };
      }
    } catch {
      /* ce candidat n'était pas du JSON : essaie le suivant */
    }
  }
  // Aucun JSON exploitable : tout le texte est la réponse, sans action.
  return { reply: text, actions: [] };
}
