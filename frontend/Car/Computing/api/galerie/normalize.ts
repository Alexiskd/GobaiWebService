// Domaine galerie : normalise une ligne de base de données en média de la collection.
// Colonnes reconnues (par priorité) : title|titre|name, kind|type|mime, folder|dossier|album,
// url|file|fichier|image, thumb_url|thumb|thumbUrl|vignette, date|created_at.
// Déclare la table interrogée : GALERIE_TABLE (galerie_items par défaut), avec un identifiant de sécurité.
const TABLE = /^[a-z_][a-z0-9_]*$/i.test(process.env.GALERIE_TABLE || '') ? process.env.GALERIE_TABLE : 'galerie_items';

// Lit la première colonne reconnue d'une ligne.
const pick = (row: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  return undefined;
};

// Détecte une vidéo, par son type MIME, puis par l'extension de son adresse.
const kindOf = (mime: unknown, url: unknown): 'video' | 'image' => (/^(video|application\/octet-stream)/i.test(String(mime || '')) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(url)) ? 'video' : 'image');

// Un média normalisé, conforme au contrat attendu par Collection.jsx.
function itemOf(row: Record<string, unknown>) {
  const url = String(pick(row, ['url', 'file', 'fichier', 'image', 'src', 'link']) ?? '');
  const kind = kindOf(pick(row, ['mime', 'mime_type', 'content_type', 'type']), url);
  return {
    id: String(pick(row, ['id', 'uuid']) ?? url),
    kind,
    title: String(pick(row, ['title', 'titre', 'name', 'nom']) ?? 'Sans titre'),
    date: pick(row, ['created_at', 'date', 'shot_at', 'taken_at']) === undefined ? undefined : String(pick(row, ['created_at', 'date', 'shot_at', 'taken_at'])),
    url,
  };
}

// Un dossier, avec ses médias.
function folderOf(id: unknown, name: unknown, category: string, items: Array<ReturnType<typeof itemOf>>) {
  return { id: String(id), name: String(name), category, items };
}

export { TABLE, itemOf, folderOf };
